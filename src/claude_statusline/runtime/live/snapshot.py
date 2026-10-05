"""Read-only metric views; values retain their source, time and limitations."""

from __future__ import annotations

import json
from pathlib import Path
import time

from claude_statusline.config import runtime as preference
from claude_statusline.runtime.live import model, ownership, store

LIVE_ITEMS = (
    "run-state",
    "permission-mode",
    "active-agents",
    "task-progress",
    "last-tool",
)


def point(value=None, reason=None, *, source=None, at=None, partial=False):
    return {
        "value": value,
        "reason": reason,
        "source": source,
        "observed_at_ms": at,
        "partial": partial,
    }


def lifecycle(config_dir, session_id, prompt_id=None):
    from claude_statusline.runtime.turns import model as turns

    root = store.root(config_dir).parent / "turns"
    try:
        data = json.loads((root / store.path(config_dir, session_id).name).read_bytes())
        if data.get("session_id") != session_id:
            return None
        return turns._find_turn(turns._store_from_state(data, session_id), prompt_id)
    except (OSError, ValueError, TypeError, AttributeError):
        return None


def resolve(
    state, config_dir: Path, session_id, prompt_id=None, *, now_ms=None, enabled=True
):
    now_ms = time.time() * 1000 if now_ms is None else now_ms
    reason = (
        "runtime_disabled"
        if not enabled
        else "not_observed"
        if state is None
        else state["invalidated"] or (None if store.fresh(state, now_ms) else "stale")
    )
    result = {item: point(reason=reason or "not_observed") for item in LIVE_ITEMS}
    if state is None or not enabled:
        return result
    selected = (
        ownership.canonical(state, prompt_id)
        if prompt_id
        else state["active_prompt_id"] or state["current_prompt_id"]
    )
    prompt = state["prompts"].get(selected)
    if prompt and prompt["epoch"] != state["epoch"] and not prompt["terminal"]:
        reason = "incomplete"
        result = {item: point(reason=reason) for item in LIVE_ITEMS}
    record = lifecycle(config_dir, session_id, selected) if selected else None
    turns = [
        row
        for row in state["turns"].values()
        if row["prompt_id"] == selected and row["agent_id"] is None
    ]
    turn = max(turns, key=lambda row: row["started_at_ms"]) if turns else None
    run = None
    if record and (
        reason is None or record.get("status") in ("completed", "failed", "interrupted")
    ):
        status = record.get("status")
        if status in ("completed", "failed", "interrupted", "unknown"):
            run = status
        elif status == "running":
            run = {
                "waiting_subagents": "waiting agents",
                "resuming_main": "main wrap-up",
            }.get(record.get("phase"))
    if (
        run is None
        and turn
        and (reason is None or turn["status"] in ("completed", "failed", "interrupted"))
    ):
        run = "main" if turn["status"] == "running" else turn["status"]
    if (
        run is None
        and selected
        and reason is None
        and state["prompts"][selected]["epoch"] == state["epoch"]
    ):
        run = "queued"
    result["run-state"] = point(
        run,
        None if run is not None else reason or "not_observed",
        source="lifecycle/native",
        at=state["heartbeat_at_ms"],
    )
    mode = state["permission"]
    if (
        reason is None
        and mode
        and (mode["live"] or 0 <= now_ms - mode["observed_at_ms"] <= model.STALE_MS)
    ):
        result["permission-mode"] = point(
            mode["mode"],
            None if mode["live"] else "observed_only",
            source=mode["source"],
            at=mode["observed_at_ms"],
            partial=not mode["live"],
        )
    snapshot = state["agent_snapshot"]
    if (
        reason is None
        and selected
        and snapshot
        and 0 <= now_ms - snapshot["observed_at_ms"] <= model.STALE_MS
    ):
        count = 0
        incomplete = False
        for agent in snapshot["agents"]:
            if agent["status"] not in ("pending", "running", "waiting"):
                continue
            owned = state["agents"].get(agent["id"])
            if not agent["local"] or owned is None or owned["epoch"] != state["epoch"]:
                incomplete = True
            elif owned["prompt_id"] == selected:
                count += 1
        result["active-agents"] = point(
            count,
            "ambiguous_owner" if incomplete else None,
            source="native.agent.list",
            at=snapshot["observed_at_ms"],
            partial=incomplete,
        )
    lists = [
        row for row in state["checklists"].values() if row.get("prompt_id") == selected
    ]
    historical = bool(turn and turn["status"] in ("completed", "failed", "interrupted"))
    if lists and (reason is None or historical):
        complete = [checklist for checklist in lists if checklist["complete"]]
        checklist = max(complete or lists, key=lambda item: item["updated_at_ms"])
        counts = {
            "completed": sum(
                status == "completed" for status in checklist["tasks"].values()
            ),
            "total": len(checklist["tasks"]),
        }
        result["task-progress"] = point(
            counts,
            None if checklist["complete"] else "incomplete",
            source="native.checklist",
            at=checklist["updated_at_ms"],
            partial=not checklist["complete"],
        )
    tools = [
        tool
        for tool in state["tools"].values()
        if tool["prompt_id"] == selected and tool["agent_id"] is None
    ]
    if tools and (reason is None or historical):
        tool = max(tools, key=lambda item: item["started_at_ms"])
        if reason is not None and tool["status"] == "started":
            return result
        result["last-tool"] = point(
            {"name": tool["name"], "status": tool["status"]},
            source="native.tool",
            at=tool["updated_at_ms"],
        )
    return result


def collect(config_dir: Path, session_id, prompt_id=None, *, now_ms=None):
    if not isinstance(session_id, str) or not session_id:
        return {item: point(reason="not_observed") for item in LIVE_ITEMS}
    try:
        enabled = preference.requested(config_dir)
        state = store.load(config_dir, session_id) if enabled else None
        return resolve(
            state, config_dir, session_id, prompt_id, now_ms=now_ms, enabled=enabled
        )
    except (OSError, ValueError, KeyError, TypeError):
        return {item: point(reason="source_unavailable") for item in LIVE_ITEMS}
