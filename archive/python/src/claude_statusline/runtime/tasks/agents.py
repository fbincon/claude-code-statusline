"""Agent ownership and report tracking for a canonical user task."""

from claude_statusline.runtime.tasks import model as turn_model


def _reopen(record, wall_ns):
    from claude_statusline.runtime.tasks.reducer import _reopen_low_priority_completion

    return _reopen_low_priority_completion(record, wall_ns)


def _agent_id(data):
    value = data.get("agent_id") if isinstance(data, dict) else None
    return value if isinstance(value, str) and value else None


def _agent_type(data):
    if not isinstance(data, dict):
        return "Agent"
    for key in ("agent_type", "name", "type"):
        value = data.get(key)
        if isinstance(value, str) and value:
            return value
    return "Agent"


def _authoritative_subagents(background_tasks, existing, wall_ns):
    if not isinstance(background_tasks, list):
        return None
    current = turn_model._clean_active_agents(existing)
    snapshot = {}
    for task in background_tasks:
        if not isinstance(task, dict) or task.get("type") != "subagent":
            continue
        task_id = task.get("id")
        if not isinstance(task_id, str) or not task_id or task_id in snapshot:
            continue
        previous = current.get(task_id)
        snapshot[task_id] = previous or {
            "agent_type": _agent_type(task),
            "started_wall_ns": wall_ns,
        }
    return snapshot


def _agent_prompt(store, prompt_id, agent_id, *, starting=False):
    if starting and prompt_id:
        return prompt_id
    owners = [
        record["prompt_id"]
        for record in store.get("turns", ())
        if agent_id in (record.get("active_agents") or {})
    ]
    if len(owners) == 1:
        return owners[0]
    owners = [
        record["prompt_id"]
        for record in store.get("turns", ())
        if agent_id in record.get("agent_ids", ())
    ]
    if len(owners) == 1:
        return owners[0]
    if prompt_id:
        return prompt_id
    if len(store.get("turns", ())) == 1:
        return store.get("current_prompt_id")
    return None


def _start_subagent(store, prompt_id, data, wall_ns):
    target = _agent_prompt(store, prompt_id, _agent_id(data), starting=True)
    record = turn_model._find_turn(store, target)
    agent_id = _agent_id(data)
    if (
        not target
        or record is None
        or agent_id is None
        or wall_ns < (record.get("started_wall_ns") or 0)
    ):
        return store.get("current_prompt_id")
    if not _reopen(record, wall_ns):
        return store.get("current_prompt_id")
    active = turn_model._clean_active_agents(record.get("active_agents"))
    previous = active.get(agent_id)
    if previous is None:
        active[agent_id] = {
            "agent_type": _agent_type(data),
            "started_wall_ns": wall_ns,
        }
    else:
        started = previous.get("started_wall_ns")
        if not isinstance(started, int) or started <= 0 or wall_ns < started:
            previous["started_wall_ns"] = wall_ns
    record["active_agents"] = active
    candidate = record.get("stop_candidate")
    if isinstance(candidate, dict) and wall_ns > candidate.get("wall_ns", wall_ns):
        record["stop_candidate"] = None
        record["phase"] = "main"
    record["had_subagents"] = True
    if turn_model._remember_id(record, "agent_ids", agent_id):
        turn_model._remember_id(record, "pending_agent_reports", agent_id)
    if record.get("phase") == "resuming_main":
        record["phase"] = "main"
    record["updated_wall_ns"] = max(turn_model._record_key(record), wall_ns)
    return target


def _stop_subagent(store, prompt_id, data, wall_ns):
    target = _agent_prompt(store, prompt_id, _agent_id(data))
    record = turn_model._find_turn(store, target)
    agent_id = _agent_id(data)
    if (
        not target
        or record is None
        or record.get("status") != "running"
        or agent_id is None
        or wall_ns < (record.get("started_wall_ns") or 0)
    ):
        return store.get("current_prompt_id")
    record["had_subagents"] = True
    if turn_model._remember_id(record, "agent_ids", agent_id):
        turn_model._remember_id(record, "pending_agent_reports", agent_id)
    active = turn_model._clean_active_agents(record.get("active_agents"))
    if agent_id in active:
        active.pop(agent_id, None)
        record["active_agents"] = active
        record["updated_wall_ns"] = max(turn_model._record_key(record), wall_ns)
        if record.get("phase") == "waiting_subagents" and not active:
            record["phase"] = "resuming_main"
    return target
