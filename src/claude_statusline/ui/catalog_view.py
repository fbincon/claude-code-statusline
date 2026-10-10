"""Catalog-specific presentation, separate from configuration and search."""

from claude_statusline.i18n import translate as t
from claude_statusline.rendering.layout import _display_width
from claude_statusline.ui import search, theme


def draw_item(screen, state, scope, item, match, y, x, width, selected, enabled):
    from claude_statusline.ui.drawing import _add_spans, _column, _item_column

    query = state.subagent_search if scope == "subagent" else state.search
    prefix = f"{'›' if selected else ' '} [{'x' if enabled else ' '}] "
    label = t(f"items.{scope}.{item}.label", state.language)
    label_match = search.match_text(label, query)
    label_column = _column(label, _item_column(width))
    description = t(f"items.{scope}.{item}.description", state.language)
    hint = bool(search.normalize(query)[0]) and (
        label_match is None or label_match.rank > match.rank
    )
    if hint:
        match = search.snippet(match)
    detail = (
        t("catalog.search.match", state.language) + match.text if hint else description
    )
    detail_match = match if hint else search.match_text(description, query)
    text = prefix + label_column + "  " + detail
    positions = (
        [
            len(prefix) + p
            for p in label_match.positions
            if p < len(label_column) and label_column[p] == label[p]
        ]
        if label_match
        else []
    )
    if detail_match:
        offset = len(prefix + label_column + "  ") + (
            len(t("catalog.search.match", state.language)) if hint else 0
        )
        positions.extend(offset + p for p in detail_match.positions)
    attr = theme.SELECTION if selected else 0
    padded = text + " " * max(0, width - _display_width(text))
    spans = [
        (part, attr | (theme.KEY if highlighted else 0))
        for part, highlighted in search.segments(padded, positions)
    ]
    _add_spans(screen, y, x, spans, width)


def draw_categories(screen, state, panel):
    from claude_statusline.ui.drawing import _add_text

    scope = "subagent" if state.page == "subagents" else "main"
    categories = search.categories(scope)
    selected = categories.index(state.category_selection)
    capacity = max(1, panel.inner_height - 1)
    start = selected // capacity * capacity
    for row, category in enumerate(categories[start : start + capacity]):
        _add_text(
            screen,
            panel.inner_y + row,
            panel.inner_x,
            ("› " if category == state.category_selection else "  ")
            + t("catalog.categories." + category, state.language),
            panel.inner_width,
            theme.SELECTION if category == state.category_selection else 0,
        )
    return f"{selected + 1}/{len(categories)}"
