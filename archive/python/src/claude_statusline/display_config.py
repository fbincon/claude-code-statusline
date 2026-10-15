"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "Any": ("claude_statusline.config.display", "Any"),
    "CONFIG_FILENAME": ("claude_statusline.config.display", "CONFIG_FILENAME"),
    "DEFAULT_CONFIG": ("claude_statusline.config.display", "DEFAULT_CONFIG"),
    "DEFAULT_ITEMS": ("claude_statusline.config.display", "DEFAULT_ITEMS"),
    "DEFAULT_SUBAGENT_ITEMS": (
        "claude_statusline.config.display",
        "DEFAULT_SUBAGENT_ITEMS",
    ),
    "DIRECTORY_STYLES": ("claude_statusline.config.display", "DIRECTORY_STYLES"),
    "DISPLAY_KEYS": ("claude_statusline.config.display", "DISPLAY_KEYS"),
    "DisplayConfig": ("claude_statusline.config.display", "DisplayConfig"),
    "DisplayConfigError": ("claude_statusline.config.display", "DisplayConfigError"),
    "ITEM_CATALOG": ("claude_statusline.config.display", "ITEM_CATALOG"),
    "LEGACY_DEFAULT_ITEMS": (
        "claude_statusline.config.display",
        "LEGACY_DEFAULT_ITEMS",
    ),
    "LEGACY_SCHEMA_VERSION": (
        "claude_statusline.config.display",
        "LEGACY_SCHEMA_VERSION",
    ),
    "PALETTES": ("claude_statusline.config.display", "PALETTES"),
    "Path": ("claude_statusline.config.display", "Path"),
    "SCHEMA_VERSION": ("claude_statusline.config.display", "SCHEMA_VERSION"),
    "SCOPE_LABELS": ("claude_statusline.config.display", "SCOPE_LABELS"),
    "SEPARATOR_STYLES": ("claude_statusline.config.display", "SEPARATOR_STYLES"),
    "SUBAGENT_ITEM_CATALOG": (
        "claude_statusline.config.display",
        "SUBAGENT_ITEM_CATALOG",
    ),
    "SUBAGENT_KEYS": ("claude_statusline.config.display", "SUBAGENT_KEYS"),
    "SubagentDisplayConfig": (
        "claude_statusline.config.display",
        "SubagentDisplayConfig",
    ),
    "V1_DISPLAY_KEYS": ("claude_statusline.config.display", "V1_DISPLAY_KEYS"),
    "_DuplicateKeyError": ("claude_statusline.config.display", "_DuplicateKeyError"),
    "_require_string_choice": (
        "claude_statusline.config.display",
        "_require_string_choice",
    ),
    "_strict_object": ("claude_statusline.config.display", "_strict_object"),
    "atomic_write_bytes": ("claude_statusline.config.display", "atomic_write_bytes"),
    "config_path": ("claude_statusline.config.display", "config_path"),
    "dataclass": ("claude_statusline.config.display", "dataclass"),
    "display_config_bytes": (
        "claude_statusline.config.display",
        "display_config_bytes",
    ),
    "field": ("claude_statusline.config.display", "field"),
    "format_directory": ("claude_statusline.config.display", "format_directory"),
    "json": ("claude_statusline.config.display", "json"),
    "load_display_config": ("claude_statusline.config.display", "load_display_config"),
    "parse_display_config_bytes": (
        "claude_statusline.config.display",
        "parse_display_config_bytes",
    ),
    "read_display_config": ("claude_statusline.config.display", "read_display_config"),
    "read_display_config_schema": (
        "claude_statusline.config.display",
        "read_display_config_schema",
    ),
    "replace": ("claude_statusline.config.display", "replace"),
    "restore_bytes": ("claude_statusline.config.display", "restore_bytes"),
    "validate_display_config": (
        "claude_statusline.config.display",
        "validate_display_config",
    ),
    "validate_items": ("claude_statusline.config.display", "validate_items"),
    "validate_subagent_config": (
        "claude_statusline.config.display",
        "validate_subagent_config",
    ),
    "validate_subagent_items": (
        "claude_statusline.config.display",
        "validate_subagent_items",
    ),
    "write_display_config": (
        "claude_statusline.config.display",
        "write_display_config",
    ),
}

_MODULES = {"_platform": "claude_statusline._platform"}


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
