"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "ANSI_PALETTE": ("claude_statusline.rendering.subagents", "ANSI_PALETTE"),
    "ANSI_RESET": ("claude_statusline.rendering.formatters", "ANSI_RESET"),
    "Any": ("claude_statusline.rendering.subagents", "Any"),
    "CONFIG_DIR": ("claude_statusline.rendering.subagents", "CONFIG_DIR"),
    "DEFAULT_COLUMNS": ("claude_statusline.rendering.subagents", "DEFAULT_COLUMNS"),
    "DEFAULT_CONFIG": ("claude_statusline.config.display", "DEFAULT_CONFIG"),
    "DEFAULT_PALETTE": ("claude_statusline.rendering.subagents", "DEFAULT_PALETTE"),
    "DisplayConfig": ("claude_statusline.config.display", "DisplayConfig"),
    "DisplayConfigError": ("claude_statusline.config.display", "DisplayConfigError"),
    "NO_COLOR_PALETTE": ("claude_statusline.rendering.subagents", "NO_COLOR_PALETTE"),
    "OPTIONAL_DROP_ORDER": (
        "claude_statusline.rendering.subagents",
        "OPTIONAL_DROP_ORDER",
    ),
    "Path": ("claude_statusline.rendering.subagents", "Path"),
    "STATUS_ICONS": ("claude_statusline.rendering.subagents", "STATUS_ICONS"),
    "_Part": ("claude_statusline.rendering.subagents", "_Part"),
    "_SubagentPalette": ("claude_statusline.rendering.subagents", "_SubagentPalette"),
    "_columns": ("claude_statusline.rendering.subagents", "_columns"),
    "_context_remaining": (
        "claude_statusline.rendering.subagents",
        "_context_remaining",
    ),
    "_context_used": ("claude_statusline.rendering.subagents", "_context_used"),
    "_directory_text": ("claude_statusline.rendering.subagents", "_directory_text"),
    "_elapsed": ("claude_statusline.rendering.subagents", "_elapsed"),
    "_finite_number": ("claude_statusline.rendering.subagents", "_finite_number"),
    "_fit_parts": ("claude_statusline.rendering.subagents", "_fit_parts"),
    "_model_with_effort": (
        "claude_statusline.rendering.subagents",
        "_model_with_effort",
    ),
    "_normalized_type": ("claude_statusline.rendering.subagents", "_normalized_type"),
    "_palette_for": ("claude_statusline.rendering.subagents", "_palette_for"),
    "_parts_for_task": ("claude_statusline.rendering.subagents", "_parts_for_task"),
    "_plain_line": ("claude_statusline.rendering.subagents", "_plain_line"),
    "_render_parts": ("claude_statusline.rendering.subagents", "_render_parts"),
    "_replace_part": ("claude_statusline.rendering.subagents", "_replace_part"),
    "_status_elapsed": ("claude_statusline.rendering.subagents", "_status_elapsed"),
    "_status_text": ("claude_statusline.rendering.subagents", "_status_text"),
    "_task_name": ("claude_statusline.rendering.subagents", "_task_name"),
    "_task_text": ("claude_statusline.rendering.subagents", "_task_text"),
    "_token_text": ("claude_statusline.rendering.subagents", "_token_text"),
    "_without_part": ("claude_statusline.rendering.subagents", "_without_part"),
    "dataclass": ("claude_statusline.rendering.subagents", "dataclass"),
    "display_width": ("claude_statusline.rendering.formatters", "display_width"),
    "format_directory": ("claude_statusline.config.display", "format_directory"),
    "format_duration": ("claude_statusline.rendering.formatters", "format_duration"),
    "humanize_tokens": ("claude_statusline.rendering.formatters", "humanize_tokens"),
    "json": ("claude_statusline.rendering.subagents", "json"),
    "load_display_config": ("claude_statusline.config.display", "load_display_config"),
    "main": ("claude_statusline.rendering.subagents", "main"),
    "math": ("claude_statusline.rendering.subagents", "math"),
    "os": ("claude_statusline.rendering.subagents", "os"),
    "preview_rows": ("claude_statusline.rendering.subagents", "preview_rows"),
    "re": ("claude_statusline.rendering.subagents", "re"),
    "render_payload": ("claude_statusline.rendering.subagents", "render_payload"),
    "render_task": ("claude_statusline.rendering.subagents", "render_task"),
    "replace": ("claude_statusline.rendering.subagents", "replace"),
    "sanitize_payload_text": (
        "claude_statusline.rendering.formatters",
        "sanitize_payload_text",
    ),
    "sys": ("claude_statusline.rendering.subagents", "sys"),
    "time": ("claude_statusline.rendering.subagents", "time"),
    "truncate_text": ("claude_statusline.rendering.formatters", "truncate_text"),
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


if __name__ == "__main__":
    raise SystemExit(__getattr__("main")())
