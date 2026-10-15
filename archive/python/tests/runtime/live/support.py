"""Identity-complete records with deterministic clocks."""


def observation(
    kind="heartbeat",
    seq=0,
    at=1000,
    *,
    session="s",
    epoch="e",
    prompt=None,
    agent=None,
    payload=None,
    source="native",
    **identity,
):
    defaults = {
        "heartbeat": {"host_version": "2.1.289", "loaded_at_ms": 1000},
        "prompt": {},
        "permission": {"mode": "plan", "live": False},
        "agent_start": {"started_at_ms": at},
        "agent_end": {"ended_at_ms": at, "status": "completed"},
        "invalidate": {"reason": "session_resume"},
    }
    return {
        "session_id": session,
        "epoch": epoch,
        "seq": seq,
        "observed_at_ms": at,
        "source": source,
        "kind": kind,
        "prompt_id": prompt,
        "agent_id": agent,
        "parent_agent_id": None,
        "turn_id": None,
        "request_id": None,
        "payload": defaults.get(kind, {}) if payload is None else payload,
        **identity,
    }
