"""Translate production sample SGR units into drawable protocol spans."""

from __future__ import annotations

from claude_statusline.rendering import layout


def foreground_style(sequence: str) -> tuple[bool, dict | None]:
    from . import styles

    state = styles.parse(sequence)
    return state.bold, styles.wire_color(state.foreground)


def row_spans(row: str) -> list[dict]:
    from . import styles

    result = []
    for unit in layout._styled_units(row):
        state = styles.parse(unit.style)
        value = {
            "text": unit.text,
            "bold": state.bold,
            "foreground": styles.wire_color(state.foreground),
            "background": styles.wire_color(state.background),
        }
        if result and all(
            result[-1][key] == value[key]
            for key in ("bold", "foreground", "background")
        ):
            result[-1]["text"] += unit.text
        else:
            result.append(value)
    return result
