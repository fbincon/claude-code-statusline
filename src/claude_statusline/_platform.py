"""Small, centralized operating-system adapters used by claude-statusline.

The renderer and hooks import this module on every invocation, so all platform
specific modules are imported lazily and every helper keeps a dependency-free
fallback where one is safe.
"""

from __future__ import annotations

import errno
import os
import stat
import subprocess
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


_WINDOWS_TRANSIENT_ERRORS = frozenset({5, 32, 33})
_WINDOWS_RETRY_DELAYS = (0.01, 0.02, 0.04, 0.08, 0.16)
_DOTNET_FILETIME_OFFSET_TICKS = 504_911_232_000_000_000
_MINUTE_NS = 60 * 1_000_000_000
_THREAD_LOCKS_GUARD = threading.Lock()
_THREAD_LOCKS: dict[str, tuple[threading.Lock, int]] = {}


def is_windows(platform_name: str | None = None) -> bool:
    return (sys.platform if platform_name is None else platform_name) == "win32"


def is_linux(platform_name: str | None = None) -> bool:
    return (sys.platform if platform_name is None else platform_name).startswith(
        "linux"
    )


def is_supported_platform(platform_name: str | None = None) -> bool:
    """Return whether the native runtime is part of the supported contract."""
    return is_linux(platform_name) or is_windows(platform_name)


def no_window_creation_flags() -> int:
    """Hide short-lived subprocess consoles on native Windows."""
    if not is_windows():
        return 0
    return int(getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000))


def new_console_creation_flags() -> int:
    """Return the Win32 flag used by the slash-command TUI launcher."""
    if not is_windows():
        return 0
    return int(getattr(subprocess, "CREATE_NEW_CONSOLE", 0x00000010))


def _set_private_mode(descriptor: int, mode: int) -> None:
    if is_linux():
        os.fchmod(descriptor, mode)


def _sync_parent_directory(path: Path) -> None:
    if not is_linux():
        return
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _is_transient_windows_error(exc: OSError) -> bool:
    if not is_windows():
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

    Linux uses ``flock``. Windows uses the CRT byte-range lock so independent
    Python processes coordinate without importing POSIX-only modules.
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
        if is_windows():
            import msvcrt

            if os.fstat(descriptor).st_size < 1:
                os.lseek(descriptor, 0, os.SEEK_SET)
                os.write(descriptor, b"\0")
                os.fsync(descriptor)
            os.lseek(descriptor, 0, os.SEEK_SET)
            msvcrt.locking(descriptor, msvcrt.LK_LOCK, 1)
            windows_lock = True
        elif is_linux():
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
                elif is_linux():
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
        _retry_windows_file_operation(
            lambda: os.replace(temporary_path, target)
        )
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


def private_mode_matches(
    path: str | os.PathLike[str], mode: int
) -> bool | None:
    """Check a POSIX private mode, or report that the check is not applicable."""
    if is_windows():
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
    if not is_windows():
        return False
    attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return bool(attributes & reparse_flag)


def _linux_process_start_token(pid: int) -> str | None:
    try:
        with open(f"/proc/{pid}/stat", "r", encoding="utf-8") as stream:
            value = stream.read()
        # comm (field 2) is parenthesized and may itself contain spaces.
        close = value.rfind(")")
        fields = value[close + 2 :].split() if close >= 0 else []
        return fields[19] if len(fields) > 19 else None
    except (OSError, ValueError):
        return None


def _windows_process_creation_filetime(pid: int) -> int | None:
    try:
        import ctypes
        from ctypes import wintypes

        class SystemTime(ctypes.Structure):
            _fields_ = (
                ("year", wintypes.WORD),
                ("month", wintypes.WORD),
                ("day_of_week", wintypes.WORD),
                ("day", wintypes.WORD),
                ("hour", wintypes.WORD),
                ("minute", wintypes.WORD),
                ("second", wintypes.WORD),
                ("milliseconds", wintypes.WORD),
            )

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        open_process = kernel32.OpenProcess
        open_process.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        open_process.restype = wintypes.HANDLE
        get_process_times = kernel32.GetProcessTimes
        get_process_times.argtypes = (
            wintypes.HANDLE,
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(wintypes.FILETIME),
        )
        get_process_times.restype = wintypes.BOOL
        filetime_to_system = kernel32.FileTimeToSystemTime
        filetime_to_system.argtypes = (
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(SystemTime),
        )
        filetime_to_system.restype = wintypes.BOOL
        system_to_local = kernel32.SystemTimeToTzSpecificLocalTimeEx
        system_to_local.argtypes = (
            ctypes.c_void_p,
            ctypes.POINTER(SystemTime),
            ctypes.POINTER(SystemTime),
        )
        system_to_local.restype = wintypes.BOOL
        system_to_filetime = kernel32.SystemTimeToFileTime
        system_to_filetime.argtypes = (
            ctypes.POINTER(SystemTime),
            ctypes.POINTER(wintypes.FILETIME),
        )
        system_to_filetime.restype = wintypes.BOOL
        close_handle = kernel32.CloseHandle
        close_handle.argtypes = (wintypes.HANDLE,)
        close_handle.restype = wintypes.BOOL

        handle = open_process(0x1000, False, int(pid))
        if not handle:
            return None
        try:
            creation = wintypes.FILETIME()
            exit_time = wintypes.FILETIME()
            kernel_time = wintypes.FILETIME()
            user_time = wintypes.FILETIME()
            if not get_process_times(
                handle,
                ctypes.byref(creation),
                ctypes.byref(exit_time),
                ctypes.byref(kernel_time),
                ctypes.byref(user_time),
            ):
                return None
            utc_system = SystemTime()
            local_system = SystemTime()
            local_creation = wintypes.FILETIME()
            if not filetime_to_system(
                ctypes.byref(creation), ctypes.byref(utc_system)
            ):
                return None
            if not system_to_local(
                None, ctypes.byref(utc_system), ctypes.byref(local_system)
            ):
                return None
            if not system_to_filetime(
                ctypes.byref(local_system), ctypes.byref(local_creation)
            ):
                return None
            value = (int(local_creation.dwHighDateTime) << 32) | int(
                local_creation.dwLowDateTime
            )
            utc_value = (int(creation.dwHighDateTime) << 32) | int(
                creation.dwLowDateTime
            )
            value += utc_value % 10_000
            # Win32_Process.CreationDate, which Claude serializes via .Ticks,
            # has microsecond precision even though FILETIME carries 100 ns.
            return value - (value % 10)
        finally:
            close_handle(handle)
    except (AttributeError, OSError, TypeError, ValueError):
        return None


def process_start_token(pid: object) -> str | None:
    """Return the token Claude records to distinguish a PID from its reuse."""
    if isinstance(pid, bool) or not isinstance(pid, int) or pid <= 0:
        return None
    if is_linux():
        return _linux_process_start_token(pid)
    if is_windows():
        value = _windows_process_creation_filetime(pid)
        if value is None:
            return None
        # Claude obtains ``CreationDate.Ticks`` on Windows. Win32 FILETIME uses
        # the same 100 ns unit but starts at 1601 instead of .NET's year 1.
        return str(value + _DOTNET_FILETIME_OFFSET_TICKS)
    return None


def _linux_boot_id() -> str | None:
    try:
        with open(
            "/proc/sys/kernel/random/boot_id", "r", encoding="ascii"
        ) as stream:
            value = stream.read().strip()
        return value or None
    except OSError:
        return None


def _windows_uptime_ns() -> int:
    import ctypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    get_tick_count = kernel32.GetTickCount64
    get_tick_count.argtypes = ()
    get_tick_count.restype = ctypes.c_ulonglong
    return int(get_tick_count()) * 1_000_000


def now_clocks() -> tuple[int, int | None, str | None]:
    """Return wall time, suspend-aware boot time, and a reboot identifier."""
    wall_ns = time.time_ns()
    if is_windows():
        try:
            boot_ns = _windows_uptime_ns()
        except (AttributeError, OSError, TypeError, ValueError):
            return wall_ns, None, None
        if boot_ns < 0 or boot_ns > wall_ns:
            return wall_ns, None, None
        boot_minute = (wall_ns - boot_ns) // _MINUTE_NS
        return wall_ns, boot_ns, f"windows:{boot_minute}"

    if is_linux():
        boot_ns = None
        clock = getattr(time, "CLOCK_BOOTTIME", None)
        if clock is not None:
            try:
                boot_ns = time.clock_gettime_ns(clock)
            except (OSError, ValueError):
                pass
        return wall_ns, boot_ns, _linux_boot_id()
    return wall_ns, None, None
