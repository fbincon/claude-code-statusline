"""Command-line entry point for claude-code-statusline."""

from __future__ import annotations

import sys

from ._version import __version__


def _common_config_argument(parser) -> None:
    parser.add_argument(
        "--config-dir",
        metavar="PATH",
        help="Claude configuration directory (default: CLAUDE_CONFIG_DIR or ~/.claude)",
    )


def build_parser():
    import argparse

    from . import config_commands

    parser = argparse.ArgumentParser(
        prog="claude-statusline",
        description="Packaged Claude Code status line for Linux.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser(
        "render", help="render status line JSON received on stdin"
    )
    subparsers.add_parser(
        "hook", help="record a Claude lifecycle hook received on stdin"
    )
    subparsers.add_parser(
        "slash-hook", help="handle direct /statusline-config invocations"
    )
    config_commands.add_config_parser(subparsers)

    install_parser = subparsers.add_parser(
        "install", help="configure Claude Code to use this status line"
    )
    _common_config_argument(install_parser)
    install_parser.add_argument(
        "--dry-run", action="store_true", help="report whether settings would change"
    )
    install_parser.add_argument(
        "--force",
        action="store_true",
        help="replace a conflicting statusLine or /statusline-config skill",
    )

    uninstall_parser = subparsers.add_parser(
        "uninstall", help="remove only this tool's Claude Code configuration"
    )
    _common_config_argument(uninstall_parser)
    uninstall_parser.add_argument(
        "--dry-run", action="store_true", help="report whether settings would change"
    )

    doctor_parser = subparsers.add_parser(
        "doctor", help="diagnose the installation without changing files"
    )
    _common_config_argument(doctor_parser)
    return parser


def _print_change(result, dry_run: bool) -> None:
    if dry_run:
        state = "would change" if result.changed else "already correct"
        print(f"{result.action}: {state}: {result.settings_path}")
        for path in result.changed_paths:
            print(f"artifact: {path}")
        return
    state = "updated" if result.changed else "already correct"
    print(f"{result.action}: {state}: {result.settings_path}")
    for path in result.changed_paths:
        print(f"artifact: {path}")
    if result.backup_dir is not None:
        print(f"backup: {result.backup_dir}")


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    # Runtime hooks and rendering run frequently. Keep their startup paths free
    # of argparse and installer imports used only by administrative commands.
    if arguments == ["render"]:
        from . import statusline

        statusline.main()
        return 0
    if arguments == ["hook"]:
        from . import turn_state

        turn_state.main()
        return 0
    if arguments == ["slash-hook"]:
        from . import slash_hook

        slash_hook.main()
        return 0

    from . import config_commands, installer

    parser = build_parser()
    args = parser.parse_args(arguments)

    if args.command == "render":
        from . import statusline

        statusline.main()
        return 0
    if args.command == "hook":
        from . import turn_state

        turn_state.main()
        return 0
    if args.command == "slash-hook":
        from . import slash_hook

        slash_hook.main()
        return 0

    config_dir = installer.resolve_config_dir(args.config_dir)
    try:
        executable = installer.resolve_cli_executable()
    except installer.ConfigurationError as exc:
        if args.command == "doctor":
            executable = None
        else:
            print(f"error: {exc}", file=sys.stderr)
            return 2

    try:
        if args.command == "install":
            if not sys.platform.startswith("linux"):
                raise installer.ConfigurationError("this release supports Linux only")
            result = installer.install_configuration(
                config_dir, executable,
                dry_run=args.dry_run,
                force=args.force,
            )
            _print_change(result, args.dry_run)
            return 0
        if args.command == "uninstall":
            result = installer.uninstall_configuration(
                config_dir, executable, dry_run=args.dry_run
            )
            _print_change(result, args.dry_run)
            return 0
        if args.command == "doctor":
            diagnostics = installer.collect_diagnostics(config_dir, executable)
            for item in diagnostics:
                print(f"[{item.level}] {item.message}")
            return 1 if any(item.level == "ERROR" for item in diagnostics) else 0
        if args.command == "config":
            print(config_commands.execute_config_namespace(
                args, config_dir, executable
            ))
            return 0
    except (installer.ConfigurationError, config_commands.ConfigCommandError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    parser.error(f"unknown command: {args.command}")
    return 2
