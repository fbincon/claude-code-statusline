"""platforms / files implementation."""

from __future__ import annotations

import errno
import os
import stat
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from claude_statusline.platforms import environment as platform_environment


_WINDOWS_TRANSIENT_ERRORS = frozenset({5, 32, 33})


_WINDOWS_RETRY_DELAYS = (0.01, 0.02, 0.04, 0.08, 0.16)


_THREAD_LOCKS_GUARD = threading.Lock()


_THREAD_LOCKS: dict[str, tuple[threading.Lock, int]] = {}


def _set_private_mode(descriptor: int, mode: int) -> None:
    if platform_environment.uses_posix_files():
        os.fchmod(descriptor, mode)


def _sync_parent_directory(path: Path) -> bool | None:
    """Sync directory metadata; False records an unsupported macOS filesystem."""
    if not platform_environment.uses_posix_files():
        return None
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        try:
            os.fsync(descriptor)
        except OSError as exc:
            if platform_environment.is_macos() and exc.errno in (
                errno.EINVAL,
                errno.ENOTSUP,
                errno.EOPNOTSUPP,
            ):
                return False
            raise
        return True
    finally:
        os.close(descriptor)


def _is_transient_windows_error(exc: OSError) -> bool:
    if not platform_environment.is_windows():
        return False
    winerror = getattr(exc, "winerror", None)
    return winerror in _WINDOWS_TRANSIENT_ERRORS or (
        winerror is None and exc.errno in (errno.EACCES, errno.EPERM)
    )


def _retry_windows_file_operation(operation) -> None:
    for delay in (*_WINDOWS_RETRY_DELAYS, None):
        try:
            operation()
            return
        except OSError as exc:
            if delay is None or not _is_transient_windows_error(exc):
                raise
            time.sleep(delay)


def _acquire_thread_lock(path: Path) -> tuple[str, threading.Lock]:
    key = os.path.normcase(os.path.abspath(os.fspath(path)))
    with _THREAD_LOCKS_GUARD:
        current = _THREAD_LOCKS.get(key)
        if current is None:
            lock = threading.Lock()
            _THREAD_LOCKS[key] = (lock, 1)
        else:
            lock, references = current
            _THREAD_LOCKS[key] = (lock, references + 1)
    try:
        lock.acquire()
    except BaseException:
        with _THREAD_LOCKS_GUARD:
            current_lock, references = _THREAD_LOCKS[key]
            if references == 1:
                _THREAD_LOCKS.pop(key, None)
            else:
                _THREAD_LOCKS[key] = (current_lock, references - 1)
        raise
    return key, lock


def _release_thread_lock(key: str, lock: threading.Lock) -> None:
    lock.release()
    with _THREAD_LOCKS_GUARD:
        current_lock, references = _THREAD_LOCKS[key]
        if references == 1:
            _THREAD_LOCKS.pop(key, None)
        else:
            _THREAD_LOCKS[key] = (current_lock, references - 1)


@contextmanager
def exclusive_file_lock(
    path: str | os.PathLike[str],
    mode: int = 0o600,
) -> Iterator[int]:
    """Hold an exclusive advisory lock on one fixed byte of *path*.

    Linux and macOS use ``flock``. Windows uses the CRT byte-range lock so
    independent Python processes coordinate without importing POSIX-only modules.
    """
    lock_path = Path(path)
    lock_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_BINARY", 0)
    thread_key, thread_lock = _acquire_thread_lock(lock_path)
    descriptor: int | None = None
    locked = False
    windows_lock = False
    try:
        descriptor = os.open(lock_path, flags, mode)
        _set_private_mode(descriptor, mode)
        if platform_environment.is_windows():
            import msvcrt

            # CRT locks may extend beyond EOF. Initializing an empty file here
            # races with a competing process that already locked the first byte.
            os.lseek(descriptor, 0, os.SEEK_SET)
            msvcrt.locking(descriptor, msvcrt.LK_LOCK, 1)
            windows_lock = True
        elif platform_environment.uses_posix_files():
            import fcntl

            fcntl.flock(descriptor, fcntl.LOCK_EX)
        else:
            raise OSError(f"unsupported platform: {sys.platform}")
        locked = True
        yield descriptor
    finally:
        if locked:
            try:
                if windows_lock:
                    import msvcrt

                    os.lseek(descriptor, 0, os.SEEK_SET)
                    msvcrt.locking(descriptor, msvcrt.LK_UNLCK, 1)
                elif platform_environment.uses_posix_files():
                    import fcntl

                    fcntl.flock(descriptor, fcntl.LOCK_UN)
            except OSError:
                # Closing the descriptor also releases either lock. Never hide
                # the caller's exception with a best-effort explicit unlock.
                pass
        try:
            if descriptor is not None:
                os.close(descriptor)
        finally:
            _release_thread_lock(thread_key, thread_lock)


def atomic_write_bytes(
    path: str | os.PathLike[str],
    content: bytes,
    mode: int = 0o600,
) -> None:
    """Durably publish bytes without exposing a partially written target."""
    target = Path(path)
    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{target.name}.claude-statusline-",
        suffix=".tmp",
        dir=target.parent,
    )
    temporary_path: Path | None = Path(temporary)
    descriptor_open = True
    try:
        _set_private_mode(descriptor, mode)
        with os.fdopen(descriptor, "wb") as stream:
            descriptor_open = False
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        _retry_windows_file_operation(lambda: os.replace(temporary_path, target))
        temporary_path = None
        _sync_parent_directory(target)
    finally:
        if descriptor_open:
            try:
                os.close(descriptor)
            except OSError:
                pass
        if temporary_path is not None:
            try:
                _retry_windows_file_operation(temporary_path.unlink)
            except FileNotFoundError:
                pass
            except OSError:
                # Preserve the publication exception. The temp name contains
                # no user data in its name and will never replace the target.
                pass


def durable_unlink(path: str | os.PathLike[str]) -> bool:
    """Remove one file, retrying transient Windows sharing violations."""
    target = Path(path)
    try:
        _retry_windows_file_operation(target.unlink)
    except FileNotFoundError:
        return False
    _sync_parent_directory(target)
    return True


def private_mode_matches(path: str | os.PathLike[str], mode: int) -> bool | None:
    """Check a POSIX private mode, or report that the check is not applicable."""
    if platform_environment.is_windows():
        return None
    try:
        return stat.S_IMODE(Path(path).stat().st_mode) == mode
    except OSError:
        return False


def is_link_or_reparse(path: str | os.PathLike[str]) -> bool:
    """Reject symlinks and, on Windows, every kind of reparse point."""
    try:
        metadata = Path(path).lstat()
    except OSError:
        return False
    if stat.S_ISLNK(metadata.st_mode):
        return True
    if not platform_environment.is_windows():
        return False
    attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return bool(attributes & reparse_flag)
