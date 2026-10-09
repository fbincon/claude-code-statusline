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
from claude_statusline.ui import shortcuts
from claude_statusline.ui.shortcuts import Hint
from claude_statusline.ui import theme

# Preserve the existing drawing/interactive_config compatibility exports.
from claude_statusline.ui.theme import (
    _ColorMapper as _ColorMapper,
    _XTERM_BASE_RGB as _XTERM_BASE_RGB,
    _XTERM_RGB as _XTERM_RGB,
    _ansi_style as _ansi_style,
    _xterm_palette as _xterm_palette,
    nearest_terminal_color as nearest_terminal_color,
)


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
            screen.addstr(y, x, unit.text, mapper.preview_style(unit.style))
        except curses.error:
            pass
        x += unit.width


def _draw_shortcuts(screen, y, hints, width, mapper, x=0, prefix="", attr=0) -> None:
    height, columns = screen.getmaxyx()
    width = max(0, min(width, columns - x - int(y == height - 1)))
    key_attr = theme.KEY
    for text, is_key in shortcuts.segments(hints, width, prefix):
        _add_text(
            screen,
            y,
            x,
            text,
            width,
            attr | (key_attr if is_key else theme.DESCRIPTION),
        )
        size = rendering_layout._display_width(text)
        x += size
        width -= size


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
            theme.BORDER,
        )
        _add_text(
            screen,
            panel.y + panel.height - 1,
            0,
            "└" + "─" * (panel.width - 2) + "┘",
            panel.width,
            theme.BORDER,
        )
        for y in range(panel.inner_y, panel.y + panel.height - 1):
            _add_text(screen, y, 0, "│", 1, theme.BORDER)
            _add_text(screen, y, panel.width - 1, "│", 1, theme.BORDER)
        _add_text(screen, panel.y, 2, " " + title + " ", panel.width - 4, title_attr)
    else:
        _add_text(screen, panel.y, 0, "─" * panel.width, panel.width, theme.BORDER)
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
        active_attr if state.page == "items" else theme.DESCRIPTION,
    )
    offset = rendering_layout._display_width(items) + 2
    _add_text(
        screen,
        2,
        offset,
        subagents,
        max(0, width - offset),
        active_attr if state.page == "subagents" else theme.DESCRIPTION,
    )
    offset += rendering_layout._display_width(subagents) + 2
    _add_text(
        screen,
        2,
        offset,
        settings,
        max(0, width - offset),
        active_attr if state.page == "settings" else theme.DESCRIPTION,
    )
    offset += rendering_layout._display_width(settings) + 2
    _add_text(
        screen,
        2,
        offset,
        "[ Layout ]",
        max(0, width - offset),
        active_attr if state.page == "layout" else theme.DESCRIPTION,
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
        _add_text(screen, start_y, x, "No matching items", width, theme.DESCRIPTION)
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
        attr = theme.SELECTION if item == selected else 0
        _add_text(screen, start_y + row, x, _column(line, width), width, attr)


def _draw_settings(
    screen,
    state: ui_editor.EditorState,
    start_y: int,
    height: int,
    width: int,
    x: int = 0,
    title_attr: int = theme.TITLE,
    mapper: _ColorMapper | None = None,
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
            theme.SELECTION if line.index == forms.index(state) else 0,
        )
        if row["kind"] == "action" and not editing and mapper is not None:
            prefix_width = 2 + label_width + 2
            _draw_shortcuts(
                screen,
                start_y + offset,
                [
                    Hint(
                        "Enter",
                        value.removeprefix("Enter").lstrip(": "),
                        "expand" if row["key"] == "preset-apply" else "path",
                    )
                ],
                width - prefix_width,
                mapper,
                x + prefix_width,
                attr=theme.SELECTION if line.index == forms.index(state) else 0,
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
    for offset in range(height):
        _add_text(screen, start_y + offset, x, " " * width, width, mapper.preview_attr)
    if state.page == "subagents":
        rows = rendering_subagents.preview_rows(state.display, width)
    else:
        rows = rendering_preview.render_preview_rows(
            state.display, width, state.host.padding
        )
    if not rows:
        _add_text(screen, start_y, x, "(no enabled items)", width, mapper.preview_attr)
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
    _add_text(screen, 0, 0, "Configure Status Line", width, theme.TITLE)
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
    title_attr = theme.TITLE
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
    _add_text(screen, 1, 0, description, width, theme.DESCRIPTION)
    _draw_tabs(screen, state, width, theme.ACTIVE_TAB)
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
    if not error and state.form_item:
        _draw_shortcuts(
            screen, 3, [Hint("Ctrl+G", "back")], width, mapper, prefix="Item format · "
        )
    elif not error and state.page == "settings":
        _draw_shortcuts(
            screen,
            3,
            [Hint("Enter", "edits new fields.", "edit")],
            width,
            mapper,
            prefix="Use arrows to change values; ",
        )
    else:
        _add_text(
            screen, 3, 0, notice, width, theme.NOTICE if error else theme.DESCRIPTION
        )

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
            theme.TITLE,
        )
        _draw_settings(
            screen,
            state,
            panel.inner_y + 1,
            layout.list_height,
            panel.inner_width,
            panel.inner_x,
            title_attr,
            mapper,
        )
        scroll = state.form_scroll if forms.special(state) else state.settings_scroll
        window = ui_layout.form_window(
            rows, forms.index(state), scroll, layout.list_height
        )
        position = f"Fields {window.start + 1}-{window.end}/{len(rows)}"
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
            theme.TITLE,
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
    _draw_shortcuts(
        screen,
        panel.inner_y + panel.inner_height - 1,
        [Hint("↑↓", "select")] if is_form else [],
        panel.inner_width,
        mapper,
        panel.inner_x,
        position + (" · " if is_form else ""),
    )

    preview = layout.preview
    preview_palette = (
        "Palette: " + state.display.palette
        if state.display.use_colors
        else "Colors: off"
    )
    _draw_panel(
        screen, preview, "Preview (sample data) · " + preview_palette, title_attr
    )
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
        actions = [Hint("Enter", "accept"), Hint("Ctrl+G/Esc", "restore")]
        help_text = [Hint("Ctrl+U", "clear"), Hint("Backspace", "delete")]
    elif state.numeric_edit is not None:
        actions = [Hint("Enter", "accept"), Hint("Esc", "restore")]
        help_text = [Hint("Digits", "edit"), Hint("Backspace", "delete")]
    else:
        actions = [
            Hint("Ctrl+S", "save"),
            Hint("Esc", "cancel"),
            Hint("Ctrl+C", "interrupt"),
        ]
        if state.form_item:
            help_text = [
                Hint("↑↓", "select"),
                Hint("←→", "adjust"),
                Hint("Enter", "edit"),
                Hint("Ctrl+G", "back"),
            ]
        elif state.page == "layout":
            help_text = [
                Hint("Tab", "page"),
                Hint("↑↓", "select"),
                Hint("←→", "adjust"),
                Hint("Enter", "edit"),
            ]
        elif state.page == "settings":
            help_text = [
                Hint("Tab", "page"),
                Hint("↑↓", "select"),
                Hint("←→", "adjust"),
                Hint("Enter", "edit/save"),
            ]
        else:
            actions = [
                Hint("Enter/Ctrl+S", "save"),
                Hint("Esc", "cancel"),
                Hint("Ctrl+C", "interrupt"),
            ]
            help_text = [
                Hint("Tab", "page"),
                Hint("Space", "toggle"),
                Hint("Ctrl+E", "format"),
                Hint("↑↓", "select"),
                Hint("←→", "order"),
            ]
    _draw_shortcuts(screen, layout.actions_y, actions, width, mapper)
    _draw_shortcuts(screen, layout.help_y, help_text, width, mapper)
    screen.refresh()
    return layout.list_height
