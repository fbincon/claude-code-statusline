"""Independent, opt-in live-metrics preference (never an editor preference)."""

from __future__ import annotations

import json
from pathlib import Path

from claude_statusline.config import storage
from claude_statusline.integration.models import ConfigurationError

FILENAME = "claude-statusline-runtime.json"


def preference_path(config_dir: Path) -> Path:
    return config_dir / FILENAME


def parse(raw: bytes) -> bool:
    def unique(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError("duplicate runtime preference field")
            value[key] = item
        return value

    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique)
        if (
            not isinstance(value, dict)
            or set(value) != {"schema_version", "live_metrics"}
            or type(value["schema_version"]) is not int
            or value["schema_version"] != 1
            or type(value["live_metrics"]) is not bool
        ):
            raise ValueError("expected schema_version 1 and a live_metrics boolean")
        return value["live_metrics"]
    except (UnicodeError, ValueError) as exc:
        raise ConfigurationError(f"Invalid {FILENAME}: {exc}") from exc


def preference_bytes(enabled: bool) -> bytes:
    return storage._json_bytes({"schema_version": 1, "live_metrics": enabled})


def requested(config_dir: Path, explicit: bool | None = None) -> bool:
    if explicit is not None:
        return explicit
    raw = storage._read_optional_bytes(preference_path(config_dir))
    return parse(raw) if raw is not None else False
