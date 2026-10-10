"""ui / session implementation."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

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
from claude_statusline.ui import drawing as ui_drawing
from claude_statusline.ui import editor as ui_editor
from claude_statusline.ui import keys as ui_keys
from claude_statusline.ui import models as ui_models
from claude_statusline.ui import forms
from claude_statusline.ui import protocol
from claude_statusline.config import ui_preferences
from claude_statusline.config import presets, transfer
from claude_statusline.config.display import DisplayConfigError
from claude_statusline.ui.import_review import ReviewState


def _screen_loop_impl(
    screen,
    state: ui_editor.EditorState,
    deadline_at: float | None = None,
    guard: Callable[[], None] | None = None,
) -> str:
    screen.keypad(True)
    # Ctrl+S is the form save chord. cbreak leaves terminal XON/XOFF active,
    # which can swallow it and freeze output; wrapper restores raw mode on exit.
    try:
        curses.raw()
    except curses.error:
        pass
    # Curses implementations can restart an interrupted blocking read. Poll on
    # every platform so pending Python signals never need another keypress.
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
    redraw = True
    while True:
        if guard is not None:
            guard()
        if deadline_at is not None and time.monotonic() >= deadline_at:
            return ui_models.TIMED_OUT
        if state.repaint:
            screen.clearok(True)
            state.repaint = False
            redraw = True
        if redraw:
            viewport_height = ui_drawing._draw_screen(screen, state, mapper)
            redraw = False
        try:
            key = screen.get_wch()
        except KeyboardInterrupt:
            return ui_models.INTERRUPT
        except curses.error:
            if deadline_at is not None and time.monotonic() >= deadline_at:
                return ui_models.TIMED_OUT
            continue
        redraw = True
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
        if state.pending_language is not None:
            try:
                if guard is not None:
                    guard()
                preference = ui_preferences.set_language(
                    state.baseline.config_path.parent, state.pending_language
                )
                state.language = preference.ui_language
                state.notice = ""
                # Language changes alter wide-character runs and field budgets.
                # Repaint the physical screen rather than reusing its old cells.
                screen.clearok(True)
            except (config_models.ConfigCommandError, OSError) as exc:
                state.notice = str(exc)
            state.pending_language = None
            state.ensure_visible(viewport_height)
            continue
        if action == "transfer":
            try:
                draft = {
                    "display": state.display.to_dict(),
                    "host": state.host.to_dict(),
                }
                if state.pending_action == "preset":
                    draft["display"] = presets.apply(
                        state.display, state.preset
                    ).to_dict()
                    forms.replace_draft(state, draft)
                    state.notice = msg(
                        "ui.session.preset_expanded_ctrl_s_saves_esc_discards"
                    )
                elif state.pending_action == "import":
                    state.import_review = ReviewState.from_result(transfer.review_import(state.path, draft))
                    state.repaint = True
                    state.notice = ""
                else:
                    path = transfer.export_file(
                        state.path, draft, state.baseline.config_path.parent
                    )
                    state.notice = msg(
                        "ui.session.exported_current_draft_may_be_unsaved", value0=path
                    )
            except (DisplayConfigError, protocol.RequestError, OSError) as exc:
                state.notice = str(exc)
            state.pending_action = None
            continue
        if action is not None:
            return action


def _screen_loop(screen, state, deadline_at=None, guard=None):
    from .terminal import screen_adapter

    with screen_adapter(screen) as wrapped:
        return _screen_loop_impl(wrapped, state, deadline_at, guard)


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
    language: str | None = None,
) -> ui_models.ConfigureOutcome:
    """Run the editor and return a result without printing a final summary."""
    stdin = sys.stdin if input_stream is None else input_stream
    stdout = sys.stdout if output_stream is None else output_stream
    if not stdin.isatty() or not stdout.isatty():
        raise config_models.ConfigCommandError(
            msg("ui.session.configure_requires_both_stdin_and_stdout_to")
        )

    baseline = config_service.read_effective_config(config_dir, executable)
    if not baseline.installed:
        raise config_models.ConfigCommandError(
            msg("ui.session.status_line_is_not_installed_for_this")
        )
    preference = ui_preferences.read(config_dir)
    state = ui_editor.EditorState.from_effective(
        baseline, language=language or preference.ui_language
    )
    state.notice = preference.warning or ""

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
                msg(
                    "ui.session.interactive_status_line_configuration_interrupted_no_changes"
                ),
                language=state.language,
            )
        except KeyboardInterrupt:
            return ui_models.ConfigureOutcome(
                "interrupted",
                130,
                msg(
                    "ui.session.interactive_status_line_configuration_interrupted_no_changes"
                ),
                language=state.language,
            )
        except curses.error as exc:
            raise config_models.ConfigCommandError(
                msg("ui.session.cannot_initialize_terminal_for_configure", exc=exc)
            ) from exc
    finally:
        _restore_signal_handlers(previous_handlers)

    if action == ui_models.INTERRUPT:
        return ui_models.ConfigureOutcome(
            "interrupted",
            130,
            msg(
                "ui.session.interactive_status_line_configuration_interrupted_no_changes"
            ),
            language=state.language,
        )
    if action == ui_models.TIMED_OUT:
        return ui_models.ConfigureOutcome(
            "timed-out",
            0,
            msg("ui.session.interactive_status_line_configuration_timed_out_no"),
            language=state.language,
        )
    if action == ui_models.CANCEL:
        return ui_models.ConfigureOutcome(
            "cancelled",
            0,
            msg("ui.session.status_line_configuration_unchanged"),
            language=state.language,
        )
    if deadline_at is not None and time.monotonic() >= deadline_at:
        return ui_models.ConfigureOutcome(
            "timed-out",
            0,
            msg("ui.session.interactive_status_line_configuration_timed_out_no"),
            language=state.language,
        )
    try:
        result = ui_editor.save_configuration(
            config_dir, executable, state, before_commit=guard
        )
    except ui_models.ConfigureAborted as exc:
        return exc.outcome
    message = (
        msg("ui.session.status_line_configuration_updated")
        if result.changed
        else msg("ui.session.status_line_configuration_already_current")
    )
    if result.backup_dir is not None:
        message += msg("ui.session.backup", backup_dir=result.backup_dir)
    return ui_models.ConfigureOutcome(
        "updated" if result.changed else "already-current",
        0,
        message,
        language=state.language,
    )


def _error_outcome(exc: BaseException) -> ui_models.ConfigureOutcome:
    detail = next(
        (line.strip() for line in str(exc).splitlines() if line.strip()),
        "unknown error",
    )[:500]
    return ui_models.ConfigureOutcome(
        "error",
        2,
        msg("ui.session.interactive_status_line_configuration_failed", detail=detail),
    )


def run(
    config_dir: Path,
    executable: Path,
    *,
    input_stream: TextIO | None = None,
    output_stream: TextIO | None = None,
    environ: dict[str, str] | None = None,
    guard: Callable[[], None] | None = None,
    language: str | None = None,
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
                language=language,
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
        language=language,
    )
    if outcome.outcome in {"updated", "already-current", "cancelled"}:
        stdout = sys.stdout if output_stream is None else output_stream
        from claude_statusline.i18n.translator import present

        print(present(outcome.message, outcome.language), file=stdout)
    return outcome.exit_code
