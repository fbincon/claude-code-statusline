"""Collect and reconcile timer evidence before the pure rendering stage."""

from claude_statusline.runtime import registry as runtime_registry
from claude_statusline.runtime.tasks import reducer as turn_reducer
from claude_statusline.runtime.tasks import store as turn_store


def _local_command_is_current(
    local_command, payload_prompt_id, real_prompt_id, last_pt
):
    if not isinstance(local_command, dict):
        return False
    local_prompt_id = local_command.get("prompt_id")
    if (
        local_prompt_id
        and real_prompt_id
        and str(local_prompt_id) == str(real_prompt_id)
    ):
        return False  # a real human record with the same ID wins
    if payload_prompt_id:
        return bool(local_prompt_id) and str(local_prompt_id) == str(payload_prompt_id)
    local_ts = local_command.get("ts")
    return isinstance(local_ts, (int, float)) and (
        last_pt is None or local_ts > last_pt
    )


def collect(
    sid,
    prompt_id,
    last_pt,
    entry,
):
    if not sid:
        return None
    sid = str(sid)
    payload_prompt_id = str(prompt_id) if prompt_id else None
    real_prompt_id = entry.get("last_prompt_id")
    real_prompt_id = str(real_prompt_id) if real_prompt_id else None
    local_command = entry.get("last_local_command")

    local_is_current = _local_command_is_current(
        local_command, payload_prompt_id, real_prompt_id, last_pt
    )

    # A local command never becomes a timed turn. Preserve the most recent
    # real prompt's frozen or running display until another real prompt begins.
    if local_is_current and not real_prompt_id:
        return None

    effective_prompt_id = real_prompt_id or payload_prompt_id
    if payload_prompt_id and payload_prompt_id != real_prompt_id:
        payload_state = turn_store.load_turn_state(sid, payload_prompt_id)
        payload_start = (
            payload_state.get("started_wall_ns")
            if isinstance(payload_state, dict)
            else None
        )
        transcript_start = (
            int(last_pt * 1_000_000_000) if isinstance(last_pt, (int, float)) else None
        )
        if (
            isinstance(payload_state, dict)
            and payload_state.get("status") == "running"
            and (
                not isinstance(transcript_start, int)
                or (isinstance(payload_start, int) and payload_start > transcript_start)
            )
        ):
            # UserPromptSubmit can lead the transcript by one refresh tick.
            effective_prompt_id = payload_prompt_id

    if not effective_prompt_id:
        return None
    state = turn_store.load_turn_state(sid, effective_prompt_id)

    # A complete transcript prompt is sufficient evidence to self-heal a
    # missing enqueue/dequeue hook record. Never use an older prompt timestamp
    # for a different payload id.
    if (
        not isinstance(state, dict)
        and real_prompt_id == effective_prompt_id
        and isinstance(last_pt, (int, float))
    ):
        try:
            turn_reducer.reconcile_transcript_events(
                sid,
                [
                    {
                        "kind": "prompt",
                        "prompt_id": effective_prompt_id,
                        "wall_ns": int(round(last_pt * 1_000_000_000)),
                    }
                ],
            )
            state = turn_store.load_turn_state(sid, effective_prompt_id)
        except Exception:
            state = None

    if not isinstance(state, dict):
        return None

    if state.get("status") == "running":
        session = runtime_registry._read_cli_session_status(sid)
        if isinstance(session, dict) and session.get("status") == "idle":
            ended_wall_ns = session.get("status_updated_wall_ns")
            start_wall_ns = state.get("started_wall_ns")
            if isinstance(ended_wall_ns, int) and (
                not isinstance(start_wall_ns, int) or ended_wall_ns >= start_wall_ns
            ):
                try:
                    turn_reducer.reconcile_idle_state(
                        sid, effective_prompt_id, ended_wall_ns
                    )
                    state = (
                        turn_store.load_turn_state(sid, effective_prompt_id) or state
                    )
                except Exception:
                    pass

    return state
