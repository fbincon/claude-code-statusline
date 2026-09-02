"""Safe installation and diagnosis for the Claude Code status line."""

from __future__ import annotations

import copy
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import shlex
import shutil
import stat
import sys
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass


HOOK_EVENTS = (
    "SessionStart",
    "UserPromptSubmit",
    "Stop",
    "StopFailure",
    "SessionEnd",
)


class ConfigurationError(RuntimeError):
    """Raised when settings cannot be changed without losing user intent."""


@dataclass(frozen=True)
class ChangeResult:
    action: str
    changed: bool
    settings_path: Path
    backup_dir: Path | None = None


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
    if subcommand not in ("render", "hook"):
        raise ValueError(f"unsupported subcommand: {subcommand}")
    return f"{_quoted_executable(executable)} {subcommand}"


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
            owned = remove_cli and (
                _is_cli_command(command, "hook", executable)
                or _is_cli_command(command, "hook")
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

    updated["statusLine"] = {
        "type": "command",
        "command": command_for(executable, "render"),
        "refreshInterval": 1,
    }

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
    backup_dir = _unique_backup_dir(config_dir, action)
    if raw is None:
        target = backup_dir / "settings.json.absent"
        target.write_bytes(b"")
    else:
        target = backup_dir / "settings.json.before"
        target.write_bytes(raw)
    _chmod_private(target, 0o600)
    metadata = {
        "action": action,
        "created_at": dt.datetime.now().astimezone().isoformat(),
        "settings_path": str(settings_path),
    }
    metadata_path = backup_dir / "metadata.json"
    metadata_path.write_bytes(_json_bytes(metadata))
    _chmod_private(metadata_path, 0o600)
    return backup_dir


def _atomic_write_settings(settings_path: Path, settings: dict) -> None:
    settings_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix=".settings.claude-statusline-",
        suffix=".tmp",
        dir=settings_path.parent,
    )
    temporary_path = Path(temporary)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(_json_bytes(settings))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, settings_path)
        temporary_path = None
        directory_fd = os.open(settings_path.parent, os.O_RDONLY)
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
) -> ChangeResult:
    settings_path = config_dir / "settings.json"

    def prepare(settings: dict) -> dict:
        if action == "install":
            return _prepare_install(settings, config_dir, executable, force)
        return _prepare_uninstall(settings, config_dir, executable)

    if dry_run:
        settings, _ = _read_settings(settings_path)
        updated = prepare(settings)
        return ChangeResult(action, updated != settings, settings_path)

    config_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    with _installation_lock(config_dir):
        settings, raw = _read_settings(settings_path)
        updated = prepare(settings)
        if updated == settings:
            return ChangeResult(action, False, settings_path)
        backup_dir = _backup_settings(
            config_dir, settings_path, raw, action
        )
        _atomic_write_settings(settings_path, updated)
        _chmod_private(settings_path, 0o600)
        return ChangeResult(action, True, settings_path, backup_dir)


def install_configuration(
    config_dir: Path,
    executable: Path,
    *,
    dry_run: bool = False,
    force: bool = False,
) -> ChangeResult:
    return _change_configuration(
        "install", config_dir, executable, dry_run, force
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


def collect_diagnostics(
    config_dir: Path,
    executable: Path | None,
) -> list[Diagnostic]:
    diagnostics = []
    if sys.platform.startswith("linux"):
        diagnostics.append(Diagnostic("OK", f"platform: {sys.platform}"))
    else:
        diagnostics.append(Diagnostic("ERROR", "this release supports Linux only"))

    version = ".".join(map(str, sys.version_info[:3]))
    if sys.version_info >= (3, 10):
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
    interval = current.get("refreshInterval") if isinstance(current, dict) else None
    if (
        executable is not None
        and _is_cli_command(current_command, "render", executable)
        and interval == 1
    ):
        diagnostics.append(Diagnostic("OK", "statusLine command and refresh interval"))
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

    runtime_dir = config_dir / "statusline_runtime"
    if runtime_dir.is_dir() and os.access(runtime_dir, os.W_OK | os.X_OK):
        diagnostics.append(Diagnostic("OK", f"runtime directory: {runtime_dir}"))
    else:
        diagnostics.append(Diagnostic("ERROR", f"runtime directory is not writable: {runtime_dir}"))
    return diagnostics
