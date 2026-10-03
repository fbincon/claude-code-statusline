"""ui / keys implementation."""

from __future__ import annotations

import curses
from claude_statusline.ui import editor as ui_editor
from claude_statusline.ui import models as ui_models


def _is_enter(key) -> bool:
    return key in ("\n", "\r", curses.KEY_ENTER)


def _is_backspace(key) -> bool:
    return key in ("\b", "\x7f", curses.KEY_BACKSPACE)


def handle_key(state: ui_editor.EditorState, key, viewport_height: int) -> str | None:
    """Translate one curses key into a pure state transition or exit action."""
    if key == "\x03":
        return ui_models.INTERRUPT
    if key == curses.KEY_RESIZE:
        state.ensure_visible(viewport_height)
        return None

    if state.numeric_edit is not None:
        if key == "\x1b":
            state.cancel_numeric()
        elif _is_enter(key):
            state.accept_numeric()
        elif _is_backspace(key):
            state.backspace_numeric()
        elif isinstance(key, str) and key.isascii() and key.isdigit():
            state.input_digit(key)
        return None

    if key == "\x1b":
        return ui_models.CANCEL
    if _is_enter(key):
        return ui_models.SAVE
    if key in ("\t", curses.KEY_BTAB):
        state.switch_page(-1 if key == curses.KEY_BTAB else 1)
    elif key == curses.KEY_UP:
        state.navigate(-1)
    elif key == curses.KEY_DOWN:
        state.navigate(1)
    elif key == curses.KEY_PPAGE:
        state.navigate_page(-1, viewport_height)
    elif key == curses.KEY_NPAGE:
        state.navigate_page(1, viewport_height)
    elif key == curses.KEY_HOME:
        state.navigate_home()
    elif key == curses.KEY_END:
        state.navigate_end()
    elif key == curses.KEY_LEFT:
        if state.page in ("items", "subagents"):
            state.move_selected_item(-1)
        else:
            state.adjust_setting(-1)
    elif key == curses.KEY_RIGHT:
        if state.page in ("items", "subagents"):
            state.move_selected_item(1)
        else:
            state.adjust_setting(1)
    elif key == " ":
        if state.page in ("items", "subagents"):
            state.toggle_selected_item()
        else:
            state.toggle_setting()
    elif state.page in ("items", "subagents") and _is_backspace(key):
        state.backspace_search()
    elif state.page in ("items", "subagents") and key == "\x15":
        state.clear_search()
    elif (
        state.page in ("items", "subagents")
        and isinstance(key, str)
        and key.isprintable()
    ):
        state.append_search(key)
    elif state.page == "settings" and key == "e":
        state.set_refresh_event()
    elif (
        state.page == "settings"
        and isinstance(key, str)
        and key.isascii()
        and key.isdigit()
    ):
        state.input_digit(key)
    state.ensure_visible(viewport_height)
    return None
