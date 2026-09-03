"""Interactive full-screen editor for status line configuration."""

from __future__ import annotations

import curses
import json
import os
import re
import signal
import stat
import sys
import tempfile
import time
from dataclasses import dataclass, replace
from pathlib import Path
from typing import TextIO

from . import config_commands as cc
from . import display_config as dc
from . import statusline

MIN_TERMINAL_WIDTH = 64
MIN_TERMINAL_HEIGHT = 18
REFRESH_PRESETS = (None, 1, 2, 5, 10, 30, 60, 300, 600, 3600)
SETTING_NAMES = (
    "Use colors",
    "Palette",
    "Directory style",
    "Separator style",
    "Padding",
    "Refresh interval",
    "Built-in Vim indicator",
)

SAVE = "save"
CANCEL = "cancel"
INTERRUPT = "interrupt"
TIMED_OUT = "timed-out"

_BRIDGE_RESULT_ENV = "CLAUDE_STATUSLINE_SLASH_RESULT"
_BRIDGE_DEADLINE_ENV = "CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS"
_BRIDGE_RESULT_NAME = "result.json"
_BRIDGE_INVOCATION_PATTERN = re.compile(r"invocation-[A-Za-z0-9_.-]+\Z")


@dataclass(frozen=True)
class ConfigureOutcome:
    outcome: str
    exit_code: int
    message: str


@dataclass
class NumericEdit:
    field: str
    buffer: str
    original: int | None
    error: str | None = None


@dataclass
class EditorState:
    """Curses-independent configuration draft and navigation state."""

    baseline: cc.EffectiveConfig
    item_order: list[str]
    enabled: set[str]
    display: dc.DisplayConfig
    host: cc.HostConfig
    page: str = "items"
    search: str = ""
    selected_item: str | None = None
    item_scroll: int = 0
    setting_index: int = 0
    settings_scroll: int = 0
    numeric_edit: NumericEdit | None = None

    @classmethod
    def from_effective(cls, effective: cc.EffectiveConfig) -> EditorState:
        enabled = list(effective.display.items)
        full_order = enabled + [
            item for item in dc.ITEM_CATALOG if item not in effective.display.items
        ]
        return cls(
            baseline=effective,
            item_order=full_order,
            enabled=set(enabled),
            display=effective.display,
            host=effective.host,
            selected_item=full_order[0] if full_order else None,
        )

    @property
    def modified(self) -> bool:
        initial_order = list(self.baseline.display.items) + [
            item
            for item in dc.ITEM_CATALOG
            if item not in self.baseline.display.items
        ]
        draft_changed = (
            self.display != self.baseline.display
            or self.host != self.baseline.host
            or self.item_order != initial_order
        )
        if self.numeric_edit is None:
            return draft_changed
        original = (
            "event"
            if self.numeric_edit.original is None
            else str(self.numeric_edit.original)
        )
        return draft_changed or self.numeric_edit.buffer != original

    def final_items(self) -> tuple[str, ...]:
        return tuple(item for item in self.item_order if item in self.enabled)

    def visible_items(self) -> list[str]:
        needle = self.search.casefold()
        if not needle:
            return list(self.item_order)
        return [
            item
            for item in self.item_order
            if needle in item.casefold()
            or needle in dc.ITEM_CATALOG[item].casefold()
        ]

    def _sync_display_items(self) -> None:
        self.display = self.display.with_updates(items=self.final_items())

    def _normalize_item_selection(self) -> list[str]:
        visible = self.visible_items()
        if visible and self.selected_item not in visible:
            self.selected_item = visible[0]
            self.item_scroll = 0
        return visible

    def append_search(self, text: str) -> None:
        self.search += text
        self._normalize_item_selection()

    def backspace_search(self) -> None:
        if self.search:
            self.search = self.search[:-1]
            self._normalize_item_selection()

    def clear_search(self) -> None:
        if self.search:
            self.search = ""
            self._normalize_item_selection()

    def navigate(self, delta: int) -> None:
        if self.page == "settings":
            self.setting_index = min(
                len(SETTING_NAMES) - 1,
                max(0, self.setting_index + delta),
            )
            return
        visible = self._normalize_item_selection()
        if not visible:
            return
        current = visible.index(self.selected_item)
        self.selected_item = visible[min(len(visible) - 1, max(0, current + delta))]

    def navigate_page(self, direction: int, page_size: int) -> None:
        self.navigate(direction * max(1, page_size))

    def navigate_home(self) -> None:
        if self.page == "settings":
            self.setting_index = 0
            return
        visible = self._normalize_item_selection()
        if visible:
            self.selected_item = visible[0]

    def navigate_end(self) -> None:
        if self.page == "settings":
            self.setting_index = len(SETTING_NAMES) - 1
            return
        visible = self._normalize_item_selection()
        if visible:
            self.selected_item = visible[-1]

    def ensure_visible(self, viewport_height: int) -> None:
        height = max(1, viewport_height)
        if self.page == "settings":
            maximum = max(0, len(SETTING_NAMES) - height)
            self.settings_scroll = min(maximum, max(0, self.settings_scroll))
            if self.setting_index < self.settings_scroll:
                self.settings_scroll = self.setting_index
            elif self.setting_index >= self.settings_scroll + height:
                self.settings_scroll = self.setting_index - height + 1
            return
        visible = self._normalize_item_selection()
        maximum = max(0, len(visible) - height)
        self.item_scroll = min(maximum, max(0, self.item_scroll))
        if not visible:
            self.item_scroll = 0
            return
        index = visible.index(self.selected_item)
        if index < self.item_scroll:
            self.item_scroll = index
        elif index >= self.item_scroll + height:
            self.item_scroll = index - height + 1

    def toggle_selected_item(self) -> bool:
        visible = self._normalize_item_selection()
        if not visible or self.selected_item is None:
            return False
        if self.selected_item in self.enabled:
            self.enabled.remove(self.selected_item)
        else:
            self.enabled.add(self.selected_item)
        self._sync_display_items()
        return True

    def move_selected_item(self, direction: int) -> bool:
        if direction not in (-1, 1):
            raise ValueError("item direction must be -1 or 1")
        visible = self._normalize_item_selection()
        if not visible or self.selected_item is None:
            return False
        visible_index = visible.index(self.selected_item)
        target_index = visible_index + direction
        if target_index < 0 or target_index >= len(visible):
            return False
        moving = self.selected_item
        target = visible[target_index]
        self.item_order.remove(moving)
        full_target_index = self.item_order.index(target)
        insertion = full_target_index if direction < 0 else full_target_index + 1
        self.item_order.insert(insertion, moving)
        self._sync_display_items()
        return True

    def switch_page(self, direction: int = 1) -> bool:
        if self.numeric_edit is not None:
            return False
        self.page = "settings" if self.page == "items" else "items"
        return True

    def _cycle(self, value, choices: tuple, direction: int):
        index = choices.index(value)
        return choices[(index + direction) % len(choices)]

    def refresh_choices(self) -> tuple[int | None, ...]:
        current = self.host.refresh_interval
        if current is None or current in REFRESH_PRESETS:
            return REFRESH_PRESETS
        numeric = sorted({choice for choice in REFRESH_PRESETS if choice is not None} | {current})
        return (None, *numeric)

    def toggle_setting(self) -> bool:
        if self.numeric_edit is not None:
            return False
        if self.setting_index == 0:
            self.display = self.display.with_updates(
                use_colors=not self.display.use_colors
            )
            return True
        if self.setting_index == 6:
            self.host = replace(
                self.host,
                hide_vim_mode_indicator=not self.host.hide_vim_mode_indicator,
            )
            return True
        return False

    def adjust_setting(self, direction: int) -> bool:
        if direction not in (-1, 1):
            raise ValueError("setting direction must be -1 or 1")
        if self.numeric_edit is not None:
            return False
        index = self.setting_index
        if index in (0, 6):
            return self.toggle_setting()
        if index == 1:
            self.display = self.display.with_updates(
                palette=self._cycle(self.display.palette, dc.PALETTES, direction)
            )
        elif index == 2:
            self.display = self.display.with_updates(
                directory_style=self._cycle(
                    self.display.directory_style, dc.DIRECTORY_STYLES, direction
                )
            )
        elif index == 3:
            self.display = self.display.with_updates(
                separator_style=self._cycle(
                    self.display.separator_style, dc.SEPARATOR_STYLES, direction
                )
            )
        elif index == 4:
            value = min(
                cc.PADDING_MAX,
                max(cc.PADDING_MIN, self.host.padding + direction),
            )
            self.host = replace(self.host, padding=value)
        elif index == 5:
            choices = self.refresh_choices()
            value = self._cycle(self.host.refresh_interval, choices, direction)
            self.host = replace(self.host, refresh_interval=value)
        else:
            return False
        return True

    def set_refresh_event(self) -> bool:
        if self.numeric_edit is not None or self.setting_index != 5:
            return False
        self.host = replace(self.host, refresh_interval=None)
        return True

    def input_digit(self, digit: str) -> bool:
        if len(digit) != 1 or not digit.isascii() or not digit.isdigit():
            return False
        field = {4: "padding", 5: "refresh"}.get(self.setting_index)
        if field is None:
            return False
        if self.numeric_edit is None:
            original = (
                self.host.padding
                if field == "padding"
                else self.host.refresh_interval
            )
            self.numeric_edit = NumericEdit(field, digit, original)
        else:
            self.numeric_edit.buffer += digit
        self._apply_numeric_buffer()
        return True

    def backspace_numeric(self) -> bool:
        if self.numeric_edit is None:
            return False
        self.numeric_edit.buffer = self.numeric_edit.buffer[:-1]
        self._apply_numeric_buffer()
        return True

    def _numeric_value(self) -> tuple[int | None, str | None]:
        edit = self.numeric_edit
        if edit is None:
            return None, "not editing a number"
        if not edit.buffer:
            return None, "Enter a number"
        value = int(edit.buffer)
        if edit.field == "padding":
            if not cc.PADDING_MIN <= value <= cc.PADDING_MAX:
                return None, "Padding must be from 0 through 32"
        elif not cc.REFRESH_INTERVAL_MIN <= value <= cc.REFRESH_INTERVAL_MAX:
            return None, "Refresh interval must be from 1 through 3600"
        return value, None

    def _apply_numeric_buffer(self) -> None:
        edit = self.numeric_edit
        if edit is None:
            return
        value, error = self._numeric_value()
        edit.error = error
        if error is not None or value is None:
            return
        if edit.field == "padding":
            self.host = replace(self.host, padding=value)
        else:
            self.host = replace(self.host, refresh_interval=value)

    def accept_numeric(self) -> bool:
        if self.numeric_edit is None:
            return False
        value, error = self._numeric_value()
        self.numeric_edit.error = error
        if error is not None or value is None:
            return False
        if self.numeric_edit.field == "padding":
            self.host = replace(self.host, padding=value)
        else:
            self.host = replace(self.host, refresh_interval=value)
        self.numeric_edit = None
        return True

    def cancel_numeric(self) -> bool:
        edit = self.numeric_edit
        if edit is None:
            return False
        if edit.field == "padding":
            self.host = replace(self.host, padding=int(edit.original or 0))
        else:
            self.host = replace(self.host, refresh_interval=edit.original)
        self.numeric_edit = None
        return True

    def setting_values(self) -> tuple[str, ...]:
        values = [
            "on" if self.display.use_colors else "off",
            self.display.palette,
            self.display.directory_style,
            self.display.separator_style,
            str(self.host.padding),
            "event" if self.host.refresh_interval is None else str(self.host.refresh_interval),
            "hide" if self.host.hide_vim_mode_indicator else "show",
        ]
        if self.numeric_edit is not None:
            edit_index = 4 if self.numeric_edit.field == "padding" else 5
            values[edit_index] = f"[{self.numeric_edit.buffer}_]"
        return tuple(values)


# A descriptive alias for callers that prefer the longer public-internal name.
InteractiveConfigState = EditorState


def save_configuration(
    config_dir: Path,
    executable: Path,
    state: EditorState,
) -> cc.MutationResult:
    """Commit one complete draft through the existing atomic transaction."""
    return cc.apply_configuration(
        config_dir,
        executable,
        items=list(state.final_items()),
        colors="on" if state.display.use_colors else "off",
        palette=state.display.palette,
        directory_style=state.display.directory_style,
        separator_style=state.display.separator_style,
        padding=state.host.padding,
        refresh_interval=(
            "event" if state.host.refresh_interval is None else state.host.refresh_interval
        ),
        hide_vim_mode_indicator=(
            "on" if state.host.hide_vim_mode_indicator else "off"
        ),
        expected=state.baseline,
    )


def _is_enter(key) -> bool:
    return key in ("\n", "\r", curses.KEY_ENTER)


def _is_backspace(key) -> bool:
    return key in ("\b", "\x7f", curses.KEY_BACKSPACE)


def handle_key(state: EditorState, key, viewport_height: int) -> str | None:
    """Translate one curses key into a pure state transition or exit action."""
    if key == "\x03":
        return INTERRUPT
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
        return CANCEL
    if _is_enter(key):
        return SAVE
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
        if state.page == "items":
            state.move_selected_item(-1)
        else:
            state.adjust_setting(-1)
    elif key == curses.KEY_RIGHT:
        if state.page == "items":
            state.move_selected_item(1)
        else:
            state.adjust_setting(1)
    elif key == " ":
        if state.page == "items":
            state.toggle_selected_item()
        else:
            state.toggle_setting()
    elif state.page == "items" and _is_backspace(key):
        state.backspace_search()
    elif state.page == "items" and key == "\x15":
        state.clear_search()
    elif state.page == "items" and isinstance(key, str) and key.isprintable():
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


_XTERM_BASE_RGB = (
    (0, 0, 0),
    (128, 0, 0),
    (0, 128, 0),
    (128, 128, 0),
    (0, 0, 128),
    (128, 0, 128),
    (0, 128, 128),
    (192, 192, 192),
    (128, 128, 128),
    (255, 0, 0),
    (0, 255, 0),
    (255, 255, 0),
    (0, 0, 255),
    (255, 0, 255),
    (0, 255, 255),
    (255, 255, 255),
)


def _xterm_palette() -> tuple[tuple[int, int, int], ...]:
    values = list(_XTERM_BASE_RGB)
    levels = (0, 95, 135, 175, 215, 255)
    values.extend((r, g, b) for r in levels for g in levels for b in levels)
    values.extend((value, value, value) for value in range(8, 239, 10))
    return tuple(values)


_XTERM_RGB = _xterm_palette()


def nearest_terminal_color(red: int, green: int, blue: int, colors: int) -> int | None:
    """Return the nearest xterm/basic palette index for a terminal capability."""
    if colors < 8:
        return None
    limit = 256 if colors >= 256 else 16 if colors >= 16 else 8
    palette = _XTERM_RGB[:limit]
    return min(
        range(len(palette)),
        key=lambda index: sum(
            (actual - expected) ** 2
            for actual, expected in zip(palette[index], (red, green, blue))
        ),
    )


def _ansi_style(style: str, colors: int) -> tuple[bool, int | None]:
    if not style:
        return False, None
    values = style[2:-1].replace(":", ";").split(";")
    try:
        codes = [int(value or "0") for value in values]
    except ValueError:
        return False, None
    bold = 1 in codes
    foreground = None
    index = 0
    while index < len(codes):
        code = codes[index]
        if 30 <= code <= 37:
            foreground = code - 30 if colors >= 8 else None
        elif 90 <= code <= 97:
            if colors >= 16:
                foreground = code - 90 + 8
            elif colors >= 8:
                foreground = code - 90
                bold = True
        elif code == 38 and index + 4 < len(codes) and codes[index + 1] == 2:
            foreground = nearest_terminal_color(
                codes[index + 2], codes[index + 3], codes[index + 4], colors
            )
            index += 4
        index += 1
    return bold, foreground


class _ColorMapper:
    def __init__(self):
        self.colors = 0
        self._pairs: dict[int, int] = {}
        try:
            if curses.has_colors():
                curses.start_color()
                try:
                    curses.use_default_colors()
                except curses.error:
                    pass
                self.colors = max(0, int(getattr(curses, "COLORS", 0)))
        except curses.error:
            self.colors = 0

    def foreground(self, color: int | None) -> int:
        if color is None or self.colors < 8:
            return 0
        if color in self._pairs:
            return curses.color_pair(self._pairs[color])
        next_pair = len(self._pairs) + 1
        maximum = max(0, int(getattr(curses, "COLOR_PAIRS", 0)) - 1)
        if next_pair > maximum:
            return 0
        try:
            curses.init_pair(next_pair, color, -1)
        except curses.error:
            return 0
        self._pairs[color] = next_pair
        return curses.color_pair(next_pair)

    def style(self, sgr: str) -> int:
        bold, foreground = _ansi_style(sgr, self.colors)
        result = curses.A_BOLD if bold else 0
        return result | self.foreground(foreground)


def _clip_text(text: str, maximum_width: int) -> str:
    if maximum_width <= 0:
        return ""
    output = []
    width = 0
    for unit in statusline._styled_units(text):
        if unit.width and width + unit.width > maximum_width:
            break
        output.append(unit.text)
        width += unit.width
    return "".join(output)


def _add_text(screen, y: int, x: int, text: str, width: int, attr: int = 0) -> None:
    if y < 0 or x < 0 or width <= 0:
        return
    clipped = _clip_text(statusline.ANSI_SGR_RE.sub("", text), width)
    try:
        screen.addstr(y, x, clipped, attr)
    except curses.error:
        pass


def _draw_ansi(screen, y: int, text: str, width: int, mapper: _ColorMapper) -> None:
    x = 0
    for unit in statusline._styled_units(text):
        if unit.width and x + unit.width > width:
            break
        try:
            screen.addstr(y, x, unit.text, mapper.style(unit.style))
        except curses.error:
            pass
        x += unit.width


def _layout_dimensions(height: int) -> tuple[int, int, int, int]:
    available = height - 7
    preview_height = min(5, max(2, available // 3))
    content_height = max(1, available - preview_height)
    separator_y = 4 + content_height
    preview_start = separator_y + 2
    return content_height, preview_height, separator_y, preview_start


def _draw_tabs(screen, state: EditorState, width: int, active_attr: int) -> None:
    items = "[ Items ]"
    settings = "[ Settings ]"
    _add_text(screen, 2, 0, items, width, active_attr if state.page == "items" else 0)
    offset = statusline._display_width(items) + 2
    _add_text(
        screen,
        2,
        offset,
        settings,
        max(0, width - offset),
        active_attr if state.page == "settings" else 0,
    )


def _draw_items(
    screen,
    state: EditorState,
    start_y: int,
    height: int,
    width: int,
) -> None:
    visible = state.visible_items()
    state.ensure_visible(height)
    if not visible:
        _add_text(screen, start_y, 0, "No matching items", width, curses.A_DIM)
        return
    for row, item in enumerate(visible[state.item_scroll : state.item_scroll + height]):
        enabled = "x" if item in state.enabled else " "
        line = f"[{enabled}] {item}  {dc.ITEM_CATALOG[item]}"
        attr = curses.A_REVERSE if item == state.selected_item else 0
        _add_text(screen, start_y + row, 0, line, width, attr)


def _draw_settings(
    screen,
    state: EditorState,
    start_y: int,
    height: int,
    width: int,
) -> None:
    state.ensure_visible(height)
    values = state.setting_values()
    visible_range = range(
        state.settings_scroll,
        min(len(SETTING_NAMES), state.settings_scroll + height),
    )
    for row, index in enumerate(visible_range):
        line = f"{SETTING_NAMES[index]}: {values[index]}"
        attr = curses.A_REVERSE if index == state.setting_index else 0
        _add_text(screen, start_y + row, 0, line, width, attr)
    edit = state.numeric_edit
    if edit is not None and edit.error and height > len(SETTING_NAMES):
        _add_text(
            screen,
            start_y + min(len(SETTING_NAMES), height - 1),
            0,
            edit.error,
            width,
            curses.A_BOLD,
        )


def _draw_preview(
    screen,
    state: EditorState,
    start_y: int,
    height: int,
    width: int,
    mapper: _ColorMapper,
) -> None:
    rows = statusline.render_preview_rows(state.display, width, state.host.padding)
    if not rows:
        _add_text(screen, start_y, 0, "(no enabled items)", width, curses.A_DIM)
        return
    if len(rows) > height:
        visible = rows[: height - 1]
        remaining = len(rows) - len(visible)
        visible.append(f"… {remaining} more line{'s' if remaining != 1 else ''}")
    else:
        visible = rows
    for offset, row in enumerate(visible):
        _draw_ansi(screen, start_y + offset, row, width, mapper)


def _draw_small_terminal(screen, height: int, width: int) -> None:
    _add_text(screen, 0, 0, "Configure Status Line", width, curses.A_BOLD)
    message = (
        f"Terminal too small: need {MIN_TERMINAL_WIDTH}x{MIN_TERMINAL_HEIGHT}; "
        f"current {width}x{height}. Resize or press Esc to cancel."
    )
    for row, chunk in enumerate(
        statusline._split_ansi_text(message, max(statusline.MIN_CONTENT_WIDTH, width))
    ):
        if row + 2 >= height:
            break
        _add_text(screen, row + 2, 0, chunk, width)


def _draw_screen(screen, state: EditorState, mapper: _ColorMapper) -> int:
    screen.erase()
    height, width = screen.getmaxyx()
    if width < MIN_TERMINAL_WIDTH or height < MIN_TERMINAL_HEIGHT:
        _draw_small_terminal(screen, height, width)
        screen.refresh()
        return 1

    content_height, preview_height, separator_y, preview_start = _layout_dimensions(height)
    state.ensure_visible(content_height)
    chrome_color = nearest_terminal_color(142, 211, 211, mapper.colors)
    title_attr = curses.A_BOLD | mapper.foreground(chrome_color)
    active_attr = curses.A_REVERSE | curses.A_BOLD
    _add_text(screen, 0, 0, "Configure Status Line", width, title_attr)
    description = (
        "Choose visible items and their order"
        if state.page == "items"
        else "Adjust display and Claude host settings"
    )
    if state.modified:
        description += " (modified)"
    _add_text(screen, 1, 0, description, width, curses.A_DIM)
    _draw_tabs(screen, state, width, active_attr)
    if state.page == "items":
        _add_text(screen, 3, 0, f"Type to search > {state.search}", width)
        _draw_items(screen, state, 4, content_height, width)
    else:
        _add_text(
            screen,
            3,
            0,
            "Use arrows to change values; digits edit numeric settings.",
            width,
        )
        _draw_settings(screen, state, 4, content_height, width)

    _add_text(screen, separator_y, 0, "─" * width, width, curses.A_DIM)
    _add_text(screen, separator_y + 1, 0, "Preview (sample data)", width, title_attr)
    _draw_preview(screen, state, preview_start, preview_height, width, mapper)

    if state.numeric_edit is not None:
        help_text = "Digits edit  Backspace delete  Enter accept  Esc restore"
    elif state.page == "items":
        help_text = "Space toggle  ↑↓ navigate  ←→ reorder  Tab settings  Enter save  Esc cancel"
    else:
        help_text = "Space toggle  ↑↓ navigate  ←→ change  Tab items  Enter save  Esc cancel"
    _add_text(screen, height - 1, 0, help_text, width, curses.A_REVERSE)
    screen.refresh()
    return content_height


def _screen_loop(
    screen,
    state: EditorState,
    deadline_at: float | None = None,
) -> str:
    screen.keypad(True)
    if deadline_at is not None:
        screen.timeout(250)
    try:
        curses.curs_set(0)
    except curses.error:
        pass
    try:
        curses.set_escdelay(25)
    except (AttributeError, curses.error):
        pass
    mapper = _ColorMapper()
    while True:
        if deadline_at is not None and time.monotonic() >= deadline_at:
            return TIMED_OUT
        viewport_height = _draw_screen(screen, state, mapper)
        try:
            key = screen.get_wch()
        except KeyboardInterrupt:
            return INTERRUPT
        except curses.error:
            if deadline_at is not None and time.monotonic() >= deadline_at:
                return TIMED_OUT
            continue
        height, width = screen.getmaxyx()
        if width < MIN_TERMINAL_WIDTH or height < MIN_TERMINAL_HEIGHT:
            if key == "\x03":
                return INTERRUPT
            if key == "\x1b":
                return CANCEL
            continue
        action = handle_key(state, key, viewport_height)
        if action is not None:
            return action


class _SignalExit(BaseException):
    def __init__(self, signum: int):
        super().__init__(signum)
        self.signum = signum


def _run_curses(
    state: EditorState,
    deadline_at: float | None = None,
) -> str:
    return curses.wrapper(_screen_loop, state, deadline_at)


def _signal_handler(signum, _frame) -> None:
    raise _SignalExit(signum)


def _install_signal_handlers() -> dict[int, object]:
    previous = {}
    for signum in (signal.SIGINT, signal.SIGHUP, signal.SIGTERM):
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
) -> ConfigureOutcome:
    """Run the editor and return a result without printing a final summary."""
    stdin = sys.stdin if input_stream is None else input_stream
    stdout = sys.stdout if output_stream is None else output_stream
    if not stdin.isatty() or not stdout.isatty():
        raise cc.ConfigCommandError(
            "configure requires both stdin and stdout to be terminals"
        )

    baseline = cc.read_effective_config(config_dir, executable)
    if not baseline.installed:
        raise cc.ConfigCommandError(
            "status line is not installed for this claude-statusline executable; "
            "run claude-statusline install first"
        )
    state = EditorState.from_effective(baseline)

    previous_handlers = _install_signal_handlers()
    try:
        try:
            action = _run_curses(state, deadline_at)
        except _SignalExit as exc:
            return ConfigureOutcome(
                "interrupted",
                128 + exc.signum,
                "Interactive status line configuration interrupted; no changes were saved.",
            )
        except KeyboardInterrupt:
            return ConfigureOutcome(
                "interrupted",
                130,
                "Interactive status line configuration interrupted; no changes were saved.",
            )
        except curses.error as exc:
            raise cc.ConfigCommandError(
                f"cannot initialize terminal for configure: {exc}"
            ) from exc
    finally:
        _restore_signal_handlers(previous_handlers)

    if action == INTERRUPT:
        return ConfigureOutcome(
            "interrupted",
            130,
            "Interactive status line configuration interrupted; no changes were saved.",
        )
    if action == TIMED_OUT:
        return ConfigureOutcome(
            "timed-out",
            0,
            "Interactive status line configuration timed out; no changes were saved.",
        )
    if action == CANCEL:
        return ConfigureOutcome(
            "cancelled", 0, "Status line configuration unchanged."
        )
    result = save_configuration(config_dir, executable, state)
    message = (
        "Status line configuration updated."
        if result.changed
        else "Status line configuration already current."
    )
    if result.backup_dir is not None:
        message += f" Backup: {result.backup_dir}"
    return ConfigureOutcome(
        "updated" if result.changed else "already-current",
        0,
        message,
    )


def _validated_bridge_path(config_dir: Path, raw: str) -> Path:
    if not raw or "\x00" in raw:
        raise cc.ConfigCommandError("invalid slash TUI result path")
    path = Path(raw)
    absolute = Path(os.path.abspath(path))
    if not path.is_absolute() or path != absolute or path.name != _BRIDGE_RESULT_NAME:
        raise cc.ConfigCommandError("invalid slash TUI result path")
    expected_base = config_dir / "statusline_runtime" / "slash_tui"
    if (
        path.parent.parent != expected_base
        or not _BRIDGE_INVOCATION_PATTERN.fullmatch(path.parent.name)
    ):
        raise cc.ConfigCommandError("invalid slash TUI result path")
    for directory in (expected_base.parent, expected_base, path.parent):
        try:
            metadata = directory.lstat()
        except OSError as exc:
            raise cc.ConfigCommandError(
                f"invalid slash TUI result directory: {exc}"
            ) from exc
        if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
            raise cc.ConfigCommandError("invalid slash TUI result directory")
    if stat.S_IMODE(path.parent.stat().st_mode) != 0o700:
        raise cc.ConfigCommandError("slash TUI result directory is not private")
    return path


def _bridge_deadline(environ: dict[str, str]) -> float:
    raw = environ.get(_BRIDGE_DEADLINE_ENV, "")
    try:
        seconds = float(raw)
    except (TypeError, ValueError) as exc:
        raise cc.ConfigCommandError("invalid slash TUI deadline") from exc
    if not 0 < seconds <= 570:
        raise cc.ConfigCommandError("invalid slash TUI deadline")
    return time.monotonic() + seconds


def _write_bridge_result(path: Path, outcome: ConfigureOutcome) -> None:
    value = {
        "schema_version": 1,
        "outcome": outcome.outcome,
        "exit_code": outcome.exit_code,
        "message": outcome.message,
    }
    content = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode(
        "utf-8"
    )
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.claude-statusline-",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary_path: Path | None = Path(temporary)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, path)
        temporary_path = None
        directory_descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass


def _error_outcome(exc: BaseException) -> ConfigureOutcome:
    detail = next(
        (line.strip() for line in str(exc).splitlines() if line.strip()),
        "unknown error",
    )[:500]
    return ConfigureOutcome(
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
) -> int:
    """Preserve CLI output while supporting the private slash result bridge."""
    environment = os.environ if environ is None else environ
    bridge_raw = environment.get(_BRIDGE_RESULT_ENV)
    if bridge_raw is not None:
        try:
            bridge_path = _validated_bridge_path(config_dir, bridge_raw)
        except cc.ConfigCommandError:
            return 2
        try:
            deadline_at = _bridge_deadline(environment)
            outcome = execute(
                config_dir,
                executable,
                input_stream=input_stream,
                output_stream=output_stream,
                deadline_at=deadline_at,
            )
        except Exception as exc:  # noqa: BLE001 - bridge errors must be reported
            outcome = _error_outcome(exc)
        try:
            _write_bridge_result(bridge_path, outcome)
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
