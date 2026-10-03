"""ui / drawing implementation."""

from __future__ import annotations

import curses
from claude_statusline.config import display as config_display
from claude_statusline.rendering import layout as rendering_layout
from claude_statusline.rendering import preview as rendering_preview
from claude_statusline.rendering import subagents as rendering_subagents
from claude_statusline.ui import editor as ui_editor
from claude_statusline.ui import models as ui_models


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
    for unit in rendering_layout._styled_units(text):
        if unit.width and width + unit.width > maximum_width:
            break
        output.append(unit.text)
        width += unit.width
    return "".join(output)


def _add_text(screen, y: int, x: int, text: str, width: int, attr: int = 0) -> None:
    if y < 0 or x < 0 or width <= 0:
        return
    clipped = _clip_text(rendering_layout.ANSI_SGR_RE.sub("", text), width)
    try:
        screen.addstr(y, x, clipped, attr)
    except curses.error:
        pass


def _draw_ansi(screen, y: int, text: str, width: int, mapper: _ColorMapper) -> None:
    x = 0
    for unit in rendering_layout._styled_units(text):
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


def _draw_tabs(
    screen, state: ui_editor.EditorState, width: int, active_attr: int
) -> None:
    items = "[ Main ]"
    subagents = "[ Subagents ]"
    settings = "[ Settings ]"
    _add_text(screen, 2, 0, items, width, active_attr if state.page == "items" else 0)
    offset = rendering_layout._display_width(items) + 2
    _add_text(
        screen,
        2,
        offset,
        subagents,
        max(0, width - offset),
        active_attr if state.page == "subagents" else 0,
    )
    offset += rendering_layout._display_width(subagents) + 2
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
    state: ui_editor.EditorState,
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
        line = f"[{enabled}] {item}  {config_display.ITEM_CATALOG[item]}"
        attr = curses.A_REVERSE if item == state.selected_item else 0
        _add_text(screen, start_y + row, 0, line, width, attr)


def _draw_subagent_items(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
) -> None:
    visible = state.visible_subagent_items()
    state.ensure_visible(height)
    if not visible:
        _add_text(screen, start_y, 0, "No matching items", width, curses.A_DIM)
        return
    for row, item in enumerate(
        visible[state.subagent_scroll : state.subagent_scroll + height]
    ):
        enabled = "x" if item in state.subagent_enabled else " "
        line = f"[{enabled}] {item}  {config_display.SUBAGENT_ITEM_CATALOG[item]}"
        attr = curses.A_REVERSE if item == state.selected_subagent_item else 0
        _add_text(screen, start_y + row, 0, line, width, attr)


def _draw_settings(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
) -> None:
    state.ensure_visible(height)
    values = state.setting_values()
    visible_range = range(
        state.settings_scroll,
        min(len(ui_models.SETTING_NAMES), state.settings_scroll + height),
    )
    for row, index in enumerate(visible_range):
        line = f"{ui_models.SETTING_NAMES[index]}: {values[index]}"
        attr = curses.A_REVERSE if index == state.setting_index else 0
        _add_text(screen, start_y + row, 0, line, width, attr)
    edit = state.numeric_edit
    if edit is not None and edit.error and height > len(ui_models.SETTING_NAMES):
        _add_text(
            screen,
            start_y + min(len(ui_models.SETTING_NAMES), height - 1),
            0,
            edit.error,
            width,
            curses.A_BOLD,
        )


def _draw_preview(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
    mapper: _ColorMapper,
) -> None:
    if state.page == "subagents":
        rows = rendering_subagents.preview_rows(state.display, width)
    else:
        rows = rendering_preview.render_preview_rows(
            state.display, width, state.host.padding
        )
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
        f"Terminal too small: need {ui_models.MIN_TERMINAL_WIDTH}x{ui_models.MIN_TERMINAL_HEIGHT}; "
        f"current {width}x{height}. Resize or press Esc to cancel."
    )
    for row, chunk in enumerate(
        rendering_layout._split_ansi_text(
            message, max(rendering_layout.MIN_CONTENT_WIDTH, width)
        )
    ):
        if row + 2 >= height:
            break
        _add_text(screen, row + 2, 0, chunk, width)


def _draw_screen(screen, state: ui_editor.EditorState, mapper: _ColorMapper) -> int:
    screen.erase()
    height, width = screen.getmaxyx()
    if width < ui_models.MIN_TERMINAL_WIDTH or height < ui_models.MIN_TERMINAL_HEIGHT:
        _draw_small_terminal(screen, height, width)
        screen.refresh()
        return 1

    content_height, preview_height, separator_y, preview_start = _layout_dimensions(
        height
    )
    state.ensure_visible(content_height)
    chrome_color = nearest_terminal_color(142, 211, 211, mapper.colors)
    title_attr = curses.A_BOLD | mapper.foreground(chrome_color)
    active_attr = curses.A_REVERSE | curses.A_BOLD
    _add_text(screen, 0, 0, "Configure Status Line", width, title_attr)
    description = (
        "Choose main status line items and their order"
        if state.page == "items"
        else "Choose subagent row items and their order"
        if state.page == "subagents"
        else "Adjust display and Claude host settings"
    )
    if state.modified:
        description += " (modified)"
    _add_text(screen, 1, 0, description, width, curses.A_DIM)
    _draw_tabs(screen, state, width, active_attr)
    if state.page == "items":
        _add_text(screen, 3, 0, f"Type to search > {state.search}", width)
        _draw_items(screen, state, 4, content_height, width)
    elif state.page == "subagents":
        _add_text(
            screen,
            3,
            0,
            f"Type to search > {state.subagent_search}",
            width,
        )
        _draw_subagent_items(screen, state, 4, content_height, width)
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
    elif state.page in ("items", "subagents"):
        help_text = (
            "Space toggle  ↑↓ navigate  ←→ reorder  Tab next  Enter save  Esc cancel"
        )
    else:
        help_text = (
            "Space toggle  ↑↓ navigate  ←→ change  Tab main  Enter save  Esc cancel"
        )
    _add_text(screen, height - 1, 0, help_text, width, curses.A_REVERSE)
    screen.refresh()
    return content_height
