"""Reconcile missing host prompt identities with completed lifecycle windows.

This reads existing evidence only. It never scans transcripts, repairs the timer,
matches prompt text or attaches an ambiguous/live window to the latest prompt.
"""

import json

from claude_statusline.runtime.live import requests


def reconcile(state, config_dir):
    from claude_statusline.runtime.live import store
    from claude_statusline.runtime.turns import model

    try:
        source = (
            store.root(config_dir).parent
            / "turns"
            / store.path(config_dir, state["session_id"]).name
        )
        raw = json.loads(source.read_bytes())
        if raw.get("session_id") != state["session_id"]:
            return
        history = model._store_from_state(raw, state["session_id"])
    except (OSError, ValueError, TypeError, AttributeError):
        return
    for key, turn in state["turns"].items():
        if turn["agent_id"] is not None or turn["prompt_id"] is not None:
            continue
        candidates = [
            row
            for row in history.get("turns", ())
            if row.get("status") in ("completed", "failed", "interrupted")
            and type(row.get("started_wall_ns")) is int
            and type(row.get("ended_wall_ns")) is int
            and row["started_wall_ns"]
            <= turn["started_at_ms"] * 1000000
            <= row["ended_wall_ns"]
        ]
        if len(candidates) != 1:
            continue
        row = candidates[0]
        prompt = row["prompt_id"]
        epoch = turn.get("epoch", key.split(":", 1)[0])
        ledger = state["epochs"].get(epoch, {})
        complete = (
            ledger.get("floor") == -1
            and len(ledger.get("seen", ())) == ledger.get("high", -2) + 1
            and state["loaded_at_ms"] <= row["started_wall_ns"] / 1000000
        )
        state["prompts"].setdefault(
            prompt,
            {
                "epoch": epoch,
                "started_at_ms": row["started_wall_ns"] / 1000000,
                "updated_at_ms": row["ended_wall_ns"] / 1000000,
                "complete": complete,
                "terminal": True,
                "source": "lifecycle_window",
            },
        )
        turn["prompt_id"] = prompt
        if key == state["current_main_turn_id"]:
            state["active_prompt_id"] = prompt
            if state["current_prompt_id"] is None:
                state["current_prompt_id"] = prompt
    # Spawn identity, never a child's time or text, links nested loops.
    for _ in range(32):
        changed = False
        for identity, agent in state["agents"].items():
            if agent["prompt_id"] is not None:
                continue
            parent_turn = state["turns"].get(agent.get("parent_turn_key"))
            parent = state["agents"].get(agent.get("parent_agent_id"))
            target = (parent_turn["prompt_id"] if parent_turn else None) or (
                parent["prompt_id"] if parent else None
            )
            if target is not None:
                agent["prompt_id"] = target
                requests.reconcile(state, identity, target)
                changed = True
        if not changed:
            break
    for turn in state["turns"].values():
        if turn["prompt_id"] is None and turn["agent_id"]:
            agent = state["agents"].get(turn["agent_id"])
            if agent:
                turn["prompt_id"] = agent["prompt_id"]
    for request in state["requests"].values():
        turn = state["turns"].get(request["turn_key"])
        if request["prompt_id"] is None and turn:
            request["prompt_id"] = turn["prompt_id"]

    for table in ("tools", "checklists"):
        for row in state[table].values():
            turn = state["turns"].get(row.get("turn_key"))
            if row["prompt_id"] is None and turn:
                row["prompt_id"] = turn["prompt_id"]
    from claude_statusline.runtime.live import ownership

    for row in state["costs"].values():
        if row["prompt_id"] is None:
            target = ownership.canonical(state, row.get("owner_alias"))
            if target and any(
                turn["prompt_id"] == target
                and turn["started_at_ms"] <= row["updated_at_ms"]
                for turn in state["turns"].values()
            ):
                row["prompt_id"] = target
    from claude_statusline.runtime.live import model as live_model

    for key in sorted(
        state["prompts"], key=lambda key: state["prompts"][key]["updated_at_ms"]
    )[: -live_model.MAX_PROMPTS]:
        state["prompts"].pop(key)
