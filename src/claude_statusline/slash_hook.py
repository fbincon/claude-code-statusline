"""Deterministic fast path for direct /statusline-config invocations."""

from __future__ import annotations

import json
import sys

from . import config_commands, installer

SLASH_COMMAND_NAME = "statusline-config"


def _decision(reason: str) -> str:
    return json.dumps(
        {"decision": "block", "reason": reason},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def handle_payload(data: object) -> str | None:
    if not isinstance(data, dict):
        return None
    if data.get("hook_event_name") != "UserPromptExpansion":
        return None
    if data.get("expansion_type") != "slash_command":
        return None
    if data.get("command_name") != SLASH_COMMAND_NAME:
        return None

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
            "[show|list-items|set-items|enable|disable|order|set|reset]"
        )

    try:
        args = config_commands.parse_slash_arguments(command_args)
        config_dir = installer.resolve_config_dir()
        executable = installer.resolve_cli_executable()
        message = config_commands.execute_config_namespace(args, config_dir, executable)
    except (
        config_commands.ConfigCommandError,
        installer.ConfigurationError,
    ) as exc:
        message = f"Status line configuration was not changed: {exc}"
    return _decision(message)


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


if __name__ == "__main__":
    main()
