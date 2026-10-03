"""integration / bridge implementation."""

from __future__ import annotations

import json
import os
import re
import stat
import time
from pathlib import Path
import tempfile
from claude_statusline.config import models as config_models
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.ui import models as ui_models


_BRIDGE_RESULT_ENV = "CLAUDE_STATUSLINE_SLASH_RESULT"


_BRIDGE_DEADLINE_ENV = "CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS"


_BRIDGE_RESULT_NAME = "result.json"


_BRIDGE_INVOCATION_PATTERN = re.compile(r"invocation-[A-Za-z0-9_.-]+\Z")


def _validated_bridge_path(config_dir: Path, raw: str) -> Path:
    if not raw or "\x00" in raw:
        raise config_models.ConfigCommandError("invalid slash TUI result path")
    path = Path(raw)
    absolute = Path(os.path.abspath(path))
    if not path.is_absolute() or path != absolute or path.name != _BRIDGE_RESULT_NAME:
        raise config_models.ConfigCommandError("invalid slash TUI result path")
    expected_base = config_dir / "statusline_runtime" / "slash_tui"
    if path.parent.parent != expected_base or not _BRIDGE_INVOCATION_PATTERN.fullmatch(
        path.parent.name
    ):
        raise config_models.ConfigCommandError("invalid slash TUI result path")
    for directory in (
        config_dir,
        expected_base.parent,
        expected_base,
        path.parent,
    ):
        try:
            metadata = directory.lstat()
        except OSError as exc:
            raise config_models.ConfigCommandError(
                f"invalid slash TUI result directory: {exc}"
            ) from exc
        if not stat.S_ISDIR(metadata.st_mode) or platform_files.is_link_or_reparse(
            directory
        ):
            raise config_models.ConfigCommandError("invalid slash TUI result directory")
    if platform_files.private_mode_matches(path.parent, 0o700) is False:
        raise config_models.ConfigCommandError(
            "slash TUI result directory is not private"
        )
    return path


def _bridge_deadline(environ: dict[str, str]) -> float:
    raw = environ.get(_BRIDGE_DEADLINE_ENV, "")
    try:
        seconds = float(raw)
    except (TypeError, ValueError) as exc:
        raise config_models.ConfigCommandError("invalid slash TUI deadline") from exc
    if not 0 < seconds <= 570:
        raise config_models.ConfigCommandError("invalid slash TUI deadline")
    return time.monotonic() + seconds


def _write_bridge_result(path: Path, outcome: ui_models.ConfigureOutcome) -> None:
    value = {
        "schema_version": 1,
        "outcome": outcome.outcome,
        "exit_code": outcome.exit_code,
        "message": outcome.message,
    }
    content = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    platform_files.atomic_write_bytes(path, content, 0o600)


def _tree_without_symlinks(root: Path) -> tuple[list[Path], list[Path]] | None:
    files: list[Path] = []
    directories: list[Path] = []
    try:
        with os.scandir(root) as entries:
            for entry in entries:
                path = Path(entry.path)
                if entry.is_symlink() or platform_files.is_link_or_reparse(path):
                    return None
                entry_stat = entry.stat(follow_symlinks=False)
                if stat.S_ISREG(entry_stat.st_mode):
                    files.append(path)
                elif stat.S_ISDIR(entry_stat.st_mode):
                    nested = _tree_without_symlinks(path)
                    if nested is None:
                        return None
                    nested_files, nested_directories = nested
                    files.extend(nested_files)
                    directories.extend(nested_directories)
                    directories.append(path)
                else:
                    return None
    except OSError:
        return None
    return files, directories


def _remove_stale_directory(path: Path) -> bool:
    contents = _tree_without_symlinks(path)
    if contents is None:
        return False
    files, directories = contents
    try:
        for child in files:
            platform_files.durable_unlink(child)
        for child in directories:
            child.rmdir()
        path.rmdir()
    except OSError:
        return False
    return True


def cleanup_stale_invocations(base: Path, *, now: float | None = None) -> None:
    cutoff = (
        time.time() if now is None else now
    ) - integration_models.STALE_AFTER_SECONDS
    try:
        entries = list(os.scandir(base))
    except (FileNotFoundError, NotADirectoryError, PermissionError):
        return
    for entry in entries:
        if (
            not integration_models._INVOCATION_PATTERN.fullmatch(entry.name)
            or entry.is_symlink()
            or platform_files.is_link_or_reparse(entry.path)
        ):
            continue
        try:
            entry_stat = entry.stat(follow_symlinks=False)
        except OSError:
            continue
        if not stat.S_ISDIR(entry_stat.st_mode) or entry_stat.st_mtime >= cutoff:
            continue
        _remove_stale_directory(Path(entry.path))


def _create_invocation_dir(config_dir: Path) -> tuple[Path, Path]:
    base = config_dir / "statusline_runtime" / "slash_tui"
    try:
        if (
            platform_files.is_link_or_reparse(config_dir)
            or platform_files.is_link_or_reparse(base.parent)
            or platform_files.is_link_or_reparse(base)
        ):
            raise OSError("runtime path is a symbolic link")
        base.mkdir(mode=0o700, parents=True, exist_ok=True)
        if not base.is_dir():
            raise OSError("runtime path is not a directory")
        if platform_environment.uses_posix_files():
            base.chmod(0o700)
        cleanup_stale_invocations(base)
        invocation = Path(
            tempfile.mkdtemp(prefix=integration_models.INVOCATION_PREFIX, dir=base)
        )
        if platform_environment.uses_posix_files():
            invocation.chmod(0o700)
    except OSError as exc:
        raise integration_models.ResultError(
            f"cannot create the private result directory: {exc}"
        ) from exc
    return invocation, invocation / integration_models.RESULT_FILENAME


def _read_capture(stream) -> bytes:
    stream.seek(0)
    return stream.read(4096)


def _decode_result(raw: bytes) -> integration_models.TuiResult:
    def strict_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate field: {key}")
            value[key] = item
        return value

    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=strict_object)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise integration_models.ResultError(f"invalid result JSON: {exc}") from exc
    expected = {"schema_version", "outcome", "exit_code", "message"}
    if not isinstance(value, dict) or set(value) != expected:
        raise integration_models.ResultError("result has an invalid schema")
    schema_version = value["schema_version"]
    outcome = value["outcome"]
    exit_code = value["exit_code"]
    message = value["message"]
    if (
        not isinstance(schema_version, int)
        or isinstance(schema_version, bool)
        or schema_version != integration_models.RESULT_SCHEMA_VERSION
    ):
        raise integration_models.ResultError("result has an unsupported schema version")
    if (
        not isinstance(outcome, str)
        or outcome not in integration_models.ALLOWED_OUTCOMES
    ):
        raise integration_models.ResultError("result has an unknown outcome")
    if (
        not isinstance(exit_code, int)
        or isinstance(exit_code, bool)
        or not 0 <= exit_code <= 255
    ):
        raise integration_models.ResultError("result has an invalid exit code")
    if (
        not isinstance(message, str)
        or not message
        or "\x00" in message
        or "\n" in message
        or "\r" in message
    ):
        raise integration_models.ResultError("result has an invalid message")
    return integration_models.TuiResult(schema_version, outcome, exit_code, message)


def _read_invocation_file(
    result_path: Path,
    invocation_dir: Path,
    filename: str,
) -> bytes:
    if (
        result_path.parent != invocation_dir
        or result_path.name != filename
        or not integration_models._INVOCATION_PATTERN.fullmatch(invocation_dir.name)
    ):
        raise integration_models.ResultError("result path is outside this invocation")
    for directory in (
        invocation_dir.parent.parent.parent,
        invocation_dir.parent.parent,
        invocation_dir.parent,
        invocation_dir,
    ):
        try:
            directory_metadata = directory.lstat()
        except OSError as exc:
            raise integration_models.ResultError(
                f"cannot inspect the private result directory: {exc}"
            ) from exc
        if not stat.S_ISDIR(
            directory_metadata.st_mode
        ) or platform_files.is_link_or_reparse(directory):
            raise integration_models.ResultError(
                "the private result directory is invalid"
            )
    if platform_files.private_mode_matches(invocation_dir, 0o700) is False:
        raise integration_models.ResultError("the private result directory is invalid")
    try:
        result_metadata = result_path.lstat()
    except FileNotFoundError as exc:
        raise integration_models.ResultError(
            "the interactive editor did not return a result"
        ) from exc
    except OSError as exc:
        raise integration_models.ResultError(
            f"cannot inspect the interactive result: {exc}"
        ) from exc
    if not stat.S_ISREG(result_metadata.st_mode) or platform_files.is_link_or_reparse(
        result_path
    ):
        raise integration_models.ResultError(
            "the interactive result is not a regular file"
        )
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(result_path, flags)
    except FileNotFoundError as exc:
        raise integration_models.ResultError(
            "the interactive editor did not return a result"
        ) from exc
    except OSError as exc:
        raise integration_models.ResultError(
            f"cannot open the interactive result: {exc}"
        ) from exc
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise integration_models.ResultError(
                "the interactive result is not a regular file"
            )
        if (
            result_metadata.st_ino
            and metadata.st_ino
            and (result_metadata.st_dev, result_metadata.st_ino)
            != (metadata.st_dev, metadata.st_ino)
        ):
            raise integration_models.ResultError(
                "the interactive result changed while opening"
            )
        if metadata.st_size > integration_models.RESULT_SIZE_LIMIT:
            raise integration_models.ResultError(
                "the interactive result exceeds 16 KiB"
            )
        chunks = []
        remaining = integration_models.RESULT_SIZE_LIMIT + 1
        while remaining:
            chunk = os.read(descriptor, min(4096, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        if len(raw) > integration_models.RESULT_SIZE_LIMIT:
            raise integration_models.ResultError(
                "the interactive result exceeds 16 KiB"
            )
    finally:
        os.close(descriptor)
    return raw


def read_result(
    result_path: Path, invocation_dir: Path
) -> integration_models.TuiResult:
    return _decode_result(
        _read_invocation_file(
            result_path, invocation_dir, integration_models.RESULT_FILENAME
        )
    )


def _clean_current_invocation(invocation: Path, result_path: Path) -> None:
    try:
        platform_files.durable_unlink(result_path)
    except OSError:
        pass
    _remove_stale_directory(invocation)
