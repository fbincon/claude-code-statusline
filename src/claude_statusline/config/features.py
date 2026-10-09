"""config / features implementation."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

import json
from pathlib import Path
from claude_statusline._version import __version__
from claude_statusline.config.editor_defaults import enabled_by_default
from claude_statusline.platforms import files as platform_files


FEATURE_FILENAME = "claude-statusline-features.json"


SCHEMA_VERSION = 1


_EXPECTED_KEYS = {"schema_version", "experimental_slash_tui"}


class FeatureConfigError(RuntimeError):
    """Raised when the persistent feature preference is not trustworthy."""


def feature_path(config_dir: Path) -> Path:
    return config_dir / FEATURE_FILENAME


def preference_bytes(enabled: bool) -> bytes:
    return (
        json.dumps(
            {
                "schema_version": SCHEMA_VERSION,
                "experimental_slash_tui": enabled,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    ).encode("utf-8")


def enabled_bytes() -> bytes:
    return preference_bytes(True)


def parse_feature_bytes(raw: bytes, path: Path | None = None) -> bool:
    label = str(path) if path is not None else FEATURE_FILENAME

    def strict_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(msg('errors.features.duplicate_field', field=key))
            value[key] = item
        return value

    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=strict_object)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise FeatureConfigError(msg('errors.features.invalid_json_in', label=label, exc=exc)) from exc
    if not isinstance(value, dict):
        raise FeatureConfigError(msg('errors.features.must_contain_a_json_object', label=label))
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
            msg('errors.features.invalid_feature_configuration_in', label=label, value1='; '.join(details))
        )
    schema = value["schema_version"]
    if (
        not isinstance(schema, int)
        or isinstance(schema, bool)
        or schema != SCHEMA_VERSION
    ):
        raise FeatureConfigError(
            msg('errors.features.unsupported_feature_configuration_schema_in', label=label, schema=f'{schema!r}')
        )
    enabled = value["experimental_slash_tui"]
    if not isinstance(enabled, bool):
        raise FeatureConfigError(msg('errors.features.experimental_slash_tui_in_must_be_a', label=label))
    return enabled


def load_experimental_slash_tui(
    config_dir: Path, *, version: str = __version__
) -> bool:
    path = feature_path(config_dir)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return enabled_by_default(version)
    except OSError as exc:
        raise FeatureConfigError(msg('errors.features.cannot_read', path=path, exc=exc)) from exc
    return parse_feature_bytes(raw, path)


def write_enabled(config_dir: Path) -> Path:
    """Atomically persist the enabled preference with mode 0600."""
    path = feature_path(config_dir)
    try:
        platform_files.atomic_write_bytes(path, enabled_bytes(), 0o600)
    except OSError as exc:
        raise FeatureConfigError(msg('errors.features.cannot_write', path=path, exc=exc)) from exc
    return path
