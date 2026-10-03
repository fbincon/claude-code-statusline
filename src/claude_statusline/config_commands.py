"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "Any": ("claude_statusline.config.service", "Any"),
    "Callable": ("claude_statusline.config.models", "Callable"),
    "ConfigCommandError": ("claude_statusline.config.models", "ConfigCommandError"),
    "DEFAULT_HOST_CONFIG": ("claude_statusline.config.models", "DEFAULT_HOST_CONFIG"),
    "DISPLAY_OPTION_NAMES": ("claude_statusline.config.models", "DISPLAY_OPTION_NAMES"),
    "EffectiveConfig": ("claude_statusline.config.models", "EffectiveConfig"),
    "HOST_OPTION_NAMES": ("claude_statusline.config.models", "HOST_OPTION_NAMES"),
    "HostConfig": ("claude_statusline.config.models", "HostConfig"),
    "Mutation": ("claude_statusline.config.models", "Mutation"),
    "MutationResult": ("claude_statusline.config.models", "MutationResult"),
    "OPTION_NAMES": ("claude_statusline.config.models", "OPTION_NAMES"),
    "PADDING_MAX": ("claude_statusline.config.models", "PADDING_MAX"),
    "PADDING_MIN": ("claude_statusline.config.models", "PADDING_MIN"),
    "Path": ("claude_statusline.config.service", "Path"),
    "REFRESH_INTERVAL_MAX": ("claude_statusline.config.models", "REFRESH_INTERVAL_MAX"),
    "REFRESH_INTERVAL_MIN": ("claude_statusline.config.models", "REFRESH_INTERVAL_MIN"),
    "SubagentStatuslineInfo": (
        "claude_statusline.config.models",
        "SubagentStatuslineInfo",
    ),
    "_DELETE": ("claude_statusline.config.models", "_DELETE"),
    "_RaisingArgumentParser": (
        "claude_statusline.config.commands",
        "_RaisingArgumentParser",
    ),
    "_UNCHANGED": ("claude_statusline.config.models", "_UNCHANGED"),
    "_backup_transaction": ("claude_statusline.config.service", "_backup_transaction"),
    "_delete_file": ("claude_statusline.config.service", "_delete_file"),
    "_display_with_option": (
        "claude_statusline.config.service",
        "_display_with_option",
    ),
    "_format_effective": ("claude_statusline.config.commands", "_format_effective"),
    "_format_mutation": ("claude_statusline.config.commands", "_format_mutation"),
    "_host_from_settings": ("claude_statusline.config.host", "_host_from_settings"),
    "_host_with_option": ("claude_statusline.config.host", "_host_with_option"),
    "_is_int": ("claude_statusline.config.host", "_is_int"),
    "_parse_padding": ("claude_statusline.config.host", "_parse_padding"),
    "_parse_refresh_interval": (
        "claude_statusline.config.host",
        "_parse_refresh_interval",
    ),
    "_parse_toggle": ("claude_statusline.config.host", "_parse_toggle"),
    "_read_display_for_mutation": (
        "claude_statusline.config.service",
        "_read_display_for_mutation",
    ),
    "_settings_with_host": ("claude_statusline.config.host", "_settings_with_host"),
    "_subagent_info": ("claude_statusline.config.service", "_subagent_info"),
    "_validated_items": ("claude_statusline.config.service", "_validated_items"),
    "_validated_subagent_items": (
        "claude_statusline.config.service",
        "_validated_subagent_items",
    ),
    "add_config_parser": ("claude_statusline.config.commands", "add_config_parser"),
    "apply_configuration": ("claude_statusline.config.service", "apply_configuration"),
    "argparse": ("claude_statusline.config.commands", "argparse"),
    "copy": ("claude_statusline.config.host", "copy"),
    "dataclass": ("claude_statusline.config.models", "dataclass"),
    "disable_items": ("claude_statusline.config.service", "disable_items"),
    "disable_subagent_items": (
        "claude_statusline.config.service",
        "disable_subagent_items",
    ),
    "enable_items": ("claude_statusline.config.service", "enable_items"),
    "enable_subagent_items": (
        "claude_statusline.config.service",
        "enable_subagent_items",
    ),
    "execute_config_namespace": (
        "claude_statusline.config.commands",
        "execute_config_namespace",
    ),
    "field": ("claude_statusline.config.models", "field"),
    "item_listing": ("claude_statusline.config.commands", "item_listing"),
    "json": ("claude_statusline.config.commands", "json"),
    "mutate_configuration": (
        "claude_statusline.config.service",
        "mutate_configuration",
    ),
    "order_items": ("claude_statusline.config.service", "order_items"),
    "order_subagent_items": (
        "claude_statusline.config.service",
        "order_subagent_items",
    ),
    "parse_slash_arguments": (
        "claude_statusline.config.commands",
        "parse_slash_arguments",
    ),
    "read_effective_config": (
        "claude_statusline.config.service",
        "read_effective_config",
    ),
    "reset_configuration": ("claude_statusline.config.service", "reset_configuration"),
    "set_items": ("claude_statusline.config.service", "set_items"),
    "set_option": ("claude_statusline.config.service", "set_option"),
    "set_subagent_items": ("claude_statusline.config.service", "set_subagent_items"),
    "shlex": ("claude_statusline.config.commands", "shlex"),
    "subagent_item_listing": (
        "claude_statusline.config.commands",
        "subagent_item_listing",
    ),
}

_MODULES = {
    "_platform": "claude_statusline._platform",
    "dc": "claude_statusline.display_config",
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
