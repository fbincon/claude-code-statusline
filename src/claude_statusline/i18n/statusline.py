"""Explicit-language statusline presentation, without UI resource or preference I/O."""

from functools import lru_cache


@lru_cache(maxsize=1)
def _locales():
    from ._generated_statusline import LOCALES

    return LOCALES


def text(key: str, language: str = "en", **params) -> str:
    key = "statusline." + key
    locales = _locales()
    english = locales["en"]
    template = locales.get(language, english).get(key, english.get(key, key))
    return template.format_map(params)


VALUES = {
    "run": {v: v.replace(" ", "_").replace("-", "_") for v in (
        "main", "queued", "waiting agents", "main wrap-up", "completed", "failed",
        "interrupted", "unknown", "running", "pending", "waiting", "paused", "killed",
    )},
    "permission": {v: v for v in ("default", "plan", "acceptEdits", "bypassPermissions", "dontAsk", "auto")},
    "effort": {v: v for v in ("low", "medium", "high", "xhigh", "max")},
    "tool": {v: v for v in ("started", "success", "error", "denied", "interrupted")},
    "review": {v: v for v in ("approved", "changes_requested", "review_required", "pending", "commented", "dismissed")},
    "period": {v: v for v in ("daily", "weekly", "monthly")},
}


def value(domain: str, raw, language: str = "en"):
    """Only known codes are translated; external/numeric values retain their identity."""
    if language == "en" or not isinstance(raw, str):
        return raw
    key = VALUES[domain].get(raw)
    return text(f"values.{domain}.{key}", language) if key else raw


def prefix(scope: str, item: str, language: str = "en") -> str:
    """A prefix exists only for an item-owned label, never arbitrary payload text."""
    locales = _locales()
    key = f"statusline.prefix.{scope}.{item}"
    return locales.get(language, locales["en"]).get(key, locales["en"].get(key, ""))


def short_label(scope: str, item: str, language: str = "en") -> str:
    return text(f"short.{scope}.{item}", language)
