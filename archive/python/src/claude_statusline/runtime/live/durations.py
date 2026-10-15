"""Independent agent end evidence, collected by existing lifecycle hooks."""

import json
from pathlib import Path
import time

from claude_statusline.platforms import files
from claude_statusline.runtime.live import model, store


def path(config_dir, session):
    return (
        store.root(config_dir).parent
        / "agent-durations"
        / store.path(config_dir, session).name
    )


def load(config_dir, session):
    try:
        value = json.loads(path(config_dir, session).read_bytes())
        if (
            isinstance(value, dict)
            and value.get("session_id") == session
            and isinstance(value.get("agents"), dict)
        ):
            return value["agents"]
    except (OSError, ValueError, TypeError):
        pass
    return {}


def observe(data, *, now_ms=None, config_dir=None):
    from claude_statusline.runtime.turns import store as turns

    event = data.get("hook_event_name") if isinstance(data, dict) else None
    if event not in ("SubagentStart", "SubagentStop"):
        return
    session, agent = data.get("session_id"), data.get("agent_id")
    if (
        not isinstance(session, str)
        or not isinstance(agent, str)
        or not session
        or not agent
    ):
        return
    config_dir = Path(turns.CONFIG_DIR) if config_dir is None else Path(config_dir)
    now_ms = time.time() * 1000 if now_ms is None else now_ms
    model.number(now_ms, "agent observation time")
    target = path(config_dir, session)
    with files.exclusive_file_lock(target.with_suffix(".lock")):
        agents = load(config_dir, session)
        record = agents.get(agent)
        if event == "SubagentStart":
            lifecycle = turns.load_turn_store(session) or {}
            owners = [
                row
                for row in lifecycle.get("turns", ())
                if agent in row.get("agent_ids", ())
            ]
            if len(owners) != 1:
                return
            prompt = owners[0].get("prompt_id")
            if record is None:
                agents[agent] = {
                    "prompt_id": prompt,
                    "started_at_ms": now_ms,
                    "ended_at_ms": None,
                }
        elif (
            record
            and record["ended_at_ms"] is None
            and now_ms >= record["started_at_ms"]
        ):
            record["ended_at_ms"] = now_ms
        else:
            return
        while len(agents) > model.MAX_AGENTS:
            agents.pop(min(agents, key=lambda key: agents[key]["started_at_ms"]))
        files.atomic_write_bytes(
            target,
            json.dumps({"session_id": session, "agents": agents}).encode(),
            0o600,
        )
    entries = sorted(
        target.parent.glob("*.json"), key=lambda p: p.stat().st_mtime_ns, reverse=True
    )
    for old in entries[model.MAX_SESSIONS :]:
        with files.exclusive_file_lock(old.with_suffix(".lock")):
            old.unlink(missing_ok=True)


def ended_at(config_dir, session):
    result = {}
    live = store.load(config_dir, session)
    for key, row in (live["agents"] if live else {}).items():
        end = row.get("ended_at_ms")
        if type(end) in (int, float) and end >= 0:
            result[key] = end
    for key, row in load(config_dir, session).items():
        end = row.get("ended_at_ms") if isinstance(row, dict) else None
        if type(end) in (int, float) and end >= 0:
            result[key] = end
    return result
