"""config / features implementation."""

from __future__ import annotations

import json
from pathlib import Path
from claude_statusline.platforms import files as platform_files


FEATURE_FILENAME = "claude-statusline-features.json"


SCHEMA_VERSION = 1


_EXPECTED_KEYS = {"schema_version", "experimental_slash_tui"}


class FeatureConfigError(RuntimeError):
    """Raised when the persistent feature preference is not trustworthy."""


def feature_path(config_dir: Path) -> Path:
    return config_dir / FEATURE_FILENAME


def enabled_bytes() -> bytes:
    return (
        json.dumps(
            {
                "schema_version": SCHEMA_VERSION,
                "experimental_slash_tui": True,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    ).encode("utf-8")


def parse_feature_bytes(raw: bytes, path: Path | None = None) -> bool:
    label = str(path) if path is not None else FEATURE_FILENAME

    def strict_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate field: {key}")
            value[key] = item
        return value

    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=strict_object)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise FeatureConfigError(f"invalid JSON in {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise FeatureConfigError(f"{label} must contain a JSON object")
    keys = set(value)
    if keys != _EXPECTED_KEYS:
        missing = sorted(_EXPECTED_KEYS - keys)
        unknown = sorted(keys - _EXPECTED_KEYS)
        details = []
        if missing:
            details.append("missing fields: " + ", ".join(missing))
        if unknown:
            details.append("unknown fields: " + ", ".join(unknown))
        raise FeatureConfigError(
            f"invalid feature configuration in {label}: {'; '.join(details)}"
        )
    schema = value["schema_version"]
    if (
        not isinstance(schema, int)
        or isinstance(schema, bool)
        or schema != SCHEMA_VERSION
    ):
        raise FeatureConfigError(
            f"unsupported feature configuration schema in {label}: {schema!r}"
        )
    enabled = value["experimental_slash_tui"]
    if not isinstance(enabled, bool):
        raise FeatureConfigError(f"experimental_slash_tui in {label} must be a boolean")
    return enabled


def load_experimental_slash_tui(config_dir: Path) -> bool:
    path = feature_path(config_dir)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return False
    except OSError as exc:
        raise FeatureConfigError(f"cannot read {path}: {exc}") from exc
    return parse_feature_bytes(raw, path)


def write_enabled(config_dir: Path) -> Path:
    """Atomically persist the enabled preference with mode 0600."""
    path = feature_path(config_dir)
    try:
        platform_files.atomic_write_bytes(path, enabled_bytes(), 0o600)
    except OSError as exc:
        raise FeatureConfigError(f"cannot write {path}: {exc}") from exc
    return path
