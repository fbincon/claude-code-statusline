"""Run the existing editor in Terminal.app using a private .command file.

The `open` process is only a launch request. A private process handshake and
the ordinary result bridge track the editor independently of Terminal itself.
"""

from __future__ import annotations

import json
import math
import os
import shlex
import signal
import subprocess
import sys
import time
from collections.abc import Mapping
from pathlib import Path

from . import _platform
from . import slash_tui as st

OPEN_COMMAND = "/usr/bin/open"
TERMINAL_APP = Path("/System/Applications/Utilities/Terminal.app")
TERMINAL_BUNDLE = "com.apple.Terminal"
SCRIPT_FILENAME = "terminal.command"
REQUEST_FILENAME = "terminal-request.json"
STARTED_FILENAME = "terminal-started.json"
STARTUP_TIMEOUT_SECONDS = 30
POLL_SECONDS = 0.1


def availability(environ: Mapping[str, str]) -> tuple[bool, str]:
    """Inspect prerequisites without launching a terminal or sending Apple events."""
    if not _platform.is_macos():
        return False, "macOS is required"
    if environ.get("SSH_CONNECTION") or environ.get("SSH_TTY"):
        return False, "SSH session; run configure in the current terminal"
    if not os.access(OPEN_COMMAND, os.X_OK) or not TERMINAL_APP.is_dir():
        return False, "Terminal.app or /usr/bin/open is missing"
    try:
        result = subprocess.run(
            ["/bin/launchctl", "print", f"gui/{os.getuid()}"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=dict(environ),
            timeout=st.PREFLIGHT_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False, "GUI session could not be verified"
    if result.returncode:
        return False, "no local GUI session"
    return True, "Terminal.app via open (window follows Terminal preferences)"


def _json_bytes(value: dict) -> bytes:
    return (json.dumps(value, ensure_ascii=False) + "\n").encode("utf-8")


def _read_json(path: Path, filename: str) -> dict:
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate field")
            result[key] = value
        return result

    try:
        value = json.loads(
            st._read_invocation_file(path, path.parent, filename).decode("utf-8"),
            object_pairs_hook=unique_object,
        )
    except (UnicodeError, ValueError) as exc:
        raise st.ResultError("invalid Terminal invocation JSON") from exc
    if (
        not isinstance(value, dict)
        or type(value.get("schema_version")) is not int
        or value["schema_version"] != 1
    ):
        raise st.ResultError("invalid Terminal invocation schema")
    if _platform.private_mode_matches(path, 0o600) is False:
        raise st.ResultError("Terminal invocation file is not private")
    return value


def _identity(value: dict, *, pid_key="pid", start_key="proc_start") -> tuple[int, str]:
    pid, token = value.get(pid_key), value.get(start_key)
    if (
        not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0
        or not isinstance(token, str) or not token or len(token) > 128
    ):
        raise st.ResultError("invalid Terminal process identity")
    return pid, token


def _alive(identity: tuple[int, str]) -> bool:
    pid, token = identity
    return _platform.process_start_token(pid) == token


def prepare(
    config_dir: Path, executable: Path, cwd: Path, invocation: Path,
    environ: Mapping[str, str],
) -> Path:
    parent_start = _platform.process_start_token(os.getpid())
    if not parent_start:
        raise st.ResultError("cannot verify the caller process")
    now = time.monotonic()
    request = {
        "schema_version": 1,
        "config_dir": str(config_dir),
        "executable": str(executable),
        "cwd": str(cwd),
        "parent_pid": os.getpid(),
        "parent_start": parent_start,
        "startup_deadline": now + STARTUP_TIMEOUT_SECONDS,
        "deadline": now + st.LAUNCHER_TIMEOUT_SECONDS,
    }
    request_path = invocation / REQUEST_FILENAME
    _platform.atomic_write_bytes(request_path, _json_bytes(request), 0o600)
    # Absolute Python and package paths work in pipx, venvs and source tests,
    # even when Terminal's login shell has a different PATH/PYTHONPATH.
    command = shlex.join([
        "/usr/bin/env", "-u", "PYTHONHOME",
        f"PATH={environ.get('PATH', os.defpath)}",
        f"PYTHONPATH={Path(__file__).resolve().parent.parent}",
        "PYTHONUTF8=1",
        sys.executable, "-m", "claude_statusline.macos_terminal", str(request_path),
    ])
    script = invocation / SCRIPT_FILENAME
    _platform.atomic_write_bytes(
        script, ("#!/bin/sh\nexec " + command + "\n").encode("utf-8"), 0o700
    )
    return script


def _read_started(invocation: Path) -> tuple[int, str] | None:
    path = invocation / STARTED_FILENAME
    if not path.exists() and not _platform.is_link_or_reparse(path):
        return None
    value = _read_json(path, STARTED_FILENAME)
    if set(value) != {"schema_version", "pid", "proc_start"}:
        raise st.ResultError("invalid Terminal startup handshake")
    identity = _identity(value)
    if identity[0] == os.getpid():
        raise st.ResultError("Terminal handshake identifies the caller")
    return identity


def _stop_owned(identity: tuple[int, str] | None) -> None:
    if identity is None:
        return
    # Allow a completed editor to exit naturally before considering termination.
    until = time.monotonic() + 1
    while _alive(identity) and time.monotonic() < until:
        time.sleep(POLL_SECONDS)
    for signum in (signal.SIGTERM, signal.SIGKILL):
        if not _alive(identity):
            return
        try:
            os.kill(identity[0], signum)
        except OSError:
            return
        until = time.monotonic() + 1
        while _alive(identity) and time.monotonic() < until:
            time.sleep(POLL_SECONDS)


def _launch_error(detail: str) -> st.TuiResult:
    return st._error(
        "Interactive status line configuration failed: " + detail[:500]
        + ". Run `claude-statusline configure` in a terminal, or use `/statusline-config`."
    )


def launch(
    config_dir: Path, executable: Path, cwd: Path, invocation: Path,
    environ: Mapping[str, str],
) -> st.TuiResult:
    identity = None
    request_path = invocation / REQUEST_FILENAME
    result_path = invocation / st.RESULT_FILENAME
    try:
        script = prepare(config_dir, executable, cwd, invocation, environ)
        request = _read_json(request_path, REQUEST_FILENAME)
        try:
            opened = subprocess.run(
                [OPEN_COMMAND, "-b", TERMINAL_BUNDLE, str(script)],
                stdin=subprocess.DEVNULL, capture_output=True,
                env=dict(environ), start_new_session=True,
                timeout=STARTUP_TIMEOUT_SECONDS, check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return _launch_error(f"Terminal.app launch failed: {exc}")
        if opened.returncode:
            detail = st._safe_first_line(opened.stderr, opened.stdout)
            return _launch_error(detail or "Terminal.app launch was rejected")
        while True:
            now = time.monotonic()
            if identity is None:
                identity = _read_started(invocation)
                if identity is None and now >= request["startup_deadline"]:
                    return _launch_error("Terminal.app did not start the editor within 30 seconds")
            if now >= request["deadline"]:
                return _launch_error("Terminal.app editor did not finish within 585 seconds")
            if identity is not None:
                if result_path.exists() or _platform.is_link_or_reparse(result_path):
                    return st.read_result(result_path, invocation)
                if not _alive(identity):
                    # Check once more after observing exit: the editor may have
                    # published its result between the first check and ps.
                    if result_path.exists():
                        return st.read_result(result_path, invocation)
                    return _launch_error("Terminal.app editor closed without a result")
            time.sleep(POLL_SECONDS)
    except (OSError, st.ResultError) as exc:
        return _launch_error(str(exc))
    finally:
        # Revoking the request also stops an editor whose launch was delayed.
        try:
            _platform.durable_unlink(request_path)
        except OSError:
            pass
        if identity is None:
            try:
                identity = _read_started(invocation)
            except st.ResultError:
                pass
        _stop_owned(identity)


def run_editor(request_path: Path) -> int:
    """Internal entry point, executed with genuine Terminal stdin/stdout."""
    from . import interactive_config as ic

    request = _read_json(request_path, REQUEST_FILENAME)
    if set(request) != {
        "schema_version", "config_dir", "executable", "cwd", "parent_pid",
        "parent_start", "startup_deadline", "deadline",
    }:
        raise st.ResultError("invalid Terminal editor request")
    parent = _identity(request, pid_key="parent_pid", start_key="parent_start")
    for key in ("deadline", "startup_deadline"):
        value = request[key]
        if (
            not isinstance(value, (int, float)) or isinstance(value, bool)
            or not math.isfinite(value)
        ):
            raise st.ResultError("invalid Terminal editor deadline")
    if not request["startup_deadline"] <= request["deadline"] <= time.monotonic() + st.LAUNCHER_TIMEOUT_SECONDS:
        raise st.ResultError("invalid Terminal editor deadline")
    for key in ("config_dir", "executable", "cwd"):
        if not isinstance(request[key], str) or not Path(request[key]).is_absolute():
            raise st.ResultError("invalid Terminal editor path")
    config_dir = Path(request["config_dir"])
    result_path = request_path.parent / st.RESULT_FILENAME
    ic._validated_bridge_path(config_dir, str(result_path))
    request_metadata = request_path.stat()

    def guard():
        try:
            metadata = request_path.lstat()
            leased = (
                metadata.st_ino == request_metadata.st_ino
                and metadata.st_dev == request_metadata.st_dev
                and not _platform.is_link_or_reparse(request_path)
            )
        except OSError:
            leased = False
        if not leased or not _alive(parent):
            raise ic.ConfigureAborted(ic.ConfigureOutcome(
                "interrupted", 130,
                "Interactive status line configuration interrupted; no changes were saved.",
            ))
        if time.monotonic() >= request["deadline"]:
            raise ic.ConfigureAborted(ic.ConfigureOutcome(
                "timed-out", 0,
                "Interactive status line configuration timed out; no changes were saved.",
            ))

    guard()
    if time.monotonic() >= request["startup_deadline"]:
        return 2
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise st.ResultError("Terminal editor requires terminal stdin and stdout")
    own_start = _platform.process_start_token(os.getpid())
    if not own_start:
        raise st.ResultError("cannot verify the Terminal editor process")
    _platform.atomic_write_bytes(
        request_path.parent / STARTED_FILENAME,
        _json_bytes({"schema_version": 1, "pid": os.getpid(), "proc_start": own_start}),
        0o600,
    )
    guard()
    os.chdir(request["cwd"])
    environment = dict(os.environ)
    environment[st.RESULT_ENV] = str(result_path)
    environment[st.DEADLINE_ENV] = str(st.DEADLINE_SECONDS)
    return ic.run(
        config_dir, Path(request["executable"]), environ=environment, guard=guard
    )


def main() -> int:
    if len(sys.argv) != 2 or not _platform.is_macos():
        return 2
    try:
        return run_editor(Path(sys.argv[1]))
    except Exception as exc:  # noqa: BLE001 - no traceback in the terminal window
        detail = next(iter(str(exc).splitlines()), "unknown error")[:500]
        print(f"Terminal editor could not start: {detail}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
