"""integration / launcher implementation."""

from __future__ import annotations

import os
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
from collections.abc import Mapping
from pathlib import Path
from claude_statusline.integration import bridge as integration_bridge
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment


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
            timeout=integration_models.PREFLIGHT_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    try:
        reported_pane = result.stdout.decode("utf-8", errors="replace").strip()
    except AttributeError:
        reported_pane = str(result.stdout).strip()
    return result.returncode == 0 and reported_pane == pane


def choose_launcher(environ: Mapping[str, str]) -> integration_models.Launcher | None:
    if platform_environment.is_windows():
        if platform_environment.new_console_creation_flags():
            return integration_models.Launcher("windows-console", sys.executable)
        return None

    pane = environ.get("TMUX_PANE", "")
    tmux = _which("tmux", environ)
    if (
        environ.get("TMUX")
        and integration_models._PANE_PATTERN.fullmatch(pane)
        and tmux is not None
        and _tmux_preflight(tmux, pane, environ)
    ):
        return integration_models.Launcher("tmux", tmux, pane)

    if platform_environment.is_macos():
        from claude_statusline.platforms import (
            macos_terminal as platform_macos_terminal,
        )

        if platform_macos_terminal.availability(environ)[0]:
            return integration_models.Launcher(
                "macos-terminal", platform_macos_terminal.OPEN_COMMAND
            )
        return None

    graphical = environ.get("DISPLAY") or environ.get("WAYLAND_DISPLAY")
    if graphical:
        gnome_terminal = _which("gnome-terminal", environ)
        if gnome_terminal is not None:
            return integration_models.Launcher("gnome", gnome_terminal)
    return None


def _configure_argv(executable: Path, config_dir: Path) -> list[str]:
    return [str(executable), "configure", "--config-dir", str(config_dir)]


def build_launcher_argv(
    launcher: integration_models.Launcher,
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
        command = shlex.join(
            [
                "env",
                f"{integration_models.RESULT_ENV}={result_path}",
                f"{integration_models.DEADLINE_ENV}={integration_models.DEADLINE_SECONDS}",
                *configure_argv,
            ]
        )
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


def _run_launcher(
    argv: list[str],
    environ: Mapping[str, str],
    *,
    launcher: integration_models.Launcher | None = None,
    cwd: Path | None = None,
) -> tuple[int | None, bytes, bytes, bool]:
    if launcher is not None and launcher.kind == "windows-console":
        try:
            process = subprocess.Popen(
                argv,
                cwd=str(cwd) if cwd is not None else None,
                env=dict(environ),
                creationflags=platform_environment.new_console_creation_flags(),
            )
        except OSError as exc:
            return None, b"", str(exc).encode("utf-8", errors="replace"), False
        try:
            return (
                process.wait(timeout=integration_models.LAUNCHER_TIMEOUT_SECONDS),
                b"",
                b"",
                False,
            )
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
            return_code = process.wait(
                timeout=integration_models.LAUNCHER_TIMEOUT_SECONDS
            )
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
        return (
            return_code,
            integration_bridge._read_capture(stdout),
            integration_bridge._read_capture(stderr),
            timed_out,
        )


def _safe_first_line(*values: bytes) -> str | None:
    for value in values:
        text = value.decode("utf-8", errors="replace")
        for line in text.splitlines():
            line = integration_models._CONTROL_PATTERN.sub("", line).strip()
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
) -> integration_models.TuiResult:
    environment = dict(os.environ if environ is None else environ)
    launcher = choose_launcher(environment)
    if launcher is None:
        return integration_models._error(integration_models.UNAVAILABLE_MESSAGE)

    try:
        invocation, result_path = integration_bridge._create_invocation_dir(config_dir)
    except integration_models.ResultError as exc:
        return integration_models._error(_failure_message(str(exc)[:500]))
    cwd = validate_cwd(payload_cwd)
    if launcher.kind == "macos-terminal":
        try:
            from claude_statusline.platforms import (
                macos_terminal as platform_macos_terminal,
            )

            return platform_macos_terminal.launch(
                config_dir, executable, cwd, invocation, environment
            )
        finally:
            integration_bridge._clean_current_invocation(invocation, result_path)
    argv = build_launcher_argv(launcher, executable, config_dir, cwd, result_path)
    child_environment = dict(environment)
    child_environment[integration_models.RESULT_ENV] = str(result_path)
    child_environment[integration_models.DEADLINE_ENV] = str(
        integration_models.DEADLINE_SECONDS
    )

    try:
        return_code, stdout, stderr, timed_out = _run_launcher(
            argv,
            child_environment,
            launcher=launcher,
            cwd=cwd,
        )
        try:
            result = integration_bridge.read_result(result_path, invocation)
        except integration_models.ResultError as exc:
            if timed_out:
                detail = f"launcher did not finish within {integration_models.LAUNCHER_TIMEOUT_SECONDS} seconds"
            else:
                detail = _safe_first_line(stderr, stdout) or str(exc)
            error_code = (
                return_code
                if isinstance(return_code, int) and 1 <= return_code <= 255
                else 1
            )
            return integration_models._error(_failure_message(detail[:500]), error_code)
        if launcher.kind == "windows-console" and return_code != result.exit_code:
            detail = f"console process exited with code {return_code}"
            error_code = (
                return_code
                if isinstance(return_code, int) and 1 <= return_code <= 255
                else 1
            )
            return integration_models._error(_failure_message(detail), error_code)
        return result
    finally:
        integration_bridge._clean_current_invocation(invocation, result_path)
