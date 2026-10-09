"""Strict portable JSON import/export, separate from configuration persistence."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

import json
import os
from pathlib import Path
import tempfile

from claude_statusline.config import display, features, native, runtime


FORMAT = "claude-code-statusline"
VERSION = 1
MAX_BYTES = 1_048_576


def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise display.DisplayConfigError(msg('errors.transfer.duplicate_transfer_field', value0=key))
        result[key] = value
    return result


def _constant(value):
    raise display.DisplayConfigError(msg('errors.transfer.non_finite_transfer_value', value0=value))


def import_file(path, current):
    from claude_statusline.ui.protocol import validate_draft

    path = Path(path).expanduser()
    with path.open("rb") as source:
        raw = source.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise display.DisplayConfigError(msg('errors.transfer.import_is_larger_than_1_mib'))
    try:
        data = json.loads(
            raw.decode("utf-8-sig"), object_pairs_hook=_unique, parse_constant=_constant
        )
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise display.DisplayConfigError(msg('errors.transfer.invalid_import_json', exc=exc)) from exc
    if isinstance(data, dict) and "schema_version" in data:
        data = {"display": data, "host": current["host"]}
    else:
        if not isinstance(data, dict) or set(data) != {"format", "version", "draft"}:
            raise display.DisplayConfigError(
                msg('errors.transfer.import_requires_a_portable_envelope_or_a')
            )
        if (
            data["format"] != FORMAT
            or type(data["version"]) is not int
            or data["version"] != VERSION
        ):
            raise display.DisplayConfigError(
                msg('errors.transfer.unsupported_portable_configuration_format_version')
            )
        data = data["draft"]
    parsed, host = validate_draft(data)
    return {"display": parsed.to_dict(), "host": host.to_dict()}


def export_file(path, draft, config_dir, *, overwrite=False):
    from claude_statusline.ui.protocol import validate_draft

    parsed, host = validate_draft(draft, require_current_schema=True)
    path = Path(path).expanduser().absolute()
    resolved = path.resolve()
    root = Path(config_dir).resolve()
    if (
        resolved
        in {
            root / name
            for name in (
                "settings.json",
                display.CONFIG_FILENAME,
                features.FEATURE_FILENAME,
                native.FILENAME,
                runtime.FILENAME,
            )
        }
        or resolved == root / "statusline-ui.json"
        or (root / "statusline-native") in resolved.parents
        or (root / "statusline-runtime") in resolved.parents
        or (root / "statusline_runtime") in resolved.parents
    ):
        raise display.DisplayConfigError(
            msg('errors.transfer.export_cannot_replace_live_configuration_or_owned')
        )
    data = {
        "format": FORMAT,
        "version": VERSION,
        "draft": {"display": parsed.to_dict(), "host": host.to_dict()},
    }
    raw = (
        json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    ).encode()
    if len(raw) > MAX_BYTES:
        raise display.DisplayConfigError(msg('errors.transfer.export_is_larger_than_1_mib'))
    fd, temporary = tempfile.mkstemp(prefix=".statusline-export-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as target:
            target.write(raw)
            target.flush()
            os.fsync(target.fileno())
        if overwrite:
            os.replace(temporary, path)
        else:
            os.link(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return str(path)
