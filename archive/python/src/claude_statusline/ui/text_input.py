"""Keep editable single-line text intact at grapheme boundaries."""

from claude_statusline.rendering.text import graphemes, _property


def printable(value):
    return bool(value) and all(
        ch == "\u200d"
        or 0xE0020 <= ord(ch) <= 0xE007F
        or (
            ord(ch) >= 32
            and not 0x7F <= ord(ch) < 0xA0
            and not 0xD800 <= ord(ch) <= 0xDFFF
            and _property(ord(ch)) not in (1, 2, 3)
        )
        for ch in value
    )


def backspace(value):
    return "".join(list(graphemes(value))[:-1])
