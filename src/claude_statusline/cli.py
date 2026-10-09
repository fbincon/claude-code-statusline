"""Command-line entry point for claude-code-statusline."""

from __future__ import annotations

import sys

from . import _platform
from ._version import __version__


def _common_config_argument(parser) -> None:
    from claude_statusline.i18n import message as msg
    parser.add_argument(
        "--config-dir",
        metavar="PATH",
        help=msg('cli.help.claude_configuration_directory_default_claude_config_dir_or'),
    )


def build_parser(language="en"):
    from claude_statusline.i18n import message as msg
    from claude_statusline.i18n.argparse import LocalizedParser

    from . import config_commands

    parser = LocalizedParser(
        locale=language,
        prog="claude-statusline",
        description=msg("cli.description"),
    )
    parser.add_argument("--language", choices=("en", "zh-CN"),
                        help=msg("cli.help.language_override"))
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
        help=msg("cli.help.version"),
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("render", help=msg('cli.help.render_status_line_json_received_on_stdin'))
    subparsers.add_parser(
        "render-subagents", help=msg('cli.help.render_subagent_status_line_tasks_as_ndjson')
    )
    subparsers.add_parser(
        "hook", help=msg('cli.help.record_a_claude_lifecycle_hook_received_on_stdin')
    )
    subparsers.add_parser(
        "slash-hook", help=msg('cli.help.handle_claude_statusline_slash_command_hooks')
    )
    config_commands.add_config_parser(subparsers)
    ui_parser = subparsers.add_parser(
        "ui", help=msg('cli.help.serve_one_internal_json_configuration_request')
    )
    _common_config_argument(ui_parser)
    runtime_parser = subparsers.add_parser(
        "runtime", help=msg('cli.help.serve_one_independent_live_observation_json_request')
    )
    _common_config_argument(runtime_parser)

    configure_parser = subparsers.add_parser(
        "configure", help=msg('cli.help.open_the_interactive_status_line_configuration_editor')
    )
    _common_config_argument(configure_parser)

    install_parser = subparsers.add_parser(
        "install", help=msg('cli.help.configure_claude_code_to_use_this_status_line')
    )
    _common_config_argument(install_parser)
    install_parser.add_argument(
        "--dry-run", action="store_true", help=msg('cli.help.report_whether_settings_would_change')
    )
    install_parser.add_argument(
        "--force",
        action="store_true",
        help=(
            msg('cli.help.replace_conflicting_statusline_and_subagentstatusline_settings_or_unrelated')
        ),
    )
    experimental_group = install_parser.add_mutually_exclusive_group()
    experimental_group.add_argument(
        "--experimental-slash-tui",
        dest="experimental_slash_tui",
        action="store_true",
        default=None,
        help=msg('cli.help.enable_external_statusline_configure_stable_default_suspend_on'),
    )
    experimental_group.add_argument(
        "--no-experimental-slash-tui",
        dest="experimental_slash_tui",
        action="store_false",
        help=msg('cli.help.persistently_disable_the_external_statusline_configure_entry'),
    )
    native_group = install_parser.add_mutually_exclusive_group()
    native_group.add_argument(
        "--native-editor",
        dest="native_editor",
        action="store_true",
        default=None,
        help=msg('cli.help.enable_the_in_session_client_tui_stable_default'),
    )
    native_group.add_argument(
        "--no-native-editor",
        dest="native_editor",
        action="store_false",
        help=msg('cli.help.persistently_disable_and_remove_owned_native_editor_integration'),
    )
    runtime_group = install_parser.add_mutually_exclusive_group()
    runtime_group.add_argument(
        "--live-metrics",
        dest="live_metrics",
        action="store_true",
        default=None,
        help=msg('cli.help.enable_independent_runtime_collection_opt_in_claude_code'),
    )
    runtime_group.add_argument(
        "--no-live-metrics",
        dest="live_metrics",
        action="store_false",
        help=msg('cli.help.persistently_disable_independent_runtime_collection'),
    )

    timing_group = install_parser.add_mutually_exclusive_group()
    timing_group.add_argument("--native-timing", action="store_true", default=None,
                              help=msg('cli.help.enable_native_task_timing_default_on_compatible_hosts'))
    timing_group.add_argument("--no-native-timing", dest="native_timing", action="store_false",
                              help=msg('cli.help.disable_native_timing_while_retaining_hook_transcript_timing'))

    uninstall_parser = subparsers.add_parser(
        "uninstall", help=msg('cli.help.remove_only_this_tool_s_claude_code_configuration')
    )
    _common_config_argument(uninstall_parser)
    uninstall_parser.add_argument(
        "--dry-run", action="store_true", help=msg('cli.help.report_whether_settings_would_change')
    )

    doctor_parser = subparsers.add_parser(
        "doctor", help=msg('cli.help.diagnose_the_installation_without_changing_files')
    )
    _common_config_argument(doctor_parser)
    return parser


def _print_change(result, dry_run: bool, language="en") -> None:
    from claude_statusline.i18n.translator import present, translate
    if result.native_state is not None:
        print(translate("cli.native_state", language, state=result.native_state))
    for detail in result.messages:
        print(present(detail, language))
    if dry_run:
        state = translate("state.would_change" if result.changed else "state.correct", language)
        print(translate("cli.change", language, action=result.action, state=state, path=result.settings_path))
        for path in result.changed_paths:
            print(translate("cli.artifact", language, path=path))
        return
    state = translate("state.updated" if result.changed else "state.correct", language)
    print(translate("cli.change", language, action=result.action, state=state, path=result.settings_path))
    for path in result.changed_paths:
        print(translate("cli.artifact", language, path=path))
    if result.backup_dir is not None:
        print(translate("cli.backup", language, path=result.backup_dir))


def _language(arguments):
    import argparse
    from claude_statusline.config import ui_preferences
    from claude_statusline.integration.ownership import resolve_config_dir
    from claude_statusline.i18n import LANGUAGES

    class Bootstrap(argparse.ArgumentParser):
        def error(self, message):
            raise ValueError(message)

    bootstrap = Bootstrap(add_help=False)
    bootstrap.add_argument("--language")
    bootstrap.add_argument("--config-dir")
    try:
        known, _ = bootstrap.parse_known_args(arguments)
    except ValueError:
        return "en", None
    prefs = ui_preferences.read(resolve_config_dir(known.config_dir))
    return (known.language if known.language in LANGUAGES else prefs.ui_language), prefs.warning


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    # Runtime hooks and rendering run frequently. Keep their startup paths free
    # of argparse and installer imports used only by administrative commands.
    if arguments == ["render"]:
        from . import statusline

        statusline.main()
        return 0
    if arguments == ["render-subagents"]:
        from . import subagent_statusline

        subagent_statusline.main()
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
    from claude_statusline.i18n import message as msg
    from claude_statusline.i18n.translator import present, translate

    language, language_warning = _language(arguments)
    parser = build_parser(language)
    args = parser.parse_args(arguments)
    if args.command == "ui":
        from claude_statusline.ui import protocol

        return protocol.main(args)
    if args.command == "runtime":
        from claude_statusline.runtime.live import protocol

        return protocol.main(args)

    if args.command == "render":
        from . import statusline

        statusline.main()
        return 0
    if args.command == "render-subagents":
        from . import subagent_statusline

        subagent_statusline.main()
        return 0
    if args.command == "hook":
        from . import turn_state

        turn_state.main()
        return 0
    if args.command == "slash-hook":
        from . import slash_hook

        slash_hook.main()
        return 0

    if language_warning:
        print(translate("cli.warning", language, detail=language_warning), file=sys.stderr)

    if args.command == "configure" and (
        not sys.stdin.isatty() or not sys.stdout.isatty()
    ):
        print(
            translate("cli.error", language, detail=msg("cli.configure_requires_terminal")),
            file=sys.stderr,
        )
        return 2

    config_dir = installer.resolve_config_dir(args.config_dir)
    try:
        from pathlib import Path

        entry = Path(sys.argv[0])
        executable = installer.resolve_cli_executable(
            entry.resolve()
            if entry.name.casefold() in {"claude-statusline", "claude-statusline.exe"}
            else None
        )
    except installer.ConfigurationError as exc:
        if args.command == "doctor":
            executable = None
        else:
            print(translate("cli.error", language, detail=exc), file=sys.stderr)
            return 2

    try:
        if args.command == "install":
            if not _platform.is_supported_platform():
                raise installer.ConfigurationError(
                    msg('errors.cli.supported_platforms_are_linux_wsl_windows_and')
                )
            result = installer.install_configuration(
                config_dir,
                executable,
                dry_run=args.dry_run,
                force=args.force,
                experimental_slash_tui=args.experimental_slash_tui,
                native_editor=args.native_editor,
                live_metrics=args.live_metrics,
                native_timing=args.native_timing,
            )
            _print_change(result, args.dry_run, language)
            return 2 if result.native_failed else 0
        if args.command == "configure":
            if not _platform.is_supported_platform():
                raise installer.ConfigurationError(
                    msg('errors.cli.supported_platforms_are_linux_wsl_windows_and')
                )
            # Keep curses out of render, hook, and slash-hook startup paths.
            try:
                from . import interactive_config
            except ImportError as exc:
                raise installer.ConfigurationError(
                    msg('errors.cli.configure_requires_an_available_curses_backend', exc=exc)
                ) from exc

            return interactive_config.run(config_dir, executable)
        if args.command == "uninstall":
            result = installer.uninstall_configuration(
                config_dir, executable, dry_run=args.dry_run
            )
            _print_change(result, args.dry_run, language)
            return 2 if result.native_failed else 0
        if args.command == "doctor":
            diagnostics = installer.collect_diagnostics(config_dir, executable)
            for item in diagnostics:
                print(f"[{item.level}] {present(item.message, language)}")
            return 1 if any(item.level == "ERROR" for item in diagnostics) else 0
        if args.command == "config":
            print(
                config_commands.execute_config_namespace(args, config_dir, executable, language=language)
            )
            return 0
    except (installer.ConfigurationError, config_commands.ConfigCommandError) as exc:
        print(translate("cli.error", language, detail=exc), file=sys.stderr)
        return 2

    parser.error(f"unknown command: {args.command}")
    return 2
