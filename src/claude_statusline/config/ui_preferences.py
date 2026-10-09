"""Shared editor language, independent of display drafts and revisions."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from claude_statusline.config import models, storage
from claude_statusline.i18n import LANGUAGES, Message, message

FILENAME = "statusline-ui.json"
SCHEMA_VERSION = 1


@dataclass(frozen=True)
class Preferences:
    ui_language: str = "en"
    warning: Message | None = None

    def to_dict(self):
        return {"schema_version": SCHEMA_VERSION, "ui_language": self.ui_language}


def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate preference key")
        result[key] = value
    return result


def _decode(raw):
    return json.loads(raw.decode("utf-8"), object_pairs_hook=_unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


def _valid(data):
    return (isinstance(data, dict) and set(data) == {"schema_version", "ui_language"}
            and type(data["schema_version"]) is int and data["schema_version"] == SCHEMA_VERSION
            and isinstance(data["ui_language"], str) and data["ui_language"] in LANGUAGES)


def read(config_dir: Path) -> Preferences:
    path = config_dir / FILENAME
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return Preferences()
    except OSError as exc:
        return Preferences(warning=message("preferences.read_failed", path=path, detail=exc))
    try:
        data = _decode(raw)
        if not _valid(data):
            raise ValueError("unsupported or invalid preferences")
        return Preferences(data["ui_language"])
    except (UnicodeError, ValueError, TypeError):
        return Preferences(warning=message("preferences.invalid", path=path))


def set_language(config_dir: Path, language: str) -> Preferences:
    if not isinstance(language, str) or language not in LANGUAGES:
        raise models.ConfigCommandError(message("preferences.unsupported_language", language=language))
    path = config_dir / FILENAME
    try:
        with storage._installation_lock(config_dir):
            raw = storage._read_optional_bytes(path)
            if raw is not None:
                try:
                    data = _decode(raw)
                except (UnicodeError, ValueError, TypeError):
                    data = None
                if isinstance(data, dict) and type(data.get("schema_version")) is int and data["schema_version"] > SCHEMA_VERSION:
                    raise models.ConfigCommandError(message("preferences.future_schema", version=data["schema_version"]))
                if _valid(data) and data["ui_language"] == language:
                    return Preferences(language)
                storage._backup_artifacts(config_dir, "ui-language", [(FILENAME, path, raw)])
            try:
                storage._atomic_write_bytes(path, storage._json_bytes(Preferences(language).to_dict()))
            except OSError as exc:
                try:
                    storage._write_optional_bytes(path, raw)
                except OSError as rollback:
                    raise models.ConfigWriteError(message("preferences.rollback_failed", path=path, detail=exc, rollback=rollback)) from exc
                raise
    except OSError as exc:
        raise models.ConfigWriteError(message("preferences.write_failed", path=path, detail=exc)) from exc
    return Preferences(language)
