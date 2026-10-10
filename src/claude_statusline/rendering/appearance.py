"""Resolve theme roles and channel overrides without losing inner SGR resets."""

from __future__ import annotations

from dataclasses import replace
from functools import lru_cache

from . import styles, layout

_ROLES = ("model", "directory", "branch", "percentage", "tokens", "timer")
_DARK = ("#f6e2b7", "#abdfa7", "#c8a9ee", "#f2b590", "#e990a9", "#8ed3d3")
_LIGHT = ("#664515", "#205727", "#633487", "#864511", "#93284a", "#126168")
_BLOCK_DARK = ("#3c3548", "#234337", "#3d3155", "#543720", "#542b3c", "#1f4148")
_BLOCK_LIGHT = ("#eee1c4", "#d6ecd4", "#e7dcf2", "#f5dfce", "#f4d8e1", "#d1ecec")
_ANSI = (3, 2, 5, 3, 5, 6)
_BLOCK_ANSI = (4, 2, 5, 3, 1, 6)


def color(value):
    if value in (None, "default"):
        return None
    return ("ansi", int(value[5:])) if value.startswith("ansi:") else ("rgb", value)


def output_color(value, config):
    if value is not None and config.palette == "ansi":
        from .colors import terminal_color

        return ("ansi", terminal_color(value, 16))
    return value


@lru_cache(maxsize=16)
def theme_styles(theme, ansi):
    values = _LIGHT if theme == "light" else _DARK
    roles = {
        role: styles.Style(True, ("ansi", index) if ansi or theme == "terminal" else ("rgb", rgb)).sgr()
        for role, rgb, index in zip(_ROLES, values, _ANSI)
    }
    roles["size"] = roles["percentage"]
    roles["git_error"] = styles.Style(True, ("ansi", 1) if ansi or theme == "terminal" else ("rgb", "#a02020" if theme == "light" else "#f28686")).sgr()
    roles["separator"] = styles.Style(False, ("ansi", 8) if ansi or theme == "terminal" else ("rgb", "#58616b" if theme == "light" else "#aab2bd")).sgr()
    return roles


def themed_palette(palette, config, *, subagent=False):
    if not config.use_colors or config.theme == "classic":
        return palette
    roles = theme_styles(config.theme, config.palette == "ansi")
    if not subagent:
        return replace(palette, **roles)
    mapping = {
        "status": "timer", "name": "model", "model": "model", "context": "percentage",
        "elapsed": "timer", "task": "directory", "tokens": "tokens",
        "directory": "directory", "separator": "separator",
    }
    return replace(palette, **{key: roles[role] for key, role in mapping.items()})


def item_role(item, scope):
    from claude_statusline.config import catalog

    group = catalog.BY_SCOPE[scope][item].group if item else "task"
    return {
        "model": "model", "location": "directory", "repo": "branch",
        "context": "percentage", "limits": "percentage", "usage": "tokens",
        "cache": "tokens", "requests": "tokens",
    }.get(group, "timer")


def base_style(config, item, scope):
    role = item_role(item, scope)
    index = _ROLES.index(role)
    if config.separator_style == "powerline":
        if config.palette == "ansi" or config.theme == "terminal":
            bg = ("ansi", _BLOCK_ANSI[index])
            fg = ("ansi", 0 if _BLOCK_ANSI[index] in (3, 6) else 15)
        else:
            light = config.theme == "light"
            bg = ("rgb", (_BLOCK_LIGHT if light else _BLOCK_DARK)[index])
            fg = ("rgb", "#202630" if light else "#f4f5f7")
        return styles.Style(True, fg, bg)
    return styles.parse(theme_styles(config.theme, config.palette == "ansi")[role])


def risk_color(used, config):
    limits = config.formatting.thresholds
    if not limits.enabled or used is None or used < limits.warning:
        return None
    critical = used >= limits.critical
    if config.palette == "ansi" or config.theme == "terminal":
        return ("ansi", 1 if critical else 3)
    return ("rgb", ("#a02020" if critical else "#805000") if config.theme == "light"
            else ("#f28686" if critical else "#f2b550"))


def apply(text, config, item, options, *, scope="main", used=None):
    if not config.use_colors:
        return layout.ANSI_SGR_RE.sub("", text)
    block = config.separator_style == "powerline"
    risk = risk_color(used, config)
    if config.theme == "classic" and not block and options.foreground is None and options.background is None and risk is None:
        return text
    base = base_style(config, item, scope)
    foreground = output_color(color(options.foreground), config)
    background = output_color(color(options.background), config)
    units = []
    for unit in layout._styled_units(text):
        state = styles.parse(unit.style)
        fg = foreground if options.foreground is not None else (base.foreground if block else state.foreground or base.foreground)
        bg = background if options.background is not None else (base.background if block else state.background)
        state = styles.Style(state.bold or (block or risk is not None), risk or fg, bg)
        units.append(replace(unit, style=state.sgr()))
    return layout._render_styled_units(units)

