"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "EXPERIMENTAL_SLASH_COMMAND_NAME": (
        "claude_statusline.integration.slash_hook",
        "EXPERIMENTAL_SLASH_COMMAND_NAME",
    ),
    "SLASH_COMMAND_NAME": (
        "claude_statusline.integration.slash_hook",
        "SLASH_COMMAND_NAME",
    ),
    "_decision": ("claude_statusline.integration.slash_hook", "_decision"),
    "_experimental_reason": (
        "claude_statusline.integration.slash_hook",
        "_experimental_reason",
    ),
    "_handle_config_command": (
        "claude_statusline.integration.slash_hook",
        "_handle_config_command",
    ),
    "_handle_experimental_command": (
        "claude_statusline.integration.slash_hook",
        "_handle_experimental_command",
    ),
    "_safe_error_reason": (
        "claude_statusline.integration.slash_hook",
        "_safe_error_reason",
    ),
    "handle_payload": ("claude_statusline.integration.slash_hook", "handle_payload"),
    "json": ("claude_statusline.integration.slash_hook", "json"),
    "main": ("claude_statusline.integration.slash_hook", "main"),
    "sys": ("claude_statusline.integration.slash_hook", "sys"),
}

_MODULES = {
    "config_commands": "claude_statusline.config_commands",
    "feature_config": "claude_statusline.feature_config",
    "installer": "claude_statusline.installer",
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
