"""rendering / layout implementation."""

from __future__ import annotations

import os
import re
from . import text as terminal_text
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
    return terminal_text.char_width(ch)


def _display_width(text):
    return terminal_text.display_width(ANSI_SGR_RE.sub("", text or ""))


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


def _sgr_style_after(sequence, current=""):
    """Compatibility serializer for an incremental style transition."""
    from . import styles

    return styles.advance(styles.parse(current), sequence).sgr()


def _styled_units(text):
    """Partition the visible row first, then attach each grapheme's base style."""
    from . import styles

    plain, states = [], []
    state = styles.DEFAULT
    position = 0
    for match in ANSI_SGR_RE.finditer(text):
        part = text[position : match.start()]
        plain.append(part)
        states.extend([state] * len(part))
        state = styles.advance(state, match.group())
        position = match.end()
    part = text[position:]
    plain.append(part)
    states.extend([state] * len(part))
    result, position = [], 0
    for cluster in terminal_text.graphemes("".join(plain)):
        base = next((i for i, char in enumerate(cluster) if _char_width(char)), 0)
        result.append(
            _StyledUnit(
                cluster,
                terminal_text.cluster_width(cluster),
                states[position + base].sgr(),
            )
        )
        position += len(cluster)
    return result


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


def truncate_styled(text, width, *, ellipsis="…"):
    """Clip complete graphemes and emit self-contained supported SGR state."""
    width = max(0, int(width))
    if not width:
        return ""
    source = _styled_units(text)
    if sum(unit.width for unit in source) <= width:
        return _render_styled_units(source)
    suffix_width = _display_width(ellipsis)
    if suffix_width > width:
        ellipsis, suffix_width = "", 0
    units, used = [], 0
    for unit in source:
        if used + unit.width > width - suffix_width:
            break
        units.append(unit)
        used += unit.width
    if ellipsis:
        units.append(
            _StyledUnit(ellipsis, suffix_width, units[-1].style if units else "")
        )
    return _render_styled_units(units)


def _split_ansi_text(text, width, prefer_slashes=False):
    """Split colored text without data loss, optionally preferring path slashes."""
    width = max(MIN_CONTENT_WIDTH, int(width))
    units = _styled_units(text)
    if sum(unit.width for unit in units) <= width:
        return [_render_styled_units(units)]
    if not units:
        return [text]
    # A grapheme wider than the entire viewport cannot be split safely.
    units = [u if u.width <= width else _StyledUnit("…", 1, u.style) for u in units]

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
    # Ordinary generated styles already sit between graphemes. Avoid parsing
    # style state on that hot path, but normalize any boundary inside a cluster.
    plain = ANSI_SGR_RE.sub("", text)
    if not (plain.isascii() and plain.isprintable()):
        boundaries = {0}
        offset = 0
        for cluster in terminal_text.graphemes(plain):
            offset += len(cluster)
            boundaries.add(offset)
        removed = 0
        for match in ANSI_SGR_RE.finditer(text):
            if match.start() - removed not in boundaries:
                text = _render_styled_units(_styled_units(text))
                break
            removed += len(match.group())
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
