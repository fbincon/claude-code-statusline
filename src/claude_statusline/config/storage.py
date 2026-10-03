"""config / storage implementation."""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files


def _read_settings(settings_path: Path) -> tuple[dict, bytes | None]:
    try:
        raw = settings_path.read_bytes()
    except FileNotFoundError:
        return {}, None
    except OSError as exc:
        raise integration_models.ConfigurationError(
            f"cannot read {settings_path}: {exc}"
        ) from exc
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise integration_models.ConfigurationError(
            f"invalid JSON in {settings_path}: {exc}"
        ) from exc
    if not isinstance(data, dict):
        raise integration_models.ConfigurationError(
            f"{settings_path} must contain a JSON object"
        )
    return data, raw


def _json_bytes(settings: dict) -> bytes:
    return (json.dumps(settings, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _chmod_private(path: Path, mode: int) -> None:
    if not platform_environment.uses_posix_files():
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
        raise integration_models.ConfigurationError(
            f"cannot back up statusline configuration: {exc}"
        ) from exc


def _atomic_write_bytes(path: Path, content: bytes, mode: int = 0o600) -> None:
    platform_files.atomic_write_bytes(path, content, mode)


def _atomic_write_settings(settings_path: Path, settings: dict) -> None:
    _atomic_write_bytes(settings_path, _json_bytes(settings), mode=0o600)


def _read_optional_bytes(path: Path) -> bytes | None:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise integration_models.ConfigurationError(
            f"cannot read {path}: {exc}"
        ) from exc


def _write_optional_bytes(path: Path, value: bytes | None) -> None:
    if value is None:
        platform_files.durable_unlink(path)
    else:
        _atomic_write_bytes(path, value, mode=0o600)


def _installation_lock(config_dir: Path):
    runtime_dir = config_dir / "statusline_runtime"
    runtime_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    _chmod_private(runtime_dir, 0o700)
    lock_path = runtime_dir / "install.lock"
    return platform_files.exclusive_file_lock(lock_path)
