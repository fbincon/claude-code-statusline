"""Launch and bridge the experimental interactive slash-command editor."""

from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from . import _platform

RESULT_ENV = "CLAUDE_STATUSLINE_SLASH_RESULT"
DEADLINE_ENV = "CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS"
RESULT_SCHEMA_VERSION = 1
DEADLINE_SECONDS = 570
LAUNCHER_TIMEOUT_SECONDS = 585
PREFLIGHT_TIMEOUT_SECONDS = 2
RESULT_SIZE_LIMIT = 16 * 1024
STALE_AFTER_SECONDS = 24 * 60 * 60
INVOCATION_PREFIX = "invocation-"
RESULT_FILENAME = "result.json"
ALLOWED_OUTCOMES = {
    "updated",
    "already-current",
    "cancelled",
    "interrupted",
    "timed-out",
    "error",
}
UNAVAILABLE_MESSAGE = (
    "Interactive status line configuration is unavailable here.\n"
    "Run `claude-statusline configure` in a terminal, or use `/statusline-config`."
)

_PANE_PATTERN = re.compile(r"%[0-9]+\Z")
_INVOCATION_PATTERN = re.compile(r"invocation-[A-Za-z0-9_.-]+\Z")
_CONTROL_PATTERN = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


@dataclass(frozen=True)
class TuiResult:
    schema_version: int
    outcome: str
    exit_code: int
    message: str

    def as_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "outcome": self.outcome,
            "exit_code": self.exit_code,
            "message": self.message,
        }


@dataclass(frozen=True)
class Launcher:
    kind: str
    executable: str
    pane: str | None = None


class ResultError(RuntimeError):
    """Raised when a bridge result cannot be trusted."""


def _error(message: str, exit_code: int = 1) -> TuiResult:
    return TuiResult(RESULT_SCHEMA_VERSION, "error", exit_code, message)


def validate_cwd(value: object) -> Path:
    if isinstance(value, str):
        try:
            candidate = Path(value)
            if candidate.is_absolute() and candidate.is_dir():
                return candidate
        except (OSError, ValueError):
            pass
    return Path.home()


def _which(name: str, environ: Mapping[str, str]) -> str | None:
    return shutil.which(name, path=environ.get("PATH"))


def _tmux_preflight(
    tmux: str,
    pane: str,
    environ: Mapping[str, str],
) -> bool:
    try:
        result = subprocess.run(
            [tmux, "display-message", "-p", "-t", pane, "#{pane_id}"],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            env=dict(environ),
            timeout=PREFLIGHT_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    try:
        reported_pane = result.stdout.decode("utf-8", errors="replace").strip()
    except AttributeError:
        reported_pane = str(result.stdout).strip()
    return result.returncode == 0 and reported_pane == pane


def choose_launcher(environ: Mapping[str, str]) -> Launcher | None:
    if _platform.is_windows():
        if _platform.new_console_creation_flags():
            return Launcher("windows-console", sys.executable)
        return None

    pane = environ.get("TMUX_PANE", "")
    tmux = _which("tmux", environ)
    if (
        environ.get("TMUX")
        and _PANE_PATTERN.fullmatch(pane)
        and tmux is not None
        and _tmux_preflight(tmux, pane, environ)
    ):
        return Launcher("tmux", tmux, pane)

    graphical = environ.get("DISPLAY") or environ.get("WAYLAND_DISPLAY")
    if graphical:
        gnome_terminal = _which("gnome-terminal", environ)
        if gnome_terminal is not None:
            return Launcher("gnome", gnome_terminal)
    return None


def _tree_without_symlinks(root: Path) -> tuple[list[Path], list[Path]] | None:
    files: list[Path] = []
    directories: list[Path] = []
    try:
        with os.scandir(root) as entries:
            for entry in entries:
                path = Path(entry.path)
                if entry.is_symlink() or _platform.is_link_or_reparse(path):
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
            _platform.durable_unlink(child)
        for child in directories:
            child.rmdir()
        path.rmdir()
    except OSError:
        return False
    return True


def cleanup_stale_invocations(base: Path, *, now: float | None = None) -> None:
    cutoff = (time.time() if now is None else now) - STALE_AFTER_SECONDS
    try:
        entries = list(os.scandir(base))
    except (FileNotFoundError, NotADirectoryError, PermissionError):
        return
    for entry in entries:
        if (
            not _INVOCATION_PATTERN.fullmatch(entry.name)
            or entry.is_symlink()
            or _platform.is_link_or_reparse(entry.path)
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
            _platform.is_link_or_reparse(config_dir)
            or _platform.is_link_or_reparse(base.parent)
            or _platform.is_link_or_reparse(base)
        ):
            raise OSError("runtime path is a symbolic link")
        base.mkdir(mode=0o700, parents=True, exist_ok=True)
        if not base.is_dir():
            raise OSError("runtime path is not a directory")
        if _platform.is_linux():
            base.chmod(0o700)
        cleanup_stale_invocations(base)
        invocation = Path(tempfile.mkdtemp(prefix=INVOCATION_PREFIX, dir=base))
        if _platform.is_linux():
            invocation.chmod(0o700)
    except OSError as exc:
        raise ResultError(f"cannot create the private result directory: {exc}") from exc
    return invocation, invocation / RESULT_FILENAME


def _configure_argv(executable: Path, config_dir: Path) -> list[str]:
    return [str(executable), "configure", "--config-dir", str(config_dir)]


def build_launcher_argv(
    launcher: Launcher,
    executable: Path,
    config_dir: Path,
    cwd: Path,
    result_path: Path,
) -> list[str]:
    if launcher.kind == "windows-console":
        return [
            launcher.executable,
            "-m",
            "claude_statusline",
            "configure",
            "--config-dir",
            str(config_dir),
        ]
    configure_argv = _configure_argv(executable, config_dir)
    if launcher.kind == "tmux":
        command = shlex.join([
            "env",
            f"{RESULT_ENV}={result_path}",
            f"{DEADLINE_ENV}={DEADLINE_SECONDS}",
            *configure_argv,
        ])
        return [
            launcher.executable,
            "display-popup",
            "-E",
            "-T",
            "Configure Status Line",
            "-w",
            "90%",
            "-h",
            "90%",
            "-d",
            str(cwd),
            "-t",
            str(launcher.pane),
            command,
        ]
    if launcher.kind == "gnome":
        return [
            launcher.executable,
            "--tab",
            "--active",
            "--wait",
            "--title=Configure Status Line",
            f"--working-directory={cwd}",
            "--",
            *configure_argv,
        ]
    raise ValueError(f"unsupported launcher: {launcher.kind}")


def _read_capture(stream) -> bytes:
    stream.seek(0)
    return stream.read(4096)


def _run_launcher(
    argv: list[str],
    environ: Mapping[str, str],
    *,
    launcher: Launcher | None = None,
    cwd: Path | None = None,
) -> tuple[int | None, bytes, bytes, bool]:
    if launcher is not None and launcher.kind == "windows-console":
        try:
            process = subprocess.Popen(
                argv,
                cwd=str(cwd) if cwd is not None else None,
                env=dict(environ),
                creationflags=_platform.new_console_creation_flags(),
            )
        except OSError as exc:
            return None, b"", str(exc).encode("utf-8", errors="replace"), False
        try:
            return process.wait(timeout=LAUNCHER_TIMEOUT_SECONDS), b"", b"", False
        except subprocess.TimeoutExpired:
            try:
                process.terminate()
                return_code = process.wait(timeout=1)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    process.kill()
                except OSError:
                    pass
                return_code = process.wait()
            return return_code, b"", b"", True

    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        try:
            process = subprocess.Popen(
                argv,
                stdin=subprocess.DEVNULL,
                stdout=stdout,
                stderr=stderr,
                env=dict(environ),
                start_new_session=True,
            )
        except OSError as exc:
            return None, b"", str(exc).encode("utf-8", errors="replace"), False
        timed_out = False
        try:
            return_code = process.wait(timeout=LAUNCHER_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(process.pid, signal.SIGTERM)
                return_code = process.wait(timeout=1)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except OSError:
                    pass
                return_code = process.wait()
        return return_code, _read_capture(stdout), _read_capture(stderr), timed_out


def _decode_result(raw: bytes) -> TuiResult:
    def strict_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate field: {key}")
            value[key] = item
        return value

    try:
        value = json.loads(
            raw.decode("utf-8"), object_pairs_hook=strict_object
        )
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise ResultError(f"invalid result JSON: {exc}") from exc
    expected = {"schema_version", "outcome", "exit_code", "message"}
    if not isinstance(value, dict) or set(value) != expected:
        raise ResultError("result has an invalid schema")
    schema_version = value["schema_version"]
    outcome = value["outcome"]
    exit_code = value["exit_code"]
    message = value["message"]
    if (
        not isinstance(schema_version, int)
        or isinstance(schema_version, bool)
        or schema_version != RESULT_SCHEMA_VERSION
    ):
        raise ResultError("result has an unsupported schema version")
    if not isinstance(outcome, str) or outcome not in ALLOWED_OUTCOMES:
        raise ResultError("result has an unknown outcome")
    if (
        not isinstance(exit_code, int)
        or isinstance(exit_code, bool)
        or not 0 <= exit_code <= 255
    ):
        raise ResultError("result has an invalid exit code")
    if (
        not isinstance(message, str)
        or not message
        or "\x00" in message
        or "\n" in message
        or "\r" in message
    ):
        raise ResultError("result has an invalid message")
    return TuiResult(schema_version, outcome, exit_code, message)


def read_result(result_path: Path, invocation_dir: Path) -> TuiResult:
    if (
        result_path.parent != invocation_dir
        or result_path.name != RESULT_FILENAME
        or not _INVOCATION_PATTERN.fullmatch(invocation_dir.name)
    ):
        raise ResultError("result path is outside this invocation")
    for directory in (
        invocation_dir.parent.parent.parent,
        invocation_dir.parent.parent,
        invocation_dir.parent,
        invocation_dir,
    ):
        try:
            directory_metadata = directory.lstat()
        except OSError as exc:
            raise ResultError(
                f"cannot inspect the private result directory: {exc}"
            ) from exc
        if (
            not stat.S_ISDIR(directory_metadata.st_mode)
            or _platform.is_link_or_reparse(directory)
        ):
            raise ResultError("the private result directory is invalid")
    if _platform.private_mode_matches(invocation_dir, 0o700) is False:
        raise ResultError("the private result directory is invalid")
    try:
        result_metadata = result_path.lstat()
    except FileNotFoundError as exc:
        raise ResultError("the interactive editor did not return a result") from exc
    except OSError as exc:
        raise ResultError(f"cannot inspect the interactive result: {exc}") from exc
    if (
        not stat.S_ISREG(result_metadata.st_mode)
        or _platform.is_link_or_reparse(result_path)
    ):
        raise ResultError("the interactive result is not a regular file")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(result_path, flags)
    except FileNotFoundError as exc:
        raise ResultError("the interactive editor did not return a result") from exc
    except OSError as exc:
        raise ResultError(f"cannot open the interactive result: {exc}") from exc
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise ResultError("the interactive result is not a regular file")
        if (
            result_metadata.st_ino
            and metadata.st_ino
            and (result_metadata.st_dev, result_metadata.st_ino)
            != (metadata.st_dev, metadata.st_ino)
        ):
            raise ResultError("the interactive result changed while opening")
        if metadata.st_size > RESULT_SIZE_LIMIT:
            raise ResultError("the interactive result exceeds 16 KiB")
        chunks = []
        remaining = RESULT_SIZE_LIMIT + 1
        while remaining:
            chunk = os.read(descriptor, min(4096, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        if len(raw) > RESULT_SIZE_LIMIT:
            raise ResultError("the interactive result exceeds 16 KiB")
    finally:
        os.close(descriptor)
    return _decode_result(raw)


def _clean_current_invocation(invocation: Path, result_path: Path) -> None:
    try:
        _platform.durable_unlink(result_path)
    except OSError:
        pass
    try:
        invocation.rmdir()
    except OSError:
        pass


def _safe_first_line(*values: bytes) -> str | None:
    for value in values:
        text = value.decode("utf-8", errors="replace")
        for line in text.splitlines():
            line = _CONTROL_PATTERN.sub("", line).strip()
            if line:
                if line.lower().startswith("traceback"):
                    return None
                return line[:500]
    return None


def _failure_message(detail: str | None) -> str:
    if not detail:
        return "Interactive status line configuration failed."
    return f"Interactive status line configuration failed: {detail}"


def launch(
    config_dir: Path,
    executable: Path,
    payload_cwd: object,
    *,
    environ: Mapping[str, str] | None = None,
) -> TuiResult:
    environment = dict(os.environ if environ is None else environ)
    launcher = choose_launcher(environment)
    if launcher is None:
        return _error(UNAVAILABLE_MESSAGE)

    try:
        invocation, result_path = _create_invocation_dir(config_dir)
    except ResultError as exc:
        return _error(_failure_message(str(exc)[:500]))
    cwd = validate_cwd(payload_cwd)
    argv = build_launcher_argv(
        launcher, executable, config_dir, cwd, result_path
    )
    child_environment = dict(environment)
    child_environment[RESULT_ENV] = str(result_path)
    child_environment[DEADLINE_ENV] = str(DEADLINE_SECONDS)

    try:
        return_code, stdout, stderr, timed_out = _run_launcher(
            argv,
            child_environment,
            launcher=launcher,
            cwd=cwd,
        )
        try:
            result = read_result(result_path, invocation)
        except ResultError as exc:
            if timed_out:
                detail = (
                    f"launcher did not finish within {LAUNCHER_TIMEOUT_SECONDS} seconds"
                )
            else:
                detail = _safe_first_line(stderr, stdout) or str(exc)
            error_code = (
                return_code
                if isinstance(return_code, int) and 1 <= return_code <= 255
                else 1
            )
            return _error(_failure_message(detail[:500]), error_code)
        if (
            launcher.kind == "windows-console"
            and return_code != result.exit_code
        ):
            detail = f"console process exited with code {return_code}"
            error_code = (
                return_code
                if isinstance(return_code, int) and 1 <= return_code <= 255
                else 1
            )
            return _error(_failure_message(detail), error_code)
        return result
    finally:
        _clean_current_invocation(invocation, result_path)
