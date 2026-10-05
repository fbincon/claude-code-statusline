"""Session-isolated, locked atomic storage for live evidence and bounded history."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import time

from claude_statusline.platforms import files
from claude_statusline.runtime.live import model


def root(config_dir: Path):
    configured = os.environ.get("CLAUDE_STATUSLINE_RUNTIME_DIR")
    return (
        Path(configured) if configured else config_dir / "statusline_runtime"
    ) / "live"


def path(config_dir: Path, session_id: str):
    key = hashlib.sha256(session_id.encode("utf-8")).hexdigest()
    return root(config_dir) / (key + ".json")


def empty(session_id):
    return {
        "schema_version": 1,
        "session_id": session_id,
        "epoch": None,
        "loaded_at_ms": None,
        "heartbeat_at_ms": None,
        "host_version": None,
        "invalidated": None,
        "current_prompt_id": None,
        "epochs": {},
        "prompts": {},
        "agents": {},
        "permission": None,
        "active_prompt_id": None,
        "current_main_turn_id": None,
        "turns": {},
        "tools": {},
        "checklists": {},
        "prompt_aliases": {},
        "prompt_links": {},
        "agent_snapshot": None,
        "requests": {},
        "costs": {},
        "wait_events": {},
    }


def load(config_dir: Path, session_id: str):
    try:
        target = path(config_dir, session_id)
        if target.is_symlink():
            return None
        state = json.loads(target.read_bytes())
        if (
            isinstance(state, dict)
            and {"schema_version", "session_id", "epochs", "prompts", "agents"}
            <= set(state)
            and set(state) <= set(empty(session_id))
            and state["schema_version"] == 1
            and state["session_id"] == session_id
            and all(
                isinstance(state[key], dict) for key in ("epochs", "prompts", "agents")
            )
        ):
            state = {**empty(session_id), **state}
            if not all(
                isinstance(state[key], dict)
                for key in (
                    "turns",
                    "tools",
                    "checklists",
                    "prompt_aliases",
                    "prompt_links",
                    "requests",
                    "costs",
                )
            ):
                return None
            for epoch, ledger in state["epochs"].items():
                model.text(epoch, "epoch")
                model.exact(
                    ledger, ("seen", "floor", "high", "updated_at_ms"), "epoch ledger"
                )
                if (
                    not isinstance(ledger["seen"], list)
                    or len(ledger["seen"]) > model.MAX_SEEN
                    or any(type(seq) is not int or seq < 0 for seq in ledger["seen"])
                    or any(
                        type(ledger[key]) is not int or ledger[key] < -1
                        for key in ("floor", "high")
                    )
                ):
                    return None
            if state["epoch"] is not None and state["epoch"] not in state["epochs"]:
                return None
            for record in state["prompts"].values():
                if not isinstance(record, dict) or not {
                    "updated_at_ms",
                    "started_at_ms",
                    "epoch",
                    "complete",
                    "terminal",
                } <= set(record):
                    return None
                model.number(record["updated_at_ms"], "prompt time")
            for record in state["agents"].values():
                if not isinstance(record, dict) or not {
                    "prompt_id",
                    "epoch",
                    "started_at_ms",
                    "ended_at_ms",
                    "status",
                    "updated_at_ms",
                } <= set(record):
                    return None
                model.number(record["updated_at_ms"], "agent time")
            if state["permission"] is not None and (
                not isinstance(state["permission"], dict)
                or set(state["permission"])
                != {"mode", "live", "observed_at_ms", "source"}
            ):
                return None
            _validate_views(state)
            return state
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        pass
    return None


def _validate_views(state):
    if len(state["prompt_links"]) > model.MAX_AGENTS:
        raise ValueError("prompt links exceed their bound")
    for alias, target in state["prompt_links"].items():
        model.text(alias, "prompt link")
        model.text(target, "message link")
    if (
        not isinstance(state["wait_events"], dict)
        or len(state["wait_events"]) > model.MAX_SEEN
    ):
        raise ValueError("invalid waiting evidence")
    for row in state["wait_events"].values():
        model.validate(row)
        if row["kind"] not in ("wait_start", "wait_end", "wait_unknown"):
            raise ValueError("invalid waiting event kind")
    for table, maximum in (
        ("turns", model.MAX_TURNS),
        ("tools", model.MAX_TOOLS),
        ("requests", model.MAX_REQUESTS),
        ("costs", model.MAX_REQUESTS),
    ):
        if len(state[table]) > maximum:
            raise ValueError("runtime table exceeds its bound")
        for row in state[table].values():
            if not isinstance(row, dict):
                raise ValueError("invalid runtime view")
            model.text(row["prompt_id"], "owner", nullable=True)
            model.number(row["updated_at_ms"], "view time")
            if table in ("turns", "tools", "requests"):
                model.text(row["agent_id"], "agent", nullable=True)
                for name in (
                    ("started_at_ms", "ended_at_ms")
                    if table != "tools"
                    else ("started_at_ms",)
                ):
                    if row[name] is not None:
                        model.number(row[name], name)
            if table == "turns" and row["status"] not in (
                "running",
                "completed",
                "failed",
                "interrupted",
            ):
                raise ValueError("invalid turn status")
            if table == "tools":
                model.text(row["name"], "tool name")
                if row["status"] not in (
                    "started",
                    "success",
                    "error",
                    "denied",
                    "interrupted",
                ):
                    raise ValueError("invalid tool status")
            if table in ("requests", "costs"):
                model.usage(row["usage"])
                if type(row["conflict"]) is not bool:
                    raise ValueError("invalid conflict flag")
                if table == "requests":
                    model.text(row["turn_key"], "turn key", maximum=1024)
                    model.text(row["epoch"], "request epoch")
                    if type(row["native"]) is not bool or row["status"] not in (
                        None,
                        "completed",
                        "failed",
                        "interrupted",
                    ):
                        raise ValueError("invalid request status")
                    if row["first_at_ms"] is not None:
                        model.number(row["first_at_ms"], "first content time")
                else:
                    model.number(row["cost_usd"], "cost")
    for row in state["checklists"].values():
        if (
            not isinstance(row, dict)
            or not isinstance(row["tasks"], dict)
            or type(row["complete"]) is not bool
            or len(row["tasks"]) > model.MAX_TASKS
        ):
            raise ValueError("invalid checklist")
        model.text(row["prompt_id"], "checklist owner", nullable=True)
        model.number(row["updated_at_ms"], "checklist time")
        if any(
            value not in ("pending", "in_progress", "completed")
            for value in row["tasks"].values()
        ):
            raise ValueError("invalid checklist entry")


def fresh(state, now_ms=None):
    now_ms = time.time() * 1000 if now_ms is None else now_ms
    stamp = state.get("heartbeat_at_ms") if state else None
    return bool(
        state
        and not state["invalidated"]
        and type(stamp) in (float, int)
        and 0 <= now_ms - stamp <= model.STALE_MS
    )


def observe(
    config_dir: Path, observations, *, timing=False, complete_timing=True, advanced=True
):
    from claude_statusline.runtime.live.reducer import apply

    accepted = ignored = 0
    grouped = {}
    for item in observations:
        grouped.setdefault(item["session_id"], []).append(item)
    for session_id, rows in grouped.items():
        target = path(config_dir, session_id)
        with files.exclusive_file_lock(target.with_suffix(".lock")):
            state = load(config_dir, session_id) or empty(session_id)
            for item in rows:
                if apply(
                    state,
                    item,
                    metadata_only=not advanced
                    and item["kind"] not in model.TIMING_KINDS,
                ):
                    accepted += 1
                else:
                    ignored += 1
            from claude_statusline.runtime.live import bindings

            bindings.reconcile(state, config_dir)
            if timing:
                # Fixed order: live lock -> task lock. Task writers never take a live lock.
                from claude_statusline.runtime.tasks.native import observe

                observe(config_dir, state, rows, complete_timing=complete_timing)
            content = json.dumps(
                state, ensure_ascii=False, allow_nan=False, separators=(",", ":")
            ).encode("utf-8")
            files.atomic_write_bytes(target, content, 0o600)
    prune(config_dir)
    return {"accepted": accepted, "ignored": ignored}


def prune(config_dir):
    try:
        entries = [
            p
            for p in root(config_dir).glob("*.json")
            if p.is_file() and not p.is_symlink()
        ]
        entries.sort(key=lambda p: p.stat().st_mtime_ns, reverse=True)
        for target in entries[model.MAX_SESSIONS :]:
            # Lock files remain fixed inodes; a delayed writer can reuse them.
            with files.exclusive_file_lock(target.with_suffix(".lock")):
                target.unlink(missing_ok=True)
    except OSError:
        pass
