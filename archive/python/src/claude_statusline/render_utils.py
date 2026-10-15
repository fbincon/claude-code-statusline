"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "ANSI_RESET": ("claude_statusline.rendering.formatters", "ANSI_RESET"),
    "ANSI_SGR_RE": ("claude_statusline.rendering.formatters", "ANSI_SGR_RE"),
    "StyledText": ("claude_statusline.rendering.formatters", "StyledText"),
    "_plain_units": ("claude_statusline.rendering.formatters", "_plain_units"),
    "char_width": ("claude_statusline.rendering.formatters", "char_width"),
    "dataclass": ("claude_statusline.rendering.formatters", "dataclass"),
    "display_width": ("claude_statusline.rendering.formatters", "display_width"),
    "format_duration": ("claude_statusline.rendering.formatters", "format_duration"),
    "humanize_tokens": ("claude_statusline.rendering.formatters", "humanize_tokens"),
    "re": ("claude_statusline.rendering.formatters", "re"),
    "sanitize_payload_text": (
        "claude_statusline.rendering.formatters",
        "sanitize_payload_text",
    ),
    "truncate_text": ("claude_statusline.rendering.formatters", "truncate_text"),
    "unicodedata": ("claude_statusline.rendering.formatters", "unicodedata"),
}

_MODULES = {}


def __getattr__(name):
    if name in _MODULES:
        return import_module(_MODULES[name])
    try:
        module, attribute = _EXPORTS[name]
    except KeyError:
        raise AttributeError(name) from None
    return getattr(import_module(module), attribute)


def __dir__():
    return sorted(set(globals()) | set(_EXPORTS))
