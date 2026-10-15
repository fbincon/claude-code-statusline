"""runtime / registry implementation."""

from __future__ import annotations

import json
import os
from claude_statusline.platforms import processes as platform_processes
from claude_statusline.runtime import paths as runtime_paths


def _proc_start_time(pid):
    return platform_processes.process_start_token(pid)


def _read_cli_session_status(session_id):
    """Return the newest live, process-verified registry entry for a session."""
    if not session_id:
        return None
    best = None
    try:
        entries = os.scandir(runtime_paths.SESSIONS_DIR)
    except OSError:
        return None
    with entries:
        for entry in entries:
            if not entry.is_file(follow_symlinks=False) or not entry.name.endswith(
                ".json"
            ):
                continue
            stem = entry.name[:-5]
            if not stem.isdigit():
                continue
            try:
                with open(entry.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (OSError, ValueError, TypeError):
                continue
            if not isinstance(data, dict):
                continue
            pid = data.get("pid")
            updated_ms = data.get("statusUpdatedAt")
            if (
                data.get("sessionId") != str(session_id)
                or not isinstance(pid, int)
                or isinstance(pid, bool)
                or pid != int(stem)
                or not isinstance(updated_ms, int)
                or isinstance(updated_ms, bool)
            ):
                continue
            process_token = _proc_start_time(pid)
            if (
                process_token is None
                or str(data.get("procStart") or "") != process_token
            ):
                continue
            candidate = {
                "status": data.get("status"),
                "status_updated_wall_ns": updated_ms * 1_000_000,
                "pid": pid,
            }
            if (
                best is None
                or candidate["status_updated_wall_ns"] > best["status_updated_wall_ns"]
            ):
                best = candidate
    return best
