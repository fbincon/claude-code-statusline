"""Safe installation and diagnosis for the Claude Code status line."""

from __future__ import annotations

import copy
import datetime as dt
import json
import os
import platform as stdlib_platform
import re
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from importlib import metadata
from importlib import resources
from pathlib import Path

from . import _platform, feature_config

HOOK_EVENTS = (
    "SessionStart",
    "UserPromptSubmit",
    "Stop",
    "StopFailure",
    "SessionEnd",
)
SUBAGENT_HOOK_EVENTS = ("SubagentStart", "SubagentStop")
SLASH_HOOK_EVENT = "UserPromptExpansion"
SLASH_COMMAND_NAME = "statusline-config"
EXPERIMENTAL_SLASH_COMMAND_NAME = "statusline-configure"
MIN_FAST_SLASH_VERSION = (2, 1, 258)
MIN_SUBAGENT_STATUSLINE_VERSION = (2, 1, 205)
SKILL_OWNER = "claude-code-statusline"
SKILL_OWNER_SCHEMA = 1
SKILL_RELATIVE_PATH = Path("skills") / SLASH_COMMAND_NAME / "SKILL.md"
SKILL_OWNER_RELATIVE_PATH = (
    Path("skills") / SLASH_COMMAND_NAME / ".claude-statusline-owner.json"
)
EXPERIMENTAL_SKILL_RELATIVE_PATH = (
    Path("skills") / EXPERIMENTAL_SLASH_COMMAND_NAME / "SKILL.md"
)
EXPERIMENTAL_SKILL_OWNER_RELATIVE_PATH = (
    Path("skills")
    / EXPERIMENTAL_SLASH_COMMAND_NAME
    / ".claude-statusline-owner.json"
)
_DETECT_CLAUDE_VERSION = object()
_UNCHANGED_ARTIFACT = object()


class ConfigurationError(RuntimeError):
    """Raised when settings cannot be changed without losing user intent."""


@dataclass(frozen=True)
class ChangeResult:
    action: str
    changed: bool
    settings_path: Path
    backup_dir: Path | None = None
    changed_paths: tuple[Path, ...] = ()


@dataclass(frozen=True)
class Diagnostic:
    level: str
    message: str


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
            if _platform.is_windows()
            else ("claude-statusline",)
        )
        value = next((found for name in names if (found := shutil.which(name))), "")
    if not value:
        command_name = (
            "claude-statusline.exe"
            if _platform.is_windows()
            else "claude-statusline"
        )
        raise ConfigurationError(
            f"cannot find {command_name} in PATH; install the package first"
        )
    return Path(os.path.abspath(os.path.expanduser(value)))


def _quoted_executable(executable: Path) -> str:
    value = str(executable)
    if any(char in value for char in ("\x00", "\n", "\r")):
        raise ConfigurationError("the executable path contains an unsafe character")
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
    if _platform.is_windows():
        return f"claude-statusline.exe {subcommand}"
    return f"{_quoted_executable(executable)} {subcommand}"


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
            creationflags=_platform.no_window_creation_flags(),
        )
    except (OSError, subprocess.SubprocessError):
        return None
    match = re.search(r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)", result.stdout)
    if result.returncode != 0 or match is None:
        return None
    return tuple(int(value) for value in match.groups())


def supports_fast_slash_hook(version: tuple[int, int, int] | None) -> bool:
    return version is not None and version >= MIN_FAST_SLASH_VERSION


def supports_subagent_statusline(version: tuple[int, int, int] | None) -> bool:
    return version is not None and version >= MIN_SUBAGENT_STATUSLINE_VERSION


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
    if (
        _is_cli_command(command, "render-subagents", executable)
        or _is_cli_command(command, "render-subagents")
    ):
        return "owned"
    return "foreign"


def skill_paths(
    config_dir: Path,
    command_name: str = SLASH_COMMAND_NAME,
) -> tuple[Path, Path]:
    if command_name == SLASH_COMMAND_NAME:
        relative = SKILL_RELATIVE_PATH
        owner_relative = SKILL_OWNER_RELATIVE_PATH
    elif command_name == EXPERIMENTAL_SLASH_COMMAND_NAME:
        relative = EXPERIMENTAL_SKILL_RELATIVE_PATH
        owner_relative = EXPERIMENTAL_SKILL_OWNER_RELATIVE_PATH
    else:
        raise ValueError(f"unsupported skill: {command_name}")
    return config_dir / relative, config_dir / owner_relative


def experimental_skill_paths(config_dir: Path) -> tuple[Path, Path]:
    return skill_paths(config_dir, EXPERIMENTAL_SLASH_COMMAND_NAME)


def _skill_owner_bytes() -> bytes:
    return _json_bytes({
        "owner": SKILL_OWNER,
        "schema_version": SKILL_OWNER_SCHEMA,
    })


def _is_owned_skill_marker(raw: bytes | None) -> bool:
    if raw is None:
        return False
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return False
    return value == {
        "owner": SKILL_OWNER,
        "schema_version": SKILL_OWNER_SCHEMA,
    }


def _render_skill_resource(resource_name: str) -> bytes:
    try:
        template = (
            resources.files("claude_statusline")
            .joinpath(f"resources/{resource_name}/SKILL.md")
            .read_text(encoding="utf-8")
        )
    except (FileNotFoundError, OSError) as exc:
        raise ConfigurationError(
            f"cannot load bundled {resource_name} skill: {exc}"
        ) from exc
    return template.encode("utf-8")


def render_skill(executable: Path) -> bytes:
    template = _render_skill_resource(SLASH_COMMAND_NAME).decode("utf-8")
    shell_command = (
        "claude-statusline.exe"
        if _platform.is_windows()
        else shlex.quote(str(executable))
    )
    rules = [f"Bash({shell_command} config *)"]
    if _platform.is_windows():
        rules.append(f"PowerShell({shell_command} config *)")
    allowed_rules = "\n".join(
        f"  - {json.dumps(rule, ensure_ascii=False)}" for rule in rules
    )
    rendered = template.replace(
        "__CLAUDE_STATUSLINE_ALLOWED_RULES__", allowed_rules
    ).replace("__CLAUDE_STATUSLINE_COMMAND__", shell_command)
    if "__CLAUDE_STATUSLINE_" in rendered:
        raise ConfigurationError("bundled statusline-config skill has unresolved placeholders")
    return rendered.encode("utf-8")


def render_experimental_skill() -> bytes:
    return _render_skill_resource(EXPERIMENTAL_SLASH_COMMAND_NAME)


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
            resolved
            and _normalized_path(resolved) == _normalized_path(executable)
        )
    return False


def _is_legacy_python_command(
    command: object,
    target: Path,
) -> bool:
    argv = _split_command(command)
    if not argv or len(argv) != 2:
        return False
    python_name = Path(argv[0]).name.lower()
    return (
        python_name.startswith("python")
        and _normalized_path(argv[1]) == _normalized_path(target)
    )


def _read_settings(settings_path: Path) -> tuple[dict, bytes | None]:
    try:
        raw = settings_path.read_bytes()
    except FileNotFoundError:
        return {}, None
    except OSError as exc:
        raise ConfigurationError(f"cannot read {settings_path}: {exc}") from exc
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ConfigurationError(f"invalid JSON in {settings_path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigurationError(f"{settings_path} must contain a JSON object")
    return data, raw


def _clean_hook_groups(
    groups: object,
    config_dir: Path,
    executable: Path,
    remove_cli: bool,
    remove_legacy: bool,
    cli_subcommands: tuple[str, ...] = ("hook",),
) -> list:
    if groups is None:
        return []
    if not isinstance(groups, list):
        raise ConfigurationError("each configured hook event must contain a list")

    cleaned = []
    legacy_target = config_dir / "turn_state.py"
    for group in groups:
        if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
            cleaned.append(copy.deepcopy(group))
            continue
        remaining = []
        for action in group["hooks"]:
            command = action.get("command") if isinstance(action, dict) else None
            owned = remove_cli and any(
                _is_cli_command(command, subcommand, executable)
                or _is_cli_command(command, subcommand)
                for subcommand in cli_subcommands
            )
            legacy = remove_legacy and _is_legacy_python_command(
                command, legacy_target
            )
            if not (owned or legacy):
                remaining.append(copy.deepcopy(action))
        if remaining:
            new_group = copy.deepcopy(group)
            new_group["hooks"] = remaining
            cleaned.append(new_group)
    return cleaned


def _prepare_install(
    settings: dict,
    config_dir: Path,
    executable: Path,
    force: bool,
    fast_slash_hook: bool = False,
    experimental_slash_tui: bool = False,
    subagent_supported: bool = False,
    subagent_enabled: bool = True,
) -> dict:
    updated = copy.deepcopy(settings)
    current = updated.get("statusLine")
    if current is not None:
        current_command = current.get("command") if isinstance(current, dict) else None
        replaceable = (
            _is_cli_command(current_command, "render", executable)
            or _is_cli_command(current_command, "render")
            or _is_legacy_python_command(
                current_command, config_dir / "statusline.py"
            )
        )
        if not replaceable and not force:
            raise ConfigurationError(
                "an unrelated statusLine is already configured; rerun with --force "
                "only if replacing it is intentional"
            )

    status_line = {
        "type": "command",
        "command": command_for(executable, "render"),
    }
    if isinstance(current, dict):
        padding = current.get("padding")
        if (
            isinstance(padding, int)
            and not isinstance(padding, bool)
            and 0 < padding <= 32
        ):
            status_line["padding"] = padding
        interval = current.get("refreshInterval", _UNCHANGED_ARTIFACT)
        if (
            interval is not _UNCHANGED_ARTIFACT
            and isinstance(interval, int)
            and not isinstance(interval, bool)
            and 1 <= interval <= 3600
        ):
            status_line["refreshInterval"] = interval
        hide_vim = current.get("hideVimModeIndicator")
        if hide_vim is True:
            status_line["hideVimModeIndicator"] = True
    else:
        status_line["refreshInterval"] = 1
    updated["statusLine"] = status_line

    current_subagent = updated.get("subagentStatusLine")
    current_subagent_command = (
        current_subagent.get("command")
        if isinstance(current_subagent, dict)
        else None
    )
    subagent_owned = (
        _is_cli_command(current_subagent_command, "render-subagents", executable)
        or _is_cli_command(current_subagent_command, "render-subagents")
    )
    if subagent_supported and subagent_enabled:
        if current_subagent is not None and not subagent_owned and not force:
            raise ConfigurationError(
                "an unrelated subagentStatusLine is already configured; choose "
                "install --force to replace it, or run 'config set "
                "subagent-statusline off' to preserve it"
            )
        updated["subagentStatusLine"] = {
            "type": "command",
            "command": command_for(executable, "render-subagents"),
        }
    elif subagent_owned:
        updated.pop("subagentStatusLine", None)

    hooks = updated.get("hooks")
    if hooks is None:
        hooks = {}
    if not isinstance(hooks, dict):
        raise ConfigurationError("the hooks setting must contain a JSON object")
    hooks = copy.deepcopy(hooks)
    action = {
        "type": "command",
        "command": command_for(executable, "hook"),
        "timeout": 5,
    }
    for event in HOOK_EVENTS:
        groups = _clean_hook_groups(
            hooks.get(event), config_dir, executable,
            remove_cli=True, remove_legacy=True,
        )
        groups.append({"hooks": [copy.deepcopy(action)]})
        hooks[event] = groups
    for event in SUBAGENT_HOOK_EVENTS:
        groups = _clean_hook_groups(
            hooks.get(event), config_dir, executable,
            remove_cli=True, remove_legacy=False,
        )
        if subagent_supported:
            groups.append({"hooks": [copy.deepcopy(action)]})
        if groups:
            hooks[event] = groups
        else:
            hooks.pop(event, None)
    slash_groups = _clean_hook_groups(
        hooks.get(SLASH_HOOK_EVENT),
        config_dir,
        executable,
        remove_cli=True,
        remove_legacy=False,
        cli_subcommands=("slash-hook",),
    )
    if fast_slash_hook:
        slash_groups.append({
            "matcher": SLASH_COMMAND_NAME,
            "hooks": [{
                "type": "command",
                "command": command_for(executable, "slash-hook"),
                "timeout": 5,
            }],
        })
    if experimental_slash_tui:
        slash_groups.append({
            "matcher": EXPERIMENTAL_SLASH_COMMAND_NAME,
            "hooks": [{
                "type": "command",
                "command": command_for(executable, "slash-hook"),
                "timeout": 600,
            }],
        })
    if slash_groups:
        hooks[SLASH_HOOK_EVENT] = slash_groups
    else:
        hooks.pop(SLASH_HOOK_EVENT, None)
    updated["hooks"] = hooks
    return updated


def _prepare_uninstall(
    settings: dict,
    config_dir: Path,
    executable: Path,
) -> dict:
    updated = copy.deepcopy(settings)
    current = updated.get("statusLine")
    current_command = current.get("command") if isinstance(current, dict) else None
    if (
        _is_cli_command(current_command, "render", executable)
        or _is_cli_command(current_command, "render")
    ):
        updated.pop("statusLine", None)

    current_subagent = updated.get("subagentStatusLine")
    current_subagent_command = (
        current_subagent.get("command")
        if isinstance(current_subagent, dict)
        else None
    )
    if (
        _is_cli_command(current_subagent_command, "render-subagents", executable)
        or _is_cli_command(current_subagent_command, "render-subagents")
    ):
        updated.pop("subagentStatusLine", None)

    hooks = updated.get("hooks")
    if isinstance(hooks, dict):
        hooks = copy.deepcopy(hooks)
        for event in list(hooks):
            groups = _clean_hook_groups(
                hooks[event], config_dir, executable,
                remove_cli=True, remove_legacy=False,
                cli_subcommands=("hook", "slash-hook"),
            )
            if groups:
                hooks[event] = groups
            else:
                hooks.pop(event, None)
        if hooks:
            updated["hooks"] = hooks
        else:
            updated.pop("hooks", None)
    return updated


def _json_bytes(settings: dict) -> bytes:
    return (json.dumps(settings, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _chmod_private(path: Path, mode: int) -> None:
    if not _platform.uses_posix_files():
        return
    try:
        path.chmod(mode)
    except OSError:
        pass


def _unique_backup_dir(config_dir: Path, action: str) -> Path:
    root = config_dir / "backups" / "statusline"
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    _chmod_private(root, 0o700)
    stamp = dt.datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
    base = root / f"cli-{action}-{stamp}"
    candidate = base
    suffix = 1
    while candidate.exists():
        candidate = Path(f"{base}-{suffix}")
        suffix += 1
    candidate.mkdir(mode=0o700)
    _chmod_private(candidate, 0o700)
    return candidate


def _backup_settings(
    config_dir: Path,
    settings_path: Path,
    raw: bytes | None,
    action: str,
) -> Path:
    return _backup_artifacts(
        config_dir,
        action,
        [("settings.json", settings_path, raw)],
    )


def _backup_artifacts(
    config_dir: Path,
    action: str,
    artifacts: list[tuple[str, Path, bytes | None]],
) -> Path:
    try:
        backup_dir = _unique_backup_dir(config_dir, action)
        recorded = []
        for name, path, raw in artifacts:
            suffix = "before" if raw is not None else "absent"
            target = backup_dir / f"{name}.{suffix}"
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            target.write_bytes(raw if raw is not None else b"")
            _chmod_private(target, 0o600)
            recorded.append({"path": str(path), "state": suffix})
        metadata = {
            "action": action,
            "created_at": dt.datetime.now().astimezone().isoformat(),
            "artifacts": recorded,
        }
        settings_artifact = next(
            (path for name, path, _raw in artifacts if name == "settings.json"),
            None,
        )
        if settings_artifact is not None:
            metadata["settings_path"] = str(settings_artifact)
        metadata_path = backup_dir / "metadata.json"
        metadata_path.write_bytes(_json_bytes(metadata))
        _chmod_private(metadata_path, 0o600)
        return backup_dir
    except OSError as exc:
        raise ConfigurationError(f"cannot back up statusline configuration: {exc}") from exc


def _atomic_write_bytes(path: Path, content: bytes, mode: int = 0o600) -> None:
    _platform.atomic_write_bytes(path, content, mode)


def _atomic_write_settings(settings_path: Path, settings: dict) -> None:
    _atomic_write_bytes(settings_path, _json_bytes(settings), mode=0o600)


def _read_optional_bytes(path: Path) -> bytes | None:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise ConfigurationError(f"cannot read {path}: {exc}") from exc


def _write_optional_bytes(path: Path, value: bytes | None) -> None:
    if value is None:
        _platform.durable_unlink(path)
    else:
        _atomic_write_bytes(path, value, mode=0o600)


def _installation_lock(config_dir: Path):
    runtime_dir = config_dir / "statusline_runtime"
    runtime_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    _chmod_private(runtime_dir, 0o700)
    lock_path = runtime_dir / "install.lock"
    return _platform.exclusive_file_lock(lock_path)


def _change_configuration(
    action: str,
    config_dir: Path,
    executable: Path,
    dry_run: bool,
    force: bool = False,
    claude_version: tuple[int, int, int] | None = None,
    experimental_slash_tui: bool | None = None,
) -> ChangeResult:
    settings_path = config_dir / "settings.json"
    skill_path, owner_path = skill_paths(config_dir)
    experimental_skill_path, experimental_owner_path = experimental_skill_paths(
        config_dir
    )
    preference_path = feature_config.feature_path(config_dir)

    def private_mode(path: Path) -> bool:
        return _platform.private_mode_matches(path, 0o600) is not False

    def prepare():
        settings, settings_raw = _read_settings(settings_path)
        preference_raw = _read_optional_bytes(preference_path)
        preference_enabled = False
        if action == "install" and preference_raw is not None:
            try:
                preference_enabled = feature_config.parse_feature_bytes(
                    preference_raw, preference_path
                )
            except feature_config.FeatureConfigError as exc:
                if experimental_slash_tui is None:
                    raise ConfigurationError(str(exc)) from exc
        if action == "install" and experimental_slash_tui is not None:
            preference_enabled = experimental_slash_tui

        fast_slash_hook = supports_fast_slash_hook(claude_version)
        subagent_supported = supports_subagent_statusline(claude_version)
        try:
            from . import display_config

            display = display_config.load_display_config(config_dir)
        except display_config.DisplayConfigError:
            display = display_config.DEFAULT_CONFIG
        experimental_active = preference_enabled and fast_slash_hook
        if action == "install":
            updated_settings = _prepare_install(
                settings,
                config_dir,
                executable,
                force,
                fast_slash_hook=fast_slash_hook,
                experimental_slash_tui=experimental_active,
                subagent_supported=subagent_supported,
                subagent_enabled=display.subagents.enabled,
            )
        else:
            updated_settings = _prepare_uninstall(
                settings, config_dir, executable
            )

        skill_raw = _read_optional_bytes(skill_path)
        owner_raw = _read_optional_bytes(owner_path)
        skill_owned = _is_owned_skill_marker(owner_raw)
        experimental_skill_raw = _read_optional_bytes(experimental_skill_path)
        experimental_owner_raw = _read_optional_bytes(experimental_owner_path)
        experimental_skill_owned = _is_owned_skill_marker(
            experimental_owner_raw
        )
        desired_skill: bytes | None | object = _UNCHANGED_ARTIFACT
        desired_owner: bytes | None | object = _UNCHANGED_ARTIFACT
        desired_experimental_skill: bytes | None | object = _UNCHANGED_ARTIFACT
        desired_experimental_owner: bytes | None | object = _UNCHANGED_ARTIFACT
        desired_preference: bytes | None | object = _UNCHANGED_ARTIFACT
        if action == "install":
            if (
                (skill_raw is not None or owner_raw is not None)
                and not skill_owned
                and not force
            ):
                raise ConfigurationError(
                    f"an unrelated /{SLASH_COMMAND_NAME} skill already exists; "
                    "rerun with --force only if replacing it is intentional"
                )
            desired_skill = render_skill(executable)
            desired_owner = _skill_owner_bytes()

            if experimental_active:
                if (
                    (
                        experimental_skill_raw is not None
                        or experimental_owner_raw is not None
                    )
                    and not experimental_skill_owned
                    and not force
                ):
                    raise ConfigurationError(
                        f"an unrelated /{EXPERIMENTAL_SLASH_COMMAND_NAME} skill "
                        "already exists; rerun with --force only if replacing it "
                        "is intentional"
                    )
                desired_experimental_skill = render_experimental_skill()
                desired_experimental_owner = _skill_owner_bytes()
            elif experimental_skill_owned:
                desired_experimental_skill = None
                desired_experimental_owner = None

            if experimental_slash_tui is True:
                desired_preference = feature_config.enabled_bytes()
            elif experimental_slash_tui is False:
                desired_preference = None
            elif preference_raw is not None:
                # Preserve valid bytes while still repairing private permissions.
                desired_preference = preference_raw
        else:
            if skill_owned:
                desired_skill = None
                desired_owner = None
            if experimental_skill_owned:
                desired_experimental_skill = None
                desired_experimental_owner = None

        def artifact_changed(
            path: Path,
            raw: bytes | None,
            desired: bytes | None | object,
            *,
            enforce_private: bool = False,
        ) -> bool:
            return desired is not _UNCHANGED_ARTIFACT and (
                desired != raw
                or (
                    enforce_private
                    and desired is not None
                    and not private_mode(path)
                )
            )

        candidates = [
            (
                "settings.json",
                settings_path,
                settings_raw,
                _json_bytes(updated_settings),
                updated_settings != settings,
            ),
            (
                feature_config.FEATURE_FILENAME,
                preference_path,
                preference_raw,
                desired_preference,
                artifact_changed(
                    preference_path,
                    preference_raw,
                    desired_preference,
                    enforce_private=True,
                ),
            ),
            (
                "skill/SKILL.md",
                skill_path,
                skill_raw,
                desired_skill,
                desired_skill is not _UNCHANGED_ARTIFACT
                and desired_skill != skill_raw,
            ),
            (
                "skill/.claude-statusline-owner.json",
                owner_path,
                owner_raw,
                desired_owner,
                desired_owner is not _UNCHANGED_ARTIFACT
                and desired_owner != owner_raw,
            ),
            (
                "experimental-skill/SKILL.md",
                experimental_skill_path,
                experimental_skill_raw,
                desired_experimental_skill,
                artifact_changed(
                    experimental_skill_path,
                    experimental_skill_raw,
                    desired_experimental_skill,
                ),
            ),
            (
                "experimental-skill/.claude-statusline-owner.json",
                experimental_owner_path,
                experimental_owner_raw,
                desired_experimental_owner,
                artifact_changed(
                    experimental_owner_path,
                    experimental_owner_raw,
                    desired_experimental_owner,
                ),
            ),
        ]
        return [candidate for candidate in candidates if candidate[4]]

    if dry_run:
        changes = prepare()
        return ChangeResult(
            action,
            bool(changes),
            settings_path,
            changed_paths=tuple(change[1] for change in changes),
        )

    config_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    with _installation_lock(config_dir):
        changes = prepare()
        if not changes:
            return ChangeResult(action, False, settings_path)
        backup_dir = _backup_artifacts(
            config_dir,
            action,
            [(name, path, raw) for name, path, raw, _desired, _ in changes],
        )
        try:
            for _name, path, _raw, desired, _changed in changes:
                _write_optional_bytes(path, desired)
        except OSError as exc:
            rollback_errors = []
            for _name, path, raw, _desired, _changed in reversed(changes):
                try:
                    _write_optional_bytes(path, raw)
                except OSError as rollback_exc:
                    rollback_errors.append(str(rollback_exc))
            suffix = (
                "; rollback also failed: " + "; ".join(rollback_errors)
                if rollback_errors
                else ""
            )
            raise ConfigurationError(
                f"cannot {action} statusline configuration: {exc}{suffix}"
            ) from exc

        if action == "uninstall":
            for directory in (skill_path.parent, experimental_skill_path.parent):
                try:
                    directory.rmdir()
                except OSError:
                    pass
        elif action == "install":
            try:
                experimental_skill_path.parent.rmdir()
            except OSError:
                pass
        return ChangeResult(
            action,
            True,
            settings_path,
            backup_dir,
            tuple(change[1] for change in changes),
        )


def install_configuration(
    config_dir: Path,
    executable: Path,
    *,
    dry_run: bool = False,
    force: bool = False,
    experimental_slash_tui: bool | None = None,
    claude_version: tuple[int, int, int] | None | object = _DETECT_CLAUDE_VERSION,
) -> ChangeResult:
    if claude_version is _DETECT_CLAUDE_VERSION:
        claude_version = detect_claude_version()
    if experimental_slash_tui is True and not supports_fast_slash_hook(
        claude_version
    ):
        version_text = (
            ".".join(map(str, claude_version))
            if isinstance(claude_version, tuple)
            else "unknown"
        )
        minimum = ".".join(map(str, MIN_FAST_SLASH_VERSION))
        raise ConfigurationError(
            "cannot enable /statusline-configure: Claude Code "
            f"{minimum}+ is required; found {version_text}"
        )
    return _change_configuration(
        "install",
        config_dir,
        executable,
        dry_run,
        force,
        claude_version=claude_version,
        experimental_slash_tui=experimental_slash_tui,
    )


def uninstall_configuration(
    config_dir: Path,
    executable: Path,
    *,
    dry_run: bool = False,
) -> ChangeResult:
    return _change_configuration(
        "uninstall", config_dir, executable, dry_run
    )


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
    command_name: str = SLASH_COMMAND_NAME,
) -> list[dict]:
    if executable is None:
        return []
    hooks = settings.get("hooks")
    groups = hooks.get(SLASH_HOOK_EVENT) if isinstance(hooks, dict) else None
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
    groups = hooks.get(SLASH_HOOK_EVENT) if isinstance(hooks, dict) else None
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
    command_name: str = SLASH_COMMAND_NAME,
) -> int:
    return len(_slash_hook_actions(settings, executable, command_name))


def collect_diagnostics(
    config_dir: Path,
    executable: Path | None,
    *,
    claude_version: tuple[int, int, int] | None | object = _DETECT_CLAUDE_VERSION,
) -> list[Diagnostic]:
    diagnostics = []
    if _platform.is_supported_platform():
        suffix = " (macOS preview)" if _platform.is_macos() else ""
        diagnostics.append(Diagnostic("OK", f"platform: {sys.platform}{suffix}"))
    else:
        diagnostics.append(Diagnostic(
            "ERROR", "supported platforms are Linux/WSL, Windows and macOS (preview)"
        ))

    if _platform.is_windows():
        machine = stdlib_platform.machine().casefold()
        if machine in {"amd64", "x86_64", "x86", "i386", "i686"}:
            diagnostics.append(Diagnostic("OK", f"Windows architecture: {machine}"))
        else:
            diagnostics.append(Diagnostic(
                "WARN",
                f"Windows architecture {machine or 'unknown'} is not covered; "
                "use x64 Python emulation on ARM64",
            ))
        try:
            import curses

            curses_version = metadata.version("windows-curses")
            if not hasattr(curses, "wrapper"):
                raise ImportError("curses.wrapper is unavailable")
            version_match = re.match(r"(\d+)\.(\d+)\.(\d+)", curses_version)
            if (
                version_match is None
                or tuple(map(int, version_match.groups())) < (2, 4, 2)
            ):
                raise ImportError(
                    f"windows-curses 2.4.2+ is required; found {curses_version}"
                )
            diagnostics.append(Diagnostic(
                "OK", f"windows-curses backend: {curses_version}"
            ))
        except (ImportError, metadata.PackageNotFoundError) as exc:
            diagnostics.append(Diagnostic(
                "ERROR", f"windows-curses backend is unavailable: {exc}"
            ))
        if _platform.new_console_creation_flags():
            diagnostics.append(Diagnostic("OK", "Windows system new-console launcher"))
        else:
            diagnostics.append(Diagnostic(
                "ERROR", "Windows system new-console launcher is unavailable"
            ))

    elif _platform.is_macos():
        machine = stdlib_platform.machine().casefold()
        diagnostics.append(Diagnostic(
            "OK" if machine in {"x86_64", "arm64"} else "WARN",
            f"macOS architecture: {machine or 'unknown'} (preview)",
        ))
        macos_version = stdlib_platform.mac_ver()[0]
        diagnostics.append(Diagnostic(
            "OK" if macos_version.split(".")[0] in {"15", "26"} else "WARN",
            f"macOS version: {macos_version or 'unknown'}; preview CI covers 15 and 26",
        ))
        try:
            import curses

            if not hasattr(curses, "wrapper"):
                raise ImportError("curses.wrapper is unavailable")
            diagnostics.append(Diagnostic("OK", "macOS curses backend"))
        except ImportError as exc:
            diagnostics.append(Diagnostic(
                "ERROR", f"macOS curses backend is unavailable: {exc}"
            ))
        process_token = _platform.process_start_token(os.getpid())
        diagnostics.append(Diagnostic(
            "OK" if process_token else "WARN",
            "macOS process start verification: " + (
                "available" if process_token else "unavailable; registry reconciliation is disabled"
            ),
        ))
        _wall, boot_ns, boot_id = _platform.now_clocks()
        native_clock = boot_ns is not None and boot_id is not None
        diagnostics.append(Diagnostic(
            "OK" if native_clock else "WARN",
            "macOS suspend-aware clock: " + (
                "available" if native_clock else "unavailable; using wall-clock fallback"
            ),
        ))

    version = ".".join(map(str, sys.version_info[:3]))
    if sys.version_info >= (3, 10):  # noqa: UP036 - doctor reports the contract
        diagnostics.append(Diagnostic("OK", f"Python: {version}"))
    else:
        diagnostics.append(Diagnostic("ERROR", f"Python 3.10+ required; found {version}"))

    if executable is None:
        diagnostics.append(Diagnostic("ERROR", "claude-statusline is not in PATH"))
    elif (
        executable.is_file()
        and os.access(executable, os.X_OK)
        and (
            not _platform.is_windows()
            or executable.suffix.casefold() == ".exe"
        )
    ):
        diagnostics.append(Diagnostic("OK", f"executable: {executable}"))
    else:
        diagnostics.append(Diagnostic("ERROR", f"executable is not runnable: {executable}"))

    git_path = shutil.which("git")
    if git_path:
        diagnostics.append(Diagnostic("OK", f"Git: {git_path}"))
    else:
        diagnostics.append(Diagnostic("WARN", "Git is missing; the Git segment will be hidden"))

    settings_path = config_dir / "settings.json"
    try:
        settings, _ = _read_settings(settings_path)
    except ConfigurationError as exc:
        diagnostics.append(Diagnostic("ERROR", str(exc)))
        return diagnostics

    if not settings_path.exists():
        diagnostics.append(Diagnostic("ERROR", f"settings not found: {settings_path}"))
        return diagnostics
    diagnostics.append(Diagnostic("OK", f"settings: {settings_path}"))
    mode_match = _platform.private_mode_matches(settings_path, 0o600)
    if mode_match is None:
        diagnostics.append(Diagnostic(
            "OK",
            "settings permissions: POSIX mode not applicable on Windows; "
            "security uses inherited ACLs",
        ))
    elif mode_match:
        diagnostics.append(Diagnostic("OK", "settings permissions: 0600"))
    else:
        mode = settings_path.stat().st_mode & 0o7777
        diagnostics.append(Diagnostic("WARN", f"settings permissions: {mode:04o}"))

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
        and _is_cli_command(current_command, "render", executable)
        and host_fields_valid
    ):
        diagnostics.append(Diagnostic("OK", "statusLine command and host options"))
    else:
        diagnostics.append(Diagnostic("ERROR", "statusLine is not configured for this executable"))

    for event in HOOK_EVENTS:
        commands = _hook_commands(settings, event)
        count = sum(
            1 for command in commands
            if (
                executable is not None
                and _is_cli_command(command, "hook", executable)
            )
            or _is_cli_command(command, "hook")
        )
        if count == 1:
            diagnostics.append(Diagnostic("OK", f"{event} hook: exactly one"))
        else:
            diagnostics.append(Diagnostic(
                "ERROR", f"{event} hook: expected one, found {count}"
            ))

    skill_path, owner_path = skill_paths(config_dir)
    if executable is not None:
        try:
            expected_skill = render_skill(executable)
            skill_raw = _read_optional_bytes(skill_path)
            owner_raw = _read_optional_bytes(owner_path)
            if skill_raw == expected_skill and _is_owned_skill_marker(owner_raw):
                diagnostics.append(Diagnostic("OK", f"/{SLASH_COMMAND_NAME} skill"))
            else:
                diagnostics.append(Diagnostic(
                    "ERROR", f"/{SLASH_COMMAND_NAME} skill is missing or not owned"
                ))
        except ConfigurationError as exc:
            diagnostics.append(Diagnostic("ERROR", str(exc)))

    display = None
    display_source_schema = None
    try:
        from . import display_config

        display = display_config.load_display_config(config_dir)
        display_source_schema = display_config.read_display_config_schema(config_dir)
        display_path = display_config.config_path(config_dir)
        if display_path.exists():
            display_mode_matches = _platform.private_mode_matches(
                display_path, 0o600
            )
            if display_mode_matches is None:
                diagnostics.append(Diagnostic(
                    "OK",
                    f"display config: {display_path} "
                    "(POSIX mode not applicable on Windows)",
                ))
            elif display_mode_matches:
                diagnostics.append(Diagnostic("OK", f"display config: {display_path}"))
            else:
                display_mode = display_path.stat().st_mode & 0o7777
                diagnostics.append(Diagnostic(
                    "WARN", f"display config permissions: {display_mode:04o}"
                ))
        else:
            diagnostics.append(Diagnostic("OK", "display config: built-in defaults"))
        if display_source_schema == display_config.LEGACY_SCHEMA_VERSION:
            diagnostics.append(Diagnostic(
                "WARN",
                "display config schema v1 is valid and will migrate to v2 on "
                "the next configuration save",
            ))
        elif display_source_schema == display_config.SCHEMA_VERSION:
            diagnostics.append(Diagnostic("OK", "display config schema: v2"))
    except display_config.DisplayConfigError as exc:
        diagnostics.append(Diagnostic("ERROR", str(exc)))

    if claude_version is _DETECT_CLAUDE_VERSION:
        claude_version = detect_claude_version()

    current_subagent = settings.get("subagentStatusLine")
    current_subagent_command = (
        current_subagent.get("command")
        if isinstance(current_subagent, dict)
        else None
    )
    subagent_owned = (
        _is_cli_command(current_subagent_command, "render-subagents", executable)
        if executable is not None
        else False
    ) or _is_cli_command(current_subagent_command, "render-subagents")
    if supports_subagent_statusline(claude_version):
        version_text = ".".join(map(str, claude_version))
        diagnostics.append(Diagnostic(
            "OK", f"subagentStatusLine supported: Claude Code {version_text}"
        ))
        state = subagent_statusline_state(settings, executable, claude_version)
        desired_enabled = (
            display.subagents.enabled if display is not None else True
        )
        exact_subagent = (
            state == "owned"
            and isinstance(current_subagent, dict)
            and set(current_subagent) == {"type", "command"}
            and current_subagent.get("type") == "command"
        )
        if desired_enabled and exact_subagent:
            diagnostics.append(Diagnostic(
                "OK", "subagentStatusLine: enabled and owned"
            ))
        elif desired_enabled:
            diagnostics.append(Diagnostic(
                "ERROR",
                f"subagentStatusLine is enabled but its state is {state}",
            ))
        elif state in ("absent", "foreign"):
            diagnostics.append(Diagnostic(
                "OK",
                "subagentStatusLine: disabled"
                + ("; foreign setting preserved" if state == "foreign" else ""),
            ))
        else:
            diagnostics.append(Diagnostic(
                "ERROR",
                "subagentStatusLine is disabled but an owned setting remains; "
                "rerun install",
            ))
        for event in SUBAGENT_HOOK_EVENTS:
            commands = _hook_commands(settings, event)
            count = sum(
                1
                for command in commands
                if (
                    executable is not None
                    and _is_cli_command(command, "hook", executable)
                )
                or _is_cli_command(command, "hook")
            )
            if count == 1:
                diagnostics.append(Diagnostic("OK", f"{event} hook: exactly one"))
            else:
                diagnostics.append(Diagnostic(
                    "ERROR", f"{event} hook: expected one, found {count}"
                ))
    else:
        version_text = (
            ".".join(map(str, claude_version))
            if isinstance(claude_version, tuple)
            else "unknown"
        )
        diagnostics.append(Diagnostic(
            "WARN",
            "subagentStatusLine and subagent lifecycle hooks require Claude Code "
            f"{'.'.join(map(str, MIN_SUBAGENT_STATUSLINE_VERSION))}+; found "
            f"{version_text}",
        ))
        if subagent_owned:
            diagnostics.append(Diagnostic(
                "ERROR",
                "owned subagentStatusLine remains on an unsupported Claude Code; "
                "rerun install to suspend it",
            ))
        for event in SUBAGENT_HOOK_EVENTS:
            commands = _hook_commands(settings, event)
            count = sum(
                1
                for command in commands
                if (
                    executable is not None
                    and _is_cli_command(command, "hook", executable)
                )
                or _is_cli_command(command, "hook")
            )
            if count:
                diagnostics.append(Diagnostic(
                    "ERROR",
                    f"{event} hook is unsupported but {count} owned hook(s) remain",
                ))
            else:
                diagnostics.append(Diagnostic(
                    "OK", f"{event} hook: suspended"
                ))

    slash_count = _slash_hook_count(settings, executable)
    if supports_fast_slash_hook(claude_version):
        version_text = ".".join(map(str, claude_version))
        if slash_count == 1:
            diagnostics.append(Diagnostic(
                "OK", f"/{SLASH_COMMAND_NAME} local fast path: Claude Code {version_text}"
            ))
        else:
            diagnostics.append(Diagnostic(
                "ERROR",
                f"/{SLASH_COMMAND_NAME} fast hook: expected one, found {slash_count}",
            ))
    else:
        version_text = (
            ".".join(map(str, claude_version))
            if isinstance(claude_version, tuple)
            else "unknown"
        )
        diagnostics.append(Diagnostic(
            "WARN",
            f"/{SLASH_COMMAND_NAME} uses model fallback on Claude Code {version_text}",
        ))

    preference_path = feature_config.feature_path(config_dir)
    preference_enabled = False
    preference_valid = True
    try:
        preference_raw = _read_optional_bytes(preference_path)
        if preference_raw is not None:
            preference_enabled = feature_config.parse_feature_bytes(
                preference_raw, preference_path
            )
            preference_mode_matches = _platform.private_mode_matches(
                preference_path, 0o600
            )
            if preference_mode_matches is None:
                diagnostics.append(Diagnostic(
                    "OK",
                    f"experimental feature preferences: {preference_path} "
                    "(POSIX mode not applicable on Windows)",
                ))
            elif preference_mode_matches:
                diagnostics.append(Diagnostic(
                    "OK", f"experimental feature preferences: {preference_path} (0600)"
                ))
            else:
                preference_mode = preference_path.stat().st_mode & 0o7777
                diagnostics.append(Diagnostic(
                    "ERROR",
                    "experimental feature preferences permissions: "
                    f"expected 0600, found {preference_mode:04o}",
                ))
    except (ConfigurationError, feature_config.FeatureConfigError, OSError) as exc:
        preference_valid = False
        diagnostics.append(Diagnostic("ERROR", str(exc)))

    experimental_skill_path, experimental_owner_path = experimental_skill_paths(
        config_dir
    )
    try:
        experimental_skill_raw = _read_optional_bytes(experimental_skill_path)
        experimental_owner_raw = _read_optional_bytes(experimental_owner_path)
    except ConfigurationError as exc:
        experimental_skill_raw = None
        experimental_owner_raw = None
        diagnostics.append(Diagnostic("ERROR", str(exc)))
    experimental_owned = _is_owned_skill_marker(experimental_owner_raw)
    experimental_actions = _slash_hook_actions(
        settings, executable, EXPERIMENTAL_SLASH_COMMAND_NAME
    )
    experimental_groups = _slash_matcher_groups(
        settings, EXPERIMENTAL_SLASH_COMMAND_NAME
    )

    if preference_valid and not preference_enabled:
        if experimental_owned or experimental_actions:
            diagnostics.append(Diagnostic(
                "ERROR",
                f"/{EXPERIMENTAL_SLASH_COMMAND_NAME} is disabled but owned artifacts remain; "
                "rerun install to repair them",
            ))
        else:
            diagnostics.append(Diagnostic(
                "OK", f"/{EXPERIMENTAL_SLASH_COMMAND_NAME}: disabled"
            ))
    elif preference_valid and not supports_fast_slash_hook(claude_version):
        version_text = (
            ".".join(map(str, claude_version))
            if isinstance(claude_version, tuple)
            else "unknown"
        )
        diagnostics.append(Diagnostic(
            "WARN",
            f"/{EXPERIMENTAL_SLASH_COMMAND_NAME}: suspended on Claude Code "
            f"{version_text}; rerun install after upgrading",
        ))
        if experimental_owned or experimental_actions:
            diagnostics.append(Diagnostic(
                "ERROR",
                f"/{EXPERIMENTAL_SLASH_COMMAND_NAME} is suspended but owned artifacts remain; "
                "rerun install to repair them",
            ))
    elif preference_valid:
        expected_experimental_skill = render_experimental_skill()
        if (
            experimental_skill_raw == expected_experimental_skill
            and experimental_owned
        ):
            diagnostics.append(Diagnostic(
                "OK", f"/{EXPERIMENTAL_SLASH_COMMAND_NAME} skill and owner marker"
            ))
        else:
            diagnostics.append(Diagnostic(
                "ERROR",
                f"/{EXPERIMENTAL_SLASH_COMMAND_NAME} skill is missing or not owned",
            ))
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
            and _is_cli_command(
                configured_actions[0].get("command"), "slash-hook", executable
            )
            and configured_actions[0].get("timeout") == 600
        )
        if exact_hook:
            diagnostics.append(Diagnostic(
                "OK", f"/{EXPERIMENTAL_SLASH_COMMAND_NAME} hook: exactly one (600s)"
            ))
        else:
            diagnostics.append(Diagnostic(
                "ERROR",
                f"/{EXPERIMENTAL_SLASH_COMMAND_NAME} hook: expected one 600s hook "
                "in exactly one matcher",
            ))
        if (
            _platform.is_linux()
            and not shutil.which("tmux")
            and not shutil.which("gnome-terminal")
        ):
            diagnostics.append(Diagnostic(
                "WARN",
                "no supported interactive launcher is installed; install tmux or "
                "GNOME Terminal, or run claude-statusline configure directly",
            ))
        elif _platform.is_macos() and not shutil.which("tmux"):
            diagnostics.append(Diagnostic(
                "WARN",
                "no supported macOS interactive launcher is installed; install tmux "
                "and run Claude inside it, or run claude-statusline configure directly",
            ))

    runtime_dir = config_dir / "statusline_runtime"
    runtime_access = os.W_OK | (0 if _platform.is_windows() else os.X_OK)
    if runtime_dir.is_dir() and os.access(runtime_dir, runtime_access):
        diagnostics.append(Diagnostic("OK", f"runtime directory: {runtime_dir}"))
    else:
        diagnostics.append(Diagnostic("ERROR", f"runtime directory is not writable: {runtime_dir}"))
    if _platform.is_macos() and config_dir.is_dir():
        try:
            synced = _platform._sync_parent_directory(settings_path)
            diagnostics.append(Diagnostic(
                "OK" if synced else "WARN",
                "macOS parent-directory sync: " + (
                    "available" if synced else "unsupported; file sync and atomic replace remain enabled"
                ),
            ))
        except OSError as exc:
            diagnostics.append(Diagnostic("WARN", f"macOS parent-directory sync failed: {exc}"))
    return diagnostics
