"""runtime / turns / reducer implementation."""

from __future__ import annotations

import math
import json
import os
import time
from claude_statusline.runtime.turns import model as turn_model
from claude_statusline.runtime.turns import store as turn_store


def _finish_record(
    record,
    status,
    ended_wall_ns,
    ended_boot_ns,
    boot_id,
    source,
    reason,
    error=None,
    duration_ns=None,
    updated_wall_ns=None,
):
    """Apply one terminal observation without weakening stronger evidence."""
    if not isinstance(record, dict) or not isinstance(ended_wall_ns, int):
        return False
    old_source = record.get("end_source")
    old_priority = turn_model._END_PRIORITY.get(old_source, 0)
    new_priority = turn_model._END_PRIORITY.get(source, 0)
    if record.get("status") in turn_model._TERMINAL_STATUSES:
        if new_priority <= old_priority:
            return False
    native = (
        status == "completed"
        and not record.get("had_subagents")
        and isinstance(duration_ns, int)
        and duration_ns >= 0
    )
    if (
        status == "completed"
        and source == "hook_stop"
        and not record.get("had_subagents")
        and record.get("duration_source") == "native"
    ):
        duration_ns = record.get("duration_ns")
        native = isinstance(duration_ns, int)
    if not native:
        duration_ns = turn_model._elapsed_ns(
            record, ended_wall_ns, ended_boot_ns, boot_id
        )
    record.update(
        {
            "status": status,
            "ended_wall_ns": ended_wall_ns,
            "ended_boot_ns": (
                ended_boot_ns if record.get("boot_id") == boot_id else None
            ),
            "end_source": source,
            "end_reason": reason,
            "error": error,
            "duration_ns": duration_ns,
            "duration_source": "native" if native else "task",
            "updated_wall_ns": (
                updated_wall_ns if isinstance(updated_wall_ns, int) else time.time_ns()
            ),
            "phase": "main",
            "active_agents": {},
        }
    )
    return True


def _agent_work_pending(record):
    if not isinstance(record, dict) or record.get("status") != "running":
        return False
    return bool(
        record.get("had_subagents") or record.get("active_agents")
    ) or record.get("phase") in (
        "waiting_subagents",
        "resuming_main",
    )


def _reopen_low_priority_completion(record, wall_ns):
    """Undo only inferred completion when a main Stop proves agents remain."""
    if not isinstance(record, dict):
        return False
    if record.get("status") == "running":
        return True
    if record.get("end_source") not in ("transcript_duration", "registry_idle"):
        return False
    record.update(
        {
            "status": "running",
            "ended_wall_ns": None,
            "ended_boot_ns": None,
            "duration_ns": None,
            "duration_source": None,
            "end_source": None,
            "end_reason": None,
            "error": None,
            "updated_wall_ns": wall_ns,
        }
    )
    return True


def _apply_prompt(store, prompt_id, wall_ns):
    if not prompt_id or not isinstance(wall_ns, int):
        return None
    prompt_id = str(prompt_id)
    previous = turn_model._find_turn(store, store.get("current_prompt_id"))
    record = turn_model._find_turn(store, prompt_id)
    if record is None:
        record = turn_model._new_record(prompt_id, (wall_ns, None, None), "transcript")
        store.setdefault("turns", []).append(record)
    else:
        # End-to-end timing begins at the earliest trustworthy user-submit
        # observation. A later transcript write must not shorten queued or
        # agent-backed work that the UserPromptSubmit hook already observed.
        existing_start = record.get("started_wall_ns")
        if record.get("status") == "running" and (
            not isinstance(existing_start, int) or wall_ns < existing_start
        ):
            record["started_wall_ns"] = wall_ns
            record["started_boot_ns"] = None
            record["boot_id"] = None
            record["start_source"] = "transcript"
        if record.get("status") not in turn_model._TERMINAL_STATUSES:
            record["status"] = "running"
        if record.get("status") == "running":
            record["updated_wall_ns"] = max(turn_model._record_key(record), wall_ns)
    previous_start = previous.get("started_wall_ns") if previous else None
    if (
        isinstance(previous, dict)
        and previous is not record
        and previous.get("status") == "running"
        and isinstance(previous_start, int)
        and previous_start <= wall_ns
    ):
        _finish_record(
            previous,
            "unknown",
            wall_ns,
            None,
            None,
            "next_prompt",
            "superseded_without_terminal_event",
            updated_wall_ns=wall_ns,
        )
    if (
        previous is None
        or previous is record
        or not isinstance(previous_start, int)
        or (
            isinstance(record.get("started_wall_ns"), int)
            and record["started_wall_ns"] >= previous_start
        )
    ):
        store["current_prompt_id"] = record["prompt_id"]
    return record


def _apply_interrupt(store, wall_ns):
    if not isinstance(wall_ns, int):
        return None
    candidates = []
    for record in store.get("turns", ()):
        start = record.get("started_wall_ns")
        end = record.get("ended_wall_ns")
        eligible = record.get("status") == "running" or (
            record.get("end_source")
            in ("next_prompt", "registry_idle", "transcript_duration")
            and isinstance(end, int)
            and wall_ns <= end
        )
        if eligible and isinstance(start, int) and start <= wall_ns:
            candidates.append(record)
    if not candidates:
        return None
    record = max(candidates, key=lambda item: item.get("started_wall_ns") or 0)
    _finish_record(
        record,
        "interrupted",
        wall_ns,
        None,
        None,
        "transcript_interrupt",
        "user_interrupt",
        updated_wall_ns=wall_ns,
    )
    return record


def _apply_local_command(store, prompt_id, wall_ns):
    if not prompt_id or not isinstance(wall_ns, int):
        return None
    record = turn_model._find_turn(store, prompt_id)
    if record is None:
        record = turn_model._new_record(
            prompt_id, (wall_ns, None, None), "local_command"
        )
        store.setdefault("turns", []).append(record)
    _finish_record(
        record,
        "ignored",
        wall_ns,
        None,
        None,
        "local_command",
        "local_command",
        updated_wall_ns=wall_ns,
    )
    if store.get("current_prompt_id") == str(prompt_id):
        running = [
            item
            for item in store.get("turns", ())
            if item.get("status") == "running"
            and item.get("prompt_id") != str(prompt_id)
        ]
        store["current_prompt_id"] = (
            max(running, key=turn_model._record_key).get("prompt_id")
            if running
            else None
        )
    return record


def _apply_assistant(store, prompt_id, wall_ns):
    record = turn_model._find_turn(store, prompt_id)
    if (
        not prompt_id
        or record is None
        or not isinstance(wall_ns, int)
        or record.get("status") != "running"
        or wall_ns < (record.get("started_wall_ns") or 0)
    ):
        return None
    old = record.get("last_assistant_wall_ns")
    if not isinstance(old, int) or wall_ns > old:
        record["last_assistant_wall_ns"] = wall_ns
        record["updated_wall_ns"] = max(turn_model._record_key(record), wall_ns)
    if (
        record.get("status") == "running"
        and record.get("phase") == "resuming_main"
        and not record.get("active_agents")
    ):
        record["phase"] = "main"
    return record


def _apply_agent_notification(store, prompt_id, agent_id, wall_ns):
    if not agent_id or not isinstance(wall_ns, int):
        return None
    owners = [
        item for item in store.get("turns", ()) if agent_id in item.get("agent_ids", ())
    ]
    if len(owners) != 1:
        return None
    record = owners[0]
    if prompt_id and prompt_id in record.get("prompt_aliases", ()):
        return record
    pending = agent_id in record.get("pending_agent_reports", ())
    if prompt_id:
        turn_model._remember_id(record, "prompt_aliases", prompt_id)
    if pending:
        record["pending_agent_reports"].remove(agent_id)
    if (
        pending
        and record.get("status") == "completed"
        and record.get("end_source") == "hook_stop"
        and store.get("current_prompt_id") == record["prompt_id"]
    ):
        # This is verified new host activity for an undelivered agent result,
        # rather than a duplicate terminal event or a native duration.
        record.update(
            status="running",
            ended_wall_ns=None,
            ended_boot_ns=None,
            duration_ns=None,
            duration_source=None,
            end_source=None,
            end_reason=None,
            error=None,
            phase="resuming_main",
        )
    if record.get("status") == "running":
        record["updated_wall_ns"] = max(turn_model._record_key(record), wall_ns)
    return record


def _apply_duration(store, prompt_id, wall_ns, duration_ms):
    if not prompt_id or not isinstance(wall_ns, int):
        return None
    if (
        not isinstance(duration_ms, (int, float))
        or isinstance(duration_ms, bool)
        or duration_ms < 0
        or duration_ms > 1e15
        or not math.isfinite(duration_ms)
    ):
        return None
    record = turn_model._find_turn(store, prompt_id)
    if record is None:
        return None
    if (
        record.get("had_subagents")
        or _agent_work_pending(record)
        or record.get("status") in ("failed", "interrupted", "ignored", "withdrawn")
        or wall_ns < (record.get("started_wall_ns") or 0)
    ):
        return record
    duration_ns = int(round(duration_ms * 1_000_000))
    if record.get("end_source") in ("hook_stop", "hook_stop_failure"):
        if (
            record.get("status") == "completed"
            and record.get("duration_source") != "native"
        ):
            record["duration_ns"] = duration_ns
            record["duration_source"] = "native"
        return record
    _finish_record(
        record,
        "completed",
        wall_ns,
        None,
        None,
        "transcript_duration",
        "turn_duration",
        duration_ns=duration_ns,
        updated_wall_ns=wall_ns,
    )
    return record


def reconcile_transcript_events(session_id, observations):
    """Idempotently fold ordered transcript lifecycle observations."""
    if not session_id or not isinstance(observations, (list, tuple)):
        return None
    indexed = list(enumerate(observations))
    indexed.sort(
        key=lambda pair: (
            pair[1].get("wall_ns", 0) if isinstance(pair[1], dict) else 0,
            pair[0],
        )
    )

    def transition(store):
        observed_prompt_id = None
        for _index, event in indexed:
            if not isinstance(event, dict):
                continue
            kind = event.get("kind")
            wall_ns = event.get("wall_ns")
            target = event.get("prompt_id") or observed_prompt_id
            if (
                target is None
                and "prompt_id" not in event
                and len(store.get("turns", ())) == 1
            ):
                target = store["turns"][0].get("prompt_id")
            if kind == "prompt":
                record = _apply_prompt(store, event.get("prompt_id"), wall_ns)
                if record is not None:
                    observed_prompt_id = record.get("prompt_id")
            elif kind == "interrupt":
                _apply_interrupt(store, wall_ns)
            elif kind == "local_command":
                _apply_local_command(store, event.get("prompt_id"), wall_ns)
            elif kind == "agent_notification":
                record = _apply_agent_notification(
                    store, event.get("prompt_id"), event.get("agent_id"), wall_ns
                )
                if record is not None:
                    observed_prompt_id = record["prompt_id"]
            elif kind == "assistant":
                _apply_assistant(store, target, wall_ns)
            elif kind == "turn_duration":
                _apply_duration(store, target, wall_ns, event.get("duration_ms"))
        turn_model._prune_turns(store)
        return store.get("current_prompt_id") or observed_prompt_id

    result = turn_store._with_store(str(session_id), transition)
    turn_store._prune_states()
    return result


def reconcile_idle_state(session_id, prompt_id, ended_wall_ns):
    """Use a process-verified idle registry entry only as a final fallback."""
    if not session_id or not prompt_id or not isinstance(ended_wall_ns, int):
        return None

    def transition(store):
        record = turn_model._find_turn(store, prompt_id)
        if record is None or record.get("status") != "running":
            return prompt_id
        if _agent_work_pending(record):
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

    result = turn_store._with_store(str(session_id), transition)
    turn_store._prune_states()
    return result


def record_interrupt(session_id, prompt_id, ended_wall_ns):
    """Compatibility wrapper; chronological matching intentionally wins."""
    return reconcile_transcript_events(
        session_id,
        [
            {
                "kind": "interrupt",
                "prompt_id": str(prompt_id) if prompt_id else None,
                "wall_ns": ended_wall_ns,
            }
        ],
    )


def record_local_command(session_id, prompt_id, ended_wall_ns):
    return reconcile_transcript_events(
        session_id,
        [
            {
                "kind": "local_command",
                "prompt_id": str(prompt_id) if prompt_id else None,
                "wall_ns": ended_wall_ns,
            }
        ],
    )


def record_prompt_withdrawal(session_id, prompt_id, ended_wall_ns):
    if not session_id or not prompt_id or not isinstance(ended_wall_ns, int):
        return None

    def transition(store):
        record = turn_model._find_turn(store, prompt_id)
        if (
            record is not None
            and record.get("status") == "running"
            and not _agent_work_pending(record)
        ):
            _finish_record(
                record,
                "withdrawn",
                ended_wall_ns,
                None,
                None,
                "registry_withdrawn",
                "pre_response_cancel",
                updated_wall_ns=ended_wall_ns,
            )
        return prompt_id

    return turn_store._with_store(str(session_id), transition)


def _unknown_lower_bound(data, record, wall_ns):
    lower = record.get("started_wall_ns") or wall_ns
    path = data.get("transcript_path")
    if isinstance(path, str):
        try:
            lower = max(lower, os.stat(path).st_mtime_ns)
        except OSError:
            pass
    return min(lower, wall_ns)


def _refresh_start_evidence(record, data, source):
    """Resolve an already-written submission before committing a frozen ending."""
    if record.get("start_source") == "transcript":
        return
    if record.get(
        "status"
    ) in turn_model._TERMINAL_STATUSES and turn_model._END_PRIORITY.get(
        record.get("end_source"), 0
    ) >= turn_model._END_PRIORITY.get(source, 0):
        return
    path = data.get("transcript_path")
    if not isinstance(path, str):
        return
    from claude_statusline.runtime import transcript

    try:
        with open(path, encoding="utf-8-sig") as stream:
            for line in stream:
                if '"promptId"' not in line or record["prompt_id"] not in line:
                    continue
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if (
                    not isinstance(row, dict)
                    or row.get("type") != "user"
                    or row.get("promptId") != record["prompt_id"]
                ):
                    continue
                message = row.get("message")
                if not isinstance(
                    message, dict
                ) or not transcript._is_real_prompt_record(row, message.get("content")):
                    continue
                timestamp = transcript._ts_to_epoch(row.get("timestamp"))
                if timestamp is None:
                    continue
                started = int(round(timestamp * 1e9))
                previous = record.get("started_wall_ns")
                if isinstance(previous, int) and started >= previous:
                    return
                boot = record.get("started_boot_ns")
                delta = previous - started if isinstance(previous, int) else None
                if (
                    isinstance(boot, int)
                    and isinstance(delta, int)
                    and 0 <= delta <= boot
                ):
                    record["started_boot_ns"] = boot - delta
                else:
                    record["started_boot_ns"] = None
                    record["boot_id"] = None
                record["started_wall_ns"] = started
                record["start_source"] = "transcript"
                return
    except OSError:
        pass


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
    if not _reopen_low_priority_completion(record, wall_ns):
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


def handle_event(data):
    if not isinstance(data, dict):
        return None
    session_id = data.get("session_id")
    event = data.get("hook_event_name")
    if not session_id or not event:
        return None
    session_id = str(session_id)
    prompt_id = data.get("prompt_id")
    prompt_id = str(prompt_id) if prompt_id else None
    clocks = turn_store.now_clocks()

    def transition(store):
        wall_ns, boot_ns, boot_id = clocks
        if event == "SubagentStart":
            return _start_subagent(store, prompt_id, data, wall_ns)
        if event == "SubagentStop":
            return _stop_subagent(store, prompt_id, data, wall_ns)
        # Ordinary events emitted from inside an agent do not describe the
        # main CLI lifecycle. Only the two explicit subagent hooks above do.
        if data.get("agent_id"):
            return store.get("current_prompt_id")
        if event == "UserPromptSubmit":
            if not prompt_id:
                return store.get("current_prompt_id")
            notification = turn_model.agent_notification_id(data.get("prompt"))
            if notification:
                record = _apply_agent_notification(
                    store, prompt_id, notification, wall_ns
                )
                if record is None:
                    _apply_local_command(store, prompt_id, wall_ns)
                return store.get("current_prompt_id")
            record = turn_model._find_turn(store, prompt_id)
            if record is None:
                turn_model._upsert_turn(store, prompt_id, clocks, "hook_submit")
            previous = turn_model._find_turn(store, store.get("current_prompt_id"))
            if (
                previous is not None
                and record is not None
                and previous is not record
                and (record.get("started_wall_ns") or 0)
                < (previous.get("started_wall_ns") or 0)
            ):
                return store.get("current_prompt_id")
            if (
                isinstance(previous, dict)
                and previous.get("prompt_id") != prompt_id
                and previous.get("status") == "running"
            ):
                _finish_record(
                    previous,
                    "unknown",
                    wall_ns,
                    boot_ns,
                    boot_id,
                    "next_prompt",
                    "superseded_without_terminal_event",
                    updated_wall_ns=wall_ns,
                )
            store["current_prompt_id"] = prompt_id
            return prompt_id
        if event == "Stop":
            target = prompt_id or store.get("current_prompt_id")
            if not target:
                return store.get("current_prompt_id")
            current_record = turn_model._find_turn(
                store, store.get("current_prompt_id")
            )
            record = turn_model._terminal_record(store, target, clocks)
            if record.get("status") in ("failed", "interrupted", "ignored"):
                return store.get("current_prompt_id")
            _refresh_start_evidence(record, data, "hook_stop")
            snapshot = _authoritative_subagents(
                data.get("background_tasks"),
                record.get("active_agents"),
                wall_ns,
            )
            if snapshot is not None and (
                record.get("status") == "running"
                or (bool(snapshot) and _reopen_low_priority_completion(record, wall_ns))
            ):
                record["active_agents"] = snapshot
                if snapshot:
                    record["had_subagents"] = True
                    for agent in snapshot:
                        if turn_model._remember_id(record, "agent_ids", agent):
                            turn_model._remember_id(
                                record, "pending_agent_reports", agent
                            )
            active = turn_model._clean_active_agents(record.get("active_agents"))
            reports_pending = bool(
                record.get("prompt_aliases") and record.get("pending_agent_reports")
            )
            if (active or reports_pending) and _reopen_low_priority_completion(
                record, wall_ns
            ):
                record.update(
                    {
                        "status": "running",
                        "phase": "waiting_subagents" if active else "resuming_main",
                        "active_agents": active,
                        "ended_wall_ns": None,
                        "ended_boot_ns": None,
                        "duration_ns": None,
                        "duration_source": None,
                        "end_source": None,
                        "end_reason": None,
                        "error": None,
                        "updated_wall_ns": wall_ns,
                    }
                )
            else:
                _finish_record(
                    record,
                    "completed",
                    wall_ns,
                    boot_ns,
                    boot_id,
                    "hook_stop",
                    "stop",
                    updated_wall_ns=wall_ns,
                )
            if store.get("current_prompt_id") in (None, target) or (
                isinstance(current_record, dict)
                and current_record.get("status") in ("ignored", "withdrawn")
            ):
                store["current_prompt_id"] = record["prompt_id"]
            return store.get("current_prompt_id")
        if event == "StopFailure":
            error = data.get("error")
            error = str(error) if error else "unknown"
            target = prompt_id or store.get("current_prompt_id")
            if not target:
                return store.get("current_prompt_id")
            current_record = turn_model._find_turn(
                store, store.get("current_prompt_id")
            )
            record = turn_model._terminal_record(store, target, clocks)
            _refresh_start_evidence(record, data, "hook_stop_failure")
            _finish_record(
                record,
                "failed",
                wall_ns,
                boot_ns,
                boot_id,
                "hook_stop_failure",
                "stop_failure",
                error,
                updated_wall_ns=wall_ns,
            )
            if store.get("current_prompt_id") in (None, target) or (
                isinstance(current_record, dict)
                and current_record.get("status") in ("ignored", "withdrawn")
            ):
                store["current_prompt_id"] = record["prompt_id"]
            return store.get("current_prompt_id")
        if event == "SessionEnd":
            target = prompt_id or store.get("current_prompt_id")
            record = turn_model._find_turn(store, target)
            if isinstance(record, dict) and record.get("status") == "running":
                _refresh_start_evidence(record, data, "hook_session_end")
                _finish_record(
                    record,
                    "interrupted",
                    wall_ns,
                    boot_ns,
                    boot_id,
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
            record = turn_model._find_turn(store, store.get("current_prompt_id"))
            if (
                source in ("startup", "resume")
                and isinstance(record, dict)
                and record.get("status") == "running"
            ):
                ended = _unknown_lower_bound(data, record, wall_ns)
                _finish_record(
                    record,
                    "unknown",
                    ended,
                    None,
                    None,
                    "session_start",
                    "unconfirmed_previous_run",
                    updated_wall_ns=wall_ns,
                )
            return store.get("current_prompt_id")
        return store.get("current_prompt_id")

    result = turn_store._with_store(session_id, transition)
    turn_store._prune_states()
    return result
