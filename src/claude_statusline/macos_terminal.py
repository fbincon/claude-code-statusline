"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "Mapping": ("claude_statusline.platforms.macos_terminal", "Mapping"),
    "OPEN_COMMAND": ("claude_statusline.platforms.macos_terminal", "OPEN_COMMAND"),
    "POLL_SECONDS": ("claude_statusline.platforms.macos_terminal", "POLL_SECONDS"),
    "Path": ("claude_statusline.platforms.macos_terminal", "Path"),
    "REQUEST_FILENAME": (
        "claude_statusline.platforms.macos_terminal",
        "REQUEST_FILENAME",
    ),
    "SCRIPT_FILENAME": (
        "claude_statusline.platforms.macos_terminal",
        "SCRIPT_FILENAME",
    ),
    "STARTED_FILENAME": (
        "claude_statusline.platforms.macos_terminal",
        "STARTED_FILENAME",
    ),
    "STARTUP_TIMEOUT_SECONDS": (
        "claude_statusline.platforms.macos_terminal",
        "STARTUP_TIMEOUT_SECONDS",
    ),
    "TERMINAL_APP": ("claude_statusline.platforms.macos_terminal", "TERMINAL_APP"),
    "TERMINAL_BUNDLE": (
        "claude_statusline.platforms.macos_terminal",
        "TERMINAL_BUNDLE",
    ),
    "_alive": ("claude_statusline.platforms.macos_terminal", "_alive"),
    "_identity": ("claude_statusline.platforms.macos_terminal", "_identity"),
    "_json_bytes": ("claude_statusline.platforms.macos_terminal", "_json_bytes"),
    "_launch_error": ("claude_statusline.platforms.macos_terminal", "_launch_error"),
    "_read_json": ("claude_statusline.platforms.macos_terminal", "_read_json"),
    "_read_started": ("claude_statusline.platforms.macos_terminal", "_read_started"),
    "_stop_owned": ("claude_statusline.platforms.macos_terminal", "_stop_owned"),
    "availability": ("claude_statusline.platforms.macos_terminal", "availability"),
    "json": ("claude_statusline.platforms.macos_terminal", "json"),
    "launch": ("claude_statusline.platforms.macos_terminal", "launch"),
    "main": ("claude_statusline.platforms.macos_terminal", "main"),
    "math": ("claude_statusline.platforms.macos_terminal", "math"),
    "os": ("claude_statusline.platforms.macos_terminal", "os"),
    "prepare": ("claude_statusline.platforms.macos_terminal", "prepare"),
    "run_editor": ("claude_statusline.platforms.macos_terminal", "run_editor"),
    "shlex": ("claude_statusline.platforms.macos_terminal", "shlex"),
    "signal": ("claude_statusline.platforms.macos_terminal", "signal"),
    "subprocess": ("claude_statusline.platforms.macos_terminal", "subprocess"),
    "sys": ("claude_statusline.platforms.macos_terminal", "sys"),
    "time": ("claude_statusline.platforms.macos_terminal", "time"),
}

_MODULES = {
    "_platform": "claude_statusline._platform",
    "st": "claude_statusline.slash_tui",
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


if __name__ == "__main__":
    raise SystemExit(__getattr__("main")())
