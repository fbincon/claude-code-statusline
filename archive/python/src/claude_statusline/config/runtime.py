"""Independent preferences for native timing and optional advanced observations."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

from dataclasses import dataclass
import json
from pathlib import Path

from claude_statusline.config import storage
from claude_statusline.integration.models import ConfigurationError

FILENAME = "claude-statusline-runtime.json"


@dataclass(frozen=True)
class Preferences:
    native_timing: bool = True
    live_metrics: bool = False

    @property
    def enabled(self):
        return self.native_timing or self.live_metrics

    def to_dict(self):
        return {
            "schema_version": 2,
            "native_timing": self.native_timing,
            "live_metrics": self.live_metrics,
        }


def preference_path(config_dir: Path) -> Path:
    return config_dir / FILENAME


def parse_preferences(raw: bytes) -> Preferences:
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(msg('errors.runtime.duplicate_runtime_preference_field'))
            result[key] = value
        return result

    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique)
        if not isinstance(value, dict) or type(value.get("schema_version")) is not int:
            raise ValueError(msg('errors.runtime.expected_runtime_preference_schema_1_or_2'))
        if value["schema_version"] == 1 and set(value) == {
            "schema_version",
            "live_metrics",
        }:
            if type(value["live_metrics"]) is not bool:
                raise ValueError(msg('errors.runtime.live_metrics_must_be_a_boolean'))
            return Preferences(value["live_metrics"], value["live_metrics"])
        if value["schema_version"] != 2 or set(value) != {
            "schema_version",
            "native_timing",
            "live_metrics",
        }:
            raise ValueError(
                msg('errors.runtime.expected_schema_version_2_native_timing_and')
            )
        if any(
            type(value[key]) is not bool for key in ("native_timing", "live_metrics")
        ):
            raise ValueError(msg('errors.runtime.runtime_preferences_must_be_booleans'))
        return Preferences(value["native_timing"], value["live_metrics"])
    except (UnicodeError, ValueError) as error:
        raise ConfigurationError(msg('errors.runtime.invalid', FILENAME=FILENAME, error=error)) from error


def parse(raw: bytes) -> bool:
    """Compatibility view: whether any runtime collector was requested."""
    return parse_preferences(raw).enabled


def load(config_dir: Path, live_metrics=None, native_timing=None) -> Preferences:
    if live_metrics is not None:
        return Preferences(
            live_metrics if native_timing is None else native_timing, live_metrics
        )
    raw = storage._read_optional_bytes(preference_path(config_dir))
    value = parse_preferences(raw) if raw is not None else Preferences()
    if native_timing is not None:
        value = Preferences(native_timing, value.live_metrics)
    return value


def preference_bytes(
    enabled: bool | None = None, *, native_timing=None, config_dir: Path | None = None
) -> bytes:
    base = (
        load(config_dir, enabled, native_timing)
        if config_dir
        else (
            Preferences(bool(enabled), bool(enabled))
            if enabled is not None
            else Preferences()
        )
    )
    if native_timing is not None:
        base = Preferences(native_timing, base.live_metrics)
    return storage._json_bytes(base.to_dict())


def requested(config_dir: Path, explicit: bool | None = None) -> bool:
    return load(config_dir, explicit).enabled


def metrics_requested(config_dir: Path) -> bool:
    return load(config_dir).live_metrics
