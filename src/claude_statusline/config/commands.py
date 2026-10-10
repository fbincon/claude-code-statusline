"""config / commands implementation."""

from __future__ import annotations

from claude_statusline.i18n import message as msg, as_message

import argparse
import json
import shlex
from pathlib import Path
from typing import Any
from claude_statusline.config import display as config_display
from claude_statusline.config import catalog, advanced, presets, ui_preferences
from claude_statusline.config import models as config_models
from claude_statusline.config import service as config_service


def _format_effective(config: config_models.EffectiveConfig, language="en") -> str:
    from claude_statusline.i18n.translator import translate as t

    host = config.host.to_dict()
    values = [
        "user",
        config.config_path,
        "yes" if config.installed else "no",
        ", ".join(config.display.items) or "(none)",
        "on" if config.display.use_colors else "off",
        config.display.palette,
        config.display.theme,
        config.display.powerline_glyph,
        config.display.directory_style,
        config.display.separator_style,
        config.display.scope_labels,
        config.display.statusline_language,
        ", ".join(config.display.subagents.items) or "(none)",
        "on" if config.display.subagents.enabled else "off",
        config.subagent_statusline.state,
        host["padding"],
        host["refresh_interval"],
        "yes" if host["hide_vim_mode_indicator"] else "no",
    ]
    keys = (
        "scope",
        "config",
        "installed",
        "items",
        "colors",
        "palette",
        "theme",
        "powerline_glyph",
        "directory_style",
        "separator_style",
        "scope_labels",
        "statusline_language",
        "subagent_items",
        "custom_subagent_rows",
        "subagent_statusline",
        "padding",
        "refresh_interval",
        "hide_vim_indicator",
    )
    return "\n".join(
        t("config.show." + key, language, value=value)
        for key, value in zip(keys, values)
    )


def _format_mutation(result: config_models.MutationResult, language="en") -> str:
    from claude_statusline.i18n.translator import translate as t

    state = t("state.updated" if result.changed else "state.current", language)
    line = t("config.changed", language, state=state)
    if result.backup_dir is not None:
        line += t("config.backup", language, path=result.backup_dir)
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
        "config", help=msg("cli.help.view_or_change_status_line_display_settings")
    )
    parser.add_argument(
        "--config-dir",
        metavar="PATH",
        help=msg(
            "cli.help.claude_configuration_directory_default_claude_config_dir_or"
        ),
    )
    actions = parser.add_subparsers(dest="config_action", required=True)

    show = actions.add_parser("show", help=msg("cli.help.show_effective_configuration"))
    show.add_argument("--json", action="store_true", dest="json_output")

    listing = actions.add_parser(
        "list-items", help=msg("cli.help.list_supported_display_items")
    )
    listing.add_argument("--json", action="store_true", dest="json_output")

    set_items_parser = actions.add_parser(
        "set-items", help=msg("cli.help.replace_enabled_items_and_their_order")
    )
    set_items_parser.add_argument("items", nargs="*")

    enable = actions.add_parser("enable", help=msg("cli.help.append_display_items"))
    enable.add_argument("items", nargs="+")

    disable = actions.add_parser("disable", help=msg("cli.help.remove_display_items"))
    disable.add_argument("items", nargs="+")

    order = actions.add_parser("order", help=msg("cli.help.reorder_all_enabled_items"))
    order.add_argument("items", nargs="*")

    subagents = actions.add_parser(
        "subagents", help=msg("cli.help.view_or_change_subagent_row_items")
    )
    subagent_actions = subagents.add_subparsers(dest="subagent_action", required=True)
    subagent_listing = subagent_actions.add_parser(
        "list-items", help=msg("cli.help.list_supported_subagent_row_items")
    )
    subagent_listing.add_argument("--json", action="store_true", dest="json_output")
    subagent_set = subagent_actions.add_parser(
        "set-items", help=msg("cli.help.replace_enabled_subagent_items_and_their_order")
    )
    subagent_set.add_argument("items", nargs="*")
    subagent_enable = subagent_actions.add_parser(
        "enable", help=msg("cli.help.append_subagent_row_items")
    )
    subagent_enable.add_argument("items", nargs="+")
    subagent_disable = subagent_actions.add_parser(
        "disable", help=msg("cli.help.remove_subagent_row_items")
    )
    subagent_disable.add_argument("items", nargs="+")
    subagent_order = subagent_actions.add_parser(
        "order", help=msg("cli.help.reorder_all_enabled_subagent_row_items")
    )
    subagent_order.add_argument("items", nargs="*")

    set_parser = actions.add_parser(
        "set", help=msg("cli.help.set_one_display_or_host_option")
    )
    set_parser.add_argument("option", choices=sorted(config_models.OPTION_NAMES))
    set_parser.add_argument("value")

    apply_parser = actions.add_parser(
        "apply", help=msg("cli.help.atomically_apply_a_complete_guided_configuration")
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
    apply_parser.add_argument("--statusline-language", choices=config_display.STATUSLINE_LANGUAGES)

    preset = actions.add_parser(
        "preset", help=msg("cli.help.apply_an_editable_display_preset")
    )
    preset.add_argument("preset", choices=tuple(presets.ROWS))
    preset.add_argument(
        "--dry-run",
        action="store_true",
        help=msg("cli.help.print_the_draft_without_saving"),
    )
    importing = actions.add_parser(
        "import", help=msg("cli.help.validate_and_import_portable_display_json")
    )
    importing.add_argument("path")
    importing.add_argument(
        "--dry-run",
        action="store_true",
        help=msg("cli.help.print_the_validated_draft_without_saving"),
    )
    exporting = actions.add_parser(
        "export", help=msg("cli.help.export_portable_tool_configuration")
    )
    exporting.add_argument("path")
    exporting.add_argument("--overwrite", action="store_true")
    item = actions.add_parser(
        "item", help=msg("cli.help.set_one_scoped_item_format_priority_width")
    )
    item.add_argument("scope", choices=("main", "subagent"))
    item.add_argument("item")
    item.add_argument("option")
    item.add_argument("value")
    layout = actions.add_parser(
        "layout",
        help=msg("cli.help.select_auto_layout_or_explicit_comma_separated_rows"),
    )
    layout.add_argument("mode", choices=("auto", "explicit"))
    layout.add_argument("rows", nargs="*")

    actions.add_parser("reset", help=msg("cli.help.restore_display_and_host_defaults"))
    language = actions.add_parser("language", help=msg("cli.help.language"))
    language_actions = language.add_subparsers(dest="language_action", required=True)
    show_language = language_actions.add_parser(
        "show", help=msg("cli.help.language_show")
    )
    show_language.add_argument("--json", action="store_true", dest="json_output")
    set_language = language_actions.add_parser("set", help=msg("cli.help.language_set"))
    set_language.add_argument("language_value", choices=("en", "zh-CN"))
    language_actions.add_parser("reset", help=msg("cli.help.language_reset"))
    return parser


class _RaisingArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise config_models.ConfigCommandError(message)


def parse_slash_arguments(command_args: str) -> argparse.Namespace:
    try:
        arguments = shlex.split(command_args, posix=True)
    except ValueError as exc:
        raise config_models.ConfigCommandError(
            msg("errors.commands.invalid_command_arguments", exc=exc)
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
    apply_parser.add_argument("--statusline-language", choices=config_display.STATUSLINE_LANGUAGES)
    actions.add_parser("reset", add_help=False)
    language_parser = actions.add_parser("language", add_help=False)
    language_actions = language_parser.add_subparsers(
        dest="language_action", required=True
    )
    showing = language_actions.add_parser("show", add_help=False)
    showing.add_argument("--json", action="store_true", dest="json_output")
    setting = language_actions.add_parser("set", add_help=False)
    setting.add_argument("language_value", choices=("en", "zh-CN"))
    language_actions.add_parser("reset", add_help=False)
    return parser.parse_args(arguments)


def execute_config_namespace(
    args: argparse.Namespace,
    config_dir: Path,
    executable: Path,
    *,
    language: str | None = None,
) -> str:
    from claude_statusline.i18n.translator import translate as t

    language = language or ui_preferences.read(config_dir).ui_language
    action = args.config_action
    if action == "language":
        if args.language_action == "show":
            preference = ui_preferences.read(config_dir)
            if args.json_output:
                return json.dumps(preference.to_dict(), ensure_ascii=False, indent=2)
            return t("cli.language", language, language=preference.ui_language)
        preference = ui_preferences.set_language(
            config_dir, "en" if args.language_action == "reset" else args.language_value
        )
        return t("cli.language_saved", language, language=preference.ui_language)
    if action == "show":
        effective = config_service.read_effective_config(config_dir, executable)
        return (
            json.dumps(effective.to_dict(), ensure_ascii=False, indent=2)
            if args.json_output
            else _format_effective(effective, language)
        )
    if action == "list-items":
        effective = config_service.read_effective_config(config_dir, executable)
        listing = item_listing(effective)
        if args.json_output:
            return json.dumps(listing, ensure_ascii=False, indent=2)
        return "\n".join(
            f"{'[x]' if item['enabled'] else '[ ]'} {item['id']}: "
            + t("items.main." + item["id"] + ".description", language)
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
                f"{item['id']}: "
                + t("items.subagent." + item["id"] + ".description", language)
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
                msg(
                    "errors.commands.unknown_subagent_config_action",
                    subaction=subaction,
                )
            )
        return _format_mutation(result, language)
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
            statusline_language=args.statusline_language,
        )
    elif action in ("preset", "import", "export"):
        from claude_statusline.ui import protocol, contracts

        current = protocol.read_result(
            config_service.read_effective_config(config_dir, executable)
        )
        payload = {"draft": current["draft"]}
        if action == "preset":
            payload["preset"] = args.preset
        else:
            payload["path"] = args.path
        if action == "export":
            payload["overwrite"] = args.overwrite
        try:
            transformed = protocol.dispatch(
                {
                    "protocol_version": contracts.PROTOCOL_VERSION,
                    "operation": action,
                    "payload": payload,
                },
                config_dir,
                executable,
            )
            if action == "export":
                return t("config.exported", language, path=transformed["path"])
            if args.dry_run:
                return json.dumps(transformed["draft"], ensure_ascii=False, indent=2)
            saved = protocol.dispatch(
                {
                    "protocol_version": contracts.PROTOCOL_VERSION,
                    "operation": "apply",
                    "payload": {
                        "draft": transformed["draft"],
                        "expected_revision": current["revision"],
                    },
                },
                config_dir,
                executable,
            )
            return t(
                "config.changed",
                language,
                state=t(
                    "state.updated" if saved["changed"] else "state.current", language
                ),
            ) + (
                t("config.backup", language, path=saved["backup_dir"])
                if saved["backup_dir"]
                else ""
            )
        except (protocol.RequestError, OSError) as exc:
            raise config_models.ConfigCommandError(as_message(exc)) from exc
    elif action in ("item", "layout"):

        def mutate(display, settings, host, installed):
            updated = (
                advanced.edit_item(
                    display, args.scope, args.item, args.option, args.value
                )
                if action == "item"
                else advanced.edit_layout(
                    display, args.mode, [row.split(",") for row in args.rows]
                )
            )
            return updated, config_models._UNCHANGED

        result = config_service.mutate_configuration(
            config_dir, executable, "config-" + action, mutate
        )
    elif action == "reset":
        result = config_service.reset_configuration(config_dir, executable)
    else:
        raise config_models.ConfigCommandError(
            msg("errors.commands.unknown_config_action", action=action)
        )
    return _format_mutation(result, language)
