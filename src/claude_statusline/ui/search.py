"""Deterministic local catalog search; mirrored by the native editor.

Positions index original Unicode code points, never normalized text or bytes.
NFKD and per-code-point lowercasing deliberately avoid process locale settings.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import re
import unicodedata

from claude_statusline.config import catalog
from claude_statusline.i18n import translate


SPACES = " \t\n\r\v\f\u0085\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000"


@dataclass(frozen=True)
class Match:
    rank: int
    positions: tuple[int, ...]
    text: str
    field: str = ""


@lru_cache(maxsize=2048)
def normalize(text: str) -> tuple[str, tuple[int, ...]]:
    characters, positions = [], []
    for index, original in enumerate(text):
        for decomposed in unicodedata.normalize("NFKD", original):
            for character in decomposed.lower():
                if character in SPACES:
                    if not characters or characters[-1] == " ":
                        continue
                    character = " "
                characters.append(character)
                positions.append(index)
    if characters and characters[-1] == " ":
        characters.pop()
        positions.pop()
    return "".join(characters), tuple(positions)


def match_text(text: str, query: str, field: str = "") -> Match | None:
    value, mapping = normalize(text)
    needle, _ = normalize(query)
    if not needle:
        return Match(5, (), text, field)
    if not value:
        return None
    indices = []
    if value == needle:
        rank, indices = 0, list(range(len(value)))
    elif value.startswith(needle):
        rank, indices = 1, list(range(len(needle)))
    else:
        words = list(re.finditer(r"[a-z0-9]+", value))
        initials = "".join(word[0][0] for word in words)
        if len(needle) > 1 and re.fullmatch(r"[a-z0-9]+", needle) and initials.startswith(needle):
            rank, indices = 2, [word.start() for word in words[:len(needle)]]
        elif needle in value:
            start = value.index(needle)
            rank, indices = 3, list(range(start, start + len(needle)))
        else:
            rank, offset = 4, 0
            for character in needle:
                found = value.find(character, offset)
                if found < 0:
                    return None
                indices.append(found)
                offset = found + 1
    return Match(rank, tuple(dict.fromkeys(mapping[i] for i in indices)), text, field)


def fields(scope: str, item: str, custom_label: str | None = None):
    definition = catalog.BY_SCOPE[scope][item]
    prefix = f"items.{scope}.{item}."
    return (
        ("id", item),
        ("label.en", definition.label),
        ("label.zh-CN", translate(prefix + "label", "zh-CN")),
        ("custom_label", custom_label or ""),
        ("description.en", definition.description),
        ("description.zh-CN", translate(prefix + "description", "zh-CN")),
        ("category.id", definition.group),
        ("category.en", translate("catalog.categories." + definition.group, "en")),
        ("category.zh-CN", translate("catalog.categories." + definition.group, "zh-CN")),
    )


def best_match(values, query: str) -> Match | None:
    matches = (match_text(value, query, field) for field, value in values)
    return min((match for match in matches if match is not None), key=lambda match: match.rank, default=None)


def categories(scope: str) -> list[str]:
    return ["all", *dict.fromkeys(item.group for item in catalog.BY_SCOPE[scope].values())]


def segments(text: str, positions=()) -> list[tuple[str, bool]]:
    marked = set(positions)
    result: list[tuple[str, bool]] = []
    for index, character in enumerate(text):
        highlight = index in marked
        if result and result[-1][1] == highlight:
            result[-1] = (result[-1][0] + character, highlight)
        else:
            result.append((character, highlight))
    return result


def snippet(match: Match) -> Match:
    """Start near actual evidence rather than hiding a late match after clipping."""
    start = max(0, min(match.positions, default=0) - 3)
    if not start:
        return match
    return Match(match.rank, tuple(p - start + 1 for p in match.positions), "…" + match.text[start:], match.field)
