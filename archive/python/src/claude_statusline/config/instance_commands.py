"""Explicit, scoped CLI operations for display compositions."""

import json
from . import instances, service, models, display
from claude_statusline.i18n import message as msg, as_message


def add_parser(actions):
    parser = actions.add_parser("instance", help=msg("composition.manage"))
    parser.add_argument("scope", choices=("main", "subagent"))
    commands = parser.add_subparsers(dest="instance_action", required=True)
    listing = commands.add_parser("list", help=msg("composition.list"))
    listing.add_argument("--json", action="store_true", dest="json_output")
    add = commands.add_parser("add", help=msg("composition.add"))
    add.add_argument("type_id")
    add.add_argument("--after")
    add.add_argument("--text")
    for action in ("copy", "remove", "enable", "disable", "move", "set"):
        command = commands.add_parser(action, help=msg("composition." + action))
        command.add_argument("instance_id")
        if action == "move":
            position = command.add_mutually_exclusive_group(required=True)
            position.add_argument("--before")
            position.add_argument("--after")
        elif action == "set":
            command.add_argument("option")
            command.add_argument("value")


def execute(args, config_dir, executable, language="en"):
    from .commands import _format_mutation

    if args.instance_action == "list":
        effective = service.read_effective_config(config_dir, executable)
        nodes = instances.scoped(effective.display, args.scope).instances
        if args.json_output:
            return json.dumps(
                [i.to_dict() for i in nodes], ensure_ascii=False, indent=2
            )
        return "\n".join(
            f"{'[x]' if i.enabled else '[ ]'} {i.id}  {i.type_id}" for i in nodes
        )
    selected = None

    def mutation(current, settings, host, installed):
        nonlocal selected
        try:
            updated, selected = instances.edit(
                current,
                args.scope,
                args.instance_action,
                getattr(args, "instance_id", None),
                type_id=getattr(args, "type_id", None),
                after=getattr(args, "after", None),
                before=getattr(args, "before", None),
                text=getattr(args, "text", None),
                option=getattr(args, "option", None),
                value=getattr(args, "value", None),
            )
        except (ValueError, display.DisplayConfigError) as exc:
            raise models.ConfigCommandError(as_message(exc)) from exc
        return updated, models._UNCHANGED

    result = service.mutate_configuration(
        config_dir, executable, "config-instance-" + args.instance_action, mutation
    )
    return _format_mutation(result, language) + (
        "\n" + selected if selected is not None else ""
    )
