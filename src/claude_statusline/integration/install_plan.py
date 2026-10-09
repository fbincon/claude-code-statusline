"""integration / install_plan implementation."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

import copy
from pathlib import Path
from claude_statusline.integration import models as integration_models
from claude_statusline.integration import ownership as integration_ownership


def _clean_hook_groups(
    groups: object,
    config_dir: Path,
    executable: Path,
    remove_cli: bool,
    remove_legacy: bool,
    cli_subcommands: tuple[str, ...] = ("hook",),
) -> list:
    if groups is None:
        return []
    if not isinstance(groups, list):
        raise integration_models.ConfigurationError(
            msg('errors.install_plan.each_configured_hook_event_must_contain_a')
        )

    cleaned = []
    legacy_target = config_dir / "turn_state.py"
    for group in groups:
        if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
            cleaned.append(copy.deepcopy(group))
            continue
        remaining = []
        for action in group["hooks"]:
            command = action.get("command") if isinstance(action, dict) else None
            owned = remove_cli and any(
                integration_ownership._is_cli_command(command, subcommand, executable)
                or integration_ownership._is_cli_command(command, subcommand)
                for subcommand in cli_subcommands
            )
            legacy = remove_legacy and integration_ownership._is_legacy_python_command(
                command, legacy_target
            )
            if not (owned or legacy):
                remaining.append(copy.deepcopy(action))
        if remaining:
            new_group = copy.deepcopy(group)
            new_group["hooks"] = remaining
            cleaned.append(new_group)
    return cleaned


def _prepare_install(
    settings: dict,
    config_dir: Path,
    executable: Path,
    force: bool,
    fast_slash_hook: bool = False,
    experimental_slash_tui: bool = False,
    subagent_supported: bool = False,
    subagent_enabled: bool = True,
) -> dict:
    updated = copy.deepcopy(settings)
    current = updated.get("statusLine")
    if current is not None:
        current_command = current.get("command") if isinstance(current, dict) else None
        replaceable = (
            integration_ownership._is_cli_command(current_command, "render", executable)
            or integration_ownership._is_cli_command(current_command, "render")
            or integration_ownership._is_legacy_python_command(
                current_command, config_dir / "statusline.py"
            )
        )
        if not replaceable and not force:
            raise integration_models.ConfigurationError(
                msg('errors.install_plan.an_unrelated_statusline_is_already_configured_rerun')
            )

    status_line = {
        "type": "command",
        "command": integration_ownership.command_for(executable, "render"),
    }
    if isinstance(current, dict):
        padding = current.get("padding")
        if (
            isinstance(padding, int)
            and not isinstance(padding, bool)
            and 0 < padding <= 32
        ):
            status_line["padding"] = padding
        interval = current.get(
            "refreshInterval", integration_models._UNCHANGED_ARTIFACT
        )
        if (
            interval is not integration_models._UNCHANGED_ARTIFACT
            and isinstance(interval, int)
            and not isinstance(interval, bool)
            and 1 <= interval <= 3600
        ):
            status_line["refreshInterval"] = interval
        hide_vim = current.get("hideVimModeIndicator")
        if hide_vim is True:
            status_line["hideVimModeIndicator"] = True
    else:
        status_line["refreshInterval"] = 1
    updated["statusLine"] = status_line

    current_subagent = updated.get("subagentStatusLine")
    current_subagent_command = (
        current_subagent.get("command") if isinstance(current_subagent, dict) else None
    )
    subagent_owned = integration_ownership._is_cli_command(
        current_subagent_command, "render-subagents", executable
    ) or integration_ownership._is_cli_command(
        current_subagent_command, "render-subagents"
    )
    if subagent_supported and subagent_enabled:
        if current_subagent is not None and not subagent_owned and not force:
            raise integration_models.ConfigurationError(
                msg('errors.install_plan.an_unrelated_subagentstatusline_is_already_configured_choose')
            )
        updated["subagentStatusLine"] = {
            "type": "command",
            "command": integration_ownership.command_for(
                executable, "render-subagents"
            ),
        }
    elif subagent_owned:
        updated.pop("subagentStatusLine", None)

    hooks = updated.get("hooks")
    if hooks is None:
        hooks = {}
    if not isinstance(hooks, dict):
        raise integration_models.ConfigurationError(
            msg('errors.install_plan.the_hooks_setting_must_contain_a_json')
        )
    hooks = copy.deepcopy(hooks)
    action = {
        "type": "command",
        "command": integration_ownership.command_for(executable, "hook"),
        "timeout": 5,
    }
    for event in integration_models.HOOK_EVENTS:
        groups = _clean_hook_groups(
            hooks.get(event),
            config_dir,
            executable,
            remove_cli=True,
            remove_legacy=True,
        )
        groups.append({"hooks": [copy.deepcopy(action)]})
        hooks[event] = groups
    for event in integration_models.SUBAGENT_HOOK_EVENTS:
        groups = _clean_hook_groups(
            hooks.get(event),
            config_dir,
            executable,
            remove_cli=True,
            remove_legacy=False,
        )
        if subagent_supported:
            groups.append({"hooks": [copy.deepcopy(action)]})
        if groups:
            hooks[event] = groups
        else:
            hooks.pop(event, None)
    slash_groups = _clean_hook_groups(
        hooks.get(integration_models.SLASH_HOOK_EVENT),
        config_dir,
        executable,
        remove_cli=True,
        remove_legacy=False,
        cli_subcommands=("slash-hook",),
    )
    if fast_slash_hook:
        slash_groups.append(
            {
                "matcher": integration_models.SLASH_COMMAND_NAME,
                "hooks": [
                    {
                        "type": "command",
                        "command": integration_ownership.command_for(
                            executable, "slash-hook"
                        ),
                        "timeout": 5,
                    }
                ],
            }
        )
    if experimental_slash_tui:
        slash_groups.append(
            {
                "matcher": integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME,
                "hooks": [
                    {
                        "type": "command",
                        "command": integration_ownership.command_for(
                            executable, "slash-hook"
                        ),
                        "timeout": 600,
                    }
                ],
            }
        )
    if slash_groups:
        hooks[integration_models.SLASH_HOOK_EVENT] = slash_groups
    else:
        hooks.pop(integration_models.SLASH_HOOK_EVENT, None)
    updated["hooks"] = hooks
    return updated


def _prepare_uninstall(
    settings: dict,
    config_dir: Path,
    executable: Path,
) -> dict:
    updated = copy.deepcopy(settings)
    current = updated.get("statusLine")
    current_command = current.get("command") if isinstance(current, dict) else None
    if integration_ownership._is_cli_command(
        current_command, "render", executable
    ) or integration_ownership._is_cli_command(current_command, "render"):
        updated.pop("statusLine", None)

    current_subagent = updated.get("subagentStatusLine")
    current_subagent_command = (
        current_subagent.get("command") if isinstance(current_subagent, dict) else None
    )
    if integration_ownership._is_cli_command(
        current_subagent_command, "render-subagents", executable
    ) or integration_ownership._is_cli_command(
        current_subagent_command, "render-subagents"
    ):
        updated.pop("subagentStatusLine", None)

    hooks = updated.get("hooks")
    if isinstance(hooks, dict):
        hooks = copy.deepcopy(hooks)
        for event in list(hooks):
            groups = _clean_hook_groups(
                hooks[event],
                config_dir,
                executable,
                remove_cli=True,
                remove_legacy=False,
                cli_subcommands=("hook", "slash-hook"),
            )
            if groups:
                hooks[event] = groups
            else:
                hooks.pop(event, None)
        if hooks:
            updated["hooks"] = hooks
        else:
            updated.pop("hooks", None)
    return updated
