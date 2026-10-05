"""Pure terminal geometry and grouped form windows; no curses or persistence."""

from __future__ import annotations

from dataclasses import dataclass
from collections.abc import Sequence


@dataclass(frozen=True)
class Panel:
    y: int
    width: int
    height: int
    framed: bool

    @property
    def inner_y(self) -> int:
        return self.y + 1

    @property
    def inner_x(self) -> int:
        return 2 if self.framed else 1

    @property
    def inner_width(self) -> int:
        return max(1, self.width - 2 * self.inner_x)

    @property
    def inner_height(self) -> int:
        return max(1, self.height - (2 if self.framed else 1))


@dataclass(frozen=True)
class ScreenLayout:
    content: Panel
    preview: Panel
    actions_y: int
    help_y: int

    @property
    def list_height(self) -> int:
        # Column headings and the position indicator have their own rows.
        return max(1, self.content.inner_height - 2)


def dimensions(width: int, height: int) -> ScreenLayout:
    framed = width >= 64 and height >= 20
    preview_rows = min(5, max(2, (height - 10) // 4))
    preview_height = preview_rows + (2 if framed else 1)
    content_height = max(3, height - 6 - preview_height)
    return ScreenLayout(
        Panel(4, width, content_height, framed),
        Panel(4 + content_height, width, preview_height, framed),
        height - 2,
        height - 1,
    )


@dataclass(frozen=True)
class FormLine:
    group: str
    index: int | None = None


@dataclass(frozen=True)
class FormWindow:
    start: int
    end: int
    lines: tuple[FormLine, ...]


def form_window(
    rows: Sequence[dict], selected: int, scroll: int, height: int
) -> FormWindow:
    """Fit headers and editable rows, repeating the first visible group title."""
    if not rows:
        return FormWindow(0, 0, ())
    height = max(1, height)
    selected = max(0, min(selected, len(rows) - 1))
    start = min(max(0, scroll), selected, max(0, len(rows) - (height - 1)))

    def window(first: int) -> FormWindow:
        lines = []
        group = None
        end = first
        for index in range(first, len(rows)):
            current = rows[index]["group"]
            heading = height > 1 and current != group
            if len(lines) + 1 + int(heading) > height:
                break
            if heading:
                lines.append(FormLine(current))
            lines.append(FormLine(current, index))
            group = current
            end = index + 1
        return FormWindow(first, end, tuple(lines))

    result = window(start)
    while result.end <= selected:
        start += 1
        result = window(start)
    return result
