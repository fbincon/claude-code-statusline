"""config / display implementation."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any
from claude_statusline.platforms import files as platform_files
from claude_statusline.config import catalog
from claude_statusline.config import formatting as display_formatting


LEGACY_SCHEMA_VERSION = 1


SCHEMA_VERSION = 3


CONFIG_FILENAME = "claude-statusline.json"


# Legacy dictionaries are derived compatibility views of the single catalog.
ITEM_CATALOG = catalog.descriptions("main")
LEGACY_DEFAULT_ITEMS = catalog.default_items("main")
DEFAULT_ITEMS = LEGACY_DEFAULT_ITEMS
SUBAGENT_ITEM_CATALOG = catalog.descriptions("subagent")
DEFAULT_SUBAGENT_ITEMS = catalog.default_items("subagent")


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


V2_DISPLAY_KEYS = frozenset(
    {
        *V1_DISPLAY_KEYS,
        "scope_labels",
        "subagents",
    }
)


DISPLAY_KEYS = V2_DISPLAY_KEYS | {"formatting", "item_options", "layout"}

SUBAGENT_KEYS = frozenset(
    {
        "enabled",
        "items",
        "item_options",
        "visibility",
        "hide_completed",
        "row_limit",
        "task_max_width",
    }
)


class DisplayConfigError(RuntimeError):
    """Raised when display configuration is invalid or cannot be stored."""


@dataclass(frozen=True)
class SubagentDisplayConfig:
    enabled: bool = True
    items: tuple[str, ...] = DEFAULT_SUBAGENT_ITEMS

    item_options: dict[str, display_formatting.ItemOptions] = field(
        default_factory=dict
    )
    visibility: str = "all"
    hide_completed: bool = False
    row_limit: int | None = None
    task_max_width: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "items": list(self.items),
            "item_options": {k: v.to_dict() for k, v in self.item_options.items()},
            "visibility": self.visibility,
            "hide_completed": self.hide_completed,
            "row_limit": self.row_limit,
            "task_max_width": self.task_max_width,
        }

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

    formatting: display_formatting.Formatting = field(
        default_factory=display_formatting.Formatting
    )
    item_options: dict[str, display_formatting.ItemOptions] = field(
        default_factory=dict
    )
    layout: display_formatting.Layout = field(default_factory=display_formatting.Layout)

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
            "formatting": self.formatting.to_dict(),
            "item_options": {k: v.to_dict() for k, v in self.item_options.items()},
            "layout": self.layout.to_dict(),
        }

    def with_updates(self, **updates: Any) -> DisplayConfig:
        if "items" in updates and "layout" not in updates:
            updates["layout"] = self.layout.reordered(updates["items"])
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
    if catalog.conflicts("subagent", result):
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
    try:
        if (
            data["visibility"] not in ("all", "running")
            or type(data["hide_completed"]) is not bool
        ):
            raise ValueError(
                "subagent visibility must be all/running and hide_completed a boolean"
            )
        return SubagentDisplayConfig(
            enabled=enabled,
            items=validate_subagent_items(data.get("items")),
            item_options=display_formatting.item_options(
                data["item_options"], SUBAGENT_ITEM_CATALOG
            ),
            visibility=data["visibility"],
            hide_completed=data["hide_completed"],
            row_limit=display_formatting.integer(
                data["row_limit"], 0, 10000, "row_limit", nullable=True
            ),
            task_max_width=display_formatting.integer(
                data["task_max_width"], 2, 10000, "task_max_width", nullable=True
            ),
        )
    except ValueError as exc:
        raise DisplayConfigError(str(exc)) from exc


def validate_display_config(data: Any) -> DisplayConfig:
    if not isinstance(data, dict):
        raise DisplayConfigError("display configuration must contain a JSON object")
    version = data.get("schema_version")
    if isinstance(version, bool) or not isinstance(version, int):
        raise DisplayConfigError(
            f"schema_version must be 1, 2 or {SCHEMA_VERSION}; found {version!r}"
        )
    if version > SCHEMA_VERSION:
        raise DisplayConfigError(
            f"schema_version {version} is newer than supported version {SCHEMA_VERSION}"
        )
    if version not in (1, 2, SCHEMA_VERSION):
        raise DisplayConfigError(
            f"schema_version must be 1, 2 or {SCHEMA_VERSION}; found {version!r}"
        )

    expected_keys = (
        V1_DISPLAY_KEYS
        if version == 1
        else V2_DISPLAY_KEYS
        if version == 2
        else DISPLAY_KEYS
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

    items = validate_items(data.get("items"))
    try:
        fmt = (
            display_formatting.Formatting.parse(data["formatting"])
            if version == 3
            else display_formatting.Formatting()
        )
        options = (
            display_formatting.item_options(data["item_options"], ITEM_CATALOG)
            if version == 3
            else {}
        )
        layout = (
            display_formatting.Layout.parse(data["layout"], items)
            if version == 3
            else display_formatting.Layout()
        )
    except ValueError as exc:
        raise DisplayConfigError(str(exc)) from exc
    subagents = data.get("subagents")
    if version == 2:
        if not isinstance(subagents, dict) or set(subagents) != {"enabled", "items"}:
            raise DisplayConfigError("v2 subagents requires exactly enabled and items")
        subagents = {**SubagentDisplayConfig().to_dict(), **subagents}
    return DisplayConfig(
        formatting=fmt,
        item_options=options,
        layout=layout,
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
            else validate_subagent_config(subagents)
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
