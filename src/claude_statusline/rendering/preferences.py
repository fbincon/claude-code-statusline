"""Data-aware format choices and safe decorations shared by both renderers."""

from __future__ import annotations

from datetime import datetime, timezone
import re

from claude_statusline.config import catalog, formatting
from claude_statusline.rendering import formatters, layout
from claude_statusline.i18n import statusline


def model_name(value, fmt):
    if not value or fmt.model_name == "original":
        return value
    match = re.fullmatch(
        r"(?:claude-)?(opus|sonnet|haiku)(?:-(\d+(?:-\d+)*))?", value, re.I
    )
    if not match:
        return value
    versions = (match[2] or "").split("-")
    versions = [v for v in versions if v and not (len(v) == 8 and v.isdigit())]
    return match[1].title() + (" " + ".".join(versions) if versions else "")


def number(value, fmt, legacy=formatters.humanize_tokens):
    if fmt.number_format == "legacy":
        return legacy(value)
    if type(value) is not int or value < 0:
        return None
    if fmt.number_format == "compact":
        return formatters.humanize_tokens(value)
    return f"{value:,}" if fmt.number_format == "grouped" else str(value)


def money(value, fmt):
    if fmt.number_format == "grouped":
        return f"{value:,.2f}"
    if fmt.number_format == "compact" and value >= 1000:
        divisor, suffix = (1_000_000, "M") if value >= 1_000_000 else (1000, "K")
        return f"{value / divisor:.2f}".rstrip("0").rstrip(".") + suffix
    return f"{value:.2f}"


def reset_time(expires, now, fmt, countdown):
    remaining = countdown(expires, now)
    if remaining is None or fmt.reset_format == "countdown":
        return remaining
    try:
        date = datetime.fromtimestamp(
            expires, timezone.utc if fmt.reset_timezone == "UTC" else None
        )
    except (ValueError, OverflowError, OSError):
        return None
    pattern = "%H:%M" if fmt.reset_format == "time" else "%Y-%m-%d %H:%M"
    return date.strftime(pattern) + (" UTC" if fmt.reset_timezone == "UTC" else "")


SYMBOLS = "✓⏱✗■…⏳⚡"
ICONS = {
    "model": ("◆", "M"),
    "location": ("⌂", "D"),
    "repo": ("↗", "G"),
    "context": ("◉", "C"),
    "limits": ("◷", "L"),
    "usage": ("∑", "U"),
    "task": ("›", ">"),
}


def decorate(text, item_id, scope, fmt, options, *, language="en"):
    """Modify terminal units, never payload digits or raw ANSI sequences."""
    if (
        fmt.labels == "legacy"
        and fmt.icons == "legacy"
        and options.label is None
        and options.icon is None
    ):
        return text
    units = layout._styled_units(text)
    plain = "".join(unit.text for unit in units)
    owns_icon = item_id in ({"task-timer"} if scope == "main" else {"status", "status-elapsed"})
    if owns_icon and (fmt.icons != "legacy" or options.icon is not None) and plain[:1] in SYMBOLS:
        removed = 1 + (plain[1:2] == " ")
        units = units[removed:]
        plain = "".join(unit.text for unit in units)
    custom = options.label is not None
    if custom or fmt.labels != "legacy":
        prefix = statusline.prefix(scope, item_id, language)
        if prefix and plain.startswith(prefix + " "):
            units = units[len(prefix) + 1 :]
        label = (
            options.label
            if custom
            else (
                statusline.short_label(scope, item_id, language) if fmt.labels == "short" else ""
            )
        )
        if label:
            units = layout._styled_units(label + " ") + units
    icon = options.icon
    if icon is None and fmt.icons in ("unicode", "ascii"):
        group = catalog.BY_SCOPE[scope][item_id].group
        icon = ICONS.get(group, ("·", ":"))[fmt.icons == "ascii"]
    if icon:
        units = layout._styled_units(icon + " ") + units
    return layout._render_styled_units(units)


def threshold(text, used, fmt, config, normal):
    if not config.use_colors or not fmt.thresholds.enabled or used is None:
        return text
    level = fmt.thresholds
    if used >= level.critical:
        color = "\x1b[1;31m" if config.palette == "ansi" else "\x1b[1;38;2;242;134;134m"
    elif used >= level.warning:
        color = "\x1b[1;33m" if config.palette == "ansi" else "\x1b[1;38;2;242;181;80m"
    else:
        return text
    return text.replace(normal, color) if normal else text


def options_for(config, item, scope="main"):
    selected = config.item_options if scope == "main" else config.subagents.item_options
    options = selected.get(item, formatting.ItemOptions())
    return config.formatting.overridden(options.formatting), options
