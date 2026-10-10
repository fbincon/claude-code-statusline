"""Display-only color syntax and scoped visibility capabilities."""

from __future__ import annotations

import re

from claude_statusline.i18n import message as msg

THEMES = ("classic", "dark", "light", "terminal")
POWERLINE_GLYPHS = ("ascii", "powerline")
VISIBILITY_RULES = ("always", "git-dirty", "nonzero", "used-at-least")
VISIBILITY_ITEMS = {
    "main": {
        "git": "git-dirty",
        "git-changes": "git-dirty",
        "active-agents": "nonzero",
        "task-progress": "nonzero",
        **dict.fromkeys(
            ("context-used", "context-remaining", "five-hour-limit",
             "weekly-limit", "spend-limit"), "used-at-least"
        ),
    },
    "subagent": dict.fromkeys(
        ("context-used", "context-remaining"), "used-at-least"
    ),
}


def visibility_choices(scope, item):
    rule = VISIBILITY_ITEMS.get(scope, {}).get(item)
    return ("always", rule) if rule else ("always",)


def color(value):
    """None inherits; default explicitly restores the terminal channel."""
    if value is None or value == "default":
        return value
    if isinstance(value, str):
        if re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            return value.lower()
        if re.fullmatch(r"ansi:[0-9]{1,3}", value) and int(value[5:]) <= 255:
            return "ansi:" + str(int(value[5:]))
    raise ValueError(msg("errors.appearance.color"))


def validate_visibility(scope, item, rule):
    if not isinstance(rule, str) or rule not in visibility_choices(scope, item):
        raise ValueError(msg("errors.appearance.visibility", scope=scope, item=item))
