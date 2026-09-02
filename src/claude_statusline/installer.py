"""Safe installation and diagnosis for the Claude Code status line."""

from __future__ import annotations

import copy
import datetime as dt
import fcntl
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from importlib import resources
from pathlib import Path

HOOK_EVENTS = (
    "SessionStart",
    "UserPromptSubmit",
    "Stop",
    "StopFailure",
    "SessionEnd",
)
SLASH_HOOK_EVENT = "UserPromptExpansion"
SLASH_COMMAND_NAME = "statusline-config"
MIN_FAST_SLASH_VERSION = (2, 1, 258)
SKILL_OWNER = "claude-code-statusline"
SKILL_OWNER_SCHEMA = 1
SKILL_RELATIVE_PATH = Path("skills") / SLASH_COMMAND_NAME / "SKILL.md"
SKILL_OWNER_RELATIVE_PATH = (
    Path("skills") / SLASH_COMMAND_NAME / ".claude-statusline-owner.json"
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
        value = shutil.which("claude-statusline") or ""
    if not value:
        raise ConfigurationError(
            "cannot find claude-statusline in PATH; install the package first"
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
    if subcommand not in ("render", "hook", "slash-hook"):
        raise ValueError(f"unsupported subcommand: {subcommand}")
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
        )
    except (OSError, subprocess.SubprocessError):
        return None
    match = re.search(r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)", result.stdout)
    if result.returncode != 0 or match is None:
        return None
    return tuple(int(value) for value in match.groups())


def supports_fast_slash_hook(version: tuple[int, int, int] | None) -> bool:
    return version is not None and version >= MIN_FAST_SLASH_VERSION


def skill_paths(config_dir: Path) -> tuple[Path, Path]:
    return (
        config_dir / SKILL_RELATIVE_PATH,
        config_dir / SKILL_OWNER_RELATIVE_PATH,
    )


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


def render_skill(executable: Path) -> bytes:
    try:
        template = (
            resources.files("claude_statusline")
            .joinpath("resources/statusline-config/SKILL.md")
            .read_text(encoding="utf-8")
        )
    except (FileNotFoundError, OSError) as exc:
        raise ConfigurationError(f"cannot load bundled statusline-config skill: {exc}") from exc
    shell_command = shlex.quote(str(executable))
    allowed_rule = json.dumps(
        f"Bash({shell_command} config *)", ensure_ascii=False
    )
    rendered = template.replace(
        "__CLAUDE_STATUSLINE_ALLOWED_RULE__", allowed_rule
    ).replace("__CLAUDE_STATUSLINE_COMMAND__", shell_command)
    if "__CLAUDE_STATUSLINE_" in rendered:
        raise ConfigurationError("bundled statusline-config skill has unresolved placeholders")
    return rendered.encode("utf-8")


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
    if executable is not None:
        return _normalized_path(argv[0]) == _normalized_path(executable)
    return Path(argv[0]).name == "claude-statusline"


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
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.claude-statusline-",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary_path = Path(temporary)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, path)
        temporary_path = None
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass


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
        try:
            path.unlink()
        except FileNotFoundError:
            return
    else:
        _atomic_write_bytes(path, value, mode=0o600)


@contextmanager
def _installation_lock(config_dir: Path):
    runtime_dir = config_dir / "statusline_runtime"
    runtime_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    _chmod_private(runtime_dir, 0o700)
    lock_path = runtime_dir / "install.lock"
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        os.fchmod(fd, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def _change_configuration(
    action: str,
    config_dir: Path,
    executable: Path,
    dry_run: bool,
    force: bool = False,
    fast_slash_hook: bool = False,
) -> ChangeResult:
    settings_path = config_dir / "settings.json"
    skill_path, owner_path = skill_paths(config_dir)

    def prepare():
        settings, settings_raw = _read_settings(settings_path)
        if action == "install":
            updated_settings = _prepare_install(
                settings,
                config_dir,
                executable,
                force,
                fast_slash_hook=fast_slash_hook,
            )
        else:
            updated_settings = _prepare_uninstall(
                settings, config_dir, executable
            )

        skill_raw = _read_optional_bytes(skill_path)
        owner_raw = _read_optional_bytes(owner_path)
        skill_owned = _is_owned_skill_marker(owner_raw)
        desired_skill: bytes | None | object = _UNCHANGED_ARTIFACT
        desired_owner: bytes | None | object = _UNCHANGED_ARTIFACT
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
        elif skill_owned:
            desired_skill = None
            desired_owner = None

        candidates = [
            (
                "settings.json",
                settings_path,
                settings_raw,
                _json_bytes(updated_settings),
                updated_settings != settings,
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
            try:
                skill_path.parent.rmdir()
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
    claude_version: tuple[int, int, int] | None | object = _DETECT_CLAUDE_VERSION,
) -> ChangeResult:
    if claude_version is _DETECT_CLAUDE_VERSION:
        claude_version = detect_claude_version()
    return _change_configuration(
        "install",
        config_dir,
        executable,
        dry_run,
        force,
        fast_slash_hook=supports_fast_slash_hook(claude_version),
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


def _slash_hook_count(settings: dict, executable: Path | None) -> int:
    if executable is None:
        return 0
    hooks = settings.get("hooks")
    groups = hooks.get(SLASH_HOOK_EVENT) if isinstance(hooks, dict) else None
    if not isinstance(groups, list):
        return 0
    count = 0
    for group in groups:
        if not isinstance(group, dict) or group.get("matcher") != SLASH_COMMAND_NAME:
            continue
        actions = group.get("hooks")
        if not isinstance(actions, list):
            continue
        count += sum(
            1
            for action in actions
            if isinstance(action, dict)
            and _is_cli_command(action.get("command"), "slash-hook", executable)
        )
    return count


def collect_diagnostics(
    config_dir: Path,
    executable: Path | None,
    *,
    claude_version: tuple[int, int, int] | None | object = _DETECT_CLAUDE_VERSION,
) -> list[Diagnostic]:
    diagnostics = []
    if sys.platform.startswith("linux"):
        diagnostics.append(Diagnostic("OK", f"platform: {sys.platform}"))
    else:
        diagnostics.append(Diagnostic("ERROR", "this release supports Linux only"))

    version = ".".join(map(str, sys.version_info[:3]))
    if sys.version_info >= (3, 10):  # noqa: UP036 - doctor reports the contract
        diagnostics.append(Diagnostic("OK", f"Python: {version}"))
    else:
        diagnostics.append(Diagnostic("ERROR", f"Python 3.10+ required; found {version}"))

    if executable is None:
        diagnostics.append(Diagnostic("ERROR", "claude-statusline is not in PATH"))
    elif executable.is_file() and os.access(executable, os.X_OK):
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
    mode = stat.S_IMODE(settings_path.stat().st_mode)
    if mode == 0o600:
        diagnostics.append(Diagnostic("OK", "settings permissions: 0600"))
    else:
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
            if executable is not None and _is_cli_command(command, "hook", executable)
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

    try:
        from . import display_config

        display_config.load_display_config(config_dir)
        display_path = display_config.config_path(config_dir)
        if display_path.exists():
            display_mode = stat.S_IMODE(display_path.stat().st_mode)
            if display_mode == 0o600:
                diagnostics.append(Diagnostic("OK", f"display config: {display_path}"))
            else:
                diagnostics.append(Diagnostic(
                    "WARN", f"display config permissions: {display_mode:04o}"
                ))
        else:
            diagnostics.append(Diagnostic("OK", "display config: built-in defaults"))
    except display_config.DisplayConfigError as exc:
        diagnostics.append(Diagnostic("ERROR", str(exc)))

    if claude_version is _DETECT_CLAUDE_VERSION:
        claude_version = detect_claude_version()
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

    runtime_dir = config_dir / "statusline_runtime"
    if runtime_dir.is_dir() and os.access(runtime_dir, os.W_OK | os.X_OK):
        diagnostics.append(Diagnostic("OK", f"runtime directory: {runtime_dir}"))
    else:
        diagnostics.append(Diagnostic("ERROR", f"runtime directory is not writable: {runtime_dir}"))
    return diagnostics
