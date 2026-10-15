"""platforms / macos_terminal implementation."""

from __future__ import annotations

import json
import claude_statusline
import math
import os
import shlex
import signal
import subprocess
import sys
import time
from collections.abc import Mapping
from pathlib import Path
from claude_statusline.integration import bridge as integration_bridge
from claude_statusline.integration import launcher as integration_launcher
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import processes as platform_processes
from claude_statusline.ui import models as ui_models


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
    if not platform_environment.is_macos():
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
            timeout=integration_models.PREFLIGHT_TIMEOUT_SECONDS,
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
            integration_bridge._read_invocation_file(
                path, path.parent, filename
            ).decode("utf-8"),
            object_pairs_hook=unique_object,
        )
    except (UnicodeError, ValueError) as exc:
        raise integration_models.ResultError(
            "invalid Terminal invocation JSON"
        ) from exc
    if (
        not isinstance(value, dict)
        or type(value.get("schema_version")) is not int
        or value["schema_version"] != 1
    ):
        raise integration_models.ResultError("invalid Terminal invocation schema")
    if platform_files.private_mode_matches(path, 0o600) is False:
        raise integration_models.ResultError("Terminal invocation file is not private")
    return value


def _identity(value: dict, *, pid_key="pid", start_key="proc_start") -> tuple[int, str]:
    pid, token = value.get(pid_key), value.get(start_key)
    if (
        not isinstance(pid, int)
        or isinstance(pid, bool)
        or pid <= 0
        or not isinstance(token, str)
        or not token
        or len(token) > 128
    ):
        raise integration_models.ResultError("invalid Terminal process identity")
    return pid, token


def _alive(identity: tuple[int, str]) -> bool:
    pid, token = identity
    return platform_processes.process_start_token(pid) == token


def prepare(
    config_dir: Path,
    executable: Path,
    cwd: Path,
    invocation: Path,
    environ: Mapping[str, str],
) -> Path:
    parent_start = platform_processes.process_start_token(os.getpid())
    if not parent_start:
        raise integration_models.ResultError("cannot verify the caller process")
    now = time.monotonic()
    request = {
        "schema_version": 1,
        "config_dir": str(config_dir),
        "executable": str(executable),
        "cwd": str(cwd),
        "parent_pid": os.getpid(),
        "parent_start": parent_start,
        "startup_deadline": now + STARTUP_TIMEOUT_SECONDS,
        "deadline": now + integration_models.LAUNCHER_TIMEOUT_SECONDS,
    }
    request_path = invocation / REQUEST_FILENAME
    platform_files.atomic_write_bytes(request_path, _json_bytes(request), 0o600)
    # Absolute Python and package paths work in pipx, venvs and source tests,
    # even when Terminal's login shell has a different PATH/PYTHONPATH.
    command = shlex.join(
        [
            "/usr/bin/env",
            "-u",
            "PYTHONHOME",
            f"PATH={environ.get('PATH', os.defpath)}",
            f"PYTHONPATH={Path(claude_statusline.__file__).resolve().parent.parent}",
            "PYTHONUTF8=1",
            sys.executable,
            "-m",
            "claude_statusline.macos_terminal",
            str(request_path),
        ]
    )
    script = invocation / SCRIPT_FILENAME
    platform_files.atomic_write_bytes(
        script, ("#!/bin/sh\nexec " + command + "\n").encode("utf-8"), 0o700
    )
    return script


def _read_started(invocation: Path) -> tuple[int, str] | None:
    path = invocation / STARTED_FILENAME
    if not path.exists() and not platform_files.is_link_or_reparse(path):
        return None
    value = _read_json(path, STARTED_FILENAME)
    if set(value) != {"schema_version", "pid", "proc_start"}:
        raise integration_models.ResultError("invalid Terminal startup handshake")
    identity = _identity(value)
    if identity[0] == os.getpid():
        raise integration_models.ResultError("Terminal handshake identifies the caller")
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


def _launch_error(detail: str) -> integration_models.TuiResult:
    return integration_models._error(
        "Interactive status line configuration failed: "
        + detail[:500]
        + ". Run `claude-statusline configure` in a terminal, or use `/statusline-config`."
    )


def launch(
    config_dir: Path,
    executable: Path,
    cwd: Path,
    invocation: Path,
    environ: Mapping[str, str],
) -> integration_models.TuiResult:
    identity = None
    request_path = invocation / REQUEST_FILENAME
    result_path = invocation / integration_models.RESULT_FILENAME
    try:
        script = prepare(config_dir, executable, cwd, invocation, environ)
        request = _read_json(request_path, REQUEST_FILENAME)
        try:
            opened = subprocess.run(
                [OPEN_COMMAND, "-b", TERMINAL_BUNDLE, str(script)],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                env=dict(environ),
                start_new_session=True,
                timeout=STARTUP_TIMEOUT_SECONDS,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return _launch_error(f"Terminal.app launch failed: {exc}")
        if opened.returncode:
            detail = integration_launcher._safe_first_line(opened.stderr, opened.stdout)
            return _launch_error(detail or "Terminal.app launch was rejected")
        while True:
            now = time.monotonic()
            if identity is None:
                identity = _read_started(invocation)
                if identity is None and now >= request["startup_deadline"]:
                    return _launch_error(
                        "Terminal.app did not start the editor within 30 seconds"
                    )
            if now >= request["deadline"]:
                return _launch_error(
                    "Terminal.app editor did not finish within 585 seconds"
                )
            if identity is not None:
                if result_path.exists() or platform_files.is_link_or_reparse(
                    result_path
                ):
                    return integration_bridge.read_result(result_path, invocation)
                if not _alive(identity):
                    # Check once more after observing exit: the editor may have
                    # published its result between the first check and ps.
                    if result_path.exists():
                        return integration_bridge.read_result(result_path, invocation)
                    return _launch_error("Terminal.app editor closed without a result")
            time.sleep(POLL_SECONDS)
    except (OSError, integration_models.ResultError) as exc:
        return _launch_error(str(exc))
    finally:
        # Revoking the request also stops an editor whose launch was delayed.
        try:
            platform_files.durable_unlink(request_path)
        except OSError:
            pass
        if identity is None:
            try:
                identity = _read_started(invocation)
            except integration_models.ResultError:
                pass
        _stop_owned(identity)


def run_editor(request_path: Path) -> int:
    """Internal entry point, executed with genuine Terminal stdin/stdout."""
    from claude_statusline.ui import session as ui_session

    request = _read_json(request_path, REQUEST_FILENAME)
    if set(request) != {
        "schema_version",
        "config_dir",
        "executable",
        "cwd",
        "parent_pid",
        "parent_start",
        "startup_deadline",
        "deadline",
    }:
        raise integration_models.ResultError("invalid Terminal editor request")
    parent = _identity(request, pid_key="parent_pid", start_key="parent_start")
    for key in ("deadline", "startup_deadline"):
        value = request[key]
        if (
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not math.isfinite(value)
        ):
            raise integration_models.ResultError("invalid Terminal editor deadline")
    if (
        not request["startup_deadline"]
        <= request["deadline"]
        <= time.monotonic() + integration_models.LAUNCHER_TIMEOUT_SECONDS
    ):
        raise integration_models.ResultError("invalid Terminal editor deadline")
    for key in ("config_dir", "executable", "cwd"):
        if not isinstance(request[key], str) or not Path(request[key]).is_absolute():
            raise integration_models.ResultError("invalid Terminal editor path")
    config_dir = Path(request["config_dir"])
    result_path = request_path.parent / integration_models.RESULT_FILENAME
    integration_bridge._validated_bridge_path(config_dir, str(result_path))
    request_metadata = request_path.stat()

    def guard():
        try:
            metadata = request_path.lstat()
            leased = (
                metadata.st_ino == request_metadata.st_ino
                and metadata.st_dev == request_metadata.st_dev
                and not platform_files.is_link_or_reparse(request_path)
            )
        except OSError:
            leased = False
        if not leased or not _alive(parent):
            raise ui_models.ConfigureAborted(
                ui_models.ConfigureOutcome(
                    "interrupted",
                    130,
                    "Interactive status line configuration interrupted; no changes were saved.",
                )
            )
        if time.monotonic() >= request["deadline"]:
            raise ui_models.ConfigureAborted(
                ui_models.ConfigureOutcome(
                    "timed-out",
                    0,
                    "Interactive status line configuration timed out; no changes were saved.",
                )
            )

    guard()
    if time.monotonic() >= request["startup_deadline"]:
        return 2
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise integration_models.ResultError(
            "Terminal editor requires terminal stdin and stdout"
        )
    own_start = platform_processes.process_start_token(os.getpid())
    if not own_start:
        raise integration_models.ResultError(
            "cannot verify the Terminal editor process"
        )
    platform_files.atomic_write_bytes(
        request_path.parent / STARTED_FILENAME,
        _json_bytes({"schema_version": 1, "pid": os.getpid(), "proc_start": own_start}),
        0o600,
    )
    guard()
    os.chdir(request["cwd"])
    environment = dict(os.environ)
    environment[integration_models.RESULT_ENV] = str(result_path)
    environment[integration_models.DEADLINE_ENV] = str(
        integration_models.DEADLINE_SECONDS
    )
    return ui_session.run(
        config_dir, Path(request["executable"]), environ=environment, guard=guard
    )


def main() -> int:
    if len(sys.argv) != 2 or not platform_environment.is_macos():
        return 2
    try:
        return run_editor(Path(sys.argv[1]))
    except Exception as exc:  # noqa: BLE001 - no traceback in the terminal window
        detail = next(iter(str(exc).splitlines()), "unknown error")[:500]
        print(f"Terminal editor could not start: {detail}", file=sys.stderr)
        return 2
