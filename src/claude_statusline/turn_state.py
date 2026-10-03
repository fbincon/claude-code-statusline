"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "BASE_DIR": ("claude_statusline.runtime.turns.store", "BASE_DIR"),
    "COMPATIBLE_LIFECYCLE_SCHEMAS": (
        "claude_statusline.runtime.turns.model",
        "COMPATIBLE_LIFECYCLE_SCHEMAS",
    ),
    "CONFIG_DIR": ("claude_statusline.runtime.turns.store", "CONFIG_DIR"),
    "LIFECYCLE_SCHEMA": ("claude_statusline.runtime.turns.model", "LIFECYCLE_SCHEMA"),
    "MAX_SESSIONS": ("claude_statusline.runtime.turns.store", "MAX_SESSIONS"),
    "MAX_TURNS_PER_SESSION": (
        "claude_statusline.runtime.turns.model",
        "MAX_TURNS_PER_SESSION",
    ),
    "RUNTIME_ROOT": ("claude_statusline.runtime.turns.store", "RUNTIME_ROOT"),
    "SCHEMA": ("claude_statusline.runtime.turns.model", "SCHEMA"),
    "TURN_DIR": ("claude_statusline.runtime.turns.store", "TURN_DIR"),
    "_END_PRIORITY": ("claude_statusline.runtime.turns.model", "_END_PRIORITY"),
    "_TERMINAL_STATUSES": (
        "claude_statusline.runtime.turns.model",
        "_TERMINAL_STATUSES",
    ),
    "_TURN_FIELDS": ("claude_statusline.runtime.turns.model", "_TURN_FIELDS"),
    "_agent_id": ("claude_statusline.runtime.turns.reducer", "_agent_id"),
    "_agent_prompt": ("claude_statusline.runtime.turns.reducer", "_agent_prompt"),
    "_agent_type": ("claude_statusline.runtime.turns.reducer", "_agent_type"),
    "_agent_work_pending": (
        "claude_statusline.runtime.turns.reducer",
        "_agent_work_pending",
    ),
    "_apply_assistant": ("claude_statusline.runtime.turns.reducer", "_apply_assistant"),
    "_apply_duration": ("claude_statusline.runtime.turns.reducer", "_apply_duration"),
    "_apply_interrupt": ("claude_statusline.runtime.turns.reducer", "_apply_interrupt"),
    "_apply_local_command": (
        "claude_statusline.runtime.turns.reducer",
        "_apply_local_command",
    ),
    "_apply_prompt": ("claude_statusline.runtime.turns.reducer", "_apply_prompt"),
    "_atomic_write": ("claude_statusline.runtime.turns.store", "_atomic_write"),
    "_authoritative_subagents": (
        "claude_statusline.runtime.turns.reducer",
        "_authoritative_subagents",
    ),
    "_clean_active_agents": (
        "claude_statusline.runtime.turns.model",
        "_clean_active_agents",
    ),
    "_clean_record": ("claude_statusline.runtime.turns.model", "_clean_record"),
    "_elapsed_ns": ("claude_statusline.runtime.turns.model", "_elapsed_ns"),
    "_find_turn": ("claude_statusline.runtime.turns.model", "_find_turn"),
    "_finish_record": ("claude_statusline.runtime.turns.reducer", "_finish_record"),
    "_legacy_record": ("claude_statusline.runtime.turns.model", "_legacy_record"),
    "_load_unlocked": ("claude_statusline.runtime.turns.store", "_load_unlocked"),
    "_lock_path": ("claude_statusline.runtime.turns.store", "_lock_path"),
    "_mirror_state": ("claude_statusline.runtime.turns.store", "_mirror_state"),
    "_new_record": ("claude_statusline.runtime.turns.model", "_new_record"),
    "_prune_states": ("claude_statusline.runtime.turns.store", "_prune_states"),
    "_prune_turns": ("claude_statusline.runtime.turns.model", "_prune_turns"),
    "_record_key": ("claude_statusline.runtime.turns.model", "_record_key"),
    "_reopen_low_priority_completion": (
        "claude_statusline.runtime.turns.reducer",
        "_reopen_low_priority_completion",
    ),
    "_safe_mkdir": ("claude_statusline.runtime.turns.store", "_safe_mkdir"),
    "_session_key": ("claude_statusline.runtime.turns.store", "_session_key"),
    "_start_subagent": ("claude_statusline.runtime.turns.reducer", "_start_subagent"),
    "_state_path": ("claude_statusline.runtime.turns.store", "_state_path"),
    "_stop_subagent": ("claude_statusline.runtime.turns.reducer", "_stop_subagent"),
    "_store_from_state": ("claude_statusline.runtime.turns.model", "_store_from_state"),
    "_terminal_record": ("claude_statusline.runtime.turns.model", "_terminal_record"),
    "_unknown_lower_bound": (
        "claude_statusline.runtime.turns.reducer",
        "_unknown_lower_bound",
    ),
    "_upsert_turn": ("claude_statusline.runtime.turns.model", "_upsert_turn"),
    "_with_lock": ("claude_statusline.runtime.turns.store", "_with_lock"),
    "_with_store": ("claude_statusline.runtime.turns.store", "_with_store"),
    "handle_event": ("claude_statusline.runtime.turns.reducer", "handle_event"),
    "hashlib": ("claude_statusline.runtime.turns.store", "hashlib"),
    "json": ("claude_statusline.runtime.turns.store", "json"),
    "load_turn_state": ("claude_statusline.runtime.turns.store", "load_turn_state"),
    "load_turn_store": ("claude_statusline.runtime.turns.store", "load_turn_store"),
    "main": ("claude_statusline.integration.lifecycle_hook", "main"),
    "math": ("claude_statusline.runtime.turns.reducer", "math"),
    "now_clocks": ("claude_statusline.runtime.turns.store", "now_clocks"),
    "os": ("claude_statusline.runtime.turns.store", "os"),
    "reconcile_idle_state": (
        "claude_statusline.runtime.turns.reducer",
        "reconcile_idle_state",
    ),
    "reconcile_transcript_events": (
        "claude_statusline.runtime.turns.reducer",
        "reconcile_transcript_events",
    ),
    "record_interrupt": ("claude_statusline.runtime.turns.reducer", "record_interrupt"),
    "record_local_command": (
        "claude_statusline.runtime.turns.reducer",
        "record_local_command",
    ),
    "record_prompt_withdrawal": (
        "claude_statusline.runtime.turns.reducer",
        "record_prompt_withdrawal",
    ),
    "sys": ("claude_statusline.integration.lifecycle_hook", "sys"),
    "time": ("claude_statusline.runtime.turns.reducer", "time"),
}

_MODULES = {"_platform": "claude_statusline._platform"}


def __getattr__(name):
    if name in _MODULES:
        return import_module(_MODULES[name])
    try:
        module, attribute = _EXPORTS[name]
    except KeyError:
        raise AttributeError(name) from None
    return getattr(import_module(module), attribute)


def __dir__():
    return sorted(set(globals()) | set(_EXPORTS))


if __name__ == "__main__":
    raise SystemExit(__getattr__("main")())
