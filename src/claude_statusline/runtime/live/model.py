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
MAX_TURNS = 256
MAX_TOOLS = 1024
MAX_TASKS = 1000
MAX_REQUESTS = 2048
STALE_MS = 15_000

Source = Literal["native", "classic_hook", "otel"]
Kind = Literal[
    "heartbeat",
    "invalidate",
    "prompt",
    "prompt_alias",
    "permission",
    "agent_start",
    "agent_end",
    "turn_start",
    "turn_end",
    "agents",
    "tool_start",
    "tool_end",
    "task_snapshot",
    "task_update",
    "request_start",
    "request_first",
    "request_end",
    "request_cost",
    "turn_usage",
    "prompt_link",
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
        or value < 0
        or (type(value) in (int, float) and value > 9_007_199_254_740_991)
        or not math.isfinite(value)
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
    elif kind == "prompt_link":
        exact(payload, ("message_id",), "official prompt link")
        text(value["prompt_id"], "prompt_id")
        text(payload["message_id"], "message_id")
        if value["source"] != "otel":
            raise ObservationError("prompt links require official telemetry")
    elif kind == "prompt_alias":
        exact(payload, ("agent_id",), "prompt alias")
        text(value["prompt_id"], "prompt_id")
        text(payload["agent_id"], "agent_id")
    elif kind in ("turn_start", "turn_end"):
        text(value["turn_id"], "turn_id")
        exact(payload, () if kind == "turn_start" else ("status",), kind)
        if kind == "turn_end" and payload["status"] not in (
            "completed",
            "failed",
            "interrupted",
        ):
            raise ObservationError("invalid turn status")
    elif kind == "agents":
        exact(payload, ("agents",), "agent snapshot")
        if (
            not isinstance(payload["agents"], list)
            or len(payload["agents"]) > MAX_AGENTS
        ):
            raise ObservationError("too many agents")
        for agent in payload["agents"]:
            exact(agent, ("id", "parent_id", "status", "local"), "agent")
            text(agent["id"], "agent id")
            text(agent["parent_id"], "parent_id", nullable=True)
            if type(agent["local"]) is not bool or agent["status"] not in (
                "pending",
                "running",
                "waiting",
                "idle",
                "completed",
                "failed",
                "killed",
            ):
                raise ObservationError("invalid agent snapshot")
        if len({agent["id"] for agent in payload["agents"]}) != len(payload["agents"]):
            raise ObservationError("duplicate agent identity")
    elif kind in ("tool_start", "tool_end"):
        text(value["request_id"], "tool use id")
        exact(payload, ("name",) if kind == "tool_start" else ("name", "status"), kind)
        text(payload["name"], "tool name")
        if kind == "tool_end" and payload["status"] not in (
            "success",
            "error",
            "denied",
            "interrupted",
        ):
            raise ObservationError("invalid tool outcome")
    elif kind in ("task_snapshot", "task_update"):
        exact(
            payload,
            ("provider", "tasks")
            if kind == "task_snapshot"
            else ("provider", "id", "status"),
            kind,
        )
        if payload["provider"] not in ("tasks", "todos"):
            raise ObservationError("unknown checklist provider")
        tasks = (
            payload["tasks"]
            if kind == "task_snapshot"
            else [{"id": payload["id"], "status": payload["status"]}]
        )
        if not isinstance(tasks, list) or len(tasks) > MAX_TASKS:
            raise ObservationError("too many checklist entries")
        for task in tasks:
            exact(task, ("id", "status"), "task")
            text(task["id"], "task id")
            if task["status"] not in ("pending", "in_progress", "completed", "deleted"):
                raise ObservationError("invalid checklist status")
        if len({task["id"] for task in tasks}) != len(tasks):
            raise ObservationError("duplicate checklist identity")
    elif kind == "permission":
        exact(payload, ("mode", "live"), "permission")
        text(payload["mode"], "mode", maximum=64)
        if type(payload["live"]) is not bool:
            raise ObservationError("permission.live must be boolean")
        if payload["live"] and value["source"] != "otel":
            raise ObservationError("live permission requires a verified change feed")
    elif kind in (
        "request_start",
        "request_first",
        "request_end",
        "request_cost",
        "turn_usage",
    ):
        if kind != "request_cost" and value["source"] != "native":
            raise ObservationError("request measurements require native observations")
        if kind == "turn_usage":
            text(value["turn_id"], "turn_id")
            exact(payload, ("usage",), kind)
        else:
            text(value["request_id"], "request_id")
            if kind != "request_cost":
                text(value["turn_id"], "turn_id")
            keys = (
                ()
                if kind in ("request_start", "request_first")
                else ("usage", "native", "status")
                if kind == "request_end"
                else ("cost_usd", "usage")
            )
            exact(payload, keys, kind)
        if kind in ("request_end", "request_cost", "turn_usage"):
            usage(payload["usage"])
        if kind == "request_end":
            if type(payload["native"]) is not bool or payload["status"] not in (
                "completed",
                "failed",
                "interrupted",
            ):
                raise ObservationError("invalid request outcome")
            if not payload["native"] and payload["usage"] is not None:
                raise ObservationError("synthetic requests cannot claim official usage")
        if kind == "request_cost":
            if value["source"] != "otel":
                raise ObservationError("cost requires official telemetry evidence")
            number(payload["cost_usd"], "cost_usd")
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


USAGE_KEYS = (
    "input_tokens",
    "output_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
)


def usage(value):
    if value is not None:
        exact(value, USAGE_KEYS, "usage")
        for key in USAGE_KEYS:
            number(value[key], key, integer=True)
    return value


def validate_batch(values):
    if not isinstance(values, list) or not 1 <= len(values) <= MAX_BATCH:
        raise ObservationError(
            f"observations must contain 1 through {MAX_BATCH} records"
        )
    # Validate the complete request before the first persistence effect.
    return [validate(value) for value in values]
