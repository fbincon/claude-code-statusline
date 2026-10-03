"""config / host implementation."""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any
from claude_statusline.config import models as config_models
from claude_statusline.integration import ownership as integration_ownership


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _parse_padding(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise config_models.ConfigCommandError(
            "padding must be an integer from 0 through 32"
        ) from exc
    if (
        isinstance(value, bool)
        or not config_models.PADDING_MIN <= parsed <= config_models.PADDING_MAX
    ):
        raise config_models.ConfigCommandError(
            "padding must be an integer from 0 through 32"
        )
    return parsed


def _parse_refresh_interval(value: Any) -> int | None:
    if isinstance(value, str) and value.lower() == "event":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise config_models.ConfigCommandError(
            "refresh-interval must be 'event' or an integer from 1 through 3600"
        ) from exc
    if (
        isinstance(value, bool)
        or not config_models.REFRESH_INTERVAL_MIN
        <= parsed
        <= config_models.REFRESH_INTERVAL_MAX
    ):
        raise config_models.ConfigCommandError(
            "refresh-interval must be 'event' or an integer from 1 through 3600"
        )
    return parsed


def _parse_toggle(value: Any, name: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.lower()
        if normalized in {"on", "true"}:
            return True
        if normalized in {"off", "false"}:
            return False
    raise config_models.ConfigCommandError(f"{name} must be on or off")


def _host_from_settings(
    settings: dict, executable: Path
) -> tuple[config_models.HostConfig, bool]:
    current = settings.get("statusLine")
    command = current.get("command") if isinstance(current, dict) else None
    installed = (
        isinstance(current, dict)
        and current.get("type") == "command"
        and integration_ownership._is_current_cli_command(command, "render", executable)
    )
    if not installed:
        return config_models.DEFAULT_HOST_CONFIG, False

    padding = current.get("padding", 0)
    if (
        not _is_int(padding)
        or not config_models.PADDING_MIN <= padding <= config_models.PADDING_MAX
    ):
        raise config_models.ConfigCommandError(
            "installed statusLine.padding is outside 0 through 32"
        )
    refresh = current.get("refreshInterval")
    if refresh is not None and (
        not _is_int(refresh)
        or not config_models.REFRESH_INTERVAL_MIN
        <= refresh
        <= config_models.REFRESH_INTERVAL_MAX
    ):
        raise config_models.ConfigCommandError(
            "installed statusLine.refreshInterval is outside 1 through 3600"
        )
    hide_vim = current.get("hideVimModeIndicator", False)
    if not isinstance(hide_vim, bool):
        raise config_models.ConfigCommandError(
            "installed statusLine.hideVimModeIndicator must be true or false"
        )
    return config_models.HostConfig(padding, refresh, hide_vim), True


def _settings_with_host(
    settings: dict,
    executable: Path,
    host: config_models.HostConfig,
) -> dict:
    current = settings.get("statusLine")
    command = current.get("command") if isinstance(current, dict) else None
    if (
        not isinstance(current, dict)
        or current.get("type") != "command"
        or not integration_ownership._is_current_cli_command(
            command, "render", executable
        )
    ):
        error = (
            config_models.NotInstalledConfig
            if current is None
            else config_models.ConfigOwnershipError
        )
        raise error(
            "Claude Code statusLine is not installed for this claude-statusline executable"
        )
    updated = copy.deepcopy(settings)
    status_line = copy.deepcopy(current)
    if host.padding:
        status_line["padding"] = host.padding
    else:
        status_line.pop("padding", None)
    if host.refresh_interval is None:
        status_line.pop("refreshInterval", None)
    else:
        status_line["refreshInterval"] = host.refresh_interval
    if host.hide_vim_mode_indicator:
        status_line["hideVimModeIndicator"] = True
    else:
        status_line.pop("hideVimModeIndicator", None)
    updated["statusLine"] = status_line
    return updated


def _host_with_option(
    host: config_models.HostConfig, option: str, value: Any
) -> config_models.HostConfig:
    if option == "padding":
        return config_models.HostConfig(
            _parse_padding(value),
            host.refresh_interval,
            host.hide_vim_mode_indicator,
        )
    if option == "refresh-interval":
        return config_models.HostConfig(
            host.padding,
            _parse_refresh_interval(value),
            host.hide_vim_mode_indicator,
        )
    if option == "hide-vim-mode-indicator":
        return config_models.HostConfig(
            host.padding,
            host.refresh_interval,
            _parse_toggle(value, option),
        )
    raise config_models.ConfigCommandError(f"unknown host option: {option}")
