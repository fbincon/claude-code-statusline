"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "CANCEL": ("claude_statusline.ui.models", "CANCEL"),
    "Callable": ("claude_statusline.ui.session", "Callable"),
    "ConfigureAborted": ("claude_statusline.ui.models", "ConfigureAborted"),
    "ConfigureOutcome": ("claude_statusline.ui.models", "ConfigureOutcome"),
    "EditorState": ("claude_statusline.ui.editor", "EditorState"),
    "INTERRUPT": ("claude_statusline.ui.models", "INTERRUPT"),
    "InteractiveConfigState": ("claude_statusline.ui.editor", "InteractiveConfigState"),
    "MIN_TERMINAL_HEIGHT": ("claude_statusline.ui.models", "MIN_TERMINAL_HEIGHT"),
    "MIN_TERMINAL_WIDTH": ("claude_statusline.ui.models", "MIN_TERMINAL_WIDTH"),
    "NumericEdit": ("claude_statusline.ui.models", "NumericEdit"),
    "Path": ("claude_statusline.integration.bridge", "Path"),
    "REFRESH_PRESETS": ("claude_statusline.ui.models", "REFRESH_PRESETS"),
    "SAVE": ("claude_statusline.ui.models", "SAVE"),
    "SETTING_NAMES": ("claude_statusline.ui.models", "SETTING_NAMES"),
    "TIMED_OUT": ("claude_statusline.ui.models", "TIMED_OUT"),
    "TextIO": ("claude_statusline.ui.session", "TextIO"),
    "_BRIDGE_DEADLINE_ENV": (
        "claude_statusline.integration.bridge",
        "_BRIDGE_DEADLINE_ENV",
    ),
    "_BRIDGE_INVOCATION_PATTERN": (
        "claude_statusline.integration.bridge",
        "_BRIDGE_INVOCATION_PATTERN",
    ),
    "_BRIDGE_RESULT_ENV": (
        "claude_statusline.integration.bridge",
        "_BRIDGE_RESULT_ENV",
    ),
    "_BRIDGE_RESULT_NAME": (
        "claude_statusline.integration.bridge",
        "_BRIDGE_RESULT_NAME",
    ),
    "_ColorMapper": ("claude_statusline.ui.drawing", "_ColorMapper"),
    "_SignalExit": ("claude_statusline.ui.session", "_SignalExit"),
    "_XTERM_BASE_RGB": ("claude_statusline.ui.drawing", "_XTERM_BASE_RGB"),
    "_XTERM_RGB": ("claude_statusline.ui.drawing", "_XTERM_RGB"),
    "_add_text": ("claude_statusline.ui.drawing", "_add_text"),
    "_ansi_style": ("claude_statusline.ui.drawing", "_ansi_style"),
    "_bridge_deadline": ("claude_statusline.integration.bridge", "_bridge_deadline"),
    "_clip_text": ("claude_statusline.ui.drawing", "_clip_text"),
    "_draw_ansi": ("claude_statusline.ui.drawing", "_draw_ansi"),
    "_draw_items": ("claude_statusline.ui.drawing", "_draw_items"),
    "_draw_preview": ("claude_statusline.ui.drawing", "_draw_preview"),
    "_draw_screen": ("claude_statusline.ui.drawing", "_draw_screen"),
    "_draw_settings": ("claude_statusline.ui.drawing", "_draw_settings"),
    "_draw_small_terminal": ("claude_statusline.ui.drawing", "_draw_small_terminal"),
    "_draw_subagent_items": ("claude_statusline.ui.drawing", "_draw_subagent_items"),
    "_draw_tabs": ("claude_statusline.ui.drawing", "_draw_tabs"),
    "_error_outcome": ("claude_statusline.ui.session", "_error_outcome"),
    "_install_signal_handlers": (
        "claude_statusline.ui.session",
        "_install_signal_handlers",
    ),
    "_is_backspace": ("claude_statusline.ui.keys", "_is_backspace"),
    "_is_enter": ("claude_statusline.ui.keys", "_is_enter"),
    "_layout_dimensions": ("claude_statusline.ui.drawing", "_layout_dimensions"),
    "_restore_signal_handlers": (
        "claude_statusline.ui.session",
        "_restore_signal_handlers",
    ),
    "_run_curses": ("claude_statusline.ui.session", "_run_curses"),
    "_screen_loop": ("claude_statusline.ui.session", "_screen_loop"),
    "_signal_handler": ("claude_statusline.ui.session", "_signal_handler"),
    "_validated_bridge_path": (
        "claude_statusline.integration.bridge",
        "_validated_bridge_path",
    ),
    "_write_bridge_result": (
        "claude_statusline.integration.bridge",
        "_write_bridge_result",
    ),
    "_xterm_palette": ("claude_statusline.ui.drawing", "_xterm_palette"),
    "curses": ("claude_statusline.ui.drawing", "curses"),
    "dataclass": ("claude_statusline.ui.models", "dataclass"),
    "execute": ("claude_statusline.ui.session", "execute"),
    "handle_key": ("claude_statusline.ui.keys", "handle_key"),
    "json": ("claude_statusline.integration.bridge", "json"),
    "nearest_terminal_color": (
        "claude_statusline.ui.drawing",
        "nearest_terminal_color",
    ),
    "os": ("claude_statusline.integration.bridge", "os"),
    "re": ("claude_statusline.integration.bridge", "re"),
    "replace": ("claude_statusline.ui.editor", "replace"),
    "run": ("claude_statusline.ui.session", "run"),
    "save_configuration": ("claude_statusline.ui.editor", "save_configuration"),
    "signal": ("claude_statusline.ui.session", "signal"),
    "stat": ("claude_statusline.integration.bridge", "stat"),
    "sys": ("claude_statusline.ui.session", "sys"),
    "time": ("claude_statusline.ui.session", "time"),
}

_MODULES = {
    "_platform": "claude_statusline._platform",
    "cc": "claude_statusline.config_commands",
    "dc": "claude_statusline.display_config",
    "statusline": "claude_statusline.statusline",
    "subagent_statusline": "claude_statusline.subagent_statusline",
}


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
