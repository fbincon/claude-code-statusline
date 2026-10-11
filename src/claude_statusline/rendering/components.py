"""Shared literal text and single-spacer composition for both output scopes."""

from dataclasses import dataclass, replace
from . import layout, appearance, styles, powerline


@dataclass(frozen=True)
class Cell:
    id: str
    text: str
    priority: int = 50
    spacer: bool = False
    payload: object = None


def literal(node, config, scope="main"):
    text = node.text or ""
    if not text:
        return ""
    options = node.options
    if options.icon:
        text = options.icon + " " + text
    if options.label:
        text = options.label + " " + text
    if config.use_colors:
        text = appearance.apply(text, config, "text", options, scope=scope)
    if options.max_width is not None:
        text = layout.truncate_styled(text, options.max_width)
    return text


def fit_row(cells, columns, config, join):
    """Fit content first, then allocate the unused cells to the flexible gap."""
    if columns < 1:
        return ""
    divider = next((n for n, c in enumerate(cells) if c.spacer), None)
    left = [c for c in (cells if divider is None else cells[:divider]) if c.text]
    right = [] if divider is None else [c for c in cells[divider + 1 :] if c.text]
    if not left and not right:
        return ""
    is_powerline = config.separator_style == "powerline"
    padding, cap = 1, True

    def text(side):
        if is_powerline:
            return powerline.row(
                [powerline.Block(c.text, c.priority) for c in side],
                config,
                padding,
                cap,
            )
        return join(side)

    def occupied():
        return layout._display_width(text(left)) + layout._display_width(text(right))

    if is_powerline and occupied() > columns:
        padding = 0
    if is_powerline and occupied() > columns:
        cap = False
    while len(left) + len(right) > 1 and occupied() > columns:
        ordered = [(left, n, c) for n, c in enumerate(left)] + [
            (right, n, c) for n, c in enumerate(right)
        ]
        victim = min(range(len(ordered)), key=lambda n: (ordered[n][2].priority, -n))
        side, index, _ = ordered[victim]
        del side[index]
    if occupied() > columns:
        side = left or right
        side[0] = replace(side[0], text=layout.truncate_styled(side[0].text, columns))
    a, b = text(left), text(right)
    gap = (
        max(0, columns - layout._display_width(a) - layout._display_width(b))
        if divider is not None
        else 0
    )
    reset = styles.RESET if config.use_colors else ""
    return layout._ensure_reset(a + (reset + " " * gap if gap else "") + b, reset)
