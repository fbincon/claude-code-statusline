"""ui / keys implementation."""

from __future__ import annotations

import curses
from claude_statusline.ui import editor as ui_editor
from claude_statusline.ui import forms
from claude_statusline.ui import search as item_search
from claude_statusline.config.display import DisplayConfigError
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

    if state.category_selection is not None:
        scope = "subagent" if state.page == "subagents" else "main"
        categories = item_search.categories(scope)
        index = categories.index(state.category_selection)
        if key in ("\x1b", "\x07"):
            state.category_selection = None
        elif _is_enter(key):
            state.choose_category(state.category_selection)
        elif key in (curses.KEY_UP, curses.KEY_LEFT):
            state.category_selection = categories[max(0, index - 1)]
        elif key in (curses.KEY_DOWN, curses.KEY_RIGHT):
            state.category_selection = categories[min(len(categories) - 1, index + 1)]
        elif key in (curses.KEY_HOME, curses.KEY_PPAGE):
            state.category_selection = categories[0]
        elif key in (curses.KEY_END, curses.KEY_NPAGE):
            state.category_selection = categories[-1]
        return None

    if state.search_input is not None:
        if key in ("\x1b", "\x07"):
            query, selected = state.search_input
            if state.page == "subagents":
                state.subagent_search, state.selected_subagent_item = query, selected
            else:
                state.search, state.selected_item = query, selected
            state.search_input = None
        elif _is_enter(key):
            state.search_input = None
        elif key == "\x15":
            state.clear_search()
        elif _is_backspace(key):
            state.backspace_search()
        elif isinstance(key, str) and key.isprintable():
            state.append_search(key)
        state.ensure_visible(viewport_height)
        return None

    if state.form_input is not None:
        try:
            if key in ("\x1b", "\x07"):
                state.form_input = None
                state.notice = ""
            elif key == "\x15":
                state.form_input["buffer"] = ""
            elif _is_enter(key):
                return forms.accept(state)
            elif _is_backspace(key):
                state.form_input["buffer"] = state.form_input["buffer"][:-1]
            elif (
                isinstance(key, str)
                and key.isprintable()
                and len(state.form_input["buffer"]) < 4096
            ):
                state.form_input["buffer"] += key
        except DisplayConfigError as exc:
            state.notice = str(exc)
        return None
    if key == "\x07" and state.form_item:
        state.form_item = None
        return None
    if key == "\x06" and state.page in ("items", "subagents") and not state.form_item:
        state.category_selection = state.subagent_category if state.page == "subagents" else state.category
        return None
    if key == "/" and state.page in ("items", "subagents") and not state.form_item:
        state.search_input = (state.subagent_search, state.selected_subagent_item) if state.page == "subagents" else (state.search, state.selected_item)
        return None
    if key == "\x05" and state.page in ("items", "subagents"):
        scope = "subagent" if state.page == "subagents" else "main"
        item = (
            state.selected_subagent_item if scope == "subagent" else state.selected_item
        )
        if item:
            state.form_item = (scope, item)
            state.form_index = state.form_scroll = 0
        return None
    if forms.special(state) or (
        state.page == "settings" and forms.current(state)["kind"] != "legacy"
    ):
        try:
            if key == "\x13":
                return ui_models.SAVE
            if key == "\x1b":
                return ui_models.CANCEL
            if _is_enter(key):
                return forms.begin(state)
            if key in (curses.KEY_LEFT, curses.KEY_RIGHT, " "):
                forms.adjust(state, -1 if key == curses.KEY_LEFT else 1)
                return None
        except DisplayConfigError as exc:
            state.notice = str(exc)
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

    if key == "\x13":
        return ui_models.SAVE
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
