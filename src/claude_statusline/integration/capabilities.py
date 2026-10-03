"""integration / capabilities implementation."""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from claude_statusline.integration import models as integration_models
from claude_statusline.integration import ownership as integration_ownership
from claude_statusline.platforms import environment as platform_environment


def detect_claude_version() -> tuple[int, int, int] | None:
    executable = shutil.which("claude")
    if not executable:
        return None
    try:
        result = subprocess.run(
            [executable, "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=5,
            check=False,
            creationflags=platform_environment.no_window_creation_flags(),
        )
    except (OSError, subprocess.SubprocessError):
        return None
    match = re.search(r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)", result.stdout)
    if result.returncode != 0 or match is None:
        return None
    return tuple(int(value) for value in match.groups())


def supports_fast_slash_hook(version: tuple[int, int, int] | None) -> bool:
    return version is not None and version >= integration_models.MIN_FAST_SLASH_VERSION


def supports_subagent_statusline(version: tuple[int, int, int] | None) -> bool:
    return (
        version is not None
        and version >= integration_models.MIN_SUBAGENT_STATUSLINE_VERSION
    )


def subagent_statusline_state(
    settings: dict,
    executable: Path | None,
    claude_version: tuple[int, int, int] | None,
) -> str:
    """Classify the configured subagent renderer using the public state names."""
    if not supports_subagent_statusline(claude_version):
        return "unsupported"
    current = settings.get("subagentStatusLine") if isinstance(settings, dict) else None
    if current is None:
        return "absent"
    command = current.get("command") if isinstance(current, dict) else None
    if integration_ownership._is_cli_command(
        command, "render-subagents", executable
    ) or integration_ownership._is_cli_command(command, "render-subagents"):
        return "owned"
    return "foreign"
