"""Deduplicate runtime observations and maintain derived live metric views."""

from claude_statusline.runtime.live import model
from claude_statusline.runtime.live import ownership
from claude_statusline.runtime.live import requests


def _trim(values, maximum, stamp="updated_at_ms"):
    if len(values) > maximum:
        for key in sorted(values, key=lambda key: values[key].get(stamp, 0))[:-maximum]:
            values.pop(key, None)


def apply(state, observation, *, metadata_only=False):
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
            active_prompt_id=None,
            current_main_turn_id=None,
            agent_snapshot=None,
            checklists={},
            prompt_aliases={},
            prompt_links={},
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
    if metadata_only:
        return True
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
                "source": o["source"],
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
    elif kind == "prompt_link":
        target = o["payload"]["message_id"]
        if current:
            state["prompt_links"][prompt_id] = target
            while len(state["prompt_links"]) > model.MAX_AGENTS:
                state["prompt_links"].pop(next(iter(state["prompt_links"])))
            state["prompt_aliases"][prompt_id] = target
            if target not in state["prompts"] and prompt_id not in state["prompts"]:
                state["prompts"][target] = {
                    "epoch": epoch,
                    "started_at_ms": stamp,
                    "updated_at_ms": stamp,
                    "complete": not gap,
                    "terminal": False,
                    "source": "otel",
                }
                state["current_prompt_id"] = target
                _trim(state["prompts"], model.MAX_PROMPTS)
    elif kind == "prompt_alias":
        agent = state["agents"].get(o["payload"]["agent_id"])
        fresh_report = prompt_id not in state["prompt_aliases"]
        if current and prompt_id not in state["prompts"]:
            state["prompt_aliases"][prompt_id] = (
                agent["prompt_id"]
                if agent and agent["epoch"] == epoch
                else {"agent_id": o["payload"]["agent_id"], "epoch": epoch}
            )
            while len(state["prompt_aliases"]) > model.MAX_AGENTS:
                state["prompt_aliases"].pop(next(iter(state["prompt_aliases"])))
        if (
            current
            and fresh_report
            and o["source"] == "classic_hook"
            and o["agent_id"] is None
            and agent is not None
            and agent["ended_at_ms"] is not None
        ):
            target = agent["prompt_id"]
            prompt = state["prompts"].get(target)
            if prompt:
                prompt["terminal"] = False
                state["active_prompt_id"] = target
    elif kind in ("wait_start", "wait_end", "wait_unknown"):
        state["wait_events"][epoch + ":" + str(seq)] = dict(o)
        _trim(state["wait_events"], model.MAX_SEEN, "observed_at_ms")
    elif kind in ("turn_start", "turn_end"):
        if not current:
            return True
        key = ownership.turn_key(epoch, o["turn_id"], o["agent_id"])
        turn = state["turns"].get(key)
        if turn is None:
            target = ownership.owner(state, o)
            if target is None and o["agent_id"] is None:
                target = ownership.pending_owner(state, epoch)
            turn = {
                "prompt_id": target,
                "agent_id": o["agent_id"],
                "started_at_ms": stamp,
                "ended_at_ms": None,
                "status": "running",
                "updated_at_ms": stamp,
                "epoch": epoch,
            }
            state["turns"][key] = turn
            if current and o["agent_id"] is None:
                state["current_main_turn_id"] = key
                state["active_prompt_id"] = target
        if (
            kind == "turn_end"
            and turn["ended_at_ms"] is None
            and stamp >= turn["started_at_ms"]
        ):
            turn.update(
                ended_at_ms=stamp, status=o["payload"]["status"], updated_at_ms=stamp
            )
            if "duration_ms" in o["payload"]:
                turn["duration_ms"] = o["payload"]["duration_ms"]
                turn["wait_coverage"] = o["payload"]["wait_coverage"]
            prompt = state["prompts"].get(turn["prompt_id"])
            if prompt and o["agent_id"] is None:
                prompt["terminal"] = not any(
                    agent["prompt_id"] == turn["prompt_id"]
                    and agent["ended_at_ms"] is None
                    for agent in state["agents"].values()
                )
        _trim(state["turns"], model.MAX_TURNS)
    elif kind == "agents":
        previous = state["agent_snapshot"]
        if current and (previous is None or stamp >= previous["observed_at_ms"]):
            state["agent_snapshot"] = {
                "agents": o["payload"]["agents"],
                "observed_at_ms": stamp,
            }
    elif kind in ("tool_start", "tool_end"):
        target = ownership.owner(state, o)
        key = epoch + ":" + o["request_id"]
        record = state["tools"].get(key)
        if record is None:
            record = {
                "prompt_id": target,
                "agent_id": o["agent_id"],
                "name": o["payload"]["name"],
                "started_at_ms": stamp,
                "updated_at_ms": stamp,
                "status": "started",
                "turn_key": ownership.turn_key(epoch, o["turn_id"], o["agent_id"])
                if o["turn_id"]
                else None,
            }
            state["tools"][key] = record
        if record["prompt_id"] is None:
            record["prompt_id"] = target
        if target is None or record["prompt_id"] == target:
            if kind == "tool_start":
                record["started_at_ms"] = min(record["started_at_ms"], stamp)
            else:
                rank = {
                    "started": 0,
                    "success": 1,
                    "error": 2,
                    "denied": 3,
                    "interrupted": 4,
                }
                status = o["payload"]["status"]
                if rank[status] > rank[record["status"]]:
                    record["status"] = status
            record["updated_at_ms"] = max(stamp, record["updated_at_ms"])
            _trim(state["tools"], model.MAX_TOOLS)
    elif kind in ("task_snapshot", "task_update"):
        target = ownership.owner(state, o)
        if current and (target or o["turn_id"]) and o["agent_id"] is None:
            provider = (
                (target or ownership.turn_key(epoch, o["turn_id"]))
                + ":"
                + o["payload"]["provider"]
            )
            previous = state["checklists"].get(provider)
            if previous is None:
                previous = {
                    "prompt_id": target,
                    "turn_key": ownership.turn_key(epoch, o["turn_id"])
                    if o["turn_id"]
                    else None,
                    "tasks": {},
                    "complete": False,
                    "updated_at_ms": 0,
                }
                state["checklists"][provider] = previous
            if stamp >= previous["updated_at_ms"]:
                if kind == "task_snapshot":
                    previous.update(
                        tasks={
                            row["id"]: row["status"]
                            for row in o["payload"]["tasks"]
                            if row["status"] != "deleted"
                        },
                        complete=True,
                    )
                else:
                    task = o["payload"]["id"]
                    status = o["payload"]["status"]
                    if status == "deleted":
                        previous["tasks"].pop(task, None)
                    else:
                        if task not in previous["tasks"]:
                            previous["complete"] = False
                        if (
                            len(previous["tasks"]) < model.MAX_TASKS
                            or task in previous["tasks"]
                        ):
                            previous["tasks"][task] = status
                previous["updated_at_ms"] = stamp
    elif kind in ("agent_start", "agent_end"):
        agent_id = o["agent_id"]
        target = (
            ownership.owner(state, o, parent=True)
            if kind == "agent_start" and o["source"] == "native"
            else ownership.owner(state, o)
        )
        prompt_id = target
        record = state["agents"].get(agent_id)
        if record is None:
            record = {
                "prompt_id": prompt_id,
                "epoch": epoch,
                "started_at_ms": None,
                "ended_at_ms": None,
                "status": None,
                "updated_at_ms": stamp,
                "parent_agent_id": o["parent_agent_id"],
                "parent_turn_key": ownership.turn_key(
                    epoch, o["turn_id"], o["parent_agent_id"]
                )
                if o["turn_id"] and o["source"] == "native"
                else None,
            }
            state["agents"][agent_id] = record
        if prompt_id is not None and record["prompt_id"] != prompt_id:
            if kind == "agent_start" and o["source"] == "native" and target:
                record["prompt_id"] = target
            else:
                return True
        if record["epoch"] != epoch:
            return True
        if kind == "agent_start" and o["source"] == "native":
            record["parent_agent_id"] = o["parent_agent_id"]
            record["parent_turn_key"] = (
                ownership.turn_key(epoch, o["turn_id"], o["parent_agent_id"])
                if o["turn_id"]
                else None
            )
            for turn in state["turns"].values():
                if turn["agent_id"] == agent_id and turn["prompt_id"] is None:
                    turn["prompt_id"] = prompt_id
            requests.reconcile(state, agent_id, prompt_id)
        field = "started_at_ms" if kind == "agent_start" else "ended_at_ms"
        observed = o["payload"][field]
        if record[field] is None or observed < record[field]:
            record[field] = observed
        if kind == "agent_end":
            rank = {None: 0, "completed": 1, "failed": 2, "killed": 3, "interrupted": 4}
            if rank[o["payload"]["status"]] > rank[record["status"]]:
                record["status"] = o["payload"]["status"]
        record["updated_at_ms"] = max(stamp, record["updated_at_ms"])
        _trim(state["agents"], model.MAX_AGENTS)
    elif kind in (
        "request_start",
        "request_first",
        "request_end",
        "request_cost",
        "turn_usage",
    ):
        requests.apply(state, o)
    if gap and current:
        for prompt in state["prompts"].values():
            if not prompt["terminal"]:
                prompt["complete"] = False
    return True
