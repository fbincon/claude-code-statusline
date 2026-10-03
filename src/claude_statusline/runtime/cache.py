"""runtime / cache implementation."""

from __future__ import annotations

import json
import os
from pathlib import Path
from claude_statusline.platforms import files as platform_files
from claude_statusline.runtime import paths as runtime_paths


def _load_state():
    try:
        with open(runtime_paths.STATEFILE, "r", encoding="utf-8") as f:
            state = json.load(f)
        if isinstance(state, dict) and isinstance(state.get("sessions"), dict):
            dropped = False
            for sid in list(state["sessions"]):
                s = state["sessions"][sid]
                # The old schema ({cum,prev} delta counters) is superseded by
                # transcript-derived totals; drop those entries, don't migrate.
                if not (
                    isinstance(s, dict)
                    and isinstance(s.get("files"), dict)
                    and isinstance(s.get("ids"), dict)
                ):
                    del state["sessions"][sid]
                    dropped = True
            return state, dropped
    except Exception:
        pass
    return {"sessions": {}}, False


def _save_state(state):
    # Atomic publication prevents readers from observing a torn JSON file.
    # The caller also holds STATE_LOCKFILE across load/update/save so multiple
    # Claude sessions cannot overwrite one another's newly parsed records.
    try:
        platform_files.atomic_write_bytes(
            Path(runtime_paths.STATEFILE), json.dumps(state).encode("utf-8"), 0o600
        )
    except Exception:
        pass


_STATE_LOCK_CONTEXTS = {}


def _acquire_state_lock():
    context = platform_files.exclusive_file_lock(Path(runtime_paths.STATE_LOCKFILE))
    descriptor = context.__enter__()
    _STATE_LOCK_CONTEXTS[descriptor] = context
    return descriptor


def _release_state_lock(descriptor):
    context = _STATE_LOCK_CONTEXTS.pop(descriptor, None)
    if context is None:
        os.close(descriptor)
    else:
        context.__exit__(None, None, None)
