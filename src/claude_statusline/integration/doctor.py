"""integration / doctor implementation."""

from __future__ import annotations

import os
import platform as stdlib_platform
import re
import shutil
import sys
from importlib import metadata
from pathlib import Path
from claude_statusline.config import display as config_display
from claude_statusline.config import features as config_features
from claude_statusline.config import storage as config_storage
from claude_statusline.integration import capabilities as integration_capabilities
from claude_statusline.integration import models as integration_models
from claude_statusline.integration import ownership as integration_ownership
from claude_statusline.integration import resources as integration_resources
from claude_statusline.integration import native as native_integration
from claude_statusline.platforms import clocks as platform_clocks
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import processes as platform_processes


def _check_environment(diagnostics, executable):
    if platform_environment.is_supported_platform():
        diagnostics.append(
            integration_models.Diagnostic("OK", f"platform: {sys.platform}")
        )
    else:
        diagnostics.append(
            integration_models.Diagnostic(
                "ERROR", "supported platforms are Linux/WSL, Windows and macOS 14+"
            )
        )

    if platform_environment.is_windows():
        machine = stdlib_platform.machine().casefold()
        if machine in {"amd64", "x86_64", "x86", "i386", "i686"}:
            diagnostics.append(
                integration_models.Diagnostic("OK", f"Windows architecture: {machine}")
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "WARN",
                    f"Windows architecture {machine or 'unknown'} is not covered; "
                    "use x64 Python emulation on ARM64",
                )
            )
        try:
            import curses

            curses_version = metadata.version("windows-curses")
            if not hasattr(curses, "wrapper"):
                raise ImportError("curses.wrapper is unavailable")
            version_match = re.match(r"(\d+)\.(\d+)\.(\d+)", curses_version)
            if version_match is None or tuple(map(int, version_match.groups())) < (
                2,
                4,
                2,
            ):
                raise ImportError(
                    f"windows-curses 2.4.2+ is required; found {curses_version}"
                )
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK", f"windows-curses backend: {curses_version}"
                )
            )
        except (ImportError, metadata.PackageNotFoundError) as exc:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR", f"windows-curses backend is unavailable: {exc}"
                )
            )
        if platform_environment.new_console_creation_flags():
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK", "Windows system new-console launcher"
                )
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR", "Windows system new-console launcher is unavailable"
                )
            )

    elif platform_environment.is_macos():
        machine = stdlib_platform.machine().casefold()
        diagnostics.append(
            integration_models.Diagnostic(
                "OK" if machine in {"x86_64", "arm64"} else "WARN",
                f"macOS architecture: {machine or 'unknown'}",
            )
        )
        macos_version = stdlib_platform.mac_ver()[0]
        major = macos_version.split(".")[0]
        diagnostics.append(
            integration_models.Diagnostic(
                "OK" if major.isdecimal() and int(major) >= 14 else "WARN",
                f"macOS version: {macos_version or 'unknown'}; supported range is 14+; "
                "CI configured for 15 and 26",
            )
        )
        try:
            import curses

            if not hasattr(curses, "wrapper"):
                raise ImportError("curses.wrapper is unavailable")
            diagnostics.append(
                integration_models.Diagnostic("OK", "macOS curses backend")
            )
        except ImportError as exc:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR", f"macOS curses backend is unavailable: {exc}"
                )
            )
        process_token = platform_processes.process_start_token(os.getpid())
        diagnostics.append(
            integration_models.Diagnostic(
                "OK" if process_token else "WARN",
                "macOS process start verification: "
                + (
                    "available"
                    if process_token
                    else "unavailable; registry reconciliation is disabled"
                ),
            )
        )
        _wall, boot_ns, boot_id = platform_clocks.now_clocks()
        native_clock = boot_ns is not None and boot_id is not None
        diagnostics.append(
            integration_models.Diagnostic(
                "OK" if native_clock else "WARN",
                "macOS suspend-aware clock: "
                + (
                    "available"
                    if native_clock
                    else "unavailable; using wall-clock fallback"
                ),
            )
        )

    version = ".".join(map(str, sys.version_info[:3]))
    if sys.version_info >= (3, 10):  # noqa: UP036 - doctor reports the contract
        diagnostics.append(integration_models.Diagnostic("OK", f"Python: {version}"))
    else:
        diagnostics.append(
            integration_models.Diagnostic(
                "ERROR", f"Python 3.10+ required; found {version}"
            )
        )

    if executable is None:
        diagnostics.append(
            integration_models.Diagnostic("ERROR", "claude-statusline is not in PATH")
        )
    elif (
        executable.is_file()
        and os.access(executable, os.X_OK)
        and (
            not platform_environment.is_windows()
            or executable.suffix.casefold() == ".exe"
        )
    ):
        diagnostics.append(
            integration_models.Diagnostic("OK", f"executable: {executable}")
        )
    else:
        diagnostics.append(
            integration_models.Diagnostic(
                "ERROR", f"executable is not runnable: {executable}"
            )
        )

    git_path = shutil.which("git")
    if git_path:
        diagnostics.append(integration_models.Diagnostic("OK", f"Git: {git_path}"))
    else:
        diagnostics.append(
            integration_models.Diagnostic(
                "WARN", "Git is missing; the Git segment will be hidden"
            )
        )


def _check_settings(diagnostics, settings, settings_path, config_dir, executable):
    current = settings.get("statusLine")
    current_command = current.get("command") if isinstance(current, dict) else None
    padding = current.get("padding", 0) if isinstance(current, dict) else None
    interval = current.get("refreshInterval") if isinstance(current, dict) else None
    hide_vim = (
        current.get("hideVimModeIndicator", False)
        if isinstance(current, dict)
        else None
    )
    host_fields_valid = (
        isinstance(padding, int)
        and not isinstance(padding, bool)
        and 0 <= padding <= 32
        and (
            interval is None
            or (
                isinstance(interval, int)
                and not isinstance(interval, bool)
                and 1 <= interval <= 3600
            )
        )
        and isinstance(hide_vim, bool)
    )
    if (
        executable is not None
        and integration_ownership._is_cli_command(current_command, "render", executable)
        and host_fields_valid
    ):
        diagnostics.append(
            integration_models.Diagnostic("OK", "statusLine command and host options")
        )
    else:
        diagnostics.append(
            integration_models.Diagnostic(
                "ERROR", "statusLine is not configured for this executable"
            )
        )

    for event in integration_models.HOOK_EVENTS:
        commands = integration_ownership._hook_commands(settings, event)
        count = sum(
            1
            for command in commands
            if (
                executable is not None
                and integration_ownership._is_cli_command(command, "hook", executable)
            )
            or integration_ownership._is_cli_command(command, "hook")
        )
        if count == 1:
            diagnostics.append(
                integration_models.Diagnostic("OK", f"{event} hook: exactly one")
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR", f"{event} hook: expected one, found {count}"
                )
            )

    skill_path, owner_path = integration_resources.skill_paths(config_dir)
    if executable is not None:
        try:
            expected_skill = integration_resources.render_skill(executable)
            skill_raw = config_storage._read_optional_bytes(skill_path)
            owner_raw = config_storage._read_optional_bytes(owner_path)
            if (
                skill_raw == expected_skill
                and integration_ownership._is_owned_skill_marker(owner_raw)
            ):
                diagnostics.append(
                    integration_models.Diagnostic(
                        "OK", f"/{integration_models.SLASH_COMMAND_NAME} skill"
                    )
                )
            else:
                diagnostics.append(
                    integration_models.Diagnostic(
                        "ERROR",
                        f"/{integration_models.SLASH_COMMAND_NAME} skill is missing or not owned",
                    )
                )
        except integration_models.ConfigurationError as exc:
            diagnostics.append(integration_models.Diagnostic("ERROR", str(exc)))


def _check_display(diagnostics, config_dir):
    display = None
    display_source_schema = None
    try:
        display = config_display.load_display_config(config_dir)
        display_source_schema = config_display.read_display_config_schema(config_dir)
        display_path = config_display.config_path(config_dir)
        if display_path.exists():
            display_mode_matches = platform_files.private_mode_matches(
                display_path, 0o600
            )
            if display_mode_matches is None:
                diagnostics.append(
                    integration_models.Diagnostic(
                        "OK",
                        f"display config: {display_path} "
                        "(POSIX mode not applicable on Windows)",
                    )
                )
            elif display_mode_matches:
                diagnostics.append(
                    integration_models.Diagnostic(
                        "OK", f"display config: {display_path}"
                    )
                )
            else:
                display_mode = display_path.stat().st_mode & 0o7777
                diagnostics.append(
                    integration_models.Diagnostic(
                        "WARN", f"display config permissions: {display_mode:04o}"
                    )
                )
        else:
            diagnostics.append(
                integration_models.Diagnostic("OK", "display config: built-in defaults")
            )
        if display_source_schema == config_display.LEGACY_SCHEMA_VERSION:
            diagnostics.append(
                integration_models.Diagnostic(
                    "WARN",
                    "display config schema v1 is valid and will migrate to v2 on "
                    "the next configuration save",
                )
            )
        elif display_source_schema == config_display.SCHEMA_VERSION:
            diagnostics.append(
                integration_models.Diagnostic("OK", "display config schema: v2")
            )
    except config_display.DisplayConfigError as exc:
        diagnostics.append(integration_models.Diagnostic("ERROR", str(exc)))
    return display, display_source_schema


def _check_subagents(
    diagnostics, settings, executable, claude_version, display, display_source_schema
):
    current_subagent = settings.get("subagentStatusLine")
    current_subagent_command = (
        current_subagent.get("command") if isinstance(current_subagent, dict) else None
    )
    subagent_owned = (
        integration_ownership._is_cli_command(
            current_subagent_command, "render-subagents", executable
        )
        if executable is not None
        else False
    ) or integration_ownership._is_cli_command(
        current_subagent_command, "render-subagents"
    )
    if integration_capabilities.supports_subagent_statusline(claude_version):
        version_text = ".".join(map(str, claude_version))
        diagnostics.append(
            integration_models.Diagnostic(
                "OK", f"subagentStatusLine supported: Claude Code {version_text}"
            )
        )
        state = integration_capabilities.subagent_statusline_state(
            settings, executable, claude_version
        )
        desired_enabled = display.subagents.enabled if display is not None else True
        exact_subagent = (
            state == "owned"
            and isinstance(current_subagent, dict)
            and set(current_subagent) == {"type", "command"}
            and current_subagent.get("type") == "command"
        )
        if desired_enabled and exact_subagent:
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK", "subagentStatusLine: enabled and owned"
                )
            )
        elif desired_enabled:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    f"subagentStatusLine is enabled but its state is {state}",
                )
            )
        elif state in ("absent", "foreign"):
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK",
                    "subagentStatusLine: disabled"
                    + ("; foreign setting preserved" if state == "foreign" else ""),
                )
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    "subagentStatusLine is disabled but an owned setting remains; "
                    "rerun install",
                )
            )
        for event in integration_models.SUBAGENT_HOOK_EVENTS:
            commands = integration_ownership._hook_commands(settings, event)
            count = sum(
                1
                for command in commands
                if (
                    executable is not None
                    and integration_ownership._is_cli_command(
                        command, "hook", executable
                    )
                )
                or integration_ownership._is_cli_command(command, "hook")
            )
            if count == 1:
                diagnostics.append(
                    integration_models.Diagnostic("OK", f"{event} hook: exactly one")
                )
            else:
                diagnostics.append(
                    integration_models.Diagnostic(
                        "ERROR", f"{event} hook: expected one, found {count}"
                    )
                )
    else:
        version_text = (
            ".".join(map(str, claude_version))
            if isinstance(claude_version, tuple)
            else "unknown"
        )
        diagnostics.append(
            integration_models.Diagnostic(
                "WARN",
                "subagentStatusLine and subagent lifecycle hooks require Claude Code "
                f"{'.'.join(map(str, integration_models.MIN_SUBAGENT_STATUSLINE_VERSION))}+; found "
                f"{version_text}",
            )
        )
        if subagent_owned:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    "owned subagentStatusLine remains on an unsupported Claude Code; "
                    "rerun install to suspend it",
                )
            )
        for event in integration_models.SUBAGENT_HOOK_EVENTS:
            commands = integration_ownership._hook_commands(settings, event)
            count = sum(
                1
                for command in commands
                if (
                    executable is not None
                    and integration_ownership._is_cli_command(
                        command, "hook", executable
                    )
                )
                or integration_ownership._is_cli_command(command, "hook")
            )
            if count:
                diagnostics.append(
                    integration_models.Diagnostic(
                        "ERROR",
                        f"{event} hook is unsupported but {count} owned hook(s) remain",
                    )
                )
            else:
                diagnostics.append(
                    integration_models.Diagnostic("OK", f"{event} hook: suspended")
                )


def _check_fast_slash(diagnostics, settings, executable, claude_version):
    slash_count = integration_ownership._slash_hook_count(settings, executable)
    if integration_capabilities.supports_fast_slash_hook(claude_version):
        version_text = ".".join(map(str, claude_version))
        if slash_count == 1:
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK",
                    f"/{integration_models.SLASH_COMMAND_NAME} local fast path: Claude Code {version_text}",
                )
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    f"/{integration_models.SLASH_COMMAND_NAME} fast hook: expected one, found {slash_count}",
                )
            )
    else:
        version_text = (
            ".".join(map(str, claude_version))
            if isinstance(claude_version, tuple)
            else "unknown"
        )
        diagnostics.append(
            integration_models.Diagnostic(
                "WARN",
                f"/{integration_models.SLASH_COMMAND_NAME} uses model fallback on Claude Code {version_text}",
            )
        )


def _check_experimental(diagnostics, settings, config_dir, executable, claude_version):
    preference_path = config_features.feature_path(config_dir)
    preference_enabled = False
    preference_valid = True
    try:
        preference_raw = config_storage._read_optional_bytes(preference_path)
        if preference_raw is not None:
            preference_enabled = config_features.parse_feature_bytes(
                preference_raw, preference_path
            )
            preference_mode_matches = platform_files.private_mode_matches(
                preference_path, 0o600
            )
            if preference_mode_matches is None:
                diagnostics.append(
                    integration_models.Diagnostic(
                        "OK",
                        f"experimental feature preferences: {preference_path} "
                        "(POSIX mode not applicable on Windows)",
                    )
                )
            elif preference_mode_matches:
                diagnostics.append(
                    integration_models.Diagnostic(
                        "OK",
                        f"experimental feature preferences: {preference_path} (0600)",
                    )
                )
            else:
                preference_mode = preference_path.stat().st_mode & 0o7777
                diagnostics.append(
                    integration_models.Diagnostic(
                        "ERROR",
                        "experimental feature preferences permissions: "
                        f"expected 0600, found {preference_mode:04o}",
                    )
                )
    except (
        integration_models.ConfigurationError,
        config_features.FeatureConfigError,
        OSError,
    ) as exc:
        preference_valid = False
        diagnostics.append(integration_models.Diagnostic("ERROR", str(exc)))

    experimental_skill_path, experimental_owner_path = (
        integration_resources.experimental_skill_paths(config_dir)
    )
    try:
        experimental_skill_raw = config_storage._read_optional_bytes(
            experimental_skill_path
        )
        experimental_owner_raw = config_storage._read_optional_bytes(
            experimental_owner_path
        )
    except integration_models.ConfigurationError as exc:
        experimental_skill_raw = None
        experimental_owner_raw = None
        diagnostics.append(integration_models.Diagnostic("ERROR", str(exc)))
    experimental_owned = integration_ownership._is_owned_skill_marker(
        experimental_owner_raw
    )
    experimental_actions = integration_ownership._slash_hook_actions(
        settings, executable, integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME
    )
    experimental_groups = integration_ownership._slash_matcher_groups(
        settings, integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME
    )

    if preference_valid and not preference_enabled:
        if experimental_owned or experimental_actions:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME} is disabled but owned artifacts remain; "
                    "rerun install to repair them",
                )
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK",
                    f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME}: disabled",
                )
            )
    elif preference_valid and not integration_capabilities.supports_fast_slash_hook(
        claude_version
    ):
        version_text = (
            ".".join(map(str, claude_version))
            if isinstance(claude_version, tuple)
            else "unknown"
        )
        diagnostics.append(
            integration_models.Diagnostic(
                "WARN",
                f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME}: suspended on Claude Code "
                f"{version_text}; rerun install after upgrading",
            )
        )
        if experimental_owned or experimental_actions:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME} is suspended but owned artifacts remain; "
                    "rerun install to repair them",
                )
            )
    elif preference_valid:
        expected_experimental_skill = integration_resources.render_experimental_skill()
        if experimental_skill_raw == expected_experimental_skill and experimental_owned:
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK",
                    f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME} skill and owner marker",
                )
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME} skill is missing or not owned",
                )
            )
        configured_actions = (
            experimental_groups[0].get("hooks")
            if len(experimental_groups) == 1
            else None
        )
        exact_hook = (
            isinstance(configured_actions, list)
            and len(configured_actions) == 1
            and isinstance(configured_actions[0], dict)
            and configured_actions[0].get("type") == "command"
            and executable is not None
            and integration_ownership._is_cli_command(
                configured_actions[0].get("command"), "slash-hook", executable
            )
            and configured_actions[0].get("timeout") == 600
        )
        if exact_hook:
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK",
                    f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME} hook: exactly one (600s)",
                )
            )
        else:
            diagnostics.append(
                integration_models.Diagnostic(
                    "ERROR",
                    f"/{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME} hook: expected one 600s hook "
                    "in exactly one matcher",
                )
            )
        if (
            platform_environment.is_linux()
            and not shutil.which("tmux")
            and not shutil.which("gnome-terminal")
        ):
            diagnostics.append(
                integration_models.Diagnostic(
                    "WARN",
                    "no supported interactive launcher is installed; install tmux or "
                    "GNOME Terminal, or run claude-statusline configure directly",
                )
            )
        elif platform_environment.is_macos():
            from claude_statusline.platforms import (
                macos_terminal as platform_macos_terminal,
            )

            terminal_available, terminal_detail = platform_macos_terminal.availability(
                os.environ
            )
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK" if terminal_available else "WARN",
                    "macOS Terminal launcher: " + terminal_detail,
                )
            )
            if not terminal_available and not shutil.which("tmux"):
                diagnostics.append(
                    integration_models.Diagnostic(
                        "WARN",
                        "no supported macOS interactive launcher is available; install tmux "
                        "and run Claude inside it, or run claude-statusline configure directly",
                    )
                )


def _check_runtime(diagnostics, config_dir, settings_path):
    runtime_dir = config_dir / "statusline_runtime"
    runtime_access = os.W_OK | (0 if platform_environment.is_windows() else os.X_OK)
    if runtime_dir.is_dir() and os.access(runtime_dir, runtime_access):
        diagnostics.append(
            integration_models.Diagnostic("OK", f"runtime directory: {runtime_dir}")
        )
    else:
        diagnostics.append(
            integration_models.Diagnostic(
                "ERROR", f"runtime directory is not writable: {runtime_dir}"
            )
        )
    if platform_environment.is_macos() and config_dir.is_dir():
        try:
            synced = platform_files._sync_parent_directory(settings_path)
            diagnostics.append(
                integration_models.Diagnostic(
                    "OK" if synced else "WARN",
                    "macOS parent-directory sync: "
                    + (
                        "available"
                        if synced
                        else "unsupported; file sync and atomic replace remain enabled"
                    ),
                )
            )
        except OSError as exc:
            diagnostics.append(
                integration_models.Diagnostic(
                    "WARN", f"macOS parent-directory sync failed: {exc}"
                )
            )


def collect_diagnostics(
    config_dir: Path,
    executable: Path | None,
    *,
    claude_version: tuple[int, int, int]
    | None
    | object = integration_models._DETECT_CLAUDE_VERSION,
) -> list[integration_models.Diagnostic]:
    diagnostics = []
    _check_environment(diagnostics, executable)
    settings_path = config_dir / "settings.json"
    try:
        settings, _ = config_storage._read_settings(settings_path)
    except integration_models.ConfigurationError as exc:
        diagnostics.append(integration_models.Diagnostic("ERROR", str(exc)))
        return diagnostics

    if not settings_path.exists():
        diagnostics.append(
            integration_models.Diagnostic(
                "ERROR", f"settings not found: {settings_path}"
            )
        )
        return diagnostics
    diagnostics.append(
        integration_models.Diagnostic("OK", f"settings: {settings_path}")
    )
    mode_match = platform_files.private_mode_matches(settings_path, 0o600)
    if mode_match is None:
        diagnostics.append(
            integration_models.Diagnostic(
                "OK",
                "settings permissions: POSIX mode not applicable on Windows; "
                "security uses inherited ACLs",
            )
        )
    elif mode_match:
        diagnostics.append(
            integration_models.Diagnostic("OK", "settings permissions: 0600")
        )
    else:
        mode = settings_path.stat().st_mode & 0o7777
        diagnostics.append(
            integration_models.Diagnostic("WARN", f"settings permissions: {mode:04o}")
        )
    _check_settings(diagnostics, settings, settings_path, config_dir, executable)
    display, display_source_schema = _check_display(diagnostics, config_dir)
    if claude_version is integration_models._DETECT_CLAUDE_VERSION:
        claude_version = integration_capabilities.detect_claude_version()
    _check_subagents(
        diagnostics,
        settings,
        executable,
        claude_version,
        display,
        display_source_schema,
    )
    _check_fast_slash(diagnostics, settings, executable, claude_version)
    _check_experimental(diagnostics, settings, config_dir, executable, claude_version)
    _check_runtime(diagnostics, config_dir, settings_path)
    diagnostics.extend(
        native_integration.diagnostics(config_dir, executable, claude_version)
    )
    return diagnostics
