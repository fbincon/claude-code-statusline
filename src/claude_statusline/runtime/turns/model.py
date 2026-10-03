"""runtime / turns / model implementation."""

from __future__ import annotations

import re
from claude_statusline.platforms import clocks as platform_clocks


SCHEMA = 1


LIFECYCLE_SCHEMA = 3


COMPATIBLE_LIFECYCLE_SCHEMAS = (2, LIFECYCLE_SCHEMA)


MAX_TURNS_PER_SESSION = 32
MAX_AGENT_HISTORY = 256


_TURN_FIELDS = (
    "prompt_id",
    "status",
    "started_wall_ns",
    "started_boot_ns",
    "ended_wall_ns",
    "ended_boot_ns",
    "duration_ns",
    "boot_id",
    "start_source",
    "end_source",
    "end_reason",
    "error",
    "last_assistant_wall_ns",
    "updated_wall_ns",
    "phase",
    "had_subagents",
    "active_agents",
    "duration_source",
    "agent_ids",
    "prompt_aliases",
    "pending_agent_reports",
)


_TERMINAL_STATUSES = {
    "completed",
    "failed",
    "interrupted",
    "withdrawn",
    "ignored",
    "unknown",
}


_END_PRIORITY = {
    None: 0,
    "next_prompt": 10,
    "session_start": 20,
    "registry_withdrawn": 30,
    "registry_idle": 40,
    "transcript_interrupt": 95,
    "local_command": 50,
    "transcript_duration": 60,
    "hook_session_end": 95,
    "hook_stop": 90,
    "hook_stop_failure": 100,
}


def _record_key(record):
    value = record.get("updated_wall_ns")
    if not isinstance(value, int):
        value = record.get("started_wall_ns")
    return value if isinstance(value, int) else 0


def _clean_record(record):
    if not isinstance(record, dict):
        return None
    prompt_id = record.get("prompt_id")
    if not prompt_id:
        return None
    cleaned = {key: record.get(key) for key in _TURN_FIELDS}
    cleaned["prompt_id"] = str(prompt_id)
    cleaned["status"] = str(cleaned.get("status") or "unknown")
    phase = cleaned.get("phase")
    cleaned["phase"] = (
        phase if phase in ("main", "waiting_subagents", "resuming_main") else "main"
    )
    cleaned["had_subagents"] = bool(cleaned.get("had_subagents"))
    cleaned["active_agents"] = _clean_active_agents(cleaned.get("active_agents"))
    for field in ("agent_ids", "prompt_aliases", "pending_agent_reports"):
        cleaned[field] = _clean_ids(cleaned.get(field))
    for agent in cleaned["active_agents"]:
        _remember_id(cleaned, "agent_ids", agent)
    if cleaned["status"] != "running":
        cleaned["active_agents"] = {}
        if (
            cleaned["had_subagents"]
            or cleaned["status"] in ("failed", "interrupted", "unknown")
            or not isinstance(cleaned.get("duration_ns"), int)
        ):
            cleaned["duration_ns"] = _elapsed_ns(
                cleaned,
                cleaned.get("ended_wall_ns"),
                cleaned.get("ended_boot_ns"),
                cleaned.get("boot_id"),
            )
            cleaned["duration_source"] = "task"
        elif not cleaned.get("duration_source"):
            # Old successful single-turn records can already be calibrated.
            cleaned["duration_source"] = "native"
    return cleaned


def _clean_ids(value):
    if not isinstance(value, list):
        return []
    return list(
        dict.fromkeys(item for item in value if isinstance(item, str) and item)
    )[-MAX_AGENT_HISTORY:]


def _remember_id(record, field, value):
    values = record.setdefault(field, [])
    if value in values:
        return False
    values.append(value)
    del values[:-MAX_AGENT_HISTORY]
    return True


def agent_notification_id(content):
    if not isinstance(content, str):
        return None
    match = re.match(r"\s*<task-notification>\s*<task-id>([^<>\s]+)</task-id>", content)
    return match.group(1) if match else None


def _clean_active_agents(value):
    if not isinstance(value, dict):
        return {}
    result = {}
    for agent_id, details in value.items():
        if not isinstance(agent_id, str) or not agent_id:
            continue
        details = details if isinstance(details, dict) else {}
        agent_type = details.get("agent_type")
        started = details.get("started_wall_ns")
        result[agent_id] = {
            "agent_type": str(agent_type) if agent_type else "Agent",
            "started_wall_ns": started if isinstance(started, int) else 0,
        }
    return result


def _legacy_record(state):
    if not isinstance(state, dict) or not state.get("prompt_id"):
        return None
    record = {key: state.get(key) for key in _TURN_FIELDS}
    record["prompt_id"] = str(record["prompt_id"])
    record["status"] = str(record.get("status") or "unknown")
    if not record.get("start_source"):
        record["start_source"] = "legacy"
    if record["status"] != "running" and not record.get("end_source"):
        record["end_source"] = "legacy"
    return _clean_record(record)


def _store_from_state(state, session_id):
    """Normalize schema-1 state plus its backwards-compatible lifecycle ledger."""
    lifecycle = state.get("lifecycle") if isinstance(state, dict) else None
    turns = []
    current_prompt_id = None
    if (
        isinstance(lifecycle, dict)
        and lifecycle.get("schema") in COMPATIBLE_LIFECYCLE_SCHEMAS
        and isinstance(lifecycle.get("turns"), list)
    ):
        seen = set()
        for item in lifecycle["turns"]:
            record = _clean_record(item)
            if record is None or record["prompt_id"] in seen:
                continue
            seen.add(record["prompt_id"])
            turns.append(record)
        current = lifecycle.get("current_prompt_id")
        current_prompt_id = str(current) if current else None
        # If an older compatible script updated only the schema-1 mirror after
        # a rollback, merge that newer observation back into the ledger.
        for legacy_source in (state.get("previous_running"), state):
            legacy = _legacy_record(legacy_source)
            if legacy is None:
                continue
            existing_index = next(
                (
                    index
                    for index, item in enumerate(turns)
                    if item.get("prompt_id") == legacy["prompt_id"]
                ),
                None,
            )
            if existing_index is None:
                turns.append(legacy)
            elif _record_key(legacy) > _record_key(turns[existing_index]):
                turns[existing_index] = legacy
        top = _legacy_record(state)
        lifecycle_updated = lifecycle.get("updated_wall_ns")
        if not isinstance(lifecycle_updated, int):
            lifecycle_updated = 0
        if top is not None and _record_key(top) >= lifecycle_updated:
            current_prompt_id = top["prompt_id"]
    else:
        previous = state.get("previous_running") if isinstance(state, dict) else None
        previous_record = _legacy_record(previous)
        if previous_record is not None:
            turns.append(previous_record)
        record = _legacy_record(state)
        if record is not None:
            if not any(item["prompt_id"] == record["prompt_id"] for item in turns):
                turns.append(record)
            current_prompt_id = record["prompt_id"]
    store = {
        "schema": LIFECYCLE_SCHEMA,
        "session_id": str(session_id),
        "current_prompt_id": current_prompt_id,
        "turns": turns,
        "updated_wall_ns": max((_record_key(item) for item in turns), default=0),
    }
    _prune_turns(store)
    return store


def _find_turn(store, prompt_id=None):
    if not isinstance(store, dict):
        return None
    explicit = prompt_id is not None
    if prompt_id is None:
        prompt_id = store.get("current_prompt_id")
    prompt_id = str(prompt_id) if prompt_id else None
    if prompt_id:
        for record in store.get("turns", ()):
            if record.get("prompt_id") == prompt_id or prompt_id in record.get(
                "prompt_aliases", ()
            ):
                return record
        if explicit:
            return None
    turns = store.get("turns")
    return max(turns, key=_record_key) if turns else None


def _new_record(prompt_id, clocks, source="hook_submit"):
    wall_ns, boot_ns, boot_id = clocks
    return {
        "prompt_id": str(prompt_id),
        "status": "running",
        "started_wall_ns": wall_ns,
        "started_boot_ns": boot_ns,
        "ended_wall_ns": None,
        "ended_boot_ns": None,
        "duration_ns": None,
        "duration_source": None,
        "agent_ids": [],
        "prompt_aliases": [],
        "pending_agent_reports": [],
        "boot_id": boot_id,
        "start_source": source,
        "end_source": None,
        "end_reason": None,
        "error": None,
        "last_assistant_wall_ns": None,
        "updated_wall_ns": wall_ns,
        "phase": "main",
        "had_subagents": False,
        "active_agents": {},
    }


def _upsert_turn(store, prompt_id, clocks=None, source="hook_submit"):
    if not prompt_id:
        return None
    prompt_id = str(prompt_id)
    record = _find_turn(store, prompt_id)
    if record is None:
        clocks = clocks or platform_clocks.now_clocks()
        record = _new_record(prompt_id, clocks, source)
        store.setdefault("turns", []).append(record)
    return record


def _prune_turns(store):
    turns = store.get("turns")
    if not isinstance(turns, list):
        store["turns"] = []
        return
    turns.sort(key=_record_key)
    if len(turns) <= MAX_TURNS_PER_SESSION:
        return
    current = store.get("current_prompt_id")
    kept = turns[-MAX_TURNS_PER_SESSION:]
    if current and not any(item.get("prompt_id") == current for item in kept):
        current_record = next(
            (item for item in turns if item.get("prompt_id") == current), None
        )
        if current_record is not None:
            kept[0] = current_record
            kept.sort(key=_record_key)
    store["turns"] = kept


def _terminal_record(store, prompt_id, clocks):
    record = _find_turn(store, prompt_id)
    if record is not None:
        return record
    record = _new_record(prompt_id, clocks, "missing_start")
    record["started_wall_ns"] = None
    record["started_boot_ns"] = None
    record["boot_id"] = None
    store.setdefault("turns", []).append(record)
    return record


def _elapsed_ns(record, ended_wall_ns, ended_boot_ns, boot_id):
    """Freeze elapsed time using a matching suspend-aware clock when possible."""
    start_boot = record.get("started_boot_ns")
    if (
        boot_id is not None
        and record.get("boot_id") == boot_id
        and isinstance(start_boot, int)
        and isinstance(ended_boot_ns, int)
    ):
        return max(0, ended_boot_ns - start_boot)
    start = record.get("started_wall_ns")
    if isinstance(start, int) and isinstance(ended_wall_ns, int):
        return max(0, ended_wall_ns - start)
    return None
