"""runtime / turns / store implementation."""

from __future__ import annotations

import hashlib
import json
import os
from claude_statusline.platforms import clocks as platform_clocks
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.runtime.turns import model as turn_model


MAX_SESSIONS = 100


CONFIG_DIR = os.path.abspath(
    os.path.expanduser(os.environ.get("CLAUDE_CONFIG_DIR", "~/.claude"))
)


BASE_DIR = CONFIG_DIR


RUNTIME_ROOT = os.environ.get(
    "CLAUDE_STATUSLINE_RUNTIME_DIR",
    os.path.join(BASE_DIR, "statusline_runtime"),
)


TURN_DIR = os.path.join(RUNTIME_ROOT, "turns")


def _safe_mkdir(path):
    os.makedirs(path, mode=0o700, exist_ok=True)
    if platform_environment.uses_posix_files():
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


def now_clocks():
    return platform_clocks.now_clocks()


def _load_unlocked(session_id):
    try:
        with open(_state_path(session_id), "r", encoding="utf-8") as f:
            state = json.load(f)
        if (
            isinstance(state, dict)
            and state.get("schema") == turn_model.SCHEMA
            and state.get("session_id") == str(session_id)
        ):
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
    return turn_model._store_from_state(state, session_id)


def load_turn_state(session_id, prompt_id=None):
    """Read one prompt state, defaulting to the store's current prompt."""
    store = load_turn_store(session_id)
    if not isinstance(store, dict):
        return None
    record = turn_model._find_turn(store, prompt_id)
    return dict(record) if isinstance(record, dict) else None


def _atomic_write(session_id, state):
    _safe_mkdir(RUNTIME_ROOT)
    _safe_mkdir(TURN_DIR)
    content = json.dumps(state, separators=(",", ":"), sort_keys=True).encode("utf-8")
    platform_files.atomic_write_bytes(_state_path(session_id), content, 0o600)


def _prune_states():
    try:
        entries = [
            e
            for e in os.scandir(TURN_DIR)
            if e.is_file(follow_symlinks=False) and e.name.endswith(".json")
        ]
        entries.sort(
            key=lambda e: e.stat(follow_symlinks=False).st_mtime_ns, reverse=True
        )
        for entry in entries[MAX_SESSIONS:]:
            try:
                platform_files.durable_unlink(entry.path)
            except OSError:
                pass
    except OSError:
        pass


def _with_lock(session_id, callback):
    _safe_mkdir(RUNTIME_ROOT)
    _safe_mkdir(TURN_DIR)
    with platform_files.exclusive_file_lock(_lock_path(session_id)):
        state = _load_unlocked(session_id)
        new_state = callback(state)
        if isinstance(new_state, dict) and new_state != state:
            _atomic_write(session_id, new_state)
        return new_state


def _mirror_state(session_id, store, preferred_prompt_id=None):
    """Publish lifecycle v3 while keeping the schema-1 mirror contract."""
    turn_model._prune_turns(store)
    selected = turn_model._find_turn(store, preferred_prompt_id)
    if selected is None:
        return None
    store["updated_wall_ns"] = max(
        (turn_model._record_key(item) for item in store.get("turns", ())), default=0
    )
    state = {key: selected.get(key) for key in turn_model._TURN_FIELDS}
    state.update(
        {
            "schema": turn_model.SCHEMA,
            "session_id": str(session_id),
            "lifecycle": store,
        }
    )
    running = [
        item
        for item in store.get("turns", ())
        if item.get("status") == "running"
        and item.get("prompt_id") != selected.get("prompt_id")
    ]
    if selected.get("status") in ("ignored", "withdrawn") and running:
        state["previous_running"] = dict(max(running, key=turn_model._record_key))
    return state


def _with_store(session_id, callback):
    session_id = str(session_id)

    def transition(state):
        store = turn_model._store_from_state(state or {}, session_id)
        preferred = callback(store)
        return _mirror_state(session_id, store, preferred)

    return _with_lock(session_id, transition)
