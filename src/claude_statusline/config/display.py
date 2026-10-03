"""config / display implementation."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any
from claude_statusline.platforms import files as platform_files


LEGACY_SCHEMA_VERSION = 1


SCHEMA_VERSION = 2


CONFIG_FILENAME = "claude-statusline.json"


# Catalog order keeps same-group items adjacent so wizard-appended items land
# next to their group anchors (groups join only when adjacent). DEFAULT_ITEMS
# below stays the legacy ten and is unaffected by this ordering.
ITEM_CATALOG = {
    "model-with-effort": "Current model identifier with reasoning effort",
    "fast-mode": "Indicates fast mode is active",
    "thinking": "Indicates extended thinking is enabled",
    "current-dir": "Current working directory",
    "project-name": "Project directory name",
    "hostname": "Local hostname",
    "git": "Git branch, divergence, and working-tree changes",
    "pr": "Open pull or merge request on the current branch",
    "repo": "Remote repository owner and name",
    "worktree": "Worktree name in --worktree sessions",
    "context-remaining": "Percentage of context window remaining",
    "context-used": "Percentage of context window used",
    "context-window-size": "Total context window size",
    "five-hour-limit": "Remaining five-hour usage limit",
    "weekly-limit": "Remaining seven-day usage limit",
    "spend-limit": "Remaining gateway spend limit",
    "tokens": "Cumulative cache hit, cache miss, and output tokens",
    "prompt-cache": "Prompt cache hit ratio and cached input tokens",
    "prompt-timer": "Elapsed time and outcome of the latest prompt",
    "version": "Claude Code version",
    "session": "Session name, or the session identifier prefix",
    "cost": "Session cost, session runtime, and line changes",
    "agent": "Agent name in --agent sessions",
    "vim-mode": "Current Vim mode",
}


LEGACY_DEFAULT_ITEMS = (
    "model-with-effort",
    "current-dir",
    "git",
    "context-remaining",
    "context-window-size",
    "five-hour-limit",
    "weekly-limit",
    "spend-limit",
    "tokens",
    "prompt-timer",
)


# New catalog items are opt-in: DEFAULT_ITEMS intentionally stays the legacy
# ten, so a machine without a display config renders exactly the 0.1.0/0.2.0
# status line. Users enable the newer items via /statusline-config.
DEFAULT_ITEMS = LEGACY_DEFAULT_ITEMS


SUBAGENT_ITEM_CATALOG = {
    "status-elapsed": "Task status icon combined with elapsed time",
    "status": "Task status icon",
    "name": "Agent name or normalized task type",
    "model-with-effort": "Agent model identifier with reasoning effort",
    "context-remaining": "Percentage of the agent context window remaining",
    "context-used": "Percentage of the agent context window used",
    "elapsed": "Elapsed time for this agent task",
    "task": "Dynamic task label or description",
    "tokens": "Agent task token count",
    "current-dir": "Agent working directory",
}


DEFAULT_SUBAGENT_ITEMS = (
    "status-elapsed",
    "name",
    "model-with-effort",
    "context-remaining",
    "task",
)


PALETTES = ("default", "ansi")


DIRECTORY_STYLES = ("full", "home", "project-relative", "basename")


SEPARATOR_STYLES = ("classic", "compact")


SCOPE_LABELS = ("off", "when-subagents", "always")


V1_DISPLAY_KEYS = frozenset(
    {
        "schema_version",
        "items",
        "use_colors",
        "palette",
        "directory_style",
        "separator_style",
    }
)


DISPLAY_KEYS = frozenset(
    {
        *V1_DISPLAY_KEYS,
        "scope_labels",
        "subagents",
    }
)


SUBAGENT_KEYS = frozenset({"enabled", "items"})


class DisplayConfigError(RuntimeError):
    """Raised when display configuration is invalid or cannot be stored."""


@dataclass(frozen=True)
class SubagentDisplayConfig:
    enabled: bool = True
    items: tuple[str, ...] = DEFAULT_SUBAGENT_ITEMS

    def to_dict(self) -> dict[str, Any]:
        return {"enabled": self.enabled, "items": list(self.items)}

    def with_updates(self, **updates: Any) -> SubagentDisplayConfig:
        return validate_subagent_config(replace(self, **updates).to_dict())


@dataclass(frozen=True)
class DisplayConfig:
    schema_version: int = SCHEMA_VERSION
    items: tuple[str, ...] = DEFAULT_ITEMS
    use_colors: bool = True
    palette: str = "default"
    directory_style: str = "full"
    separator_style: str = "classic"
    scope_labels: str = "when-subagents"
    subagents: SubagentDisplayConfig = field(default_factory=SubagentDisplayConfig)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "items": list(self.items),
            "use_colors": self.use_colors,
            "palette": self.palette,
            "directory_style": self.directory_style,
            "separator_style": self.separator_style,
            "scope_labels": self.scope_labels,
            "subagents": self.subagents.to_dict(),
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


def validate_subagent_items(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise DisplayConfigError("subagents.items must be an array of item identifiers")
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise DisplayConfigError("every subagents.items entry must be a string")
        if item not in SUBAGENT_ITEM_CATALOG:
            raise DisplayConfigError(f"unknown subagent status line item: {item}")
        if item in seen:
            raise DisplayConfigError(f"duplicate subagent status line item: {item}")
        seen.add(item)
        result.append(item)
    if "status-elapsed" in result and ("status" in result or "elapsed" in result):
        raise DisplayConfigError(
            "subagents.items cannot combine status-elapsed with status or elapsed"
        )
    return tuple(result)


def validate_subagent_config(data: Any) -> SubagentDisplayConfig:
    if not isinstance(data, dict):
        raise DisplayConfigError("subagents must contain a JSON object")
    unknown = sorted(set(data) - SUBAGENT_KEYS)
    if unknown:
        raise DisplayConfigError("unknown subagents field(s): " + ", ".join(unknown))
    missing = sorted(SUBAGENT_KEYS - set(data))
    if missing:
        raise DisplayConfigError("missing subagents field(s): " + ", ".join(missing))
    enabled = data.get("enabled")
    if not isinstance(enabled, bool):
        raise DisplayConfigError("subagents.enabled must be true or false")
    return SubagentDisplayConfig(
        enabled=enabled,
        items=validate_subagent_items(data.get("items")),
    )


def validate_display_config(data: Any) -> DisplayConfig:
    if not isinstance(data, dict):
        raise DisplayConfigError("display configuration must contain a JSON object")
    version = data.get("schema_version")
    if isinstance(version, bool) or not isinstance(version, int):
        raise DisplayConfigError(
            f"schema_version must be 1 or {SCHEMA_VERSION}; found {version!r}"
        )
    if version > SCHEMA_VERSION:
        raise DisplayConfigError(
            f"schema_version {version} is newer than supported version {SCHEMA_VERSION}"
        )
    if version not in (LEGACY_SCHEMA_VERSION, SCHEMA_VERSION):
        raise DisplayConfigError(
            f"schema_version must be 1 or {SCHEMA_VERSION}; found {version!r}"
        )

    expected_keys = (
        V1_DISPLAY_KEYS if version == LEGACY_SCHEMA_VERSION else DISPLAY_KEYS
    )
    unknown = sorted(set(data) - expected_keys)
    if unknown:
        raise DisplayConfigError(
            "unknown display configuration field(s): " + ", ".join(unknown)
        )
    missing = sorted(expected_keys - set(data))
    if missing:
        raise DisplayConfigError(
            "missing display configuration field(s): " + ", ".join(missing)
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
        scope_labels=(
            "when-subagents"
            if version == LEGACY_SCHEMA_VERSION
            else _require_string_choice(data, "scope_labels", SCOPE_LABELS)
        ),
        subagents=(
            SubagentDisplayConfig()
            if version == LEGACY_SCHEMA_VERSION
            else validate_subagent_config(data.get("subagents"))
        ),
    )


class _DuplicateKeyError(ValueError):
    pass


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise _DuplicateKeyError(f"duplicate JSON field: {key}")
        result[key] = value
    return result


def parse_display_config_bytes(
    raw: bytes, path: Path | str
) -> tuple[DisplayConfig, int]:
    try:
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=_strict_object)
    except (UnicodeDecodeError, json.JSONDecodeError, _DuplicateKeyError) as exc:
        raise DisplayConfigError(f"invalid JSON in {path}: {exc}") from exc
    config = validate_display_config(data)
    return config, int(data["schema_version"])


def read_display_config(config_dir: Path) -> tuple[DisplayConfig, bytes | None]:
    path = config_path(config_dir)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return DEFAULT_CONFIG, None
    except OSError as exc:
        raise DisplayConfigError(f"cannot read {path}: {exc}") from exc
    config, _source_schema = parse_display_config_bytes(raw, path)
    return config, raw


def read_display_config_schema(config_dir: Path) -> int | None:
    """Return the on-disk schema without changing a migratable v1 file."""
    path = config_path(config_dir)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise DisplayConfigError(f"cannot read {path}: {exc}") from exc
    _config, source_schema = parse_display_config_bytes(raw, path)
    return source_schema


def load_display_config(config_dir: Path) -> DisplayConfig:
    config, _ = read_display_config(config_dir)
    return config


def display_config_bytes(config: DisplayConfig) -> bytes:
    return (json.dumps(config.to_dict(), ensure_ascii=False, indent=2) + "\n").encode(
        "utf-8"
    )


def atomic_write_bytes(path: Path, content: bytes, mode: int = 0o600) -> None:
    try:
        platform_files.atomic_write_bytes(path, content, mode)
    except OSError as exc:
        raise DisplayConfigError(f"cannot write {path}: {exc}") from exc


def write_display_config(config_dir: Path, config: DisplayConfig) -> None:
    atomic_write_bytes(config_path(config_dir), display_config_bytes(config))


def restore_bytes(path: Path, raw: bytes | None, mode: int = 0o600) -> None:
    if raw is None:
        try:
            platform_files.durable_unlink(path)
        except OSError as exc:
            raise DisplayConfigError(
                f"cannot restore absence of {path}: {exc}"
            ) from exc
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
