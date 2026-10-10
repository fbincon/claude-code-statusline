"""rendering / formatters implementation."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


def deep_get(d, path):
    for key in path:
        if not isinstance(d, dict):
            return None
        d = d.get(key)
    return d


ANSI_SGR_RE = re.compile(r"\x1b\[[0-9;:]*m")


ANSI_RESET = "\x1b[0m"


def char_width(character: str) -> int:
    from . import text as terminal_text

    return terminal_text.char_width(character)


def display_width(text: str | None) -> int:
    plain = ANSI_SGR_RE.sub("", text or "")
    if plain.isascii() and plain.isprintable():
        return len(plain)
    from . import text as terminal_text

    return terminal_text.display_width(plain)


def _plain_units(text: str) -> list[tuple[str, int]]:
    from . import text as terminal_text

    return terminal_text.units(text)


def truncate_text(text: str, maximum_width: int, *, ellipsis: str = "…") -> str:
    """Clip at a whole grapheme, preserving SGR state when present."""
    if "\x1b[" in text:
        from .layout import truncate_styled

        return truncate_styled(text, maximum_width, ellipsis=ellipsis)
    maximum_width = max(0, int(maximum_width))
    if not maximum_width:
        return ""
    if text.isascii() and text.isprintable():
        if len(text) <= maximum_width:
            return text
        if ellipsis == "…" or (
            ellipsis.isascii() and (not ellipsis or ellipsis.isprintable())
        ):
            suffix = ellipsis if len(ellipsis) <= maximum_width else ""
            return text[: maximum_width - len(suffix)] + suffix
    from . import text as terminal_text

    return terminal_text.clip(text, maximum_width, ellipsis)


def sanitize_payload_text(value: object) -> str | None:
    """Normalize untrusted payload text without allowing ANSI or new rows."""
    if not isinstance(value, str):
        return None
    output: list[str] = []
    for character in value:
        category = unicodedata.category(character)
        if character in "\r\n\t":
            output.append(" ")
        elif category == "Cc" or (
            category == "Cf"
            and character != "\u200d"
            and not 0xE0020 <= ord(character) <= 0xE007F
        ):
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
