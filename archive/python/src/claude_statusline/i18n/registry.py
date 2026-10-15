"""Small generated language registry; importing it never reads translation JSON."""

from ._generated_languages import LANGUAGES, LANGUAGE_NAMES, STATUSLINE_MODULES


def normalize_language(language: str) -> str:
    """Internal presentation fallback; configuration writes validate separately."""
    return language if language in LANGUAGES else "en"


__all__ = ["LANGUAGES", "LANGUAGE_NAMES", "STATUSLINE_MODULES", "normalize_language"]
