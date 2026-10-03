"""rendering / palette implementation."""

from __future__ import annotations

from dataclasses import dataclass


C_RESET = "\033[0m"


C_MODEL = "\033[1;38;2;246;226;183m"  # bold ivory/cream #F6E2B7


C_DIR = "\033[1;38;2;171;223;167m"  # bold light green #ABDFA7


C_BRANCH = "\033[1;38;2;200;169;238m"  # bold lavender #C8A9EE


C_GIT_ERROR = "\033[1;38;2;242;134;134m"  # bold warning red #F28686


C_PCT = "\033[1;38;2;242;181;144m"  # bold light peach-orange #F2B590


C_SIZE = "\033[1;38;2;242;181;144m"  # bold light peach-orange #F2B590


C_TOKENS = "\033[1;38;2;233;144;169m"  # bold pink #E990A9


C_TIMER = "\033[1;38;2;142;211;211m"  # bold light cyan #8ED3D3


C_SEP = "\033[90m | \033[0m"  # dim gray separator between top-level segments


C_JOIN = (
    "\033[90m · \033[0m"  # dim gray middle dot, joins segments that read as one item
)


@dataclass(frozen=True)
class _Palette:
    reset: str
    model: str
    directory: str
    branch: str
    git_error: str
    percentage: str
    size: str
    tokens: str
    timer: str
    separator: str


DEFAULT_PALETTE = _Palette(
    reset=C_RESET,
    model=C_MODEL,
    directory=C_DIR,
    branch=C_BRANCH,
    git_error=C_GIT_ERROR,
    percentage=C_PCT,
    size=C_SIZE,
    tokens=C_TOKENS,
    timer=C_TIMER,
    separator="\033[90m",
)


ANSI_PALETTE = _Palette(
    reset=C_RESET,
    model="\033[1;33m",
    directory="\033[1;32m",
    branch="\033[1;35m",
    git_error="\033[1;31m",
    percentage="\033[1;33m",
    size="\033[1;33m",
    tokens="\033[1;35m",
    timer="\033[1;36m",
    separator="\033[90m",
)


NO_COLOR_PALETTE = _Palette(*("",) * 10)


def _palette_for(config):
    if not config.use_colors:
        return NO_COLOR_PALETTE
    return ANSI_PALETTE if config.palette == "ansi" else DEFAULT_PALETTE


def _styled_separator(symbol, palette):
    if not palette.reset:
        return f" {symbol} "
    return f"{palette.separator} {symbol} {palette.reset}"


def _separators(config, palette):
    outer_symbol = "·" if config.separator_style == "compact" else "|"
    return (
        _styled_separator(outer_symbol, palette),
        _styled_separator("·", palette),
    )
