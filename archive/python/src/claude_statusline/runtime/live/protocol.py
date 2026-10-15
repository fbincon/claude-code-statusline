"""One strict runtime request/response; reads have no persistence effects."""

from __future__ import annotations

import json
from pathlib import Path
import sys

from claude_statusline._version import __version__
from claude_statusline.config import runtime as preference
from claude_statusline.integration.models import ConfigurationError
from claude_statusline.runtime.live import model, store


def dispatch(request, config_dir: Path):
    model.exact(request, ("protocol_version", "operation", "payload"), "request")
    if type(request["protocol_version"]) is not int or request[
        "protocol_version"
    ] not in (1, model.PROTOCOL_VERSION):
        raise model.ObservationError(
            "unsupported runtime protocol; reinstall matching Mod/backend"
        )
    modes = preference.load(config_dir)
    enabled = modes.enabled
    payload = request["payload"]
    if request["operation"] == "observe":
        model.exact(payload, ("observations",), "payload")
        observations = model.validate_batch(payload["observations"])
        counts = (
            store.observe(
                config_dir,
                observations,
                timing=modes.native_timing,
                complete_timing=request["protocol_version"] == model.PROTOCOL_VERSION,
                advanced=modes.live_metrics,
            )
            if enabled
            else {"accepted": 0, "ignored": len(observations)}
        )
        return {
            "backend_version": __version__,
            "enabled": enabled,
            "native_timing": modes.native_timing,
            "live_metrics": modes.live_metrics,
            **counts,
        }
    if request["operation"] == "read":
        model.exact(payload, ("session_id", "prompt_id"), "payload")
        session_id = model.text(payload["session_id"], "session_id")
        prompt_id = model.text(payload["prompt_id"], "prompt_id", nullable=True)
        state = store.load(config_dir, session_id) if enabled else None
        live = store.fresh(state)
        reason = (
            "runtime_disabled"
            if not enabled
            else "not_observed"
            if state is None
            else state["invalidated"] or (None if live else "stale")
        )
        from claude_statusline.runtime.live import snapshot

        metrics = snapshot.resolve(
            state, config_dir, session_id, prompt_id, enabled=modes.live_metrics
        )

        from claude_statusline.runtime.tasks.view import active_point

        metrics["task-active-timer"] = active_point(config_dir, session_id, prompt_id)
        return {
            "native_timing": modes.native_timing,
            "live_metrics": modes.live_metrics,
            "backend_version": __version__,
            "session_id": session_id,
            "prompt_id": prompt_id or (state["current_prompt_id"] if state else None),
            "enabled": enabled,
            "fresh": live,
            "reason": reason,
            "observed_at_ms": state["heartbeat_at_ms"] if state else None,
            "state": state,
            "metrics": metrics,
        }
    raise model.ObservationError("unsupported runtime operation")


def _unique(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise model.ObservationError("duplicate JSON field: " + key)
        value[key] = item
    return value


def _constant(value):
    raise model.ObservationError("non-finite JSON constant: " + value)


def main(args):
    from claude_statusline.integration.ownership import resolve_config_dir

    response = {"protocol_version": model.PROTOCOL_VERSION}
    status = 0
    try:
        raw = sys.stdin.buffer.read(model.MAX_BYTES + 1)
        if len(raw) > model.MAX_BYTES:
            raise model.ObservationError("runtime request is larger than 1 MiB")
        request = json.loads(
            raw.decode("utf-8-sig"), object_pairs_hook=_unique, parse_constant=_constant
        )
        if isinstance(request, dict) and type(request.get("protocol_version")) is int:
            response["protocol_version"] = request["protocol_version"]
        response["result"] = dispatch(request, resolve_config_dir(args.config_dir))
        response["protocol_version"] = request["protocol_version"]
    except (
        model.ObservationError,
        ConfigurationError,
        UnicodeError,
        ValueError,
        TypeError,
    ) as exc:
        response["error"] = {"code": "invalid_observation", "message": str(exc)}
        status = 2
    except OSError:
        response["error"] = {
            "code": "source_unavailable",
            "message": "Runtime state cannot be read or published",
        }
        status = 2
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stdout.write(json.dumps(response, ensure_ascii=False, allow_nan=False) + "\n")
    return status
