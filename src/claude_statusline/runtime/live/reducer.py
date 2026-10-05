"""Merge observations without changing the prompt-timer lifecycle reducer."""

from claude_statusline.runtime.live import model


def _trim(values, maximum, stamp="updated_at_ms"):
    if len(values) > maximum:
        for key in sorted(values, key=lambda key: values[key].get(stamp, 0))[:-maximum]:
            values.pop(key, None)


def apply(state, observation):
    o = observation
    epoch = o["epoch"]
    kind = o["kind"]
    stamp = o["observed_at_ms"]
    if epoch not in state["epochs"]:
        if kind != "heartbeat":
            return False
        loaded = o["payload"]["loaded_at_ms"]
        if state["loaded_at_ms"] is not None and loaded <= state["loaded_at_ms"]:
            return False
        state["epochs"][epoch] = {
            "seen": [],
            "floor": -1,
            "high": -1,
            "updated_at_ms": loaded,
        }
        state.update(
            epoch=epoch,
            loaded_at_ms=loaded,
            heartbeat_at_ms=None,
            invalidated=None,
            current_prompt_id=None,
            permission=None,
        )
        for prompt in state["prompts"].values():
            if not prompt.get("terminal"):
                prompt["complete"] = False
        _trim(state["epochs"], model.MAX_EPOCHS)
    ledger = state["epochs"][epoch]
    seq = o["seq"]
    if seq <= ledger["floor"] or seq in ledger["seen"]:
        return False
    gap = seq > ledger["high"] + 1
    ledger["seen"].append(seq)
    ledger["seen"].sort()
    ledger["high"] = max(seq, ledger["high"])
    if len(ledger["seen"]) > model.MAX_SEEN:
        removed = ledger["seen"][: -model.MAX_SEEN]
        ledger["floor"] = max(removed)
        ledger["seen"] = ledger["seen"][-model.MAX_SEEN :]
    current = epoch == state["epoch"]
    if kind == "heartbeat":
        if current and (
            state["heartbeat_at_ms"] is None or stamp >= state["heartbeat_at_ms"]
        ):
            state.update(
                heartbeat_at_ms=stamp, host_version=o["payload"]["host_version"]
            )
        return True
    if kind == "invalidate":
        if current:
            state["invalidated"] = o["payload"]["reason"]
        return True
    prompt_id = o["prompt_id"]
    if kind == "prompt":
        if not current:
            return True
        previous = state["prompts"].get(state["current_prompt_id"])
        if previous and previous["updated_at_ms"] > stamp:
            return True
        state["prompts"].setdefault(
            prompt_id,
            {
                "updated_at_ms": stamp,
                "started_at_ms": stamp,
                "epoch": epoch,
                "complete": not gap,
                "terminal": False,
            },
        )
        state["current_prompt_id"] = prompt_id
        _trim(state["prompts"], model.MAX_PROMPTS)
    elif kind == "permission":
        previous = state["permission"]
        if (
            current
            and o["agent_id"] is None
            and (previous is None or stamp >= previous["observed_at_ms"])
        ):
            state["permission"] = {
                **o["payload"],
                "observed_at_ms": stamp,
                "source": o["source"],
            }
    elif kind in ("agent_start", "agent_end"):
        agent_id = o["agent_id"]
        record = state["agents"].get(agent_id)
        if record is None:
            if not prompt_id or prompt_id not in state["prompts"]:
                return True
            record = {
                "prompt_id": prompt_id,
                "epoch": epoch,
                "started_at_ms": None,
                "ended_at_ms": None,
                "status": None,
                "updated_at_ms": stamp,
            }
            state["agents"][agent_id] = record
        if prompt_id is not None and record["prompt_id"] != prompt_id:
            return True
        if record["epoch"] != epoch:
            return True
        field = "started_at_ms" if kind == "agent_start" else "ended_at_ms"
        observed = o["payload"][field]
        if record[field] is None or observed < record[field]:
            record[field] = observed
        if kind == "agent_end" and record["status"] is None:
            record["status"] = o["payload"]["status"]
        record["updated_at_ms"] = max(stamp, record["updated_at_ms"])
        _trim(state["agents"], model.MAX_AGENTS)
    if gap and current:
        for prompt in state["prompts"].values():
            if not prompt["terminal"]:
                prompt["complete"] = False
    return True
