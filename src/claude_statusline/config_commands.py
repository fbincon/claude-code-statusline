"""Administrative commands for status line display and host configuration."""

from __future__ import annotations

import argparse
import copy
import json
import os
import shlex
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import display_config as dc
from . import installer

PADDING_MIN = 0
PADDING_MAX = 32
REFRESH_INTERVAL_MIN = 1
REFRESH_INTERVAL_MAX = 3600

DISPLAY_OPTION_NAMES = {
    "colors",
    "palette",
    "directory-style",
    "separator-style",
}
HOST_OPTION_NAMES = {
    "padding",
    "refresh-interval",
    "hide-vim-mode-indicator",
}
OPTION_NAMES = DISPLAY_OPTION_NAMES | HOST_OPTION_NAMES


class ConfigCommandError(RuntimeError):
    """Raised for a rejected config command with a user-facing explanation."""


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
class EffectiveConfig:
    display: dc.DisplayConfig
    host: HostConfig
    installed: bool
    config_path: Path

    def to_dict(self) -> dict[str, Any]:
        return {
            "scope": "user",
            "config_path": str(self.config_path),
            "installed": self.installed,
            "display": self.display.to_dict(),
            "host": self.host.to_dict(),
        }


@dataclass(frozen=True)
class MutationResult:
    changed: bool
    effective: EffectiveConfig
    backup_dir: Path | None = None


_UNCHANGED = object()
_DELETE = object()


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _parse_padding(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ConfigCommandError(
            "padding must be an integer from 0 through 32"
        ) from exc
    if isinstance(value, bool) or not PADDING_MIN <= parsed <= PADDING_MAX:
        raise ConfigCommandError("padding must be an integer from 0 through 32")
    return parsed


def _parse_refresh_interval(value: Any) -> int | None:
    if isinstance(value, str) and value.lower() == "event":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ConfigCommandError(
            "refresh-interval must be 'event' or an integer from 1 through 3600"
        ) from exc
    if (
        isinstance(value, bool)
        or not REFRESH_INTERVAL_MIN <= parsed <= REFRESH_INTERVAL_MAX
    ):
        raise ConfigCommandError(
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
    raise ConfigCommandError(f"{name} must be on or off")


def _host_from_settings(settings: dict, executable: Path) -> tuple[HostConfig, bool]:
    current = settings.get("statusLine")
    command = current.get("command") if isinstance(current, dict) else None
    installed = installer._is_cli_command(command, "render", executable)
    if not installed:
        return DEFAULT_HOST_CONFIG, False

    padding = current.get("padding", 0)
    if not _is_int(padding) or not PADDING_MIN <= padding <= PADDING_MAX:
        raise ConfigCommandError("installed statusLine.padding is outside 0 through 32")
    refresh = current.get("refreshInterval")
    if refresh is not None and (
        not _is_int(refresh)
        or not REFRESH_INTERVAL_MIN <= refresh <= REFRESH_INTERVAL_MAX
    ):
        raise ConfigCommandError(
            "installed statusLine.refreshInterval is outside 1 through 3600"
        )
    hide_vim = current.get("hideVimModeIndicator", False)
    if not isinstance(hide_vim, bool):
        raise ConfigCommandError(
            "installed statusLine.hideVimModeIndicator must be true or false"
        )
    return HostConfig(padding, refresh, hide_vim), True


def _settings_with_host(
    settings: dict,
    executable: Path,
    host: HostConfig,
) -> dict:
    current = settings.get("statusLine")
    command = current.get("command") if isinstance(current, dict) else None
    if not installer._is_cli_command(command, "render", executable):
        raise ConfigCommandError(
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


def read_effective_config(config_dir: Path, executable: Path) -> EffectiveConfig:
    try:
        display = dc.load_display_config(config_dir)
        settings, _ = installer._read_settings(config_dir / "settings.json")
        host, installed = _host_from_settings(settings, executable)
    except (dc.DisplayConfigError, installer.ConfigurationError) as exc:
        raise ConfigCommandError(str(exc)) from exc
    return EffectiveConfig(display, host, installed, dc.config_path(config_dir))


def _read_display_for_mutation(
    config_dir: Path, *, tolerate_invalid: bool
) -> tuple[dc.DisplayConfig, bytes | None]:
    try:
        return dc.read_display_config(config_dir)
    except dc.DisplayConfigError:
        if not tolerate_invalid:
            raise
        path = dc.config_path(config_dir)
        try:
            return dc.DEFAULT_CONFIG, path.read_bytes()
        except FileNotFoundError:
            return dc.DEFAULT_CONFIG, None
        except OSError as exc:
            raise ConfigCommandError(f"cannot read {path}: {exc}") from exc


def _backup_transaction(
    config_dir: Path,
    action: str,
    *,
    display_raw: bytes | None | object = _UNCHANGED,
    settings_raw: bytes | None | object = _UNCHANGED,
) -> Path:
    artifacts = []
    if display_raw is not _UNCHANGED:
        artifacts.append(
            (
                "claude-statusline.json",
                dc.config_path(config_dir),
                display_raw,
            )
        )
    if settings_raw is not _UNCHANGED:
        artifacts.append(
            (
                "settings.json",
                config_dir / "settings.json",
                settings_raw,
            )
        )
    return installer._backup_artifacts(config_dir, action, artifacts)


def _delete_file(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        return
    directory_fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


Mutation = Callable[
    [dc.DisplayConfig, dict, HostConfig, bool],
    tuple[dc.DisplayConfig | object, dict | object],
]


def mutate_configuration(
    config_dir: Path,
    executable: Path,
    action: str,
    mutation: Mutation,
    *,
    tolerate_invalid_display: bool = False,
) -> MutationResult:
    config_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        with installer._installation_lock(config_dir):
            display, display_raw = _read_display_for_mutation(
                config_dir, tolerate_invalid=tolerate_invalid_display
            )
            settings, settings_raw = installer._read_settings(
                config_dir / "settings.json"
            )
            host, installed = _host_from_settings(settings, executable)
            new_display, new_settings = mutation(display, settings, host, installed)

            display_changed = False
            if new_display is _DELETE:
                display_changed = display_raw is not None
            elif new_display is not _UNCHANGED:
                if not isinstance(new_display, dc.DisplayConfig):
                    raise AssertionError("display mutation returned an invalid value")
                display_changed = new_display != display

            settings_changed = (
                new_settings is not _UNCHANGED and new_settings != settings
            )
            if not display_changed and not settings_changed:
                effective = EffectiveConfig(
                    display,
                    host,
                    installed,
                    dc.config_path(config_dir),
                )
                return MutationResult(False, effective)

            backup_dir = _backup_transaction(
                config_dir,
                action,
                display_raw=display_raw if display_changed else _UNCHANGED,
                settings_raw=settings_raw if settings_changed else _UNCHANGED,
            )
            try:
                if settings_changed:
                    installer._atomic_write_settings(
                        config_dir / "settings.json", new_settings
                    )
                if display_changed:
                    if new_display is _DELETE:
                        _delete_file(dc.config_path(config_dir))
                    else:
                        dc.write_display_config(config_dir, new_display)
            except (OSError, dc.DisplayConfigError) as exc:
                rollback_errors = []
                if display_changed:
                    try:
                        dc.restore_bytes(dc.config_path(config_dir), display_raw)
                    except dc.DisplayConfigError as rollback_exc:
                        rollback_errors.append(str(rollback_exc))
                if settings_changed:
                    try:
                        dc.restore_bytes(config_dir / "settings.json", settings_raw)
                    except dc.DisplayConfigError as rollback_exc:
                        rollback_errors.append(str(rollback_exc))
                suffix = (
                    "; rollback also failed: " + "; ".join(rollback_errors)
                    if rollback_errors
                    else ""
                )
                raise ConfigCommandError(
                    f"configuration update failed: {exc}{suffix}"
                ) from exc

            effective_display = (
                dc.DEFAULT_CONFIG
                if new_display is _DELETE
                else new_display
                if new_display is not _UNCHANGED
                else display
            )
            effective_settings = (
                new_settings if new_settings is not _UNCHANGED else settings
            )
            effective_host, effective_installed = _host_from_settings(
                effective_settings, executable
            )
            effective = EffectiveConfig(
                effective_display,
                effective_host,
                effective_installed,
                dc.config_path(config_dir),
            )
            return MutationResult(True, effective, backup_dir)
    except (dc.DisplayConfigError, installer.ConfigurationError) as exc:
        raise ConfigCommandError(str(exc)) from exc


def _validated_items(items: list[str]) -> tuple[str, ...]:
    try:
        return dc.validate_items(items)
    except dc.DisplayConfigError as exc:
        raise ConfigCommandError(str(exc)) from exc


def set_items(config_dir: Path, executable: Path, items: list[str]) -> MutationResult:
    validated = _validated_items(items)
    return mutate_configuration(
        config_dir,
        executable,
        "config-set-items",
        lambda display, settings, host, installed: (
            display.with_updates(items=validated),
            _UNCHANGED,
        ),
    )


def enable_items(
    config_dir: Path, executable: Path, items: list[str]
) -> MutationResult:
    validated = _validated_items(items)

    def mutation(display, settings, host, installed):
        enabled = list(display.items)
        enabled.extend(item for item in validated if item not in enabled)
        return display.with_updates(items=tuple(enabled)), _UNCHANGED

    return mutate_configuration(config_dir, executable, "config-enable", mutation)


def disable_items(
    config_dir: Path, executable: Path, items: list[str]
) -> MutationResult:
    validated = _validated_items(items)
    disabled = set(validated)
    return mutate_configuration(
        config_dir,
        executable,
        "config-disable",
        lambda display, settings, host, installed: (
            display.with_updates(
                items=tuple(item for item in display.items if item not in disabled)
            ),
            _UNCHANGED,
        ),
    )


def order_items(config_dir: Path, executable: Path, items: list[str]) -> MutationResult:
    validated = _validated_items(items)

    def mutation(display, settings, host, installed):
        if set(validated) != set(display.items) or len(validated) != len(display.items):
            missing = [item for item in display.items if item not in validated]
            extra = [item for item in validated if item not in display.items]
            details = []
            if missing:
                details.append("missing: " + ", ".join(missing))
            if extra:
                details.append("not enabled: " + ", ".join(extra))
            raise ConfigCommandError(
                "order must contain every enabled item exactly once"
                + (" (" + "; ".join(details) + ")" if details else "")
            )
        return display.with_updates(items=validated), _UNCHANGED

    return mutate_configuration(config_dir, executable, "config-order", mutation)


def _display_with_option(
    display: dc.DisplayConfig, option: str, value: Any
) -> dc.DisplayConfig:
    try:
        if option == "colors":
            return display.with_updates(use_colors=_parse_toggle(value, option))
        if option == "palette":
            return display.with_updates(palette=value)
        if option == "directory-style":
            return display.with_updates(directory_style=value)
        if option == "separator-style":
            return display.with_updates(separator_style=value)
    except dc.DisplayConfigError as exc:
        raise ConfigCommandError(str(exc)) from exc
    raise ConfigCommandError(f"unknown display option: {option}")


def _host_with_option(host: HostConfig, option: str, value: Any) -> HostConfig:
    if option == "padding":
        return HostConfig(
            _parse_padding(value),
            host.refresh_interval,
            host.hide_vim_mode_indicator,
        )
    if option == "refresh-interval":
        return HostConfig(
            host.padding,
            _parse_refresh_interval(value),
            host.hide_vim_mode_indicator,
        )
    if option == "hide-vim-mode-indicator":
        return HostConfig(
            host.padding,
            host.refresh_interval,
            _parse_toggle(value, option),
        )
    raise ConfigCommandError(f"unknown host option: {option}")


def set_option(
    config_dir: Path,
    executable: Path,
    option: str,
    value: Any,
) -> MutationResult:
    if option not in OPTION_NAMES:
        raise ConfigCommandError(
            "unknown option; expected one of: " + ", ".join(sorted(OPTION_NAMES))
        )

    def mutation(display, settings, host, installed):
        if option in DISPLAY_OPTION_NAMES:
            return _display_with_option(display, option, value), _UNCHANGED
        updated_host = _host_with_option(host, option, value)
        return _UNCHANGED, _settings_with_host(settings, executable, updated_host)

    return mutate_configuration(
        config_dir, executable, f"config-set-{option}", mutation
    )


def apply_configuration(
    config_dir: Path,
    executable: Path,
    *,
    items: list[str],
    colors: Any,
    palette: str,
    directory_style: str,
    separator_style: str,
    padding: Any,
    refresh_interval: Any,
    hide_vim_mode_indicator: Any,
) -> MutationResult:
    validated_items = _validated_items(items)
    try:
        display = dc.validate_display_config(
            {
                "schema_version": dc.SCHEMA_VERSION,
                "items": list(validated_items),
                "use_colors": _parse_toggle(colors, "colors"),
                "palette": palette,
                "directory_style": directory_style,
                "separator_style": separator_style,
            }
        )
    except dc.DisplayConfigError as exc:
        raise ConfigCommandError(str(exc)) from exc
    host = HostConfig(
        _parse_padding(padding),
        _parse_refresh_interval(refresh_interval),
        _parse_toggle(hide_vim_mode_indicator, "hide-vim-mode-indicator"),
    )

    return mutate_configuration(
        config_dir,
        executable,
        "config-apply",
        lambda current_display, settings, current_host, installed: (
            display,
            _settings_with_host(settings, executable, host),
        ),
    )


def reset_configuration(config_dir: Path, executable: Path) -> MutationResult:
    def mutation(display, settings, host, installed):
        updated_settings = (
            _settings_with_host(settings, executable, DEFAULT_HOST_CONFIG)
            if installed
            else _UNCHANGED
        )
        return _DELETE, updated_settings

    return mutate_configuration(
        config_dir,
        executable,
        "config-reset",
        mutation,
        tolerate_invalid_display=True,
    )


def _format_effective(config: EffectiveConfig) -> str:
    host = config.host.to_dict()
    lines = [
        "Scope: user",
        f"Config: {config.config_path}",
        f"Installed: {'yes' if config.installed else 'no'}",
        "Items: " + (", ".join(config.display.items) or "(none)"),
        f"Colors: {'on' if config.display.use_colors else 'off'}",
        f"Palette: {config.display.palette}",
        f"Directory style: {config.display.directory_style}",
        f"Separator style: {config.display.separator_style}",
        f"Padding: {host['padding']}",
        f"Refresh interval: {host['refresh_interval']}",
        "Hide Vim mode indicator: "
        + ("yes" if host["hide_vim_mode_indicator"] else "no"),
    ]
    return "\n".join(lines)


def _format_mutation(result: MutationResult) -> str:
    state = "updated" if result.changed else "already current"
    line = f"Status line configuration {state}."
    if result.backup_dir is not None:
        line += f" Backup: {result.backup_dir}"
    return line


def item_listing(config: EffectiveConfig | None = None) -> list[dict[str, Any]]:
    enabled = config.display.items if config else dc.DEFAULT_ITEMS
    positions = {item: index for index, item in enumerate(enabled)}
    return [
        {
            "id": item,
            "description": description,
            "default_enabled": item in dc.DEFAULT_ITEMS,
            "enabled": item in positions,
            "position": positions.get(item),
        }
        for item, description in dc.ITEM_CATALOG.items()
    ]


def add_config_parser(subparsers) -> argparse.ArgumentParser:
    parser = subparsers.add_parser(
        "config", help="view or change status line display settings"
    )
    parser.add_argument(
        "--config-dir",
        metavar="PATH",
        help="Claude configuration directory (default: CLAUDE_CONFIG_DIR or ~/.claude)",
    )
    actions = parser.add_subparsers(dest="config_action", required=True)

    show = actions.add_parser("show", help="show effective configuration")
    show.add_argument("--json", action="store_true", dest="json_output")

    listing = actions.add_parser("list-items", help="list supported display items")
    listing.add_argument("--json", action="store_true", dest="json_output")

    set_items_parser = actions.add_parser(
        "set-items", help="replace enabled items and their order"
    )
    set_items_parser.add_argument("items", nargs="*")

    enable = actions.add_parser("enable", help="append display items")
    enable.add_argument("items", nargs="+")

    disable = actions.add_parser("disable", help="remove display items")
    disable.add_argument("items", nargs="+")

    order = actions.add_parser("order", help="reorder all enabled items")
    order.add_argument("items", nargs="*")

    set_parser = actions.add_parser("set", help="set one display or host option")
    set_parser.add_argument("option", choices=sorted(OPTION_NAMES))
    set_parser.add_argument("value")

    apply_parser = actions.add_parser(
        "apply", help="atomically apply a complete guided configuration"
    )
    apply_parser.add_argument("--items", nargs="*", required=True)
    apply_parser.add_argument("--colors", choices=("on", "off"), required=True)
    apply_parser.add_argument("--palette", choices=dc.PALETTES, required=True)
    apply_parser.add_argument(
        "--directory-style", choices=dc.DIRECTORY_STYLES, required=True
    )
    apply_parser.add_argument(
        "--separator-style", choices=dc.SEPARATOR_STYLES, required=True
    )
    apply_parser.add_argument("--padding", required=True)
    apply_parser.add_argument("--refresh-interval", required=True)
    apply_parser.add_argument(
        "--hide-vim-mode-indicator", choices=("on", "off"), required=True
    )

    actions.add_parser("reset", help="restore display and host defaults")
    return parser


class _RaisingArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise ConfigCommandError(message)


def parse_slash_arguments(command_args: str) -> argparse.Namespace:
    try:
        arguments = shlex.split(command_args, posix=True)
    except ValueError as exc:
        raise ConfigCommandError(f"invalid command arguments: {exc}") from exc
    parser = _RaisingArgumentParser(prog="/statusline-config", add_help=False)
    actions = parser.add_subparsers(dest="config_action", required=True)

    show = actions.add_parser("show", add_help=False)
    show.add_argument("--json", action="store_true", dest="json_output")
    listing = actions.add_parser("list-items", add_help=False)
    listing.add_argument("--json", action="store_true", dest="json_output")
    for name, minimum in (
        ("set-items", 0),
        ("enable", 1),
        ("disable", 1),
        ("order", 0),
    ):
        child = actions.add_parser(name, add_help=False)
        child.add_argument("items", nargs="*" if minimum == 0 else "+")
    set_parser = actions.add_parser("set", add_help=False)
    set_parser.add_argument("option", choices=sorted(OPTION_NAMES))
    set_parser.add_argument("value")
    apply_parser = actions.add_parser("apply", add_help=False)
    apply_parser.add_argument("--items", nargs="*", required=True)
    apply_parser.add_argument("--colors", choices=("on", "off"), required=True)
    apply_parser.add_argument("--palette", choices=dc.PALETTES, required=True)
    apply_parser.add_argument(
        "--directory-style", choices=dc.DIRECTORY_STYLES, required=True
    )
    apply_parser.add_argument(
        "--separator-style", choices=dc.SEPARATOR_STYLES, required=True
    )
    apply_parser.add_argument("--padding", required=True)
    apply_parser.add_argument("--refresh-interval", required=True)
    apply_parser.add_argument(
        "--hide-vim-mode-indicator", choices=("on", "off"), required=True
    )
    actions.add_parser("reset", add_help=False)
    return parser.parse_args(arguments)


def execute_config_namespace(
    args: argparse.Namespace,
    config_dir: Path,
    executable: Path,
) -> str:
    action = args.config_action
    if action == "show":
        effective = read_effective_config(config_dir, executable)
        return (
            json.dumps(effective.to_dict(), ensure_ascii=False, indent=2)
            if args.json_output
            else _format_effective(effective)
        )
    if action == "list-items":
        effective = read_effective_config(config_dir, executable)
        listing = item_listing(effective)
        if args.json_output:
            return json.dumps(listing, ensure_ascii=False, indent=2)
        return "\n".join(
            f"{'[x]' if item['enabled'] else '[ ]'} {item['id']}: {item['description']}"
            for item in listing
        )
    if action == "set-items":
        result = set_items(config_dir, executable, args.items)
    elif action == "enable":
        result = enable_items(config_dir, executable, args.items)
    elif action == "disable":
        result = disable_items(config_dir, executable, args.items)
    elif action == "order":
        result = order_items(config_dir, executable, args.items)
    elif action == "set":
        result = set_option(config_dir, executable, args.option, args.value)
    elif action == "apply":
        result = apply_configuration(
            config_dir,
            executable,
            items=args.items,
            colors=args.colors,
            palette=args.palette,
            directory_style=args.directory_style,
            separator_style=args.separator_style,
            padding=args.padding,
            refresh_interval=args.refresh_interval,
            hide_vim_mode_indicator=args.hide_vim_mode_indicator,
        )
    elif action == "reset":
        result = reset_configuration(config_dir, executable)
    else:
        raise ConfigCommandError(f"unknown config action: {action}")
    return _format_mutation(result)
