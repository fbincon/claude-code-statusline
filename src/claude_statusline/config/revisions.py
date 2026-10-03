"""Semantic configuration revisions shared by editors and JSON snapshots."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from claude_statusline.integration import ownership


def installation_identity(settings: dict, executable: Path) -> dict:
    result = {}
    for key, operation in (
        ("statusLine", "render"),
        ("subagentStatusLine", "render-subagents"),
    ):
        current = settings.get(key)
        if current is None:
            result[key] = {"state": "absent"}
            continue
        if not isinstance(current, dict):
            result[key] = {"state": "foreign", "value": current}
            continue
        command = current.get("command")
        argv = ownership._split_command(command)
        normalized = None
        owned = current.get("type") == "command" and ownership._is_current_cli_command(
            command, operation, executable
        )
        if argv:
            program = argv[0]
            if owned and ("/" in program or "\\" in program):
                # Use the actual path for our escaped POSIX command, too.
                program = str(executable)
            try:
                resolved = shutil.which(program) or program
            except (OSError, ValueError):
                resolved = program
            normalized = [ownership._normalized_path(resolved), *argv[1:]]
        result[key] = {
            "state": "owned" if owned else "foreign",
            "type": current.get("type"),
            "command": normalized if argv else command,
        }
    return result


def semantic_revision(display, host, settings: dict, executable: Path) -> str:
    payload = {
        "revision_version": 1,
        "display": display.to_dict(),
        "host": host.to_dict(),
        "installation": installation_identity(settings, executable),
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
