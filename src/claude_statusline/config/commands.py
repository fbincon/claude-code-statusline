"""config / commands implementation."""

from __future__ import annotations

import argparse
import json
import shlex
from pathlib import Path
from typing import Any
from claude_statusline.config import display as config_display
from claude_statusline.config import catalog, advanced
from claude_statusline.config import models as config_models
from claude_statusline.config import service as config_service


def _format_effective(config: config_models.EffectiveConfig) -> str:
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
        f"Scope labels: {config.display.scope_labels}",
        "Subagent items: " + (", ".join(config.display.subagents.items) or "(none)"),
        "Custom subagent rows: "
        + ("on" if config.display.subagents.enabled else "off"),
        "Subagent statusline: " + config.subagent_statusline.state,
        f"Padding: {host['padding']}",
        f"Refresh interval: {host['refresh_interval']}",
        "Hide Vim mode indicator: "
        + ("yes" if host["hide_vim_mode_indicator"] else "no"),
    ]
    return "\n".join(lines)


def _format_mutation(result: config_models.MutationResult) -> str:
    state = "updated" if result.changed else "already current"
    line = f"Status line configuration {state}."
    if result.backup_dir is not None:
        line += f" Backup: {result.backup_dir}"
    return line


def item_listing(
    config: config_models.EffectiveConfig | None = None,
) -> list[dict[str, Any]]:
    enabled = config.display.items if config else config_display.DEFAULT_ITEMS
    positions = {item: index for index, item in enumerate(enabled)}
    return [
        {
            **catalog.BY_SCOPE["main"][item].to_dict(),
            "description": description,
            "default_enabled": item in config_display.DEFAULT_ITEMS,
            "enabled": item in positions,
            "position": positions.get(item),
        }
        for item, description in config_display.ITEM_CATALOG.items()
    ]


def subagent_item_listing(
    config: config_models.EffectiveConfig | None = None,
) -> list[dict[str, Any]]:
    enabled = (
        config.display.subagents.items
        if config
        else config_display.DEFAULT_SUBAGENT_ITEMS
    )
    positions = {item: index for index, item in enumerate(enabled)}
    return [
        {
            **catalog.BY_SCOPE["subagent"][item].to_dict(),
            "description": description,
            "default_enabled": item in config_display.DEFAULT_SUBAGENT_ITEMS,
            "enabled": item in positions,
            "position": positions.get(item),
        }
        for item, description in config_display.SUBAGENT_ITEM_CATALOG.items()
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

    subagents = actions.add_parser(
        "subagents", help="view or change subagent row items"
    )
    subagent_actions = subagents.add_subparsers(dest="subagent_action", required=True)
    subagent_listing = subagent_actions.add_parser(
        "list-items", help="list supported subagent row items"
    )
    subagent_listing.add_argument("--json", action="store_true", dest="json_output")
    subagent_set = subagent_actions.add_parser(
        "set-items", help="replace enabled subagent items and their order"
    )
    subagent_set.add_argument("items", nargs="*")
    subagent_enable = subagent_actions.add_parser(
        "enable", help="append subagent row items"
    )
    subagent_enable.add_argument("items", nargs="+")
    subagent_disable = subagent_actions.add_parser(
        "disable", help="remove subagent row items"
    )
    subagent_disable.add_argument("items", nargs="+")
    subagent_order = subagent_actions.add_parser(
        "order", help="reorder all enabled subagent row items"
    )
    subagent_order.add_argument("items", nargs="*")

    set_parser = actions.add_parser("set", help="set one display or host option")
    set_parser.add_argument("option", choices=sorted(config_models.OPTION_NAMES))
    set_parser.add_argument("value")

    apply_parser = actions.add_parser(
        "apply", help="atomically apply a complete guided configuration"
    )
    apply_parser.add_argument("--items", nargs="*", required=True)
    apply_parser.add_argument("--colors", choices=("on", "off"), required=True)
    apply_parser.add_argument(
        "--palette", choices=config_display.PALETTES, required=True
    )
    apply_parser.add_argument(
        "--directory-style", choices=config_display.DIRECTORY_STYLES, required=True
    )
    apply_parser.add_argument(
        "--separator-style", choices=config_display.SEPARATOR_STYLES, required=True
    )
    apply_parser.add_argument("--padding", required=True)
    apply_parser.add_argument("--refresh-interval", required=True)
    apply_parser.add_argument(
        "--hide-vim-mode-indicator", choices=("on", "off"), required=True
    )
    apply_parser.add_argument("--subagent-items", nargs="*")
    apply_parser.add_argument("--subagent-statusline", choices=("on", "off"))
    apply_parser.add_argument("--scope-labels", choices=config_display.SCOPE_LABELS)

    item = actions.add_parser("item", help="set one scoped item format/priority/width")
    item.add_argument("scope", choices=("main", "subagent"))
    item.add_argument("item")
    item.add_argument("option")
    item.add_argument("value")
    layout = actions.add_parser("layout", help="select auto layout or explicit comma-separated rows")
    layout.add_argument("mode", choices=("auto", "explicit"))
    layout.add_argument("rows", nargs="*")

    actions.add_parser("reset", help="restore display and host defaults")
    return parser


class _RaisingArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise config_models.ConfigCommandError(message)


def parse_slash_arguments(command_args: str) -> argparse.Namespace:
    try:
        arguments = shlex.split(command_args, posix=True)
    except ValueError as exc:
        raise config_models.ConfigCommandError(
            f"invalid command arguments: {exc}"
        ) from exc
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
    subagents = actions.add_parser("subagents", add_help=False)
    subagent_actions = subagents.add_subparsers(dest="subagent_action", required=True)
    subagent_listing = subagent_actions.add_parser("list-items", add_help=False)
    subagent_listing.add_argument("--json", action="store_true", dest="json_output")
    for name, minimum in (
        ("set-items", 0),
        ("enable", 1),
        ("disable", 1),
        ("order", 0),
    ):
        child = subagent_actions.add_parser(name, add_help=False)
        child.add_argument("items", nargs="*" if minimum == 0 else "+")
    set_parser = actions.add_parser("set", add_help=False)
    set_parser.add_argument("option", choices=sorted(config_models.OPTION_NAMES))
    set_parser.add_argument("value")
    apply_parser = actions.add_parser("apply", add_help=False)
    apply_parser.add_argument("--items", nargs="*", required=True)
    apply_parser.add_argument("--colors", choices=("on", "off"), required=True)
    apply_parser.add_argument(
        "--palette", choices=config_display.PALETTES, required=True
    )
    apply_parser.add_argument(
        "--directory-style", choices=config_display.DIRECTORY_STYLES, required=True
    )
    apply_parser.add_argument(
        "--separator-style", choices=config_display.SEPARATOR_STYLES, required=True
    )
    apply_parser.add_argument("--padding", required=True)
    apply_parser.add_argument("--refresh-interval", required=True)
    apply_parser.add_argument(
        "--hide-vim-mode-indicator", choices=("on", "off"), required=True
    )
    apply_parser.add_argument("--subagent-items", nargs="*")
    apply_parser.add_argument("--subagent-statusline", choices=("on", "off"))
    apply_parser.add_argument("--scope-labels", choices=config_display.SCOPE_LABELS)
    actions.add_parser("reset", add_help=False)
    return parser.parse_args(arguments)


def execute_config_namespace(
    args: argparse.Namespace,
    config_dir: Path,
    executable: Path,
) -> str:
    action = args.config_action
    if action == "show":
        effective = config_service.read_effective_config(config_dir, executable)
        return (
            json.dumps(effective.to_dict(), ensure_ascii=False, indent=2)
            if args.json_output
            else _format_effective(effective)
        )
    if action == "list-items":
        effective = config_service.read_effective_config(config_dir, executable)
        listing = item_listing(effective)
        if args.json_output:
            return json.dumps(listing, ensure_ascii=False, indent=2)
        return "\n".join(
            f"{'[x]' if item['enabled'] else '[ ]'} {item['id']}: {item['description']}"
            for item in listing
        )
    if action == "subagents":
        subaction = args.subagent_action
        if subaction == "list-items":
            effective = config_service.read_effective_config(config_dir, executable)
            listing = subagent_item_listing(effective)
            if args.json_output:
                return json.dumps(listing, ensure_ascii=False, indent=2)
            return "\n".join(
                f"{'[x]' if item['enabled'] else '[ ]'} "
                f"{item['id']}: {item['description']}"
                for item in listing
            )
        if subaction == "set-items":
            result = config_service.set_subagent_items(
                config_dir, executable, args.items
            )
        elif subaction == "enable":
            result = config_service.enable_subagent_items(
                config_dir, executable, args.items
            )
        elif subaction == "disable":
            result = config_service.disable_subagent_items(
                config_dir, executable, args.items
            )
        elif subaction == "order":
            result = config_service.order_subagent_items(
                config_dir, executable, args.items
            )
        else:
            raise config_models.ConfigCommandError(
                f"unknown subagent config action: {subaction}"
            )
        return _format_mutation(result)
    if action == "set-items":
        result = config_service.set_items(config_dir, executable, args.items)
    elif action == "enable":
        result = config_service.enable_items(config_dir, executable, args.items)
    elif action == "disable":
        result = config_service.disable_items(config_dir, executable, args.items)
    elif action == "order":
        result = config_service.order_items(config_dir, executable, args.items)
    elif action == "set":
        result = config_service.set_option(
            config_dir, executable, args.option, args.value
        )
    elif action == "apply":
        result = config_service.apply_configuration(
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
            subagent_items=args.subagent_items,
            subagent_statusline=args.subagent_statusline,
            scope_labels=args.scope_labels,
        )
    elif action in ("item", "layout"):
        def mutate(display, settings, host, installed):
            updated = (advanced.edit_item(display, args.scope, args.item, args.option, args.value)
                       if action == "item" else advanced.edit_layout(display, args.mode, [row.split(",") for row in args.rows]))
            return updated, config_models._UNCHANGED
        result = config_service.mutate_configuration(config_dir, executable, "config-" + action, mutate)
    elif action == "reset":
        result = config_service.reset_configuration(config_dir, executable)
    else:
        raise config_models.ConfigCommandError(f"unknown config action: {action}")
    return _format_mutation(result)
