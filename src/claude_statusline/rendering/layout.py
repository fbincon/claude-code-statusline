"""rendering / layout implementation."""

from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass
from claude_statusline.rendering import palette as rendering_palette


ANSI_SGR_RE = re.compile(r"\x1b\[[0-9;:]*m")


DEFAULT_TERMINAL_COLUMNS = 120


STATUSLINE_WIDTH_MARGIN = 2


MIN_CONTENT_WIDTH = 2  # a single terminal-wide Unicode character must fit


@dataclass(frozen=True)
class _LayoutSegment:
    text: str
    prefer_slash_breaks: bool = False


@dataclass(frozen=True)
class _StyledUnit:
    text: str
    width: int
    style: str


def _char_width(ch):
    """Return a dependency-free approximation of terminal cell width."""
    if not ch or unicodedata.combining(ch):
        return 0
    category = unicodedata.category(ch)
    if category in ("Cc", "Cf"):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def _display_width(text):
    """Measure visible terminal cells while ignoring the SGR sequences we emit."""
    plain = ANSI_SGR_RE.sub("", text or "")
    return sum(_char_width(ch) for ch in plain)


def _terminal_content_width(env=None):
    """Return usable statusline cells, with a stable fallback for manual runs."""
    source = os.environ if env is None else env
    try:
        columns = int(source.get("COLUMNS", ""))
        if columns <= 0:
            raise ValueError
    except (TypeError, ValueError):
        columns = DEFAULT_TERMINAL_COLUMNS
    return max(MIN_CONTENT_WIDTH, columns - STATUSLINE_WIDTH_MARGIN)


def _sgr_style_after(sequence):
    """Track the simple full-style SGR sequences used by this renderer."""
    params = sequence[2:-1]
    values = params.replace(":", ";").split(";") if params else ["0"]
    resets = "0" in values
    non_reset = any(value not in ("", "0") for value in values)
    if resets and not non_reset:
        return ""
    # Every non-reset SGR emitted above is a complete style, not a partial
    # modifier, so replacing the active style is both sufficient and safer.
    return sequence


def _styled_units(text):
    """Convert ANSI-colored text into visible units carrying their active style."""
    units = []
    style = ""
    position = 0
    for match in ANSI_SGR_RE.finditer(text):
        for ch in text[position : match.start()]:
            width = _char_width(ch)
            if width == 0 and units and units[-1].style == style:
                previous = units[-1]
                units[-1] = _StyledUnit(
                    previous.text + ch, previous.width, previous.style
                )
            else:
                units.append(_StyledUnit(ch, width, style))
        style = _sgr_style_after(match.group(0))
        position = match.end()
    for ch in text[position:]:
        width = _char_width(ch)
        if width == 0 and units and units[-1].style == style:
            previous = units[-1]
            units[-1] = _StyledUnit(previous.text + ch, previous.width, previous.style)
        else:
            units.append(_StyledUnit(ch, width, style))
    return units


def _render_styled_units(units):
    """Render a unit slice with self-contained ANSI state."""
    output = []
    active = ""
    for unit in units:
        if unit.style != active:
            if active:
                output.append(rendering_palette.C_RESET)
            if unit.style:
                output.append(unit.style)
            active = unit.style
        output.append(unit.text)
    if active:
        output.append(rendering_palette.C_RESET)
    return "".join(output)


def truncate_styled(text, width):
    """Clip terminal cells while preserving combining units and color resets."""
    if _display_width(text) <= width:
        return text
    units = []
    used = 0
    for unit in _styled_units(text):
        if used + unit.width > max(0, width - 1):
            break
        units.append(unit)
        used += unit.width
    if width > 0:
        units.append(_StyledUnit("…", 1, units[-1].style if units else ""))
    return _render_styled_units(units)


def _split_ansi_text(text, width, prefer_slashes=False):
    """Split colored text without data loss, optionally preferring path slashes."""
    width = max(MIN_CONTENT_WIDTH, int(width))
    if _display_width(text) <= width:
        return [text]
    units = _styled_units(text)
    if not units:
        return [text]

    chunks = []
    start = 0
    while start < len(units):
        used = 0
        end = start
        while end < len(units):
            next_width = units[end].width
            if end > start and used + next_width > width:
                break
            if end == start and next_width > width:
                end += 1
                break
            used += next_width
            end += 1
        if end >= len(units):
            chunks.append(_render_styled_units(units[start:]))
            break

        if prefer_slashes:
            # Break before the last path separator that fits so concatenating
            # the plain chunks reconstructs an exact POSIX, drive, or UNC path.
            slash = None
            for index in range(start + 1, end):
                if units[index].text.startswith(("/", "\\")):
                    slash = index
            if slash is not None:
                end = slash
        if end <= start:  # defensive progress guarantee for pathological input
            end = start + 1
        chunks.append(_render_styled_units(units[start:end]))
        start = end
    return chunks


def _ensure_reset(text, reset=rendering_palette.C_RESET):
    if not reset:
        return text
    return text if text.endswith(reset) else text + reset


def _layout_segments(
    segments, width, separator=rendering_palette.C_SEP, reset=rendering_palette.C_RESET
):
    """Pack ordered top-level segments into complete, width-bounded rows."""
    width = max(MIN_CONTENT_WIDTH, int(width))
    separator_width = _display_width(separator)
    rows = []
    current = ""
    current_width = 0

    for segment in segments:
        if not isinstance(segment, _LayoutSegment):
            segment = _LayoutSegment(str(segment))
        if not segment.text:
            continue
        segment_width = _display_width(segment.text)
        if segment_width <= width:
            if current and current_width + separator_width + segment_width <= width:
                current += separator + segment.text
                current_width += separator_width + segment_width
            else:
                if current:
                    rows.append(_ensure_reset(current, reset))
                current = segment.text
                current_width = segment_width
            continue

        if current:
            rows.append(_ensure_reset(current, reset))
            current = ""
            current_width = 0
        chunks = _split_ansi_text(
            segment.text,
            width,
            prefer_slashes=segment.prefer_slash_breaks,
        )
        rows.extend(_ensure_reset(chunk, reset) for chunk in chunks[:-1])
        current = chunks[-1]
        current_width = _display_width(current)

    if current:
        rows.append(_ensure_reset(current, reset))
    return rows
