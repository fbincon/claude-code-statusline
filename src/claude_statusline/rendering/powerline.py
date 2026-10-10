"""Width-bounded item blocks, composed after visibility and item fitting."""

from __future__ import annotations

from dataclasses import dataclass, replace

from . import layout, styles


@dataclass(frozen=True)
class Block:
    text: str
    priority: int = 50
    prefer_slash_breaks: bool = False


def _edge(text, last=False):
    units = layout._styled_units(text)
    return styles.parse(units[-1 if last else 0].style) if units else styles.DEFAULT


def _separator(left, right, config):
    if not config.use_colors:
        return ">"
    a, b = _edge(left, True), _edge(right)
    arrow = config.powerline_glyph == "powerline" and a.background is not None and a.background != b.background
    style = styles.Style(False, a.background if arrow else a.foreground, b.background)
    return style.sgr() + ("\ue0b0" if arrow else ">") + styles.RESET


def width(blocks, padding=1, cap=True):
    return sum(layout._display_width(b.text) + 2 * padding for b in blocks) + max(0, len(blocks) - 1) + bool(blocks and cap)


def row(blocks, config, padding=1, cap=True):
    result = []
    previous = None
    for block in blocks:
        if previous is not None:
            result.append(_separator(previous.text, block.text, config))
        if padding:
            state = _edge(block.text)
            left = state.sgr() + " " * padding + (styles.RESET if config.use_colors else "")
            state = _edge(block.text, True)
            right = state.sgr() + " " * padding + (styles.RESET if config.use_colors else "")
            result.append(left + block.text + right)
        else:
            result.append(block.text)
        previous = block
    if blocks and cap:
        result.append(_separator(blocks[-1].text, "", config))
    value = "".join(result)
    return layout._ensure_reset(value, styles.RESET if config.use_colors else "")


def fit(blocks, columns, config):
    """Explicit/subagent rows: spend cells on content before decorations."""
    blocks = list(blocks)
    if not blocks or columns < 1:
        return ""
    padding, cap = 1, True
    if width(blocks, padding, cap) > columns:
        padding = 0
    if width(blocks, padding, cap) > columns:
        cap = False
    while len(blocks) > 1 and width(blocks, padding, cap) > columns:
        index = min(range(len(blocks)), key=lambda n: (blocks[n].priority, -n))
        del blocks[index]
    if width(blocks, padding, cap) > columns:
        blocks[0] = replace(blocks[0], text=layout.truncate_styled(blocks[0].text, columns))
    return row(blocks, config, padding, cap)


def wrap(blocks, columns, config):
    """Automatic rows keep all content, splitting only complete graphemes."""
    columns = max(2, columns)
    result, current = [], []
    padding, cap = (1, True) if columns >= 4 else (0, False)
    body_width = columns - 2 * padding - int(cap)
    # A two-cell cluster must always fit without being replaced by decoration.
    if body_width < 2:
        padding, cap, body_width = 0, False, columns
    for block in blocks:
        if current and width([*current, block], padding, cap) > columns:
            result.append(row(current, config, padding, cap))
            current = []
        if width([block], padding, cap) > columns:
            chunks = layout._split_ansi_text(block.text, body_width, block.prefer_slash_breaks)
            for chunk in chunks[:-1]:
                result.append(row([replace(block, text=chunk)], config, padding, cap))
            current = [replace(block, text=chunks[-1])]
        else:
            current.append(block)
    if current:
        result.append(row(current, config, padding, cap))
    return result
