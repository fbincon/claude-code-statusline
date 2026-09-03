"""Small, side-effect-free helpers shared by status line renderers."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


ANSI_SGR_RE = re.compile(r"\x1b\[[0-9;:]*m")
ANSI_RESET = "\x1b[0m"


def char_width(character: str) -> int:
    if not character or unicodedata.combining(character):
        return 0
    category = unicodedata.category(character)
    if category in ("Cc", "Cf"):
        return 0
    return 2 if unicodedata.east_asian_width(character) in ("W", "F") else 1


def display_width(text: str | None) -> int:
    plain = ANSI_SGR_RE.sub("", text or "")
    return sum(width for _unit, width in _plain_units(plain))


def _plain_units(text: str) -> list[tuple[str, int]]:
    """Group combining marks and common emoji joiners for safe truncation."""
    units: list[tuple[str, int]] = []
    regional_pending = False
    join_next = False
    for character in text:
        codepoint = ord(character)
        combining = bool(unicodedata.combining(character))
        variation = 0xFE00 <= codepoint <= 0xFE0F
        emoji_modifier = 0x1F3FB <= codepoint <= 0x1F3FF
        regional = 0x1F1E6 <= codepoint <= 0x1F1FF
        if character == "\u200d":
            if units:
                value, width = units[-1]
                units[-1] = (value + character, width)
                join_next = True
            continue
        if units and (combining or variation or emoji_modifier or join_next):
            value, width = units[-1]
            width = max(width, char_width(character)) if join_next else width
            units[-1] = (value + character, width)
            join_next = False
            continue
        if regional and regional_pending and units:
            value, _width = units[-1]
            units[-1] = (value + character, 2)
            regional_pending = False
            continue
        width = char_width(character)
        units.append((character, width))
        regional_pending = regional
        join_next = False
    return units


def truncate_text(text: str, maximum_width: int, *, ellipsis: str = "…") -> str:
    """Return a single-line prefix no wider than ``maximum_width``."""
    maximum_width = max(0, int(maximum_width))
    if display_width(text) <= maximum_width:
        return text
    if maximum_width == 0:
        return ""
    ellipsis_width = display_width(ellipsis)
    if ellipsis_width > maximum_width:
        ellipsis = ""
        ellipsis_width = 0
    budget = maximum_width - ellipsis_width
    output: list[str] = []
    used = 0
    for unit, width in _plain_units(text):
        if width and used + width > budget:
            break
        output.append(unit)
        used += width
    return "".join(output) + ellipsis


def sanitize_payload_text(value: object) -> str | None:
    """Normalize untrusted payload text without allowing ANSI or new rows."""
    if not isinstance(value, str):
        return None
    output: list[str] = []
    for character in value:
        category = unicodedata.category(character)
        if character in "\r\n\t":
            output.append(" ")
        elif category == "Cc" or (category == "Cf" and character != "\u200d"):
            output.append(" ")
        elif category == "Cs":
            output.append(" ")
        else:
            output.append(character)
    cleaned = " ".join("".join(output).split())
    return cleaned or None


def humanize_tokens(value: object) -> str | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        return None
    if isinstance(value, bool) or parsed < 0:
        return None
    if parsed >= 1_000_000:
        try:
            number = f"{parsed / 1_000_000:.2f}".rstrip("0").rstrip(".")
        except OverflowError:
            return None
        return number + "M"
    if parsed >= 1000:
        try:
            number = f"{parsed / 1000:.1f}".rstrip("0").rstrip(".")
        except OverflowError:
            return None
        return number + "K"
    return str(parsed)


def format_duration(seconds: object, *, nearest: bool = False) -> str | None:
    try:
        value = float(seconds)
    except (TypeError, ValueError, OverflowError):
        return None
    if value != value or value in (float("inf"), float("-inf")):
        return None
    total = int(value + 0.5) if nearest and value >= 0 else int(value)
    total = max(0, total)
    if total >= 3600:
        return f"{total // 3600}h {total % 3600 // 60:02d}m {total % 60:02d}s"
    return f"{total // 60}m {total % 60:02d}s"


@dataclass(frozen=True)
class StyledText:
    text: str
    style: str = ""

    def render(self, reset: str = ANSI_RESET) -> str:
        if not self.style or not self.text:
            return self.text
        return f"{self.style}{self.text}{reset}"
