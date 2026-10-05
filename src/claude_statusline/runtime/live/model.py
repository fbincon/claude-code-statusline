"""Strict, bounded observation records. Missing ownership is never guessed."""

from __future__ import annotations

import math
import unicodedata
from typing import Literal, TypedDict

PROTOCOL_VERSION = 1
MAX_BATCH = 256
MAX_BYTES = 1_048_576
MAX_SESSIONS = 100
MAX_EPOCHS = 32
MAX_SEEN = 4096
MAX_PROMPTS = 32
MAX_AGENTS = 256
STALE_MS = 15_000

Source = Literal["native", "classic_hook", "otel"]
Kind = Literal[
    "heartbeat", "invalidate", "prompt", "permission", "agent_start", "agent_end"
]


class Observation(TypedDict):
    session_id: str
    epoch: str
    seq: int
    observed_at_ms: float
    source: Source
    kind: Kind
    prompt_id: str | None
    turn_id: str | None
    agent_id: str | None
    parent_agent_id: str | None
    request_id: str | None
    payload: dict


class ObservationError(ValueError):
    pass


def exact(value, keys, name):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ObservationError(
            f"{name} must contain exactly: {', '.join(sorted(keys))}"
        )
    return value


def text(value, name, *, nullable=False, maximum=256):
    if nullable and value is None:
        return None
    if (
        not isinstance(value, str)
        or not value.strip()
        or len(value) > maximum
        or any(unicodedata.category(c) in ("Cc", "Cs") for c in value)
    ):
        raise ObservationError(
            f"{name} must be nonempty safe text (up to {maximum} characters)"
        )
    return value


def number(value, name, *, integer=False):
    if (
        type(value) not in (int, float)
        or (type(value) in (int, float) and value > 9_007_199_254_740_991)
        or not math.isfinite(value)
        or value < 0
        or (integer and type(value) is not int)
    ):
        raise ObservationError(
            f"{name} must be a finite nonnegative {'integer' if integer else 'number'}"
        )
    return value


def validate(value):
    exact(value, Observation.__annotations__, "observation")
    for key in ("session_id", "epoch"):
        text(value[key], key)
    for key in ("prompt_id", "turn_id", "agent_id", "parent_agent_id", "request_id"):
        text(value[key], key, nullable=True)
    number(value["seq"], "seq", integer=True)
    number(value["observed_at_ms"], "observed_at_ms")
    if value["source"] not in ("native", "classic_hook", "otel"):
        raise ObservationError("unknown observation source")
    payload = value["payload"]
    kind = value["kind"]
    if kind == "heartbeat":
        exact(payload, ("host_version", "loaded_at_ms"), "heartbeat")
        text(payload["host_version"], "host_version")
        number(payload["loaded_at_ms"], "loaded_at_ms")
        if payload["loaded_at_ms"] > value["observed_at_ms"]:
            raise ObservationError("heartbeat predates module loading")
        if value["source"] != "native":
            raise ObservationError("heartbeats require a native source")
    elif kind == "invalidate":
        exact(payload, ("reason",), "invalidation")
        text(payload["reason"], "reason")
    elif kind == "prompt":
        exact(payload, (), "prompt")
        text(value["prompt_id"], "prompt_id")
        if value["agent_id"] is not None:
            raise ObservationError("a human prompt belongs to main")
    elif kind == "permission":
        exact(payload, ("mode", "live"), "permission")
        text(payload["mode"], "mode", maximum=64)
        if type(payload["live"]) is not bool:
            raise ObservationError("permission.live must be boolean")
        if payload["live"] and value["source"] != "otel":
            raise ObservationError("live permission requires a verified change feed")
    elif kind in ("agent_start", "agent_end"):
        keys = (
            ("started_at_ms",) if kind == "agent_start" else ("ended_at_ms", "status")
        )
        exact(payload, keys, kind)
        text(value["agent_id"], "agent_id")
        number(payload[keys[0]], keys[0])
        if kind == "agent_end" and payload["status"] not in (
            "completed",
            "failed",
            "killed",
            "interrupted",
        ):
            raise ObservationError("unknown terminal agent status")
    else:
        raise ObservationError("unknown observation kind")
    return value


def validate_batch(values):
    if not isinstance(values, list) or not 1 <= len(values) <= MAX_BATCH:
        raise ObservationError(
            f"observations must contain 1 through {MAX_BATCH} records"
        )
    # Validate the complete request before the first persistence effect.
    return [validate(value) for value in values]
