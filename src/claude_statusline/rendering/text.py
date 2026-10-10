"""Fixed Unicode 18.0 grapheme boundaries and terminal cells, shared with native UI.

Tables are generated offline. Runtime imports only the required tables and never
imports wcwidth or depends on the interpreter's Unicode database version.
"""

from __future__ import annotations

from functools import lru_cache


def _contains(code, ranges):
    if not ranges or code < ranges[0][0] or code > ranges[-1][1]:
        return False
    low, high = 0, len(ranges)
    while low < high:
        middle = (low + high) // 2
        start, end = ranges[middle][:2]
        if code < start:
            high = middle
        elif code > end:
            low = middle + 1
        else:
            return True
    return False


@lru_cache(maxsize=2048)
def char_width(character: str) -> int:
    if not character:
        return 0
    code = ord(character)
    if 32 <= code < 127:
        return 1
    if code < 32 or 0x7F <= code < 0xA0 or 0xD800 <= code <= 0xDFFF:
        return 0
    from . import _unicode_width as data

    if _contains(code, data.ZERO_WIDTH):
        return 0
    return 2 if _contains(code, data.WIDE_EASTASIAN) else 1


@lru_cache(maxsize=2048)
def _property(code):
    if 32 <= code < 127:
        return 0
    if 0xAC00 <= code <= 0xD7A3:
        return 12 if (code - 0xAC00) % 28 == 0 else 13
    from ._unicode_grapheme import BREAK_PROPERTIES

    low, high = 0, len(BREAK_PROPERTIES)
    while low < high:
        middle = (low + high) // 2
        start, end, value = BREAK_PROPERTIES[middle]
        if code < start:
            high = middle
        elif code > end:
            low = middle + 1
        else:
            return value
    return 0


@lru_cache(maxsize=2048)
def _consonant(code):
    from ._unicode_grapheme import INCB_CONSONANT

    return _contains(code, INCB_CONSONANT)


@lru_cache(maxsize=256)
def _short_graphemes(text):
    return tuple(_graphemes_uncached(text))


def graphemes(text: str):
    """Reuse bounded short strings within a refresh, preserving exact text."""
    if text.isascii() and text.isprintable():
        yield from text
    elif len(text) <= 512:
        yield from _short_graphemes(text)
    else:
        yield from _graphemes_uncached(text)


def _graphemes_uncached(text: str):
    """Yield UAX #29 extended graphemes, preserving original code points."""
    if not text:
        return
    if text.isascii() and text.isprintable():
        yield from text
        return
    from . import _unicode_grapheme as data

    start = 0
    previous = _property(ord(text[0]))
    regional = int(previous == 6)
    for index in range(1, len(text)):
        code = ord(text[index])
        current = _property(code)
        boundary = True
        if previous == 1 and current == 2:  # GB3
            boundary = False
        elif previous in (1, 2, 3) or current in (1, 2, 3):  # GB4/5
            pass
        elif (
            previous == 9
            and current in (9, 10, 12, 13)
            or previous in (10, 12)
            and current in (10, 11)
            or previous in (11, 13)
            and current == 11
        ):  # GB6–8
            boundary = False
        elif current in (4, 5, 8) or previous == 7:  # GB9/9a/9b
            boundary = False
        elif _consonant(code):  # GB9c
            cursor = index - 1
            while cursor >= start and _contains(ord(text[cursor]), data.INCB_EXTEND):
                cursor -= 1
            if cursor >= start and _contains(ord(text[cursor]), data.INCB_LINKER):
                boundary = False
        if (
            boundary and previous == 5 and _contains(code, data.EXTENDED_PICTOGRAPHIC)
        ):  # GB11
            cursor = index - 2
            while cursor >= start and _property(ord(text[cursor])) == 4:
                cursor -= 1
            if cursor >= start and _contains(
                ord(text[cursor]), data.EXTENDED_PICTOGRAPHIC
            ):
                boundary = False
        if previous == 6 and current == 6:  # GB12/13
            boundary = regional % 2 == 0
        if boundary:
            yield text[start:index]
            start = index
        regional = regional + 1 if current == 6 and previous == 6 else int(current == 6)
        previous = current
    yield text[start:]


@lru_cache(maxsize=1024)
def cluster_width(cluster: str) -> int:
    """Measure one whole grapheme; ambiguous characters occupy one column.

    The width policy follows wcwidth 0.9.1, applied *per grapheme*. An unrelated
    character following a non-emoji ZWJ is not swallowed by a string-wide shortcut.
    """
    if len(cluster) == 1:
        return char_width(cluster)
    if not cluster:
        return 0
    from . import _unicode_width as data

    total = pending = 0
    last_code = -1
    last_width = 0
    base = False
    virama = False
    index = 0
    regional = 0
    while index < len(cluster):
        code = ord(cluster[index])
        if code == 0x200D:
            index += 1 if virama or index + 1 == len(cluster) else 2
            if not virama:
                last_width = 0
            continue
        if code == 0xFE0F and base:
            if _contains(last_code, data.VS16_NARROW_TO_WIDE):
                pending = 2
            base = False
            index += 1
            continue
        if code == 0xFE0E and base:
            if _contains(last_code, data.VS15_WIDE_TO_NARROW) and last_width == 2:
                pending = max(0, pending - 1)
            base = False
            index += 1
            continue
        if 0x1F1E6 <= code <= 0x1F1FF:
            regional += 1
            if regional % 2 == 0:
                last_code = code
                index += 1
                continue
        elif 0x1F3FB <= code <= 0x1F3FF and (
            _contains(last_code, data.EXTENDED_PICTOGRAPHIC)
            or 0x1F1E6 <= last_code <= 0x1F1FF
        ):
            index += 1
            continue
        width = char_width(cluster[index])
        if width:
            if virama:
                pending = 2
            else:
                total += pending
                pending = width
            last_code, last_width, base, virama = code, width, True, False
        elif _contains(code, data.VIRAMA):
            virama = True
        elif base and _contains(code, data.CATEGORY_MC):
            pending, base, virama = 2, False, False
        else:
            virama = False
        index += 1
    return total + pending


def units(text: str):
    return [(cluster, cluster_width(cluster)) for cluster in graphemes(text)]


@lru_cache(maxsize=512)
def _short_width(text):
    return sum(cluster_width(cluster) for cluster in graphemes(text))


def display_width(text: str) -> int:
    if text.isascii() and text.isprintable():
        return len(text)
    if len(text) <= 512:
        return _short_width(text)
    return sum(cluster_width(cluster) for cluster in graphemes(text))


def clip(text: str, width: int, ellipsis: str = "") -> str:
    width = max(0, int(width))
    if not width:
        return ""
    if display_width(text) <= width:
        return text
    suffix_width = display_width(ellipsis)
    if suffix_width > width:
        ellipsis, suffix_width = "", 0
    used, result = 0, []
    for cluster in graphemes(text):
        size = cluster_width(cluster)
        if used + size > width - suffix_width:
            break
        result.append(cluster)
        used += size
    return "".join(result) + ellipsis
