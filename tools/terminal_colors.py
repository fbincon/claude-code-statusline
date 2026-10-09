"""Resolve captured terminal colors for visual evidence and contrast checks."""

from __future__ import annotations

import re

COLORS = {
    "black": "202127",
    "red": "f08080",
    "green": "85c99a",
    "brown": "e5c07b",
    "yellow": "e5c07b",
    "blue": "87aade",
    "magenta": "cba2e5",
    "cyan": "85d1db",
    "white": "dedee7",
    "brightblack": "858895",
    "brightred": "fca5a5",
    "brightgreen": "a6e3a1",
    "brightyellow": "f9e2af",
    "brightblue": "89b4fa",
    "brightmagenta": "cba6f7",
    "brightcyan": "94e2d5",
    "brightwhite": "ffffff",
}


def resolve(value: str, default: str, palette=None) -> str:
    """ANSI names use the documented capture palette, not a physical terminal."""
    value = (COLORS if palette is None else palette).get(value, value).removeprefix("#")
    return "#" + value if re.fullmatch(r"[0-9a-fA-F]{6}", value) else default


def cell_colors(cell: dict, foreground="#dedee7", background="#17191e", palette=None):
    fg = resolve(cell["fg"], foreground, palette)
    bg = resolve(cell["bg"], background, palette)
    return (bg, fg) if cell["reverse"] else (fg, bg)


def contrast(foreground: str, background: str) -> float:
    def luminance(value):
        components = [int(value[i : i + 2], 16) / 255 for i in (1, 3, 5)]
        linear = [
            c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
            for c in components
        ]
        return sum(c * weight for c, weight in zip(linear, (0.2126, 0.7152, 0.0722)))

    low, high = sorted((luminance(foreground), luminance(background)))
    return (high + 0.05) / (low + 0.05)
