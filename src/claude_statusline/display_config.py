"""Strict, user-owned display configuration for the status line."""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
CONFIG_FILENAME = "claude-statusline.json"

ITEM_CATALOG = {
    "model-with-effort": "Current model identifier with reasoning effort",
    "current-dir": "Current working directory",
    "git": "Git branch, divergence, and working-tree changes",
    "context-remaining": "Percentage of context window remaining",
    "context-window-size": "Total context window size",
    "five-hour-limit": "Remaining five-hour usage limit",
    "weekly-limit": "Remaining seven-day usage limit",
    "spend-limit": "Remaining gateway spend limit",
    "tokens": "Cumulative cache hit, cache miss, and output tokens",
    "prompt-timer": "Elapsed time and outcome of the latest prompt",
}

DEFAULT_ITEMS = tuple(ITEM_CATALOG)
PALETTES = ("default", "ansi")
DIRECTORY_STYLES = ("full", "home", "project-relative", "basename")
SEPARATOR_STYLES = ("classic", "compact")
DISPLAY_KEYS = frozenset(
    {
        "schema_version",
        "items",
        "use_colors",
        "palette",
        "directory_style",
        "separator_style",
    }
)


class DisplayConfigError(RuntimeError):
    """Raised when display configuration is invalid or cannot be stored."""


@dataclass(frozen=True)
class DisplayConfig:
    schema_version: int = SCHEMA_VERSION
    items: tuple[str, ...] = DEFAULT_ITEMS
    use_colors: bool = True
    palette: str = "default"
    directory_style: str = "full"
    separator_style: str = "classic"

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "items": list(self.items),
            "use_colors": self.use_colors,
            "palette": self.palette,
            "directory_style": self.directory_style,
            "separator_style": self.separator_style,
        }

    def with_updates(self, **updates: Any) -> DisplayConfig:
        return validate_display_config(replace(self, **updates).to_dict())


DEFAULT_CONFIG = DisplayConfig()


def config_path(config_dir: Path) -> Path:
    return config_dir / CONFIG_FILENAME


def _require_string_choice(
    data: dict[str, Any], key: str, choices: tuple[str, ...]
) -> str:
    value = data.get(key)
    if not isinstance(value, str) or value not in choices:
        allowed = ", ".join(choices)
        raise DisplayConfigError(f"{key} must be one of: {allowed}")
    return value


def validate_items(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise DisplayConfigError("items must be an array of item identifiers")
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise DisplayConfigError("every items entry must be a string")
        if item not in ITEM_CATALOG:
            raise DisplayConfigError(f"unknown status line item: {item}")
        if item in seen:
            raise DisplayConfigError(f"duplicate status line item: {item}")
        seen.add(item)
        result.append(item)
    return tuple(result)


def validate_display_config(data: Any) -> DisplayConfig:
    if not isinstance(data, dict):
        raise DisplayConfigError("display configuration must contain a JSON object")
    unknown = sorted(set(data) - DISPLAY_KEYS)
    if unknown:
        raise DisplayConfigError(
            "unknown display configuration field(s): " + ", ".join(unknown)
        )
    missing = sorted(DISPLAY_KEYS - set(data))
    if missing:
        raise DisplayConfigError(
            "missing display configuration field(s): " + ", ".join(missing)
        )

    version = data.get("schema_version")
    if isinstance(version, bool) or version != SCHEMA_VERSION:
        raise DisplayConfigError(
            f"schema_version must be {SCHEMA_VERSION}; found {version!r}"
        )
    use_colors = data.get("use_colors")
    if not isinstance(use_colors, bool):
        raise DisplayConfigError("use_colors must be true or false")

    return DisplayConfig(
        schema_version=SCHEMA_VERSION,
        items=validate_items(data.get("items")),
        use_colors=use_colors,
        palette=_require_string_choice(data, "palette", PALETTES),
        directory_style=_require_string_choice(
            data, "directory_style", DIRECTORY_STYLES
        ),
        separator_style=_require_string_choice(
            data, "separator_style", SEPARATOR_STYLES
        ),
    )


def read_display_config(config_dir: Path) -> tuple[DisplayConfig, bytes | None]:
    path = config_path(config_dir)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return DEFAULT_CONFIG, None
    except OSError as exc:
        raise DisplayConfigError(f"cannot read {path}: {exc}") from exc
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DisplayConfigError(f"invalid JSON in {path}: {exc}") from exc
    return validate_display_config(data), raw


def load_display_config(config_dir: Path) -> DisplayConfig:
    config, _ = read_display_config(config_dir)
    return config


def display_config_bytes(config: DisplayConfig) -> bytes:
    return (json.dumps(config.to_dict(), ensure_ascii=False, indent=2) + "\n").encode(
        "utf-8"
    )


def atomic_write_bytes(path: Path, content: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary_path: Path | None = Path(temporary)
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
    except OSError as exc:
        raise DisplayConfigError(f"cannot write {path}: {exc}") from exc
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass


def write_display_config(config_dir: Path, config: DisplayConfig) -> None:
    atomic_write_bytes(config_path(config_dir), display_config_bytes(config))


def restore_bytes(path: Path, raw: bytes | None, mode: int = 0o600) -> None:
    if raw is None:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        except OSError as exc:
            raise DisplayConfigError(f"cannot restore absence of {path}: {exc}") from exc
        return
    atomic_write_bytes(path, raw, mode=mode)


def format_directory(
    value: str,
    style: str,
    *,
    project_dir: str | None = None,
) -> str:
    """Format a directory without resolving symlinks or requiring it to exist."""
    path = Path(value)
    if style == "full":
        return value
    if style == "basename":
        return path.name or path.anchor or value
    if style == "home":
        try:
            relative = path.relative_to(Path.home())
        except (ValueError, OSError):
            return value
        return "~" if not relative.parts else f"~/{relative.as_posix()}"
    if style == "project-relative" and project_dir:
        try:
            relative = path.relative_to(Path(project_dir))
        except ValueError:
            return value
        return "." if not relative.parts else relative.as_posix()
    return value
