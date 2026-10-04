"""Independent native-editor preference; absence follows the release default."""

from __future__ import annotations

import json
from pathlib import Path

from claude_statusline._version import __version__
from claude_statusline.config import storage
from claude_statusline.config.editor_defaults import enabled_by_default
from claude_statusline.integration.models import ConfigurationError

FILENAME = "claude-statusline-native.json"


def preference_path(config_dir: Path) -> Path:
    return config_dir / FILENAME


def parse(raw: bytes) -> bool:
    def object_pairs(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError("duplicate native preference field")
            value[key] = item
        return value

    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=object_pairs)
        if (
            not isinstance(value, dict)
            or set(value) != {"schema_version", "native_editor"}
            or type(value["schema_version"]) is not int
            or value["schema_version"] != 1
            or type(value["native_editor"]) is not bool
        ):
            raise ValueError("expected schema_version 1 and a native_editor boolean")
        return value["native_editor"]
    except (UnicodeError, ValueError) as exc:
        raise ConfigurationError(f"Invalid {FILENAME}: {exc}") from exc


def preference_bytes(enabled: bool) -> bytes:
    return storage._json_bytes({"schema_version": 1, "native_editor": enabled})


def requested(
    config_dir: Path,
    explicit: bool | None,
    *,
    version: str = __version__,
) -> bool:
    if explicit is not None:
        return explicit
    raw = storage._read_optional_bytes(preference_path(config_dir))
    if raw is not None:
        return parse(raw)
    return enabled_by_default(version)
