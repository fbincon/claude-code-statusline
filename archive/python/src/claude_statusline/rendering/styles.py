"""Incremental SGR state for foreground, background, bold and their resets."""

from __future__ import annotations

from functools import lru_cache
import re
from typing import NamedTuple

SGR_RE = re.compile(r"\x1b\[[0-9;:]*m")
RESET = "\x1b[0m"
Color = tuple[str, int | str]


class Style(NamedTuple):
    bold: bool = False
    foreground: Color | None = None
    background: Color | None = None

    def sgr(self) -> str:
        return serialize(self)


DEFAULT = Style()


def color_codes(color: Color, background=False):
    kind, value = color
    if kind == "rgb":
        return [
            48 if background else 38,
            2,
            *(int(str(value)[i : i + 2], 16) for i in (1, 3, 5)),
        ]
    index = int(value)
    if index < 8:
        return [(40 if background else 30) + index]
    if index < 16:
        return [(100 if background else 90) + index - 8]
    return [48 if background else 38, 5, index]


@lru_cache(maxsize=1024)
def serialize(style: Style) -> str:
    codes = [1] if style.bold else []
    if style.foreground is not None:
        codes.extend(color_codes(style.foreground))
    if style.background is not None:
        codes.extend(color_codes(style.background, True))
    return "\x1b[" + ";".join(map(str, codes)) + "m" if codes else ""


def _color(mode, values):
    try:
        numbers = [int(value) for value in values]
    except ValueError:
        return None
    if any(not 0 <= value <= 255 for value in numbers):
        return None
    if mode == "5" and len(numbers) == 1:
        return ("ansi", numbers[0])
    if mode == "2" and len(numbers) == 3:
        return ("rgb", "#" + "".join(f"{value:02x}" for value in numbers))
    return None


@lru_cache(maxsize=2048)
def advance(style: Style, sequence: str) -> Style:
    if not SGR_RE.fullmatch(sequence):
        return style
    bold, foreground, background = style.bold, style.foreground, style.background
    fields = sequence[2:-1].split(";")
    index = 0
    while index < len(fields):
        field = fields[index]
        index += 1
        if ":" in field:
            parts = field.split(":")
            if parts[0] not in ("38", "48") or len(parts) < 3:
                continue
            values = parts[2:]
            if parts[1] == "2" and len(values) == 4:
                if values[0] not in ("", "0"):
                    continue
                values = values[1:]
            color = _color(parts[1], values)
            if color is not None:
                if parts[0] == "38":
                    foreground = color
                else:
                    background = color
            continue
        try:
            code = int(field or "0")
        except ValueError:
            continue
        if code in (38, 48):
            if index == len(fields):
                break
            mode = fields[index]
            count = 3 if mode == "2" else 1 if mode == "5" else None
            if count is None:
                break  # Never reinterpret an unknown color payload as SGR.
            values = fields[index + 1 : index + 1 + count]
            index += 1 + count
            color = _color(mode, values)
            if color is not None:
                if code == 38:
                    foreground = color
                else:
                    background = color
        elif code == 0:
            bold, foreground, background = False, None, None
        elif code in (1, 22):
            bold = code == 1
        elif code == 39:
            foreground = None
        elif code == 49:
            background = None
        elif 30 <= code <= 37 or 90 <= code <= 97:
            foreground = ("ansi", code - 30 if code < 90 else code - 90 + 8)
        elif 40 <= code <= 47 or 100 <= code <= 107:
            background = ("ansi", code - 40 if code < 100 else code - 100 + 8)
    return Style(bold, foreground, background)


def parse(sequence: str) -> Style:
    state = DEFAULT
    for match in SGR_RE.finditer(sequence):
        state = advance(state, match.group())
    return state


def wire_color(color):
    return None if color is None else {"kind": color[0], "value": color[1]}
