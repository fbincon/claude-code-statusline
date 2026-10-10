"""One request/response JSON transport for source-native configuration clients."""

from __future__ import annotations

from claude_statusline.i18n import message as msg, as_message, Message

import json
import re
from pathlib import Path
import sys

from claude_statusline._version import __version__
from claude_statusline.config import (
    catalog,
    display,
    host,
    models,
    service,
    formatting,
    presets,
    transfer,
    editor_fields,
    ui_preferences,
)
from claude_statusline.integration import capabilities, models as integration_models
from claude_statusline.ui import contracts


class RequestError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _object(value, keys, name):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise RequestError(
            "invalid_request",
            msg('errors.protocol.must_be_an_object_containing_exactly', name=name, value1=', '.join(keys)),
        )
    return value


def validate_draft(value, *, require_current_schema=False):
    value = _object(value, ("display", "host"), "draft")
    try:
        parsed = display.validate_display_config(value["display"])
        if (
            require_current_schema
            and value["display"]["schema_version"] != display.SCHEMA_VERSION
        ):
            raise RequestError(
                "invalid_configuration",
                msg('errors.protocol.apply_requires_the_complete_schema_v_draft', SCHEMA_VERSION=display.SCHEMA_VERSION),
            )
        raw = _object(
            value["host"],
            ("padding", "refresh_interval", "hide_vim_mode_indicator"),
            "host",
        )
        if (
            type(raw["padding"]) is not int
            or type(raw["hide_vim_mode_indicator"]) is not bool
        ):
            raise RequestError(
                "invalid_configuration",
                msg('errors.protocol.padding_must_be_an_integer_and_hide'),
            )
        refresh = raw["refresh_interval"]
        if refresh != "event" and type(refresh) is not int:
            raise RequestError(
                "invalid_configuration",
                msg('errors.protocol.refresh_interval_must_be_an_integer_or'),
            )
        parsed_host = models.HostConfig(
            host._parse_padding(raw["padding"]),
            host._parse_refresh_interval(refresh),
            raw["hide_vim_mode_indicator"],
        )
        return parsed, parsed_host
    except (display.DisplayConfigError, models.ConfigCommandError) as exc:
        raise RequestError("invalid_configuration", as_message(exc)) from exc


def host_capabilities() -> contracts.Capabilities:
    version = capabilities.detect_claude_version()
    return {
        "host_version": ".".join(map(str, version)) if version else None,
        "subagent_rows": "unknown"
        if version is None
        else "supported"
        if capabilities.supports_subagent_statusline(version)
        else "unsupported",
        "native_mod": "unknown"
        if version is None
        else "unverified"
        if version >= (2, 1, 287)
        else "unsupported",
        "native_mod_loaded": None,
        "data_observation": "not_observed",
    }


def configuration_options() -> contracts.ConfigurationOptions:
    return {
        "colors": {"choices": [True, False]},
        "palette": {"choices": list(display.PALETTES)},
        "directory-style": {"choices": list(display.DIRECTORY_STYLES)},
        "separator-style": {"choices": list(display.SEPARATOR_STYLES)},
        "scope-labels": {"choices": list(display.SCOPE_LABELS)},
        "statusline-language": {"choices": list(display.STATUSLINE_LANGUAGES)},
        "subagent-statusline": {"choices": [True, False]},
        "padding": {"minimum": models.PADDING_MIN, "maximum": models.PADDING_MAX},
        "refresh-interval": {
            "minimum": models.REFRESH_INTERVAL_MIN,
            "maximum": models.REFRESH_INTERVAL_MAX,
            "special": "event",
        },
        "hide-vim-mode-indicator": {"choices": [True, False]},
    }


def read_result(effective):
    return {
        "draft": {
            "display": effective.display.to_dict(),
            "host": effective.host.to_dict(),
        },
        "revision": effective.revision,
        "installed": effective.installed,
        "installation": effective.installation,
        "capabilities": host_capabilities(),
        "backend_version": __version__,
    }


def dispatch(request: object, config_dir: Path, executable: Path):
    request = _object(request, ("protocol_version", "operation", "payload"), "request")
    if (
        type(request["protocol_version"]) is not int
        or request["protocol_version"] != contracts.PROTOCOL_VERSION
    ):
        raise RequestError(
            "unsupported_protocol",
            msg('errors.protocol.unsupported_protocol'),
        )
    operation = request["operation"]
    if not isinstance(operation, str) or operation not in contracts.OPERATIONS:
        raise RequestError(
            "unsupported_operation", msg('errors.protocol.unsupported_configuration_operation')
        )
    payload = request["payload"]
    if operation in ("read_ui_preferences", "set_ui_language"):
        _object(payload, () if operation == "read_ui_preferences" else ("ui_language",), "payload")
        preference = (ui_preferences.read(config_dir) if operation == "read_ui_preferences"
                      else ui_preferences.set_language(config_dir, payload["ui_language"]))
        return {**preference.to_dict(), "warning": preference.warning.wire() if preference.warning else None}
    if operation in ("import", "review_import", "export", "preset"):
        keys = (
            ("draft", "path", "overwrite")
            if operation == "export"
            else ("draft", "path")
            if operation in ("import", "review_import")
            else ("draft", "preset")
        )
        _object(payload, keys, "payload")
        parsed, parsed_host = validate_draft(
            payload["draft"], require_current_schema=True
        )
        current = {"display": parsed.to_dict(), "host": parsed_host.to_dict()}
        if operation == "preset":
            if not isinstance(payload["preset"], str):
                raise RequestError("invalid_request", msg('errors.protocol.preset_must_be_a_string'))
            return {
                "draft": {
                    "display": presets.apply(parsed, payload["preset"]).to_dict(),
                    "host": parsed_host.to_dict(),
                }
            }
        path = payload["path"]
        if not isinstance(path, str) or not path.strip() or "\0" in path:
            raise RequestError(
                "invalid_request", msg('errors.protocol.path_must_be_nonempty_text_without_nul')
            )
        if operation == "import":
            return {"draft": transfer.import_file(path, current)}
        if operation == "review_import":
            return transfer.review_import(path, current)
        if type(payload["overwrite"]) is not bool:
            raise RequestError("invalid_request", msg('errors.protocol.overwrite_must_be_a_boolean'))
        return {
            "path": transfer.export_file(
                path, current, config_dir, overwrite=payload["overwrite"]
            )
        }
    if operation in ("describe", "read"):
        _object(payload, (), "payload")
    if operation == "describe":
        return {
            "presets": presets.descriptions(),
            "editor_fields": editor_fields.descriptions(),
            "catalog": [item.to_dict() for item in catalog.ITEMS],
            "options": configuration_options(),
            "capabilities": host_capabilities(),
            "backend_version": __version__,
            "operations": list(contracts.OPERATIONS),
            "formatting_options": {
                k: list(v) for k, v in formatting.FORMAT_CHOICES.items()
            },
        }
    if operation == "read":
        return read_result(service.read_effective_config(config_dir, executable))
    if operation == "apply":
        _object(payload, ("draft", "expected_revision"), "payload")
        parsed, parsed_host = validate_draft(
            payload["draft"], require_current_schema=True
        )
        revision = payload["expected_revision"]
        if (
            not isinstance(revision, str)
            or re.fullmatch(r"[0-9a-f]{64}", revision) is None
        ):
            raise RequestError(
                "invalid_request",
                msg('errors.protocol.expected_revision_must_be_the_revision_returned'),
            )
        mutation = service.apply_configuration(
            config_dir,
            executable,
            items=list(parsed.items),
            colors=parsed.use_colors,
            palette=parsed.palette,
            directory_style=parsed.directory_style,
            separator_style=parsed.separator_style,
            scope_labels=parsed.scope_labels,
            subagent_items=list(parsed.subagents.items),
            subagent_statusline=parsed.subagents.enabled,
            padding=parsed_host.padding,
            refresh_interval=parsed_host.to_dict()["refresh_interval"],
            hide_vim_mode_indicator=parsed_host.hide_vim_mode_indicator,
            expected_revision=revision,
            display_draft=parsed,
        )
        return {
            **read_result(mutation.effective),
            "changed": mutation.changed,
            "backup_dir": str(mutation.backup_dir) if mutation.backup_dir else None,
        }
    if operation == "preview":
        _object(payload, ("draft", "width"), "payload")
        parsed, parsed_host = validate_draft(payload["draft"])
        width = payload["width"]
        if type(width) is not int or not 2 <= width <= 10000:
            raise RequestError(
                "invalid_request", msg('errors.protocol.width_must_be_an_integer_from_2')
            )
        from claude_statusline.rendering import preview, spans, subagents

        return {
            "sample": True,
            "main": [
                spans.row_spans(row)
                for row in preview.render_preview_rows(
                    parsed, width, parsed_host.padding
                )
            ],
            "subagents": [
                spans.row_spans(row) for row in subagents.preview_rows(parsed, width)
            ],
        }
    raise AssertionError("Unhandled operation")


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise RequestError("invalid_json", msg('errors.protocol.duplicate_json_key', field=key))
        result[key] = value
    return result


def _reject_constant(value):
    raise RequestError("invalid_json", msg('errors.protocol.non_finite_json_value', value=value))


def handle(raw: str, config_dir: Path, executable: Path):
    try:
        request = json.loads(
            raw, object_pairs_hook=_unique_object, parse_constant=_reject_constant
        )
        return {
            "protocol_version": contracts.PROTOCOL_VERSION,
            "result": dispatch(request, config_dir, executable),
        }, 0
    except (json.JSONDecodeError, UnicodeError) as exc:
        error = RequestError("invalid_json", as_message(exc))
    except RequestError as exc:
        error = exc
    except (
        models.ConfigCommandError,
        display.DisplayConfigError,
        integration_models.ConfigurationError,
    ) as exc:
        error = RequestError(getattr(exc, "code", "invalid_configuration"), as_message(exc))
    except OSError as exc:
        error = RequestError("io_error", as_message(exc))
    except Exception:
        import traceback

        traceback.print_exc(file=sys.stderr)
        error = RequestError(
            "internal_error", msg('errors.protocol.unexpected_backend_failure_see_stderr_diagnostics')
        )
    return {
        "protocol_version": contracts.PROTOCOL_VERSION,
        "error": {"code": error.code, "message": str(error),
                  "localization": as_message(error).wire() if isinstance(as_message(error), Message) else None},
    }, 2


def main(args) -> int:
    """Keep path resolution/input decoding failures inside the JSON envelope."""
    from claude_statusline.integration import ownership

    try:
        raw = (
            sys.stdin.buffer.read().decode("utf-8")
            if hasattr(sys.stdin, "buffer")
            else sys.stdin.read()
        )
        directory = ownership.resolve_config_dir(args.config_dir)
        entry = Path(sys.argv[0])
        executable = ownership.resolve_cli_executable(
            entry
            if entry.name.casefold() in {"claude-statusline", "claude-statusline.exe"}
            else None
        )
        response, status = handle(raw, directory, executable)
    except (UnicodeError, OSError, integration_models.ConfigurationError) as exc:
        response, status = (
            {
                "protocol_version": contracts.PROTOCOL_VERSION,
                "error": {"code": "invalid_request", "message": str(exc),
                          "localization": as_message(exc).wire() if isinstance(as_message(exc), Message) else None},
            },
            2,
        )
    try:
        sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    except AttributeError:
        pass
    print(json.dumps(response, ensure_ascii=False, allow_nan=False))
    return status
