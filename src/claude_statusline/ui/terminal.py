"""Cell-accurate VT painting while curses continues to own input and geometry.

Curses cells cannot represent many emoji sequences. Keep a blank backing frame
and paint bounded, complete text runs after refresh. Redraw clears the previous
frame first, so neither stale clusters nor backgrounds survive shorter content.
"""

from __future__ import annotations

import curses
import os
import sys
from contextlib import contextmanager

from claude_statusline.rendering import styles, text as cells


def _enable_vt(output):
    """Return (supported, restore); probe capabilities without terminal queries."""
    if not output.isatty():
        return False, lambda: None
    if os.name == "nt":
        import ctypes

        from ctypes import wintypes

        kernel = ctypes.windll.kernel32
        kernel.GetStdHandle.argtypes = [wintypes.DWORD]
        kernel.GetStdHandle.restype = wintypes.HANDLE
        kernel.GetConsoleMode.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(wintypes.DWORD),
        ]
        kernel.SetConsoleMode.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        handle = kernel.GetStdHandle(-11)
        mode = ctypes.c_ulong()
        if not kernel.GetConsoleMode(handle, ctypes.byref(mode)):
            return False, lambda: None
        if not kernel.SetConsoleMode(handle, mode.value | 4):
            return False, lambda: None
        return True, lambda: kernel.SetConsoleMode(handle, mode.value)
    try:
        return bool(curses.tigetstr("cup") and curses.tigetstr("sgr0")), lambda: None
    except curses.error:
        return False, lambda: None


def attribute_sgr(attr):
    codes = [0]
    if attr & curses.A_BOLD:
        codes.append(1)
    if attr & curses.A_REVERSE:
        codes.append(7)
    if attr & curses.A_UNDERLINE:
        codes.append(4)
    try:
        pair = curses.pair_number(attr)
        if pair:
            foreground, background = curses.pair_content(pair)
            if foreground >= 0:
                codes.extend(styles.color_codes(("ansi", foreground)))
            if background >= 0:
                codes.extend(styles.color_codes(("ansi", background), True))
    except curses.error:
        pass
    return "\x1b[" + ";".join(map(str, codes)) + "m"


class GraphemeScreen:
    """A frame adapter; every queued run has already been clipped by cells."""

    def __init__(self, screen, output, *, vt=False):
        self.screen, self.output, self.vt = screen, output, vt
        self.runs = []
        self.had_frame = False
        self.fallback_used = False

    def __getattr__(self, name):
        return getattr(self.screen, name)

    def erase(self):
        self.runs.clear()
        return self.screen.erase()

    def addstr(self, y, x, value, attr=0):
        rows, columns = self.screen.getmaxyx()
        if not 0 <= y < rows or not 0 <= x < columns:
            raise curses.error("Outside terminal viewport")
        budget = columns - x - int(y == rows - 1)
        value = cells.clip(value, budget)
        width = cells.display_width(value)
        if not value:
            return
        if self.vt:
            self.screen.addstr(y, x, " " * width, attr)
            self.runs.append((y, x, value, attr))
            return
        # Preserve atomic clusters even on a backend unable to paint them.
        safe = []
        for cluster in cells.graphemes(value):
            if len(cluster) > 1:
                size = cells.cluster_width(cluster)
                safe.append("?" + " " * (size - 1) if size else "")
                self.fallback_used = True
            else:
                safe.append(cluster)
        self.screen.addstr(y, x, "".join(safe), attr)

    def refresh(self):
        if self.vt or self.had_frame:
            # touchwin alone may still compare equal blank virtual/physical
            # cells and leave externally painted glyphs on the real terminal.
            self.screen.clearok(True)
            self.screen.touchwin()
        self.screen.refresh()
        if not self.vt:
            return
        # Save/restore the physical cursor to the backing curses position.
        rows, columns = self.screen.getmaxyx()
        output = ["\x1b7"]
        for y, x, value, attr in self.runs:
            if 0 <= y < rows and 0 <= x < columns:
                value = cells.clip(value, columns - x - int(y == rows - 1))
                output.extend((f"\x1b[{y + 1};{x + 1}H", attribute_sgr(attr), value))
        output.extend((styles.RESET, "\x1b8"))
        try:
            self.output.write("".join(output))
            self.output.flush()
        except (OSError, ValueError):
            self.vt = False
            self.fallback_used = True
        self.had_frame = True


@contextmanager
def screen_adapter(screen):
    output = sys.stdout
    supported, restore = _enable_vt(output)
    try:
        yield GraphemeScreen(screen, output, vt=supported)
    finally:
        restore()
