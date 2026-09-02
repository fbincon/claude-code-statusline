#!/usr/bin/env python3
"""Silent Claude Code hook for per-prompt wall-clock lifecycle state.

The hook deliberately writes no stdout and always exits successfully.  It is
also imported by statusline.py to read state and to record the transcript-only
user-interrupt marker that Claude Code does not expose as a hook event.
"""

import fcntl
import hashlib
import json
import os
import sys
import tempfile
import time


SCHEMA = 1
LIFECYCLE_SCHEMA = 2
MAX_TURNS_PER_SESSION = 32
MAX_SESSIONS = 100
CONFIG_DIR = os.path.abspath(os.path.expanduser(
    os.environ.get("CLAUDE_CONFIG_DIR", "~/.claude")
))
BASE_DIR = CONFIG_DIR
RUNTIME_ROOT = os.environ.get(
    "CLAUDE_STATUSLINE_RUNTIME_DIR",
    os.path.join(BASE_DIR, "statusline_runtime"),
)
TURN_DIR = os.path.join(RUNTIME_ROOT, "turns")


def _safe_mkdir(path):
    os.makedirs(path, mode=0o700, exist_ok=True)
    try:
        os.chmod(path, 0o700)
    except OSError:
        pass


def _session_key(session_id):
    return hashlib.sha256(str(session_id).encode("utf-8")).hexdigest()


def _state_path(session_id):
    return os.path.join(TURN_DIR, _session_key(session_id) + ".json")


def _lock_path(session_id):
    return os.path.join(TURN_DIR, _session_key(session_id) + ".lock")


def _boot_id():
    try:
        with open("/proc/sys/kernel/random/boot_id", "r", encoding="ascii") as f:
            value = f.read().strip()
        return value or None
    except OSError:
        return None


def now_clocks():
    wall_ns = time.time_ns()
    boot_ns = None
    clock = getattr(time, "CLOCK_BOOTTIME", None)
    if clock is not None:
        try:
            boot_ns = time.clock_gettime_ns(clock)
        except (OSError, ValueError):
            pass
    return wall_ns, boot_ns, _boot_id()


def _load_unlocked(session_id):
    try:
        with open(_state_path(session_id), "r", encoding="utf-8") as f:
            state = json.load(f)
        if (isinstance(state, dict)
                and state.get("schema") == SCHEMA
                and state.get("session_id") == str(session_id)):
            return state
    except (OSError, ValueError, TypeError):
        pass
    return None


def load_turn_store(session_id):
    """Read and normalize one prompt-indexed lifecycle store."""
    if not session_id:
        return None
    session_id = str(session_id)
    state = _load_unlocked(session_id)
    if not isinstance(state, dict):
        return None
    return _store_from_state(state, session_id)


def load_turn_state(session_id, prompt_id=None):
    """Read one prompt state, defaulting to the store's current prompt."""
    store = load_turn_store(session_id)
    if not isinstance(store, dict):
        return None
    record = _find_turn(store, prompt_id)
    return dict(record) if isinstance(record, dict) else None


def _atomic_write(session_id, state):
    _safe_mkdir(RUNTIME_ROOT)
    _safe_mkdir(TURN_DIR)
    fd, tmp = tempfile.mkstemp(prefix=".turn-", suffix=".tmp", dir=TURN_DIR)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, separators=(",", ":"), sort_keys=True)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, _state_path(session_id))
        tmp = None
    finally:
        if tmp is not None:
            try:
                os.unlink(tmp)
            except OSError:
                pass


def _prune_states():
    try:
        entries = [
            e for e in os.scandir(TURN_DIR)
            if e.is_file(follow_symlinks=False) and e.name.endswith(".json")
        ]
        entries.sort(key=lambda e: e.stat(follow_symlinks=False).st_mtime_ns,
                     reverse=True)
        for entry in entries[MAX_SESSIONS:]:
            try:
                os.unlink(entry.path)
            except OSError:
                pass
    except OSError:
        pass


def _with_lock(session_id, callback):
    _safe_mkdir(RUNTIME_ROOT)
    _safe_mkdir(TURN_DIR)
    fd = os.open(_lock_path(session_id), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            os.fchmod(fd, 0o600)
        except OSError:
            pass
        fcntl.flock(fd, fcntl.LOCK_EX)
        state = _load_unlocked(session_id)
        new_state = callback(state)
        if isinstance(new_state, dict) and new_state != state:
            _atomic_write(session_id, new_state)
        return new_state
    finally:
        os.close(fd)


_TURN_FIELDS = (
    "prompt_id", "status", "started_wall_ns", "started_boot_ns",
    "ended_wall_ns", "ended_boot_ns", "duration_ns", "boot_id",
    "start_source", "end_source", "end_reason", "error",
    "last_assistant_wall_ns", "updated_wall_ns",
)

_TERMINAL_STATUSES = {
    "completed", "failed", "interrupted", "withdrawn", "ignored", "unknown",
}

_END_PRIORITY = {
    None: 0,
    "next_prompt": 10,
    "session_start": 20,
    "registry_withdrawn": 30,
    "registry_idle": 40,
    "transcript_interrupt": 50,
    "local_command": 50,
    "transcript_duration": 60,
    "hook_session_end": 70,
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
    return cleaned


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
    return record


def _store_from_state(state, session_id):
    """Normalize schema-1 state plus its backwards-compatible v2 ledger."""
    lifecycle = state.get("lifecycle") if isinstance(state, dict) else None
    turns = []
    current_prompt_id = None
    if (isinstance(lifecycle, dict)
            and lifecycle.get("schema") == LIFECYCLE_SCHEMA
            and isinstance(lifecycle.get("turns"), list)):
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
            existing_index = next((
                index for index, item in enumerate(turns)
                if item.get("prompt_id") == legacy["prompt_id"]
            ), None)
            if existing_index is None:
                turns.append(legacy)
            elif _record_key(legacy) > _record_key(turns[existing_index]):
                turns[existing_index] = legacy
        top = _legacy_record(state)
        lifecycle_updated = lifecycle.get("updated_wall_ns")
        if not isinstance(lifecycle_updated, int):
            lifecycle_updated = 0
        if (top is not None
                and _record_key(top) >= lifecycle_updated):
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
            if record.get("prompt_id") == prompt_id:
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
        "boot_id": boot_id,
        "start_source": source,
        "end_source": None,
        "end_reason": None,
        "error": None,
        "last_assistant_wall_ns": None,
        "updated_wall_ns": wall_ns,
    }


def _upsert_turn(store, prompt_id, clocks=None, source="hook_submit"):
    if not prompt_id:
        return None
    prompt_id = str(prompt_id)
    record = _find_turn(store, prompt_id)
    if record is None:
        clocks = clocks or now_clocks()
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


def _mirror_state(session_id, store, preferred_prompt_id=None):
    """Publish v2 while keeping the old schema-1 top-level reader contract."""
    _prune_turns(store)
    selected = _find_turn(store, preferred_prompt_id)
    if selected is None:
        return None
    store["updated_wall_ns"] = max(
        (_record_key(item) for item in store.get("turns", ())), default=0
    )
    state = {key: selected.get(key) for key in _TURN_FIELDS}
    state.update({
        "schema": SCHEMA,
        "session_id": str(session_id),
        "lifecycle": store,
    })
    running = [
        item for item in store.get("turns", ())
        if item.get("status") == "running"
        and item.get("prompt_id") != selected.get("prompt_id")
    ]
    if selected.get("status") in ("ignored", "withdrawn") and running:
        state["previous_running"] = dict(max(running, key=_record_key))
    return state


def _with_store(session_id, callback):
    session_id = str(session_id)

    def transition(state):
        store = _store_from_state(state or {}, session_id)
        preferred = callback(store)
        return _mirror_state(session_id, store, preferred)

    return _with_lock(session_id, transition)


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


def _finish_record(record, status, ended_wall_ns, ended_boot_ns, boot_id,
                   source, reason, error=None, duration_ns=None,
                   updated_wall_ns=None):
    """Apply one terminal observation without weakening stronger evidence."""
    if not isinstance(record, dict) or not isinstance(ended_wall_ns, int):
        return False
    if isinstance(duration_ns, int) and duration_ns >= 0:
        if (not isinstance(record.get("duration_ns"), int)
                or source == "transcript_duration"):
            record["duration_ns"] = duration_ns
    old_source = record.get("end_source")
    old_priority = _END_PRIORITY.get(old_source, 0)
    new_priority = _END_PRIORITY.get(source, 0)
    old_end = record.get("ended_wall_ns")
    if record.get("status") in _TERMINAL_STATUSES:
        if new_priority < old_priority:
            return False
        if (new_priority == old_priority and isinstance(old_end, int)
                and ended_wall_ns < old_end):
            return False
    record.update({
        "status": status,
        "ended_wall_ns": ended_wall_ns,
        "ended_boot_ns": (
            ended_boot_ns if record.get("boot_id") == boot_id else None
        ),
        "end_source": source,
        "end_reason": reason,
        "error": error,
        "updated_wall_ns": (
            updated_wall_ns if isinstance(updated_wall_ns, int)
            else time.time_ns()
        ),
    })
    return True


def _apply_prompt(store, prompt_id, wall_ns):
    if not prompt_id or not isinstance(wall_ns, int):
        return None
    prompt_id = str(prompt_id)
    previous = _find_turn(store, store.get("current_prompt_id"))
    record = _find_turn(store, prompt_id)
    if record is None:
        record = _new_record(prompt_id, (wall_ns, None, None), "transcript")
        store.setdefault("turns", []).append(record)
    else:
        # The transcript timestamp is when the prompt actually entered the
        # conversation. It corrects an earlier enqueue-time hook candidate.
        record["started_wall_ns"] = wall_ns
        record["started_boot_ns"] = None
        record["boot_id"] = None
        record["start_source"] = "transcript"
        if record.get("status") not in _TERMINAL_STATUSES:
            record["status"] = "running"
        record["updated_wall_ns"] = max(_record_key(record), wall_ns)
    previous_start = previous.get("started_wall_ns") if previous else None
    if (isinstance(previous, dict) and previous is not record
            and previous.get("status") == "running"
            and isinstance(previous_start, int) and previous_start <= wall_ns):
        _finish_record(
            previous, "unknown", wall_ns, None, None, "next_prompt",
            "superseded_without_terminal_event", updated_wall_ns=wall_ns,
        )
    store["current_prompt_id"] = prompt_id
    return record


def _apply_interrupt(store, wall_ns):
    if not isinstance(wall_ns, int):
        return None
    candidates = []
    for record in store.get("turns", ()):
        start = record.get("started_wall_ns")
        if (record.get("status") == "running" and isinstance(start, int)
                and start <= wall_ns):
            candidates.append(record)
    if not candidates:
        return None
    record = max(candidates, key=lambda item: item.get("started_wall_ns") or 0)
    _finish_record(
        record, "interrupted", wall_ns, None, None,
        "transcript_interrupt", "user_interrupt", updated_wall_ns=wall_ns,
    )
    return record


def _apply_local_command(store, prompt_id, wall_ns):
    if not prompt_id or not isinstance(wall_ns, int):
        return None
    record = _find_turn(store, prompt_id)
    if record is None:
        record = _new_record(prompt_id, (wall_ns, None, None), "local_command")
        store.setdefault("turns", []).append(record)
    _finish_record(
        record, "ignored", wall_ns, None, None,
        "local_command", "local_command", updated_wall_ns=wall_ns,
    )
    if store.get("current_prompt_id") == str(prompt_id):
        running = [
            item for item in store.get("turns", ())
            if item.get("status") == "running"
            and item.get("prompt_id") != str(prompt_id)
        ]
        store["current_prompt_id"] = (
            max(running, key=_record_key).get("prompt_id") if running else None
        )
    return record


def _apply_assistant(store, prompt_id, wall_ns):
    record = _find_turn(store, prompt_id)
    if record is None or not isinstance(wall_ns, int):
        return None
    old = record.get("last_assistant_wall_ns")
    if not isinstance(old, int) or wall_ns > old:
        record["last_assistant_wall_ns"] = wall_ns
        record["updated_wall_ns"] = max(_record_key(record), wall_ns)
    return record


def _apply_duration(store, prompt_id, wall_ns, duration_ms):
    if not prompt_id or not isinstance(wall_ns, int):
        return None
    if (not isinstance(duration_ms, (int, float))
            or isinstance(duration_ms, bool) or duration_ms < 0):
        return None
    record = _terminal_record(store, prompt_id, (wall_ns, None, None))
    duration_ns = int(round(duration_ms * 1_000_000))
    if record.get("end_source") in ("hook_stop", "hook_stop_failure"):
        if record.get("status") == "completed":
            record["duration_ns"] = duration_ns
            record["updated_wall_ns"] = max(_record_key(record), wall_ns)
        return record
    _finish_record(
        record, "completed", wall_ns, None, None,
        "transcript_duration", "turn_duration", duration_ns=duration_ns,
        updated_wall_ns=wall_ns,
    )
    return record


def reconcile_transcript_events(session_id, observations):
    """Idempotently fold ordered transcript lifecycle observations."""
    if not session_id or not isinstance(observations, (list, tuple)):
        return None
    indexed = list(enumerate(observations))
    indexed.sort(key=lambda pair: (
        pair[1].get("wall_ns", 0) if isinstance(pair[1], dict) else 0,
        pair[0],
    ))

    def transition(store):
        observed_prompt_id = store.get("current_prompt_id")
        for _index, event in indexed:
            if not isinstance(event, dict):
                continue
            kind = event.get("kind")
            wall_ns = event.get("wall_ns")
            if kind == "prompt":
                record = _apply_prompt(store, event.get("prompt_id"), wall_ns)
                if record is not None:
                    observed_prompt_id = record.get("prompt_id")
            elif kind == "interrupt":
                _apply_interrupt(store, wall_ns)
            elif kind == "local_command":
                _apply_local_command(store, event.get("prompt_id"), wall_ns)
            elif kind == "assistant":
                _apply_assistant(store, observed_prompt_id, wall_ns)
            elif kind == "turn_duration":
                _apply_duration(
                    store, observed_prompt_id, wall_ns, event.get("duration_ms")
                )
        _prune_turns(store)
        return store.get("current_prompt_id") or observed_prompt_id

    result = _with_store(str(session_id), transition)
    _prune_states()
    return result


def reconcile_idle_state(session_id, prompt_id, ended_wall_ns):
    """Use a process-verified idle registry entry only as a final fallback."""
    if not session_id or not prompt_id or not isinstance(ended_wall_ns, int):
        return None

    def transition(store):
        record = _find_turn(store, prompt_id)
        if record is None or record.get("status") != "running":
            return prompt_id
        start = record.get("started_wall_ns")
        if isinstance(start, int) and ended_wall_ns < start:
            return prompt_id
        assistant = record.get("last_assistant_wall_ns")
        completed = isinstance(assistant, int) and (
            not isinstance(start, int) or assistant >= start
        )
        _finish_record(
            record,
            "completed" if completed else "withdrawn",
            ended_wall_ns,
            None,
            None,
            "registry_idle" if completed else "registry_withdrawn",
            "idle_after_assistant" if completed else "pre_response_cancel",
            updated_wall_ns=ended_wall_ns,
        )
        return prompt_id

    result = _with_store(str(session_id), transition)
    _prune_states()
    return result


def record_interrupt(session_id, prompt_id, ended_wall_ns):
    """Compatibility wrapper; chronological matching intentionally wins."""
    return reconcile_transcript_events(session_id, [{
        "kind": "interrupt",
        "prompt_id": str(prompt_id) if prompt_id else None,
        "wall_ns": ended_wall_ns,
    }])


def record_local_command(session_id, prompt_id, ended_wall_ns):
    return reconcile_transcript_events(session_id, [{
        "kind": "local_command",
        "prompt_id": str(prompt_id) if prompt_id else None,
        "wall_ns": ended_wall_ns,
    }])


def record_prompt_withdrawal(session_id, prompt_id, ended_wall_ns):
    if not session_id or not prompt_id or not isinstance(ended_wall_ns, int):
        return None

    def transition(store):
        record = _find_turn(store, prompt_id)
        if record is not None and record.get("status") == "running":
            _finish_record(
                record, "withdrawn", ended_wall_ns, None, None,
                "registry_withdrawn", "pre_response_cancel",
                updated_wall_ns=ended_wall_ns,
            )
        return prompt_id

    return _with_store(str(session_id), transition)


def _unknown_lower_bound(data, record, wall_ns):
    lower = record.get("started_wall_ns") or wall_ns
    path = data.get("transcript_path")
    if isinstance(path, str):
        try:
            lower = max(lower, os.stat(path).st_mtime_ns)
        except OSError:
            pass
    return min(lower, wall_ns)


def handle_event(data):
    if not isinstance(data, dict):
        return None
    session_id = data.get("session_id")
    event = data.get("hook_event_name")
    if not session_id or not event:
        return None
    # The configured lifecycle is for the main CLI turn only.
    if data.get("agent_id"):
        return None
    session_id = str(session_id)
    prompt_id = data.get("prompt_id")
    prompt_id = str(prompt_id) if prompt_id else None
    clocks = now_clocks()

    def transition(store):
        wall_ns, boot_ns, boot_id = clocks
        if event == "UserPromptSubmit":
            if not prompt_id:
                return store.get("current_prompt_id")
            record = _find_turn(store, prompt_id)
            if record is None:
                _upsert_turn(store, prompt_id, clocks, "hook_submit")
            store["current_prompt_id"] = prompt_id
            return prompt_id
        if event == "Stop":
            target = prompt_id or store.get("current_prompt_id")
            if not target:
                return store.get("current_prompt_id")
            existed = _find_turn(store, target) is not None
            current_record = _find_turn(store, store.get("current_prompt_id"))
            record = _terminal_record(store, target, clocks)
            _finish_record(
                record, "completed", wall_ns, boot_ns, boot_id,
                "hook_stop", "stop", updated_wall_ns=wall_ns,
            )
            if (store.get("current_prompt_id") in (None, target) or not existed
                    or (isinstance(current_record, dict)
                        and current_record.get("status") in ("ignored", "withdrawn"))):
                store["current_prompt_id"] = target
            return store.get("current_prompt_id")
        if event == "StopFailure":
            error = data.get("error")
            error = str(error) if error else "unknown"
            target = prompt_id or store.get("current_prompt_id")
            if not target:
                return store.get("current_prompt_id")
            existed = _find_turn(store, target) is not None
            current_record = _find_turn(store, store.get("current_prompt_id"))
            record = _terminal_record(store, target, clocks)
            _finish_record(
                record, "failed", wall_ns, boot_ns, boot_id,
                "hook_stop_failure", "stop_failure", error,
                updated_wall_ns=wall_ns,
            )
            if (store.get("current_prompt_id") in (None, target) or not existed
                    or (isinstance(current_record, dict)
                        and current_record.get("status") in ("ignored", "withdrawn"))):
                store["current_prompt_id"] = target
            return store.get("current_prompt_id")
        if event == "SessionEnd":
            target = prompt_id or store.get("current_prompt_id")
            record = _find_turn(store, target)
            if isinstance(record, dict) and record.get("status") == "running":
                _finish_record(
                    record, "interrupted", wall_ns, boot_ns, boot_id,
                    "hook_session_end",
                    "session_end:" + str(data.get("reason") or "other"),
                    updated_wall_ns=wall_ns,
                )
            return store.get("current_prompt_id")
        if event == "SessionStart":
            source = str(data.get("source") or "startup")
            # SessionStart can also run after /clear or /compact. Those are not
            # evidence that an in-flight prompt was abandoned; only a fresh
            # process startup/resume makes a pre-existing running state stale.
            record = _find_turn(store, store.get("current_prompt_id"))
            if (source in ("startup", "resume") and isinstance(record, dict)
                    and record.get("status") == "running"):
                ended = _unknown_lower_bound(data, record, wall_ns)
                _finish_record(
                    record, "unknown", ended, None, None,
                    "session_start", "unconfirmed_previous_run",
                    updated_wall_ns=wall_ns,
                )
            return store.get("current_prompt_id")
        return store.get("current_prompt_id")

    result = _with_store(session_id, transition)
    _prune_states()
    return result


def main():
    try:
        raw = sys.stdin.buffer.read()
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        data = json.loads(raw.decode("utf-8"))
        handle_event(data)
    except Exception:
        # Lifecycle hooks must never block, restart, or fail a Claude turn.
        pass


if __name__ == "__main__":
    main()
