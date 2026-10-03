"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "ChangeResult": ("claude_statusline.integration.models", "ChangeResult"),
    "ConfigurationError": (
        "claude_statusline.integration.models",
        "ConfigurationError",
    ),
    "Diagnostic": ("claude_statusline.integration.models", "Diagnostic"),
    "EXPERIMENTAL_SKILL_OWNER_RELATIVE_PATH": (
        "claude_statusline.integration.models",
        "EXPERIMENTAL_SKILL_OWNER_RELATIVE_PATH",
    ),
    "EXPERIMENTAL_SKILL_RELATIVE_PATH": (
        "claude_statusline.integration.models",
        "EXPERIMENTAL_SKILL_RELATIVE_PATH",
    ),
    "EXPERIMENTAL_SLASH_COMMAND_NAME": (
        "claude_statusline.integration.models",
        "EXPERIMENTAL_SLASH_COMMAND_NAME",
    ),
    "HOOK_EVENTS": ("claude_statusline.integration.models", "HOOK_EVENTS"),
    "MIN_FAST_SLASH_VERSION": (
        "claude_statusline.integration.models",
        "MIN_FAST_SLASH_VERSION",
    ),
    "MIN_SUBAGENT_STATUSLINE_VERSION": (
        "claude_statusline.integration.models",
        "MIN_SUBAGENT_STATUSLINE_VERSION",
    ),
    "Path": ("claude_statusline.config.storage", "Path"),
    "SKILL_OWNER": ("claude_statusline.integration.models", "SKILL_OWNER"),
    "SKILL_OWNER_RELATIVE_PATH": (
        "claude_statusline.integration.models",
        "SKILL_OWNER_RELATIVE_PATH",
    ),
    "SKILL_OWNER_SCHEMA": (
        "claude_statusline.integration.models",
        "SKILL_OWNER_SCHEMA",
    ),
    "SKILL_RELATIVE_PATH": (
        "claude_statusline.integration.models",
        "SKILL_RELATIVE_PATH",
    ),
    "SLASH_COMMAND_NAME": (
        "claude_statusline.integration.models",
        "SLASH_COMMAND_NAME",
    ),
    "SLASH_HOOK_EVENT": ("claude_statusline.integration.models", "SLASH_HOOK_EVENT"),
    "SUBAGENT_HOOK_EVENTS": (
        "claude_statusline.integration.models",
        "SUBAGENT_HOOK_EVENTS",
    ),
    "_DETECT_CLAUDE_VERSION": (
        "claude_statusline.integration.models",
        "_DETECT_CLAUDE_VERSION",
    ),
    "_UNCHANGED_ARTIFACT": (
        "claude_statusline.integration.models",
        "_UNCHANGED_ARTIFACT",
    ),
    "_atomic_write_bytes": ("claude_statusline.config.storage", "_atomic_write_bytes"),
    "_atomic_write_settings": (
        "claude_statusline.config.storage",
        "_atomic_write_settings",
    ),
    "_backup_artifacts": ("claude_statusline.config.storage", "_backup_artifacts"),
    "_backup_settings": ("claude_statusline.config.storage", "_backup_settings"),
    "_change_configuration": (
        "claude_statusline.integration.installer",
        "_change_configuration",
    ),
    "_chmod_private": ("claude_statusline.config.storage", "_chmod_private"),
    "_clean_hook_groups": (
        "claude_statusline.integration.install_plan",
        "_clean_hook_groups",
    ),
    "_hook_commands": ("claude_statusline.integration.ownership", "_hook_commands"),
    "_installation_lock": ("claude_statusline.config.storage", "_installation_lock"),
    "_is_cli_command": ("claude_statusline.integration.ownership", "_is_cli_command"),
    "_is_legacy_python_command": (
        "claude_statusline.integration.ownership",
        "_is_legacy_python_command",
    ),
    "_is_owned_skill_marker": (
        "claude_statusline.integration.ownership",
        "_is_owned_skill_marker",
    ),
    "_json_bytes": ("claude_statusline.config.storage", "_json_bytes"),
    "_normalized_path": ("claude_statusline.integration.ownership", "_normalized_path"),
    "_prepare_install": (
        "claude_statusline.integration.install_plan",
        "_prepare_install",
    ),
    "_prepare_uninstall": (
        "claude_statusline.integration.install_plan",
        "_prepare_uninstall",
    ),
    "_quoted_executable": (
        "claude_statusline.integration.ownership",
        "_quoted_executable",
    ),
    "_read_optional_bytes": (
        "claude_statusline.config.storage",
        "_read_optional_bytes",
    ),
    "_read_settings": ("claude_statusline.config.storage", "_read_settings"),
    "_render_skill_resource": (
        "claude_statusline.integration.resources",
        "_render_skill_resource",
    ),
    "_skill_owner_bytes": (
        "claude_statusline.integration.resources",
        "_skill_owner_bytes",
    ),
    "_slash_hook_actions": (
        "claude_statusline.integration.ownership",
        "_slash_hook_actions",
    ),
    "_slash_hook_count": (
        "claude_statusline.integration.ownership",
        "_slash_hook_count",
    ),
    "_slash_matcher_groups": (
        "claude_statusline.integration.ownership",
        "_slash_matcher_groups",
    ),
    "_split_command": ("claude_statusline.integration.ownership", "_split_command"),
    "_unique_backup_dir": ("claude_statusline.config.storage", "_unique_backup_dir"),
    "_write_optional_bytes": (
        "claude_statusline.config.storage",
        "_write_optional_bytes",
    ),
    "collect_diagnostics": (
        "claude_statusline.integration.doctor",
        "collect_diagnostics",
    ),
    "command_for": ("claude_statusline.integration.ownership", "command_for"),
    "copy": ("claude_statusline.integration.install_plan", "copy"),
    "dataclass": ("claude_statusline.integration.models", "dataclass"),
    "detect_claude_version": (
        "claude_statusline.integration.capabilities",
        "detect_claude_version",
    ),
    "dt": ("claude_statusline.config.storage", "dt"),
    "experimental_skill_paths": (
        "claude_statusline.integration.resources",
        "experimental_skill_paths",
    ),
    "install_configuration": (
        "claude_statusline.integration.installer",
        "install_configuration",
    ),
    "json": ("claude_statusline.config.storage", "json"),
    "metadata": ("claude_statusline.config.storage", "metadata"),
    "os": ("claude_statusline.integration.ownership", "os"),
    "re": ("claude_statusline.integration.capabilities", "re"),
    "render_experimental_skill": (
        "claude_statusline.integration.resources",
        "render_experimental_skill",
    ),
    "render_skill": ("claude_statusline.integration.resources", "render_skill"),
    "resolve_cli_executable": (
        "claude_statusline.integration.ownership",
        "resolve_cli_executable",
    ),
    "resolve_config_dir": (
        "claude_statusline.integration.ownership",
        "resolve_config_dir",
    ),
    "resources": ("claude_statusline.integration.resources", "resources"),
    "shlex": ("claude_statusline.integration.ownership", "shlex"),
    "shutil": ("claude_statusline.integration.doctor", "shutil"),
    "skill_paths": ("claude_statusline.integration.resources", "skill_paths"),
    "stdlib_platform": ("claude_statusline.integration.doctor", "stdlib_platform"),
    "subagent_statusline_state": (
        "claude_statusline.integration.capabilities",
        "subagent_statusline_state",
    ),
    "subprocess": ("claude_statusline.integration.capabilities", "subprocess"),
    "supports_fast_slash_hook": (
        "claude_statusline.integration.capabilities",
        "supports_fast_slash_hook",
    ),
    "supports_subagent_statusline": (
        "claude_statusline.integration.capabilities",
        "supports_subagent_statusline",
    ),
    "sys": ("claude_statusline.integration.doctor", "sys"),
    "uninstall_configuration": (
        "claude_statusline.integration.installer",
        "uninstall_configuration",
    ),
}

_MODULES = {
    "_platform": "claude_statusline._platform",
    "feature_config": "claude_statusline.feature_config",
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
