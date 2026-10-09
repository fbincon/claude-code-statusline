"""integration / slash_hook implementation."""

from __future__ import annotations

import json
import sys
from claude_statusline.config import commands as config_commands
from claude_statusline.config import features as config_features
from claude_statusline.config import models as config_models
from claude_statusline.integration import capabilities as integration_capabilities
from claude_statusline.integration import models as integration_models
from claude_statusline.integration import ownership as integration_ownership
from claude_statusline.config import ui_preferences
from claude_statusline.i18n import message as msg
from claude_statusline.i18n.translator import present


SLASH_COMMAND_NAME = "statusline-config"


EXPERIMENTAL_SLASH_COMMAND_NAME = "statusline-configure"


def _decision(reason: str) -> str:
    locale = ui_preferences.read(integration_ownership.resolve_config_dir()).ui_language
    reason = present(reason, locale)
    return json.dumps(
        {"decision": "block", "reason": reason},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _handle_config_command(data: dict) -> str | None:
    command_args = data.get("command_args")
    if command_args is None:
        command_args = ""
    if not isinstance(command_args, str):
        return _decision(msg("slash.invalid_arguments"))
    if not command_args.strip():
        return None
    if command_args.strip() in {"help", "--help", "-h"}:
        return _decision(msg("slash.config_usage"))

    try:
        args = config_commands.parse_slash_arguments(command_args)
        config_dir = integration_ownership.resolve_config_dir()
        executable = integration_ownership.resolve_cli_executable()
        message = config_commands.execute_config_namespace(args, config_dir, executable)
    except (
        config_models.ConfigCommandError,
        integration_models.ConfigurationError,
    ) as exc:
        message = msg("slash.config_unchanged", detail=exc)
    return _decision(message)


def _safe_error_reason(message: object) -> str:
    if not isinstance(message, str):
        return "Interactive status line configuration failed."
    if message == integration_models.UNAVAILABLE_MESSAGE:
        return msg("slash.unavailable")
    first_line = next(
        (line.strip() for line in message.splitlines() if line.strip()),
        "Interactive status line configuration failed.",
    )
    return first_line[:500]


def _experimental_reason(result: object) -> str:
    outcome = getattr(result, "outcome", None)
    message = getattr(result, "message", None)
    fixed = {
        "already-current": msg("ui.session.status_line_configuration_already_current"),
        "cancelled": msg("ui.session.status_line_configuration_unchanged"),
        "interrupted": (
            msg(
                "ui.session.interactive_status_line_configuration_interrupted_no_changes"
            )
        ),
        "timed-out": (
            msg("ui.session.interactive_status_line_configuration_timed_out_no")
        ),
    }
    if outcome == "updated" and isinstance(message, str):
        return message[:2000]
    if outcome in fixed:
        return fixed[outcome]
    return _safe_error_reason(message)


def _handle_experimental_command(data: dict) -> str:
    command_args = data.get("command_args")
    if command_args is None:
        command_args = ""
    if not isinstance(command_args, str):
        return _decision(msg("slash.tui_invalid_arguments"))
    stripped = command_args.strip()
    if stripped in {"help", "--help", "-h"}:
        return _decision(msg("slash.tui_usage"))
    if stripped:
        return _decision(msg("slash.tui_unsupported", arguments=stripped[:200]))

    try:
        config_dir = integration_ownership.resolve_config_dir()
        try:
            enabled = config_features.load_experimental_slash_tui(config_dir)
        except config_features.FeatureConfigError as exc:
            return _decision(msg("slash.tui_preference_invalid", detail=exc))
        if not enabled:
            return _decision(msg("slash.tui_disabled"))
        version = integration_capabilities.detect_claude_version()
        if not integration_capabilities.supports_fast_slash_hook(version):
            return _decision(msg("slash.tui_suspended"))
        executable = integration_ownership.resolve_cli_executable()
        # Keep tmux/GNOME launcher code out of the ordinary slash fast path.
        from claude_statusline.integration import launcher as integration_launcher

        result = integration_launcher.launch(
            config_dir,
            executable,
            data.get("cwd"),
        )
        return _decision(_experimental_reason(result))
    except Exception as exc:  # noqa: BLE001 - recognized command must always block
        return _decision(
            _safe_error_reason(f"Interactive status line configuration failed: {exc}")
        )


def handle_payload(data: object) -> str | None:
    if not isinstance(data, dict):
        return None
    if data.get("hook_event_name") != "UserPromptExpansion":
        return None
    if data.get("expansion_type") != "slash_command":
        return None
    command_name = data.get("command_name")
    if command_name == SLASH_COMMAND_NAME:
        return _handle_config_command(data)
    if command_name == EXPERIMENTAL_SLASH_COMMAND_NAME:
        return _handle_experimental_command(data)
    return None


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", newline="\n")
        raw = sys.stdin.buffer.read()
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        result = handle_payload(json.loads(raw.decode("utf-8")))
        if result is not None:
            sys.stdout.write(result + "\n")
    except Exception:  # noqa: BLE001 - a hook must fail open for every bad input
        # A malformed or unrelated hook event must never block a user prompt.
        return
