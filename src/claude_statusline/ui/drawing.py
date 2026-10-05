"""ui / drawing implementation."""

from __future__ import annotations

import curses
from claude_statusline.config import display as config_display
from claude_statusline.rendering import layout as rendering_layout
from claude_statusline.rendering import preview as rendering_preview
from claude_statusline.rendering import subagents as rendering_subagents
from claude_statusline.ui import editor as ui_editor
from claude_statusline.ui import models as ui_models
from claude_statusline.ui import forms
from claude_statusline.ui import layout as ui_layout


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
    height, columns = screen.getmaxyx()
    if y >= height or x >= columns:
        return
    # Writing the bottom-right cell advances curses beyond the last row.
    width = min(width, columns - x - int(y == height - 1))
    if width <= 0:
        return
    clipped = _clip_text(rendering_layout.ANSI_SGR_RE.sub("", text), width)
    try:
        screen.addstr(y, x, clipped, attr)
    except curses.error:
        pass


def _draw_ansi(
    screen, y: int, text: str, width: int, mapper: _ColorMapper, x: int = 0
) -> None:
    end = x + width
    for unit in rendering_layout._styled_units(text):
        if unit.width and x + unit.width > end:
            break
        try:
            screen.addstr(y, x, unit.text, mapper.style(unit.style))
        except curses.error:
            pass
        x += unit.width


def _layout_dimensions(height: int) -> tuple[int, int, int, int]:
    """Compatibility view of the canonical screen geometry."""
    layout = ui_layout.dimensions(ui_models.MIN_TERMINAL_WIDTH, height)
    return (
        layout.list_height,
        layout.preview.inner_height,
        layout.preview.y,
        layout.preview.inner_y,
    )


def _column(text: str, width: int) -> str:
    text = rendering_layout.ANSI_SGR_RE.sub("", text)
    if rendering_layout._display_width(text) > width:
        text = _clip_text(text, max(0, width - 1)) + "…"
    return text + " " * max(0, width - rendering_layout._display_width(text))


def _draw_panel(screen, panel: ui_layout.Panel, title: str, title_attr: int) -> None:
    if panel.framed:
        _add_text(
            screen,
            panel.y,
            0,
            "┌" + "─" * (panel.width - 2) + "┐",
            panel.width,
            curses.A_DIM,
        )
        _add_text(
            screen,
            panel.y + panel.height - 1,
            0,
            "└" + "─" * (panel.width - 2) + "┘",
            panel.width,
            curses.A_DIM,
        )
        for y in range(panel.inner_y, panel.y + panel.height - 1):
            _add_text(screen, y, 0, "│", 1, curses.A_DIM)
            _add_text(screen, y, panel.width - 1, "│", 1, curses.A_DIM)
        _add_text(screen, panel.y, 2, " " + title + " ", panel.width - 4, title_attr)
    else:
        _add_text(screen, panel.y, 0, "─" * panel.width, panel.width, curses.A_DIM)
        _add_text(screen, panel.y, 1, " " + title + " ", panel.width - 2, title_attr)


def _draw_tabs(
    screen, state: ui_editor.EditorState, width: int, active_attr: int
) -> None:
    items = "[ Main ]"
    subagents = "[ Subagents ]"
    settings = "[ Settings ]"
    _add_text(
        screen,
        2,
        0,
        items,
        width,
        active_attr if state.page == "items" else curses.A_DIM,
    )
    offset = rendering_layout._display_width(items) + 2
    _add_text(
        screen,
        2,
        offset,
        subagents,
        max(0, width - offset),
        active_attr if state.page == "subagents" else curses.A_DIM,
    )
    offset += rendering_layout._display_width(subagents) + 2
    _add_text(
        screen,
        2,
        offset,
        settings,
        max(0, width - offset),
        active_attr if state.page == "settings" else curses.A_DIM,
    )
    offset += rendering_layout._display_width(settings) + 2
    _add_text(
        screen,
        2,
        offset,
        "[ Layout ]",
        max(0, width - offset),
        active_attr if state.page == "layout" else curses.A_DIM,
    )


def _draw_items(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
    x: int = 0,
) -> None:
    _draw_item_rows(screen, state, start_y, height, width, x, "main")


def _draw_subagent_items(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
    x: int = 0,
) -> None:
    _draw_item_rows(screen, state, start_y, height, width, x, "subagent")


def _item_column(width: int) -> int:
    return min(30, max(18, width // 3))


def _draw_item_rows(screen, state, start_y, height, width, x, scope) -> None:
    subagents = scope == "subagent"
    visible = state.visible_subagent_items() if subagents else state.visible_items()
    state.ensure_visible(height)
    if not visible:
        _add_text(screen, start_y, x, "No matching items", width, curses.A_DIM)
        return
    scroll = state.subagent_scroll if subagents else state.item_scroll
    selected = state.selected_subagent_item if subagents else state.selected_item
    enabled = state.subagent_enabled if subagents else state.enabled
    descriptions = (
        config_display.SUBAGENT_ITEM_CATALOG
        if subagents
        else config_display.ITEM_CATALOG
    )
    for row, item in enumerate(visible[scroll : scroll + height]):
        line = (
            f"{'›' if item == selected else ' '} [{'x' if item in enabled else ' '}] "
            + _column(item, _item_column(width))
            + "  "
            + descriptions[item]
        )
        attr = curses.A_REVERSE if item == selected else 0
        _add_text(screen, start_y + row, x, _column(line, width), width, attr)


def _draw_settings(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
    x: int = 0,
    title_attr: int = curses.A_BOLD,
) -> None:
    state.ensure_visible(height)
    rows = forms.rows(state)
    scroll = state.form_scroll if forms.special(state) else state.settings_scroll
    window = ui_layout.form_window(rows, forms.index(state), scroll, height)
    label_width = min(
        44,
        max(24, width // 2),
        max(rendering_layout._display_width(row["label"]) + 1 for row in rows),
    )
    for offset, line in enumerate(window.lines):
        if line.index is None:
            heading = "─ " + line.group + " "
            heading += "─" * max(0, width - rendering_layout._display_width(heading))
            _add_text(screen, start_y + offset, x, heading, width, title_attr)
            continue
        row = rows[line.index]
        editing = state.form_input and state.form_input["row"]["key"] == row["key"]
        value = (
            state.form_input["buffer"] + " _" if editing else forms.shown(row["value"])
        )
        _add_text(
            screen,
            start_y + offset,
            x,
            _column(
                ("› " if line.index == forms.index(state) else "  ")
                + _column(row["label"] + ":", label_width)
                + "  "
                + value,
                width,
            ),
            width,
            curses.A_REVERSE if line.index == forms.index(state) else 0,
        )


def _draw_preview(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
    mapper: _ColorMapper,
    x: int = 0,
) -> None:
    if state.page == "subagents":
        rows = rendering_subagents.preview_rows(state.display, width)
    else:
        rows = rendering_preview.render_preview_rows(
            state.display, width, state.host.padding
        )
    if not rows:
        _add_text(screen, start_y, x, "(no enabled items)", width, curses.A_DIM)
        return
    if len(rows) > height:
        visible = rows[: height - 1]
        remaining = len(rows) - len(visible)
        visible.append(f"… {remaining} more line{'s' if remaining != 1 else ''}")
    else:
        visible = rows
    for offset, row in enumerate(visible):
        _draw_ansi(screen, start_y + offset, row, width, mapper, x)


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

    layout = ui_layout.dimensions(width, height)
    panel = layout.content
    state.ensure_visible(layout.list_height)
    chrome_color = nearest_terminal_color(142, 211, 211, mapper.colors)
    title_attr = curses.A_BOLD | mapper.foreground(chrome_color)
    _add_text(
        screen,
        0,
        0,
        "Configure Status Line" + (" *" if state.modified else ""),
        width,
        title_attr,
    )
    description = (
        "Edit item format: " + state.form_item[1]
        if state.form_item
        else "Set explicit rows, priorities and widths"
        if state.page == "layout"
        else "Choose main status line items and their order"
        if state.page == "items"
        else "Choose subagent row items and their order"
        if state.page == "subagents"
        else "Adjust display and tool refresh settings"
    )
    _add_text(screen, 1, 0, description, width, curses.A_DIM)
    _draw_tabs(screen, state, width, curses.A_REVERSE | curses.A_BOLD)
    error = state.notice or (state.numeric_edit.error if state.numeric_edit else "")
    notice = error or (
        "Item format (Ctrl+G back)"
        if state.form_item
        else "Explicit rows / priority / width"
        if state.page == "layout"
        else "Use arrows to change values; Enter edits new fields."
        if state.page == "settings"
        else "Type to search > "
        + (state.subagent_search if state.page == "subagents" else state.search)
    )
    _add_text(screen, 3, 0, notice, width, curses.A_BOLD if error else curses.A_DIM)

    is_form = forms.special(state) or state.page == "settings"
    title = (
        "Item format / " + state.form_item[0] + ": " + state.form_item[1]
        if state.form_item
        else "Layout / rows and fitting"
        if state.page == "layout"
        else "Settings / global options"
        if state.page == "settings"
        else "Subagent items"
        if state.page == "subagents"
        else "Main items"
    )
    _draw_panel(screen, panel, title, title_attr)
    if is_form:
        rows = forms.rows(state)
        label_width = min(
            44,
            max(24, panel.inner_width // 2),
            max(rendering_layout._display_width(row["label"]) + 1 for row in rows),
        )
        heading = "  " + _column("OPTION", label_width) + "  VALUE"
        _add_text(
            screen,
            panel.inner_y,
            panel.inner_x,
            heading,
            panel.inner_width,
            curses.A_DIM | curses.A_BOLD,
        )
        _draw_settings(
            screen,
            state,
            panel.inner_y + 1,
            layout.list_height,
            panel.inner_width,
            panel.inner_x,
            title_attr,
        )
        scroll = state.form_scroll if forms.special(state) else state.settings_scroll
        window = ui_layout.form_window(
            rows, forms.index(state), scroll, layout.list_height
        )
        position = f"Fields {window.start + 1}-{window.end}/{len(rows)} · ↑↓ select"
    else:
        heading = (
            "  ON  "
            + _column("ITEM", _item_column(panel.inner_width))
            + "  DESCRIPTION"
        )
        _add_text(
            screen,
            panel.inner_y,
            panel.inner_x,
            heading,
            panel.inner_width,
            curses.A_DIM | curses.A_BOLD,
        )
        if state.page == "subagents":
            _draw_subagent_items(
                screen,
                state,
                panel.inner_y + 1,
                layout.list_height,
                panel.inner_width,
                panel.inner_x,
            )
            visible, scroll, enabled = (
                state.visible_subagent_items(),
                state.subagent_scroll,
                state.subagent_enabled,
            )
        else:
            _draw_items(
                screen,
                state,
                panel.inner_y + 1,
                layout.list_height,
                panel.inner_width,
                panel.inner_x,
            )
            visible, scroll, enabled = (
                state.visible_items(),
                state.item_scroll,
                state.enabled,
            )
        position = f"Items {scroll + 1 if visible else 0}-{min(len(visible), scroll + layout.list_height)}/{len(visible)} · {len(enabled)} enabled"
    _add_text(
        screen,
        panel.inner_y + panel.inner_height - 1,
        panel.inner_x,
        position,
        panel.inner_width,
        curses.A_DIM,
    )

    preview = layout.preview
    _draw_panel(screen, preview, "Preview (sample data)", title_attr)
    _draw_preview(
        screen,
        state,
        preview.inner_y,
        preview.inner_height,
        preview.inner_width,
        mapper,
        preview.inner_x,
    )

    if state.form_input is not None:
        actions = "Enter accept · Ctrl+G/Esc restore"
        help_text = "Ctrl+U clear · Backspace delete"
    elif state.numeric_edit is not None:
        actions = "Enter accept · Esc restore"
        help_text = "Digits edit · Backspace delete"
    else:
        actions = "Ctrl+S save · Esc cancel · Ctrl+C interrupt"
        if state.form_item:
            help_text = "↑↓ select · ←→ adjust · Enter edit · Ctrl+G back"
        elif state.page == "layout":
            help_text = "Tab page · ↑↓ select · ←→ adjust · Enter edit"
        elif state.page == "settings":
            help_text = "Tab page · ↑↓ select · ←→ adjust · Enter edit/save"
        else:
            actions = "Enter/Ctrl+S save · Esc cancel · Ctrl+C interrupt"
            help_text = "Tab page · Space toggle · Ctrl+E format · Arrows select/order"
    _add_text(
        screen,
        layout.actions_y,
        0,
        _column(actions, width),
        width,
        curses.A_REVERSE | curses.A_BOLD,
    )
    _add_text(screen, layout.help_y, 0, help_text, width, curses.A_DIM)
    screen.refresh()
    return layout.list_height
