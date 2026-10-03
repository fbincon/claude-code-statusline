"""ui / session implementation."""

from __future__ import annotations

import curses
import os
import signal
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import TextIO
from claude_statusline.config import models as config_models
from claude_statusline.config import service as config_service
from claude_statusline.integration import bridge as integration_bridge
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.ui import drawing as ui_drawing
from claude_statusline.ui import editor as ui_editor
from claude_statusline.ui import keys as ui_keys
from claude_statusline.ui import models as ui_models


def _screen_loop(
    screen,
    state: ui_editor.EditorState,
    deadline_at: float | None = None,
    guard: Callable[[], None] | None = None,
) -> str:
    screen.keypad(True)
    if deadline_at is not None or guard is not None or platform_environment.is_macos():
        # Older macOS curses can restart an interrupted blocking read. Polling
        # lets Python dispatch pending signals without needing another keypress.
        screen.timeout(250)
    try:
        curses.curs_set(0)
    except curses.error:
        pass
    try:
        curses.set_escdelay(25)
    except (AttributeError, curses.error):
        pass
    mapper = ui_drawing._ColorMapper()
    while True:
        if guard is not None:
            guard()
        if deadline_at is not None and time.monotonic() >= deadline_at:
            return ui_models.TIMED_OUT
        viewport_height = ui_drawing._draw_screen(screen, state, mapper)
        try:
            key = screen.get_wch()
        except KeyboardInterrupt:
            return ui_models.INTERRUPT
        except curses.error:
            if deadline_at is not None and time.monotonic() >= deadline_at:
                return ui_models.TIMED_OUT
            continue
        if key == curses.KEY_RESIZE:
            try:
                # windows-curses 2.x already does this after get_wch(); the
                # explicit call also supports older PDCurses behavior and is
                # harmless under ncurses.
                curses.resize_term(0, 0)
            except (AttributeError, curses.error):
                pass
        height, width = screen.getmaxyx()
        if (
            width < ui_models.MIN_TERMINAL_WIDTH
            or height < ui_models.MIN_TERMINAL_HEIGHT
        ):
            if key == "\x03":
                return ui_models.INTERRUPT
            if key == "\x1b":
                return ui_models.CANCEL
            continue
        action = ui_keys.handle_key(state, key, viewport_height)
        if action is not None:
            return action


class _SignalExit(BaseException):
    def __init__(self, signum: int):
        super().__init__(signum)
        self.signum = signum


def _run_curses(
    state: ui_editor.EditorState,
    deadline_at: float | None = None,
    guard: Callable[[], None] | None = None,
) -> str:
    return curses.wrapper(_screen_loop, state, deadline_at, guard)


def _signal_handler(signum, _frame) -> None:
    raise _SignalExit(signum)


def _install_signal_handlers() -> dict[int, object]:
    previous = {}
    signums = tuple(
        signum
        for name in ("SIGINT", "SIGHUP", "SIGTERM")
        if (signum := getattr(signal, name, None)) is not None
    )
    for signum in signums:
        previous[signum] = signal.getsignal(signum)
        signal.signal(signum, _signal_handler)
    return previous


def _restore_signal_handlers(previous: dict[int, object]) -> None:
    for signum, handler in previous.items():
        signal.signal(signum, handler)


def execute(
    config_dir: Path,
    executable: Path,
    *,
    input_stream: TextIO | None = None,
    output_stream: TextIO | None = None,
    deadline_at: float | None = None,
    guard: Callable[[], None] | None = None,
) -> ui_models.ConfigureOutcome:
    """Run the editor and return a result without printing a final summary."""
    stdin = sys.stdin if input_stream is None else input_stream
    stdout = sys.stdout if output_stream is None else output_stream
    if not stdin.isatty() or not stdout.isatty():
        raise config_models.ConfigCommandError(
            "configure requires both stdin and stdout to be terminals"
        )

    baseline = config_service.read_effective_config(config_dir, executable)
    if not baseline.installed:
        raise config_models.ConfigCommandError(
            "status line is not installed for this claude-statusline executable; "
            "run claude-statusline install first"
        )
    state = ui_editor.EditorState.from_effective(baseline)

    previous_handlers = _install_signal_handlers()
    try:
        try:
            if guard is not None:
                guard()
                action = _run_curses(state, deadline_at, guard)
            else:
                action = _run_curses(state, deadline_at)
        except ui_models.ConfigureAborted as exc:
            return exc.outcome
        except _SignalExit as exc:
            return ui_models.ConfigureOutcome(
                "interrupted",
                128 + exc.signum,
                "Interactive status line configuration interrupted; no changes were saved.",
            )
        except KeyboardInterrupt:
            return ui_models.ConfigureOutcome(
                "interrupted",
                130,
                "Interactive status line configuration interrupted; no changes were saved.",
            )
        except curses.error as exc:
            raise config_models.ConfigCommandError(
                f"cannot initialize terminal for configure: {exc}"
            ) from exc
    finally:
        _restore_signal_handlers(previous_handlers)

    if action == ui_models.INTERRUPT:
        return ui_models.ConfigureOutcome(
            "interrupted",
            130,
            "Interactive status line configuration interrupted; no changes were saved.",
        )
    if action == ui_models.TIMED_OUT:
        return ui_models.ConfigureOutcome(
            "timed-out",
            0,
            "Interactive status line configuration timed out; no changes were saved.",
        )
    if action == ui_models.CANCEL:
        return ui_models.ConfigureOutcome(
            "cancelled", 0, "Status line configuration unchanged."
        )
    if deadline_at is not None and time.monotonic() >= deadline_at:
        return ui_models.ConfigureOutcome(
            "timed-out",
            0,
            "Interactive status line configuration timed out; no changes were saved.",
        )
    try:
        result = ui_editor.save_configuration(
            config_dir, executable, state, before_commit=guard
        )
    except ui_models.ConfigureAborted as exc:
        return exc.outcome
    message = (
        "Status line configuration updated."
        if result.changed
        else "Status line configuration already current."
    )
    if result.backup_dir is not None:
        message += f" Backup: {result.backup_dir}"
    return ui_models.ConfigureOutcome(
        "updated" if result.changed else "already-current",
        0,
        message,
    )


def _error_outcome(exc: BaseException) -> ui_models.ConfigureOutcome:
    detail = next(
        (line.strip() for line in str(exc).splitlines() if line.strip()),
        "unknown error",
    )[:500]
    return ui_models.ConfigureOutcome(
        "error",
        2,
        f"Interactive status line configuration failed: {detail}",
    )


def run(
    config_dir: Path,
    executable: Path,
    *,
    input_stream: TextIO | None = None,
    output_stream: TextIO | None = None,
    environ: dict[str, str] | None = None,
    guard: Callable[[], None] | None = None,
) -> int:
    """Preserve CLI output while supporting the private slash result bridge."""
    environment = os.environ if environ is None else environ
    bridge_raw = environment.get(integration_bridge._BRIDGE_RESULT_ENV)
    if bridge_raw is not None:
        try:
            bridge_path = integration_bridge._validated_bridge_path(
                config_dir, bridge_raw
            )
        except config_models.ConfigCommandError:
            return 2
        try:
            deadline_at = integration_bridge._bridge_deadline(environment)
            outcome = execute(
                config_dir,
                executable,
                input_stream=input_stream,
                output_stream=output_stream,
                deadline_at=deadline_at,
                guard=guard,
            )
        except Exception as exc:  # noqa: BLE001 - bridge errors must be reported
            outcome = _error_outcome(exc)
        try:
            if guard is not None:
                guard()
            integration_bridge._write_bridge_result(bridge_path, outcome)
        except ui_models.ConfigureAborted:
            return outcome.exit_code
        except OSError:
            return 2
        return outcome.exit_code

    outcome = execute(
        config_dir,
        executable,
        input_stream=input_stream,
        output_stream=output_stream,
    )
    if outcome.outcome in {"updated", "already-current", "cancelled"}:
        stdout = sys.stdout if output_stream is None else output_stream
        print(outcome.message, file=stdout)
    return outcome.exit_code
