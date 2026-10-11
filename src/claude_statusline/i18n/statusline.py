"""Explicit-language statusline presentation, without UI resource or preference I/O."""

from functools import lru_cache
from importlib import import_module

from .registry import LANGUAGES, STATUSLINE_MODULES, normalize_language


@lru_cache(maxsize=len(LANGUAGES))
def _catalogue(language: str):
    return import_module(
        "._generated_statusline." + STATUSLINE_MODULES[language], __package__
    ).MESSAGES


def _template(key: str, language: str, default: str) -> str:
    current = _catalogue(normalize_language(language))
    value = current.get(key)
    return value if value is not None else _catalogue("en").get(key, default)


def text(key: str, language: str = "en", **params) -> str:
    key = "statusline." + key
    template = _template(key, language, key)
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
    key = f"statusline.prefix.{scope}.{item}"
    return _template(key, language, "")


def short_label(scope: str, item: str, language: str = "en") -> str:
    return text(f"short.{scope}.{item}", language)
