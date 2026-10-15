"""config / display implementation."""

from __future__ import annotations

from . import instances as composition

from claude_statusline.i18n import message as msg, as_message
from claude_statusline.i18n.registry import LANGUAGES as STATUSLINE_LANGUAGES

import json
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any
from claude_statusline.platforms import files as platform_files
from claude_statusline.config import catalog, appearance
from claude_statusline.config.metrics import Metrics
from claude_statusline.config import formatting as display_formatting


LEGACY_SCHEMA_VERSION = 1


SCHEMA_VERSION = 8


CONFIG_FILENAME = "claude-statusline.json"


# Legacy dictionaries are derived compatibility views of the single catalog.
ITEM_CATALOG = {
    k: v
    for k, v in catalog.descriptions("main").items()
    if k not in composition.NODE_TYPES
}
LEGACY_DEFAULT_ITEMS = catalog.default_items("main")
DEFAULT_ITEMS = LEGACY_DEFAULT_ITEMS
SUBAGENT_ITEM_CATALOG = {
    k: v
    for k, v in catalog.descriptions("subagent").items()
    if k not in composition.NODE_TYPES
}
DEFAULT_SUBAGENT_ITEMS = catalog.default_items("subagent")


PALETTES = ("default", "ansi")


DIRECTORY_STYLES = ("full", "home", "project-relative", "basename")


SEPARATOR_STYLES = ("classic", "compact", "powerline")


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


V3_DISPLAY_KEYS = V2_DISPLAY_KEYS | {"formatting", "item_options", "layout"}
V5_DISPLAY_KEYS = V3_DISPLAY_KEYS | {"metrics"}
V6_DISPLAY_KEYS = V5_DISPLAY_KEYS | {"statusline_language"}
V7_DISPLAY_KEYS = V6_DISPLAY_KEYS | {"theme", "powerline_glyph"}
DISPLAY_KEYS = (V7_DISPLAY_KEYS - {"items", "item_options"}) | {"instances"}

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
    items: tuple[str, ...] | None = None
    instances: tuple[composition.DisplayInstance, ...] | None = None

    item_options: dict[str, display_formatting.ItemOptions] | None = None
    visibility: str = "all"
    hide_completed: bool = False
    row_limit: int | None = None
    task_max_width: int | None = None

    def __post_init__(self):
        _initialize_instances(self, "subagent", DEFAULT_SUBAGENT_ITEMS)

    def to_dict(self) -> dict[str, Any]:
        value = self.legacy_dict()
        value.pop("items")
        value.pop("item_options")
        value["instances"] = [i.to_dict() for i in self.instances]
        return value

    def legacy_dict(self) -> dict[str, Any]:
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
        return _with_updates(self, "subagent", updates)


@dataclass(frozen=True)
class DisplayConfig:
    schema_version: int = SCHEMA_VERSION
    items: tuple[str, ...] | None = None
    instances: tuple[composition.DisplayInstance, ...] | None = None
    use_colors: bool = True
    palette: str = "default"
    directory_style: str = "full"
    separator_style: str = "classic"
    scope_labels: str = "when-subagents"
    statusline_language: str = "en"
    theme: str = "classic"
    powerline_glyph: str = "ascii"
    subagents: SubagentDisplayConfig = field(default_factory=SubagentDisplayConfig)

    formatting: display_formatting.Formatting = field(
        default_factory=display_formatting.Formatting
    )
    item_options: dict[str, display_formatting.ItemOptions] | None = None
    layout: display_formatting.Layout = field(default_factory=display_formatting.Layout)
    metrics: Metrics = field(default_factory=Metrics)

    def __post_init__(self):
        legacy = self.instances is None
        _initialize_instances(self, "main", DEFAULT_ITEMS)
        if legacy and self.layout.mode == "explicit":
            object.__setattr__(
                self,
                "layout",
                self.layout.reordered(tuple(i.id for i in self.instances)),
            )

    def to_dict(self) -> dict[str, Any]:
        value = self.legacy_dict()
        value.pop("items")
        value.pop("item_options")
        value["instances"] = [i.to_dict() for i in self.instances]
        value["subagents"] = self.subagents.to_dict()
        return value

    def legacy_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "items": list(self.items),
            "use_colors": self.use_colors,
            "palette": self.palette,
            "directory_style": self.directory_style,
            "separator_style": self.separator_style,
            "scope_labels": self.scope_labels,
            "statusline_language": self.statusline_language,
            "theme": self.theme,
            "powerline_glyph": self.powerline_glyph,
            "subagents": self.subagents.legacy_dict(),
            "formatting": self.formatting.to_dict(),
            "item_options": {k: v.to_dict() for k, v in self.item_options.items()},
            "layout": self.layout.to_dict(),
            "metrics": self.metrics.to_dict(),
        }

    def with_updates(self, **updates: Any) -> DisplayConfig:
        return _with_updates(self, "main", updates)


def _initialize_instances(config, scope, defaults):
    if config.instances is None:
        nodes = composition.legacy_instances(
            scope,
            defaults if config.items is None else config.items,
            config.item_options or {},
        )
    else:
        nodes = config.instances
        items, options = composition.projections(nodes)
        if config.items is not None and config.items != items:
            nodes = composition.update_projection(nodes, scope, items=config.items)
        if config.item_options is not None and config.item_options != options:
            nodes = composition.update_projection(
                nodes, scope, options=config.item_options
            )
    object.__setattr__(config, "instances", tuple(nodes))
    items, options = composition.projections(nodes)
    object.__setattr__(config, "items", items)
    object.__setattr__(config, "item_options", options)


def _with_updates(config, scope, updates):
    updates = dict(updates)
    nodes = updates.pop("instances", config.instances)
    try:
        nodes = composition.update_projection(
            nodes, scope, updates.pop("items", None), updates.pop("item_options", None)
        )
    except ValueError as exc:
        raise DisplayConfigError(as_message(exc)) from exc
    if scope == "main" and "layout" not in updates:
        updates["layout"] = composition.reconcile_rows(config.layout, nodes)
    if scope == "main" and "layout" in updates:
        requested = updates["layout"]
        enabled = tuple(i.id for i in nodes if i.enabled)
        flat = tuple(i for row in requested.rows for i in row)
        if requested.mode == "explicit" and flat == enabled:
            updates["layout"] = requested.reordered(tuple(i.id for i in nodes))
    candidate = replace(
        config, instances=nodes, items=None, item_options=None, **updates
    )
    return (
        validate_display_config(candidate.to_dict())
        if scope == "main"
        else _validate_subagent_v8(candidate.to_dict())
    )


DEFAULT_CONFIG = DisplayConfig()


def config_path(config_dir: Path) -> Path:
    return config_dir / CONFIG_FILENAME


def _require_string_choice(
    data: dict[str, Any], key: str, choices: tuple[str, ...]
) -> str:
    value = data.get(key)
    if not isinstance(value, str) or value not in choices:
        allowed = ", ".join(choices)
        raise DisplayConfigError(
            msg("errors.display.must_be_one_of", field=key, allowed=allowed)
        )
    return value


def validate_items(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise DisplayConfigError(msg("errors.display.items_must_be_an_array_of_item"))
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise DisplayConfigError(
                msg("errors.display.every_items_entry_must_be_a_string")
            )
        item = catalog.canonical_item(item)
        if item not in ITEM_CATALOG:
            raise DisplayConfigError(
                msg("errors.display.unknown_status_line_item", item=item)
            )
        if item in seen:
            raise DisplayConfigError(
                msg("errors.display.duplicate_status_line_item", item=item)
            )
        seen.add(item)
        result.append(item)
    return tuple(result)


def validate_subagent_items(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise DisplayConfigError(
            msg("errors.display.subagents_items_must_be_an_array_of")
        )
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise DisplayConfigError(
                msg("errors.display.every_subagents_items_entry_must_be_a")
            )
        if item not in SUBAGENT_ITEM_CATALOG:
            raise DisplayConfigError(
                msg("errors.display.unknown_subagent_status_line_item", item=item)
            )
        if item in seen:
            raise DisplayConfigError(
                msg("errors.display.duplicate_subagent_status_line_item", item=item)
            )
        seen.add(item)
        result.append(item)
    if catalog.conflicts("subagent", result):
        raise DisplayConfigError(
            msg("errors.display.subagents_items_cannot_combine_status_elapsed_with")
        )
    return tuple(result)


def validate_subagent_config(data: Any, *, legacy=False) -> SubagentDisplayConfig:
    if not isinstance(data, dict):
        raise DisplayConfigError(
            msg("errors.display.subagents_must_contain_a_json_object")
        )
    unknown = sorted(set(data) - SUBAGENT_KEYS)
    if unknown:
        raise DisplayConfigError(
            msg("errors.display.unknown_subagents_field_s", value0=", ".join(unknown))
        )
    missing = sorted(SUBAGENT_KEYS - set(data))
    if missing:
        raise DisplayConfigError(
            msg("errors.display.missing_subagents_field_s", value0=", ".join(missing))
        )
    enabled = data.get("enabled")
    if not isinstance(enabled, bool):
        raise DisplayConfigError(
            msg("errors.display.subagents_enabled_must_be_true_or_false")
        )
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
                data["item_options"], SUBAGENT_ITEM_CATALOG, "subagent", legacy=legacy
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
        raise DisplayConfigError(as_message(exc)) from exc


def _validate_legacy_display(data: Any) -> DisplayConfig:
    if not isinstance(data, dict):
        raise DisplayConfigError(
            msg("errors.display.display_configuration_must_contain_a_json_object")
        )
    version = data.get("schema_version")
    if isinstance(version, bool) or not isinstance(version, int):
        raise DisplayConfigError(
            msg(
                "errors.display.schema_version_must_be_1_2_3",
                SCHEMA_VERSION=SCHEMA_VERSION,
                version=f"{version!r}",
            )
        )
    if version > 7:
        raise DisplayConfigError(
            msg(
                "errors.display.schema_version_is_newer_than_supported_version",
                version=version,
                SCHEMA_VERSION=SCHEMA_VERSION,
            )
        )
    if version not in (1, 2, 3, 4, 5, 6, 7):
        raise DisplayConfigError(
            msg(
                "errors.display.schema_version_must_be_1_2_3",
                SCHEMA_VERSION=SCHEMA_VERSION,
                version=f"{version!r}",
            )
        )

    expected_keys = (
        V1_DISPLAY_KEYS
        if version == 1
        else V2_DISPLAY_KEYS
        if version == 2
        else V3_DISPLAY_KEYS
        if version == 3
        else V5_DISPLAY_KEYS
        if version in (4, 5)
        else V6_DISPLAY_KEYS
        if version == 6
        else V7_DISPLAY_KEYS
    )
    unknown = sorted(set(data) - expected_keys)
    if unknown:
        raise DisplayConfigError(
            msg(
                "errors.display.unknown_display_configuration_field_s",
                value0=", ".join(unknown),
            )
        )
    missing = sorted(expected_keys - set(data))
    if missing:
        raise DisplayConfigError(
            msg(
                "errors.display.missing_display_configuration_field_s",
                value0=", ".join(missing),
            )
        )

    use_colors = data.get("use_colors")
    if not isinstance(use_colors, bool):
        raise DisplayConfigError(msg("errors.display.use_colors_must_be_true_or_false"))

    data = dict(data)
    # Normalize aliases everywhere before validating uniqueness and references.
    raw_items = data.get("items")
    if isinstance(raw_items, list):
        data["items"] = [
            catalog.canonical_item(item) if isinstance(item, str) else item
            for item in raw_items
        ]
    options = data.get("item_options")
    if isinstance(options, dict):
        canonical = {}
        for key, value in options.items():
            name = catalog.canonical_item(key)
            if name in canonical:
                raise DisplayConfigError(
                    msg("errors.display.conflicting_item_aliases_in_item_options")
                )
            canonical[name] = value
        data["item_options"] = canonical
    layout = data.get("layout")
    if isinstance(layout, dict) and isinstance(layout.get("rows"), list):
        data["layout"] = {
            **layout,
            "rows": [
                [
                    catalog.canonical_item(item) if isinstance(item, str) else item
                    for item in row
                ]
                if isinstance(row, list)
                else row
                for row in layout["rows"]
            ],
        }
    items = validate_items(data.get("items"))
    try:
        fmt = (
            display_formatting.Formatting.parse(data["formatting"])
            if version >= 3
            else display_formatting.Formatting()
        )
        options = (
            display_formatting.item_options(
                data["item_options"], ITEM_CATALOG, legacy=version < 7
            )
            if version >= 3
            else {}
        )
        layout = (
            display_formatting.Layout.parse(data["layout"], items)
            if version >= 3
            else display_formatting.Layout()
        )
        metrics = Metrics.parse(data["metrics"]) if version >= 4 else Metrics()
    except ValueError as exc:
        raise DisplayConfigError(as_message(exc)) from exc
    subagents = data.get("subagents")
    if version == 2:
        if not isinstance(subagents, dict) or set(subagents) != {"enabled", "items"}:
            raise DisplayConfigError(
                msg("errors.display.v2_subagents_requires_exactly_enabled_and_items")
            )
        subagents = {**SubagentDisplayConfig().legacy_dict(), **subagents}
    return DisplayConfig(
        formatting=fmt,
        item_options=options,
        layout=layout,
        metrics=metrics,
        schema_version=SCHEMA_VERSION,
        theme=_require_string_choice(data, "theme", appearance.THEMES)
        if version >= 7
        else "classic",
        powerline_glyph=_require_string_choice(
            data, "powerline_glyph", appearance.POWERLINE_GLYPHS
        )
        if version >= 7
        else "ascii",
        statusline_language=(
            _require_string_choice(data, "statusline_language", STATUSLINE_LANGUAGES)
            if version >= 6
            else "en"
        ),
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
            else validate_subagent_config(subagents, legacy=version < 7)
        ),
    )


def _validate_subagent_v8(data):
    try:
        display_formatting.exact(
            data,
            (SUBAGENT_KEYS - {"items", "item_options"}) | {"instances"},
            "subagents",
        )
        nodes = composition.parse_instances(data["instances"], "subagent")
        # Reuse scalar validation without projecting instances into type selections.
        scalars = {**data, "items": [], "item_options": {}}
        scalars.pop("instances")
        parsed = validate_subagent_config(scalars)
        return replace(parsed, instances=nodes, items=None, item_options=None)
    except ValueError as exc:
        raise DisplayConfigError(as_message(exc)) from exc


def validate_display_config(data: Any) -> DisplayConfig:
    if (
        not isinstance(data, dict)
        or type(data.get("schema_version")) is not int
        or data.get("schema_version") != SCHEMA_VERSION
    ):
        return _validate_legacy_display(data)
    try:
        display_formatting.exact(data, DISPLAY_KEYS, "display")
        nodes = composition.parse_instances(data["instances"], "main")
        layout = display_formatting.Layout.parse(
            data["layout"], tuple(i.id for i in nodes)
        )
        by_id = {i.id: i for i in nodes}
        if layout.mode == "auto" and any(i.type_id == "spacer" for i in nodes):
            raise ValueError(msg("composition.errors.main_spacer"))
        if any(
            sum(by_id[i].type_id == "spacer" for i in row) > 1 for row in layout.rows
        ):
            raise ValueError(msg("composition.errors.row_spacer"))
        subagents = _validate_subagent_v8(data["subagents"])
        scalar_data = {
            **data,
            "schema_version": 7,
            "items": [],
            "item_options": {},
            "layout": {"mode": "auto", "rows": []},
            "subagents": SubagentDisplayConfig().legacy_dict(),
        }
        scalar_data.pop("instances")
        parsed = _validate_legacy_display(scalar_data)
        return replace(
            parsed,
            instances=nodes,
            items=None,
            item_options=None,
            layout=layout,
            subagents=subagents,
        )
    except ValueError as exc:
        raise DisplayConfigError(as_message(exc)) from exc


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
        raise DisplayConfigError(
            msg("errors.display.invalid_json_in", path=path, exc=exc)
        ) from exc
    config = validate_display_config(data)
    return config, int(data["schema_version"])


def read_display_config(config_dir: Path) -> tuple[DisplayConfig, bytes | None]:
    path = config_path(config_dir)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return DEFAULT_CONFIG, None
    except OSError as exc:
        raise DisplayConfigError(
            msg("errors.display.cannot_read", path=path, exc=exc)
        ) from exc
    config, _source_schema = parse_display_config_bytes(raw, path)
    return config, raw


def read_display_config_schema(config_dir: Path) -> int | None:
    """Return the on-disk schema without rewriting a supported legacy file."""
    path = config_path(config_dir)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise DisplayConfigError(
            msg("errors.display.cannot_read", path=path, exc=exc)
        ) from exc
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
        raise DisplayConfigError(
            msg("errors.display.cannot_write", path=path, exc=exc)
        ) from exc


def write_display_config(config_dir: Path, config: DisplayConfig) -> None:
    atomic_write_bytes(config_path(config_dir), display_config_bytes(config))


def restore_bytes(path: Path, raw: bytes | None, mode: int = 0o600) -> None:
    if raw is None:
        try:
            platform_files.durable_unlink(path)
        except OSError as exc:
            raise DisplayConfigError(
                msg("errors.display.cannot_restore_absence_of", path=path, exc=exc)
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
