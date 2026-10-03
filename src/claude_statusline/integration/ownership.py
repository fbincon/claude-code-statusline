"""integration / ownership implementation."""

from __future__ import annotations

import json
import os
import shlex
import shutil
from pathlib import Path
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment


def resolve_config_dir(explicit: str | os.PathLike[str] | None = None) -> Path:
    raw = explicit if explicit is not None else os.environ.get("CLAUDE_CONFIG_DIR")
    if raw is None or not str(raw).strip():
        raw = "~/.claude"
    return Path(os.path.abspath(os.path.expanduser(os.fspath(raw))))


def resolve_cli_executable(explicit: str | os.PathLike[str] | None = None) -> Path:
    if explicit is not None:
        value = os.fspath(explicit)
    else:
        names = (
            ("claude-statusline.exe",)
            if platform_environment.is_windows()
            else ("claude-statusline",)
        )
        value = next((found for name in names if (found := shutil.which(name))), "")
    if not value:
        command_name = (
            "claude-statusline.exe"
            if platform_environment.is_windows()
            else "claude-statusline"
        )
        raise integration_models.ConfigurationError(
            f"cannot find {command_name} in PATH; install the package first"
        )
    return Path(os.path.abspath(os.path.expanduser(value)))


def _quoted_executable(executable: Path) -> str:
    value = str(executable)
    if any(char in value for char in ("\x00", "\n", "\r")):
        raise integration_models.ConfigurationError(
            "the executable path contains an unsafe character"
        )
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("$", "\\$")
        .replace("`", "\\`")
    )
    return f'"{escaped}"'


def command_for(executable: Path, subcommand: str) -> str:
    if subcommand not in ("render", "render-subagents", "hook", "slash-hook"):
        raise ValueError(f"unsupported subcommand: {subcommand}")
    if platform_environment.is_windows():
        return f"claude-statusline.exe {subcommand}"
    return f"{_quoted_executable(executable)} {subcommand}"


def _is_owned_skill_marker(raw: bytes | None) -> bool:
    if raw is None:
        return False
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return False
    return value == {
        "owner": integration_models.SKILL_OWNER,
        "schema_version": integration_models.SKILL_OWNER_SCHEMA,
    }


def _split_command(command: object) -> list[str] | None:
    if not isinstance(command, str):
        return None
    try:
        return shlex.split(command, posix=True)
    except ValueError:
        return None


def _normalized_path(value: str | os.PathLike[str]) -> str:
    return os.path.normcase(os.path.abspath(os.path.expanduser(os.fspath(value))))


def _is_cli_command(
    command: object,
    subcommand: str,
    executable: Path | None = None,
) -> bool:
    argv = _split_command(command)
    if not argv or len(argv) != 2 or argv[1] != subcommand:
        return False
    candidate = argv[0]
    candidate_name = candidate.replace("\\", "/").rsplit("/", 1)[-1]
    canonical = candidate_name == "claude-statusline"
    windows_canonical = candidate_name.casefold() == "claude-statusline.exe"
    if canonical or windows_canonical:
        return True
    if executable is not None:
        if _normalized_path(candidate) == _normalized_path(executable):
            return True
        try:
            resolved = shutil.which(candidate)
        except (OSError, ValueError):
            resolved = None
        return bool(
            resolved and _normalized_path(resolved) == _normalized_path(executable)
        )
    return False


def _is_current_cli_command(
    command: object,
    subcommand: str,
    executable: Path,
) -> bool:
    """Match configuration ownership without accepting another absolute install.

    Install/upgrade discovery intentionally recognizes canonical basenames in
    _is_cli_command. Editors need a narrower match for explicitly bound paths.
    Keep the canonical PATH commands used by Windows/older installs compatible.
    Comparing the generated tokens also handles escaped shell characters in a
    POSIX executable path without unescaping arbitrary user-authored commands.
    """
    argv = _split_command(command)
    if not argv or len(argv) != 2 or argv[1] != subcommand:
        return False
    if argv == _split_command(command_for(executable, subcommand)):
        return True
    candidate = argv[0]
    if (
        "/" not in candidate
        and "\\" not in candidate
        and (
            candidate == "claude-statusline"
            or candidate.casefold() == "claude-statusline.exe"
        )
    ):
        return True
    if _normalized_path(candidate) == _normalized_path(executable):
        return True
    try:
        resolved = shutil.which(candidate)
    except (OSError, ValueError):
        resolved = None
    return bool(resolved and _normalized_path(resolved) == _normalized_path(executable))


def _is_legacy_python_command(
    command: object,
    target: Path,
) -> bool:
    argv = _split_command(command)
    if not argv or len(argv) != 2:
        return False
    python_name = Path(argv[0]).name.lower()
    return python_name.startswith("python") and _normalized_path(
        argv[1]
    ) == _normalized_path(target)


def _hook_commands(settings: dict, event: str) -> list[object]:
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        return []
    groups = hooks.get(event)
    if not isinstance(groups, list):
        return []
    result = []
    for group in groups:
        if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
            continue
        for action in group["hooks"]:
            if isinstance(action, dict):
                result.append(action.get("command"))
    return result


def _slash_hook_actions(
    settings: dict,
    executable: Path | None,
    command_name: str = integration_models.SLASH_COMMAND_NAME,
) -> list[dict]:
    if executable is None:
        return []
    hooks = settings.get("hooks")
    groups = (
        hooks.get(integration_models.SLASH_HOOK_EVENT)
        if isinstance(hooks, dict)
        else None
    )
    if not isinstance(groups, list):
        return []
    result = []
    for group in groups:
        if not isinstance(group, dict) or group.get("matcher") != command_name:
            continue
        actions = group.get("hooks")
        if not isinstance(actions, list):
            continue
        result.extend(
            action
            for action in actions
            if isinstance(action, dict)
            and _is_cli_command(action.get("command"), "slash-hook", executable)
        )
    return result


def _slash_matcher_groups(settings: dict, command_name: str) -> list[dict]:
    hooks = settings.get("hooks")
    groups = (
        hooks.get(integration_models.SLASH_HOOK_EVENT)
        if isinstance(hooks, dict)
        else None
    )
    if not isinstance(groups, list):
        return []
    return [
        group
        for group in groups
        if isinstance(group, dict) and group.get("matcher") == command_name
    ]


def _slash_hook_count(
    settings: dict,
    executable: Path | None,
    command_name: str = integration_models.SLASH_COMMAND_NAME,
) -> int:
    return len(_slash_hook_actions(settings, executable, command_name))
