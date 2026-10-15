"""Conservative visibility predicates over shared, unformatted observations."""

from __future__ import annotations

import math

from . import metrics

RATE_WINDOWS = {
    "five-hour-limit": "five_hour",
    "weekly-limit": "seven_day",
    "spend-limit": "spend_limit",
}


def used_percentage(data, item, now=None, *, scope="main"):
    if item in ("context-used", "context-remaining"):
        if scope == "subagent":
            count = metrics.token_count(data.get("tokenCount"))
            capacity = metrics.token_count(data.get("contextWindowSize"))
            value = count / capacity * 100 if count is not None and capacity else None
            return value if value is not None and math.isfinite(value) else None
        context = data.get("context_window")
        if not isinstance(context, dict):
            return None
        used = metrics.finite_number(context.get("used_percentage"))
        remaining = metrics.finite_number(context.get("remaining_percentage"))
        return used if used is not None else (
            100 - remaining if remaining is not None and remaining <= 100 else None
        )
    if item in RATE_WINDOWS:
        window = metrics.live_rate_window(data, RATE_WINDOWS[item], now)
        return metrics.finite_number(window.get("used_percentage")) if window else None
    return None


def visible(options, item, *, used=None, git=None, point=None):
    if options.visibility == "always":
        return True
    if options.visibility == "used-at-least":
        return used is None or used >= options.visibility_threshold
    if options.visibility == "git-dirty":
        if not isinstance(git, dict) or git.get("kind") != "ok":
            return True
        keys = ("staged", "unstaged", "conflicts", "untracked")
        if item == "git":
            keys += ("ahead", "behind")
            if git.get("upstream_gone") is not False:
                return True
        # Only a validated zero suppresses an item, never a missing counter.
        return not all(type(git.get(key)) is int and git[key] == 0 for key in keys)
    if options.visibility == "nonzero":
        if not isinstance(point, dict) or point.get("reason") is not None or point.get("partial") is not False:
            return True
        value = point.get("value")
        if item == "task-progress":
            value = value.get("total") if isinstance(value, dict) else None
        return not (type(value) is int and value == 0)
    return True
