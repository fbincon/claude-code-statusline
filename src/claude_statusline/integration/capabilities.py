"""integration / capabilities implementation."""

from __future__ import annotations

import re
import json
import shutil
import subprocess
from pathlib import Path
from claude_statusline.integration import models as integration_models
from claude_statusline.integration import ownership as integration_ownership
from claude_statusline.platforms import environment as platform_environment


def claude_argv(executable: str = "claude") -> list[str]:
    resolved = shutil.which(executable)
    if not resolved:
        raise integration_models.ConfigurationError("Claude Code is not in PATH")
    path = Path(resolved).resolve()
    if platform_environment.is_windows() and path.suffix.casefold() in {".cmd", ".bat"}:
        # Avoid cmd.exe interpolation of user-selected paths. Invoke the npm
        # package through Node directly when PATH points at a batch shim.
        roots = (
            path.parent / "node_modules/@anthropic-ai/claude-code",
            path.parent.parent / "@anthropic-ai/claude-code",
        )
        for root in roots:
            metadata = root / "package.json"
            if not metadata.is_file():
                continue
            try:
                package = json.loads(metadata.read_text(encoding="utf-8"))
                entry = package["bin"]
                entry = entry["claude"] if isinstance(entry, dict) else entry
                if not isinstance(entry, str):
                    continue
                target = (root / entry).resolve()
                if not target.is_relative_to(root.resolve()) or not target.is_file():
                    continue
            except (OSError, ValueError, KeyError, TypeError):
                continue
            if target.suffix.casefold() == ".exe":
                return [str(target)]
            node = shutil.which("node")
            if node and target.suffix.casefold() in {".js", ".cjs", ".mjs"}:
                return [str(Path(node).resolve()), str(target)]
        raise integration_models.ConfigurationError(
            "Cannot safely resolve Claude batch wrapper; use a native Claude executable or its matching npm package"
        )
    return [str(path)]


def detect_claude_version() -> tuple[int, int, int] | None:
    try:
        command = claude_argv()
    except integration_models.ConfigurationError:
        return None
    try:
        result = subprocess.run(
            [*command, "--version"],
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
