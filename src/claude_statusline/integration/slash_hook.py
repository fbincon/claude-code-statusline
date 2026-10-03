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


SLASH_COMMAND_NAME = "statusline-config"


EXPERIMENTAL_SLASH_COMMAND_NAME = "statusline-configure"


def _decision(reason: str) -> str:
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
        return _decision(
            "Status line configuration was not changed: invalid arguments."
        )
    if not command_args.strip():
        return None
    if command_args.strip() in {"help", "--help", "-h"}:
        return _decision(
            "Usage: /statusline-config "
            "[show|list-items|set-items|enable|disable|order|subagents|set|reset]"
        )

    try:
        args = config_commands.parse_slash_arguments(command_args)
        config_dir = integration_ownership.resolve_config_dir()
        executable = integration_ownership.resolve_cli_executable()
        message = config_commands.execute_config_namespace(args, config_dir, executable)
    except (
        config_models.ConfigCommandError,
        integration_models.ConfigurationError,
    ) as exc:
        message = f"Status line configuration was not changed: {exc}"
    return _decision(message)


def _safe_error_reason(message: object) -> str:
    if not isinstance(message, str):
        return "Interactive status line configuration failed."
    if message.startswith(
        "Interactive status line configuration is unavailable here.\n"
    ):
        return message
    first_line = next(
        (line.strip() for line in message.splitlines() if line.strip()),
        "Interactive status line configuration failed.",
    )
    return first_line[:500]


def _experimental_reason(result: object) -> str:
    outcome = getattr(result, "outcome", None)
    message = getattr(result, "message", None)
    fixed = {
        "already-current": "Status line configuration already current.",
        "cancelled": "Status line configuration unchanged.",
        "interrupted": (
            "Interactive status line configuration interrupted; no changes were saved."
        ),
        "timed-out": (
            "Interactive status line configuration timed out; no changes were saved."
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
        return _decision(
            "Interactive status line configuration was not started: invalid arguments."
        )
    stripped = command_args.strip()
    if stripped in {"help", "--help", "-h"}:
        return _decision("Usage: /statusline-configure")
    if stripped:
        return _decision(
            f"Usage: /statusline-configure\nUnsupported arguments: {stripped[:200]}"
        )

    try:
        config_dir = integration_ownership.resolve_config_dir()
        try:
            enabled = config_features.load_experimental_slash_tui(config_dir)
        except config_features.FeatureConfigError as exc:
            return _decision(
                "Interactive status line configuration was not started: "
                f"{_safe_error_reason(str(exc))} Run `claude-statusline install` "
                "to repair the feature preference."
            )
        if not enabled:
            return _decision(
                "Interactive status line configuration is disabled. Enable it with "
                "`claude-statusline install --experimental-slash-tui`."
            )
        version = integration_capabilities.detect_claude_version()
        if not integration_capabilities.supports_fast_slash_hook(version):
            return _decision(
                "Interactive status line configuration is suspended for this "
                "Claude Code version. Upgrade Claude Code and rerun "
                "`claude-statusline install`."
            )
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
