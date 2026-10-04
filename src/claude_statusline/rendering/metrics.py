"""Strict, side-effect-free parsing and formatting of official display metrics."""

from __future__ import annotations

import math
import time

from claude_statusline.rendering import formatters, preferences
from claude_statusline.config.formatting import Formatting


def finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        number = float(value)
    except (ValueError, OverflowError):
        return None
    return number if math.isfinite(number) and number >= 0 else None


def token_count(value: object) -> int | None:
    if not isinstance(value, int) or finite_number(value) is None:
        return None
    return value


def token_ratio(used: object, capacity: object, fmt=Formatting()) -> str | None:
    count, window = token_count(used), token_count(capacity)
    if count is None or window is None or window == 0:
        return None
    return (
        f"Context {preferences.number(count, fmt)} / {preferences.number(window, fmt)}"
    )


def context_tokens(context: object, fmt=Formatting()) -> str | None:
    if not isinstance(context, dict):
        return None
    if "current_usage" in context:
        usage = context["current_usage"]
        if not isinstance(usage, dict):
            return None
        parts = [
            token_count(usage.get(field))
            for field in (
                "input_tokens",
                "cache_creation_input_tokens",
                "cache_read_input_tokens",
            )
        ]
        if any(part is None for part in parts):
            return None
        count = sum(parts)
    else:
        count = token_count(context.get("total_input_tokens"))
    return token_ratio(count, context.get("context_window_size"), fmt)


def model_name(data: dict) -> str | None:
    return formatters.sanitize_payload_text(
        formatters.deep_get(data, ("model", "id"))
    ) or formatters.sanitize_payload_text(
        formatters.deep_get(data, ("model", "display_name"))
    )


def effort_text(value: object) -> str | None:
    if isinstance(value, str):
        return formatters.sanitize_payload_text(value)
    if finite_number(value) is not None:
        return str(value) if isinstance(value, int) else f"{value:g}"
    return None


def live_rate_window(data: dict, field: str, now: float | None = None) -> dict | None:
    window = formatters.deep_get(data, ("rate_limits", field))
    if not isinstance(window, dict):
        return None
    if "resets_at" in window:
        reset = finite_number(window["resets_at"])
        if reset is None or reset <= (time.time() if now is None else now):
            return None
    return window


def countdown(expires_at: object, now: float) -> str | None:
    expires = finite_number(expires_at)
    if expires is None or expires <= now:
        return None
    seconds = math.ceil(expires - now)
    if seconds >= 86400:
        return f"{seconds // 86400}d {seconds % 86400 // 3600}h"
    if seconds >= 3600:
        return f"{seconds // 3600}h {seconds % 3600 // 60}m"
    if seconds >= 60:
        return f"{seconds // 60}m {seconds % 60}s"
    return f"{seconds}s"


def session_metric(cost: object, item: str, fmt=Formatting()) -> str | None:
    if not isinstance(cost, dict):
        return None
    if item == "lines-changed":
        added = token_count(cost.get("total_lines_added"))
        removed = token_count(cost.get("total_lines_removed"))
        return (
            f"+{preferences.number(added, fmt, str)}/-{preferences.number(removed, fmt, str)}"
            if added is not None and removed is not None
            else None
        )
    fields = {
        "session-cost": "total_cost_usd",
        "session-duration": "total_duration_ms",
        "api-duration": "total_api_duration_ms",
    }
    number = finite_number(cost.get(fields[item]))
    if number is None:
        return None
    if item == "session-cost":
        return f"Cost ${preferences.money(number, fmt)}"
    label = "Session" if item == "session-duration" else "API"
    return f"{label} {formatters.format_duration(number / 1000)}"


def cache_metric(cache: object, item: str, now: float, fmt=Formatting()) -> str | None:
    if not isinstance(cache, dict):
        return None
    if item in ("cache-misses", "api-requests"):
        field, label = (
            ("misses", "Cache miss")
            if item == "cache-misses"
            else ("requests", "API requests")
        )
        count = token_count(cache.get(field))
        return (
            f"{label} {preferences.number(count, fmt, str)}"
            if count is not None
            else None
        )
    if cache.get("caching_observed") is False:
        return "Cache unobserved" if item == "cache-state" else None
    warm = cache.get("warm")
    if warm is False:
        return "Cache cold" if item == "cache-state" else None
    if warm is not True:
        return None
    expires = finite_number(cache.get("expires_at"))
    if expires is None:
        return None
    remaining = countdown(expires, now)
    if item == "cache-state":
        return "Cache warm" if remaining else "Cache cold"
    return f"Cache TTL {remaining}" if remaining else None


def spend_metric(window: object, item: str, fmt=Formatting()) -> str | None:
    if not isinstance(window, dict):
        return None
    if item == "spend-period":
        period = window.get("period")
        return (
            f"Spend {period}"
            if isinstance(period, str) and period in ("daily", "weekly", "monthly")
            else None
        )
    used = finite_number(window.get("used_usd"))
    limit = finite_number(window.get("limit_usd"))
    return (
        f"Spend ${preferences.money(used, fmt)} / ${preferences.money(limit, fmt)}"
        if used is not None and limit is not None
        else None
    )
