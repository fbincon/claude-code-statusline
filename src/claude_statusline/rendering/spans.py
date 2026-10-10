"""Translate production sample SGR units into drawable protocol spans."""

from __future__ import annotations

from claude_statusline.rendering import layout


def foreground_style(sequence: str) -> tuple[bool, dict | None]:
    from . import styles

    state = styles.parse(sequence)
    return state.bold, styles.wire_color(state.foreground)


def row_spans(row: str) -> list[dict]:
    result = []
    for unit in layout._styled_units(row):
        bold, foreground = foreground_style(unit.style)
        if (
            result
            and result[-1]["bold"] == bold
            and result[-1]["foreground"] == foreground
        ):
            result[-1]["text"] += unit.text
        else:
            result.append({"text": unit.text, "bold": bold, "foreground": foreground})
    return result
