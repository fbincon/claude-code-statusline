"""Cell-sized shortcut groups; styling is applied by the terminal renderer."""

from __future__ import annotations

from dataclasses import dataclass
from collections.abc import Sequence

from claude_statusline.rendering import layout


@dataclass(frozen=True)
class Hint:
    key: str
    label: str
    short: str | None = None


def segments(
    hints: Sequence[Hint], width: int, prefix: str = ""
) -> tuple[tuple[str, bool], ...]:
    """Fit whole key/action pairs, choosing short labels when necessary."""
    result = []
    used = 0
    if prefix:
        text = ""
        for unit in layout._styled_units(prefix):
            if used + unit.width > width:
                break
            text += unit.text
            used += unit.width
        result.append((text, False))
    compact = used + layout._display_width(
        " · ".join(h.key + " " + h.label for h in hints)
    ) > width
    count = 0
    for hint in hints:
        label = (hint.short or hint.label) if compact else hint.label
        separator = " · " if count else ""
        size = layout._display_width(separator + hint.key + " " + label)
        if used + size > width:
            break
        if separator:
            result.append((separator, False))
        result.extend(((hint.key, True), (" " + label, False)))
        used += size
        count += 1
    return tuple(result)
