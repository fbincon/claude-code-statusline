"""Terminal-default chrome and capability-aware sample preview colors."""

from __future__ import annotations

import curses
from claude_statusline.rendering import styles

TEXT = curses.A_NORMAL
TITLE = curses.A_BOLD
KEY = curses.A_BOLD
DESCRIPTION = curses.A_NORMAL
BORDER = curses.A_NORMAL
SELECTION = curses.A_REVERSE
ACTIVE_TAB = curses.A_REVERSE | curses.A_BOLD
NOTICE = curses.A_BOLD

from claude_statusline.rendering.colors import (
    nearest_terminal_color as nearest_terminal_color, terminal_color as _terminal_color,
    _XTERM_RGB as _XTERM_RGB, _XTERM_BASE_RGB as _XTERM_BASE_RGB,
    _xterm_palette as _xterm_palette,
)


def _ansi_style(style: str, colors: int) -> tuple[bool, int | None]:
    state = styles.parse(style)
    bold = state.bold or bool(
        colors == 8
        and state.foreground
        and state.foreground[0] == "ansi"
        and 8 <= int(state.foreground[1]) < 16
    )
    return bold, _terminal_color(state.foreground, colors)


class _ColorMapper:
    """Cache color pairs without changing the terminal's palette or defaults."""

    def __init__(self):
        self.colors = 0
        self.default_colors = False
        self.preview_attr = 0
        self._pairs: dict[tuple[int, int], int] = {}
        self._failed_pairs: set[tuple[int, int]] = set()
        self._maximum = 0
        self._styles: dict[str, int] = {}
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
        """Map sample text without painting a terminal background."""
        if color is None or self.colors < 8 or not self.default_colors:
            return 0
        return self._pair(color, -1)

    def style(self, sgr: str) -> int:
        """Map complete supported state, with independent terminal defaults."""
        if sgr in self._styles:
            return self._styles[sgr]
        state = styles.parse(sgr)
        bold, foreground = _ansi_style(sgr, self.colors)
        background = _terminal_color(state.background, self.colors)
        attr = curses.A_BOLD if bold else 0
        if self.colors >= 8 and (foreground is not None or background is not None):
            if self.default_colors or (
                foreground is not None and background is not None
            ):
                attr |= self._pair(
                    -1 if foreground is None else foreground,
                    -1 if background is None else background,
                )
        if len(self._styles) < 1024:
            self._styles[sgr] = attr
        return attr

    def preview_style(self, sgr: str) -> int:
        """Explicit sample backgrounds override the terminal-default surface."""
        return self.style(sgr)
