"""Terminal-default chrome and capability-aware sample preview colors."""

from __future__ import annotations

import curses

TEXT = curses.A_NORMAL
TITLE = curses.A_BOLD
KEY = curses.A_BOLD
DESCRIPTION = curses.A_NORMAL
BORDER = curses.A_NORMAL
SELECTION = curses.A_REVERSE
ACTIVE_TAB = curses.A_REVERSE | curses.A_BOLD
NOTICE = curses.A_BOLD

PREVIEW_BACKGROUND = (23, 25, 30)
PREVIEW_FOREGROUND = (222, 222, 231)


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
    """Cache color pairs without changing the terminal's palette or defaults."""

    def __init__(self):
        self.colors = 0
        self.default_colors = False
        self.preview_attr = 0
        self._pairs: dict[tuple[int, int], int] = {}
        self._failed_pairs: set[tuple[int, int]] = set()
        self._maximum = 0
        self._preview_foreground = None
        self._preview_background = None
        try:
            if curses.has_colors():
                curses.start_color()
                try:
                    curses.use_default_colors()
                    self.default_colors = True
                except curses.error:
                    pass
                self.colors = max(0, int(getattr(curses, "COLORS", 0)))
                # Python's color_pair attributes support pairs 0 through 255.
                self._maximum = min(
                    255, max(0, int(getattr(curses, "COLOR_PAIRS", 0)) - 1)
                )
        except curses.error:
            self.colors = 0
        if self.colors >= 8:
            self._preview_foreground = nearest_terminal_color(
                *PREVIEW_FOREGROUND, self.colors
            )
            self._preview_background = nearest_terminal_color(
                *PREVIEW_BACKGROUND, self.colors
            )
            # Reserve the neutral preview pair before allocating sample colors.
            self.preview_attr = self._pair(
                self._preview_foreground, self._preview_background
            )

    def _pair(self, foreground: int, background: int) -> int:
        key = (foreground, background)
        if key in self._pairs:
            return curses.color_pair(self._pairs[key])
        if key in self._failed_pairs or self.colors < 8:
            return 0
        next_pair = len(self._pairs) + 1
        if next_pair > self._maximum:
            return 0
        try:
            curses.init_pair(next_pair, foreground, background)
        except curses.error:
            self._failed_pairs.add(key)
            return 0
        self._pairs[key] = next_pair
        return curses.color_pair(next_pair)

    def foreground(self, color: int | None) -> int:
        """Compatibility foreground mapping on the default/basic background."""
        if color is None or self.colors < 8:
            return 0
        return self._pair(color, -1 if self.default_colors else curses.COLOR_BLACK)

    def style(self, sgr: str) -> int:
        """Compatibility ANSI style mapping outside a preview panel."""
        bold, foreground = _ansi_style(sgr, self.colors)
        return (curses.A_BOLD if bold else 0) | self.foreground(foreground)

    def preview_style(self, sgr: str) -> int:
        """Keep resets and uncolored spans on the preview's neutral dark pair."""
        bold, foreground = _ansi_style(sgr, self.colors)
        result = curses.A_BOLD if bold else 0
        if not self.preview_attr:
            return result
        if foreground is None:
            return result | self.preview_attr
        return result | (
            self._pair(foreground, self._preview_background) or self.preview_attr
        )
