"""Translate production sample SGR units into drawable protocol spans."""

from __future__ import annotations

from claude_statusline.rendering import layout


def foreground_style(sequence: str) -> tuple[bool, dict | None]:
    if not sequence:
        return False, None
    codes = [int(code or "0") for code in sequence[2:-1].replace(":", ";").split(";")]
    bold = False
    foreground = None
    index = 0
    while index < len(codes):
        code = codes[index]
        if code == 1:
            bold = True
        if 30 <= code <= 37 or 90 <= code <= 97:
            foreground = {
                "kind": "ansi",
                "value": code - 30 if code < 90 else code - 90 + 8,
            }
        elif (
            code == 38
            and codes[index + 1 : index + 2] == [2]
            and len(codes) >= index + 5
        ):
            foreground = {
                "kind": "rgb",
                "value": "#"
                + "".join(f"{value:02x}" for value in codes[index + 2 : index + 5]),
            }
            index += 4
        index += 1
    return bold, foreground


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
