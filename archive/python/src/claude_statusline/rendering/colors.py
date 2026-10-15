"""Shared terminal color quantization; independent of curses and collection."""

from functools import lru_cache

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


@lru_cache(maxsize=2048)
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


def terminal_color(color, colors: int) -> int | None:
    if color is None or colors < 8:
        return None
    kind, value = color
    if kind == "ansi":
        if int(value) < min(colors, 256):
            return int(value)
        if int(value) < 16 and colors == 8:
            return int(value) % 8
        rgb = _XTERM_RGB[int(value)]
    else:
        rgb = tuple(int(str(value)[i : i + 2], 16) for i in (1, 3, 5))
    return nearest_terminal_color(*rgb, colors)


