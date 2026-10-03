"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "FEATURE_FILENAME": ("claude_statusline.config.features", "FEATURE_FILENAME"),
    "FeatureConfigError": ("claude_statusline.config.features", "FeatureConfigError"),
    "Path": ("claude_statusline.config.features", "Path"),
    "SCHEMA_VERSION": ("claude_statusline.config.features", "SCHEMA_VERSION"),
    "_EXPECTED_KEYS": ("claude_statusline.config.features", "_EXPECTED_KEYS"),
    "enabled_bytes": ("claude_statusline.config.features", "enabled_bytes"),
    "feature_path": ("claude_statusline.config.features", "feature_path"),
    "json": ("claude_statusline.config.features", "json"),
    "load_experimental_slash_tui": (
        "claude_statusline.config.features",
        "load_experimental_slash_tui",
    ),
    "parse_feature_bytes": ("claude_statusline.config.features", "parse_feature_bytes"),
    "write_enabled": ("claude_statusline.config.features", "write_enabled"),
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
