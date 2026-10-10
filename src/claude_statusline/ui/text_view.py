"""Wrap read-only paragraphs using the editor's existing terminal cell widths."""

from claude_statusline.rendering.layout import _styled_units


def wrap_text(paragraphs, width):
    width = max(2, width)
    lines = []
    for text in paragraphs:
        if not text:
            lines.append("")
        while text:
            prefix, used = "", 0
            for unit in _styled_units(text):
                if used + unit.width > width:
                    break
                prefix += unit.text
                used += unit.width
            if prefix == text:
                lines.append(text)
                break
            cut = prefix.rfind(" ")
            if cut <= 0:
                cut = len(prefix) or 1
            lines.append(text[:cut])
            text = text[cut:].lstrip(" ")
    return lines
