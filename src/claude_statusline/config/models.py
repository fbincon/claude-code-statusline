"""config / models implementation."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from claude_statusline.config import display as config_display
from claude_statusline.config.formatting import FORMAT_CHOICES


PADDING_MIN = 0


PADDING_MAX = 32


REFRESH_INTERVAL_MIN = 1


REFRESH_INTERVAL_MAX = 3600


DISPLAY_OPTION_NAMES = {
    "statusline-language",
    "branch-diff-base",
    "colors",
    "palette",
    "theme",
    "powerline-glyph",
    "directory-style",
    "separator-style",
    "scope-labels",
    "subagent-statusline",
}


DISPLAY_OPTION_NAMES |= {key.replace("_", "-") for key in FORMAT_CHOICES} | {
    "threshold-colors",
    "warning-threshold",
    "critical-threshold",
}


DISPLAY_OPTION_NAMES |= {
    "subagent-visibility",
    "subagent-hide-completed",
    "subagent-row-limit",
    "subagent-task-max-width",
}


HOST_OPTION_NAMES = {
    "padding",
    "refresh-interval",
    "hide-vim-mode-indicator",
}


OPTION_NAMES = DISPLAY_OPTION_NAMES | HOST_OPTION_NAMES


class ConfigCommandError(RuntimeError):
    """Raised for a rejected config command with a user-facing explanation."""


class ConfigConflict(ConfigCommandError):
    code = "configuration_conflict"


class NotInstalledConfig(ConfigCommandError):
    code = "not_installed"


class ConfigOwnershipError(ConfigCommandError):
    code = "ownership_mismatch"


class ConfigWriteError(ConfigCommandError):
    code = "io_error"


@dataclass(frozen=True)
class HostConfig:
    padding: int = 0
    refresh_interval: int | None = 1
    hide_vim_mode_indicator: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "padding": self.padding,
            "refresh_interval": (
                self.refresh_interval if self.refresh_interval is not None else "event"
            ),
            "hide_vim_mode_indicator": self.hide_vim_mode_indicator,
        }


DEFAULT_HOST_CONFIG = HostConfig()


@dataclass(frozen=True)
class SubagentStatuslineInfo:
    enabled: bool = True
    installed: bool = False
    state: str = "unsupported"

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "installed": self.installed,
            "state": self.state,
        }


@dataclass(frozen=True)
class EffectiveConfig:
    display: config_display.DisplayConfig
    host: HostConfig
    installed: bool
    config_path: Path
    subagent_statusline: SubagentStatuslineInfo = field(
        default_factory=SubagentStatuslineInfo
    )
    revision: str | None = None
    installation: dict = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scope": "user",
            "config_path": str(self.config_path),
            "installed": self.installed,
            "display": self.display.to_dict(),
            "host": self.host.to_dict(),
            "subagent_statusline": self.subagent_statusline.to_dict(),
        }


@dataclass(frozen=True)
class MutationResult:
    changed: bool
    effective: EffectiveConfig
    backup_dir: Path | None = None


_UNCHANGED = object()


_DELETE = object()


Mutation = Callable[
    [config_display.DisplayConfig, dict, HostConfig, bool],
    tuple[config_display.DisplayConfig | object, dict | object],
]
