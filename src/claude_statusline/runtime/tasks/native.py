"""Map explicit native loop identities into the canonical task ledger.

Runtime evidence is replayable. The live observation lock is acquired before
the task lock; task/compatibility writers never acquire a live lock.
"""

from claude_statusline.runtime.tasks import model, reducer, store
from claude_statusline.runtime.timing.clock import Sample, StatusTimer


def _sample(wall_ns, record=None, *, starting=False):
    # A hook's uptime anchor bridges the native start into the same boot domain.
    if starting and record and type(record.get("started_boot_ns")) is int:
        offset = wall_ns - record["started_wall_ns"]
        if offset >= 0 and record.get("boot_id"):
            return Sample(
                wall_ns, record["started_boot_ns"] + offset, record["boot_id"]
            )
    captured = Sample(*store.now_clocks())
    delay = captured.wall_ns - wall_ns
    if (
        captured.boot_id
        and captured.boot_ns is not None
        and 0 <= delay <= 2_000_000_000
    ):
        return Sample(wall_ns, captured.boot_ns - delay, captured.boot_id)
    return Sample(wall_ns)


def _link(history, alias, target):
    original = model._find_turn(history, alias)
    message = model._find_turn(history, target)
    if original and message and original is not message:
        for item in message.get("prompt_aliases", []):
            model._remember_id(original, "prompt_aliases", item)
        history["turns"].remove(message)
    record = original or message
    if record:
        for key in (alias, target):
            if key != record["prompt_id"]:
                model._remember_id(record, "prompt_aliases", key)
        if history.get("current_prompt_id") in (alias, target):
            history["current_prompt_id"] = record["prompt_id"]


def observe(config_dir, state, observations, *, complete_timing=True):
    epoch = state["epoch"]
    ledger = state["epochs"].get(epoch, {})
    contiguous = (
        ledger.get("floor") == -1
        and len(ledger.get("seen", [])) == ledger.get("high", -2) + 1
    )

    def transition(history):
        pending_ends = []
        for alias, target in state["prompt_aliases"].items():
            if isinstance(target, str):
                _link(history, alias, target)
        # A real prompt is accepted by the collector before its turn. A classic
        # hook normally already owns its suspend-aware start, which is retained.
        for prompt, info in state["prompts"].items():
            if info["epoch"] != epoch or info.get("source") == "lifecycle_window":
                continue
            linked = (
                prompt in state["prompt_aliases"]
                or prompt in state["prompt_aliases"].values()
            )
            if info.get("source") == "native" and history["turns"] and not linked:
                continue  # Message UUID awaits its explicit human prompt link.
            if model._find_turn(history, prompt) is None:
                reducer._apply_prompt(
                    history, prompt, int(round(info["started_at_ms"] * 1e6))
                )
        for alias, target in state["prompt_aliases"].items():
            if isinstance(target, str):
                _link(history, alias, target)
        for key, turn in sorted(
            state["turns"].items(), key=lambda item: item[1]["started_at_ms"]
        ):
            if turn.get("epoch") != epoch:
                continue
            if turn["prompt_id"] is None:
                continue
            record = model._find_turn(history, turn["prompt_id"])
            if record is None or record.get("historical_frozen"):
                continue
            if any(
                loop.get("epoch") != epoch for loop in record["native_turns"].values()
            ):
                record["active_coverage"] = "incomplete"
            previous = record["native_turns"].get(key)
            started = int(round(turn["started_at_ms"] * 1e6))
            agent = turn["agent_id"]
            if (
                previous is None
                and agent is None
                and record["status"] == "completed"
                and record.get("end_source") == "native_turn_end"
                and started > (record.get("ended_wall_ns") or started)
                and record.get("report_aliases")
                and history.get("current_prompt_id") == record["prompt_id"]
            ):
                record.update(
                    status="running",
                    ended_wall_ns=None,
                    ended_boot_ns=None,
                    duration_ns=None,
                    end_source=None,
                    end_reason=None,
                    phase="main",
                )
            if previous is None or record.get("active_clock") is None:
                candidate = record.get("stop_candidate")
                if candidate and started > candidate["wall_ns"]:
                    record.update(stop_candidate=None, phase="main")
                if record.get("active_clock") is None:
                    record["active_clock"] = StatusTimer.start(
                        _sample(started, record, starting=True)
                    ).to_dict()
                else:
                    timer = StatusTimer.load(record["active_clock"])
                    if timer:
                        record["active_clock"] = timer.reopen().to_dict()
                if (
                    complete_timing
                    and contiguous
                    and record["active_coverage"] == "not_observed"
                ):
                    record["active_coverage"] = "complete"
                if agent:
                    reducer._start_subagent(
                        history, record["prompt_id"], {"agent_id": agent}, started
                    )
            record["native_turns"][key] = dict(
                turn, confirmed_end=bool(previous and previous.get("confirmed_end"))
            )
            if not contiguous or (state["invalidated"] and turn["ended_at_ms"] is None):
                record["active_coverage"] = "incomplete"
            pending_ends.append((key, record, turn, previous, agent))
        wait_starts = {}
        for event in state.get("wait_events", {}).values():
            if event["kind"] == "wait_start":
                identity = (
                    event["epoch"],
                    event["agent_id"],
                    event["turn_id"],
                    event["request_id"],
                )
                wait_starts[identity] = min(
                    wait_starts.get(identity, event["seq"]), event["seq"]
                )
        for observation in sorted(
            state.get("wait_events", {}).values(), key=lambda item: item["seq"]
        ):
            if observation["epoch"] != epoch or not observation["kind"].startswith(
                "wait_"
            ):
                continue
            key = (
                epoch
                + ":"
                + (observation["agent_id"] or "main")
                + ":"
                + str(observation["turn_id"])
            )
            turn = state["turns"].get(key)
            record = (
                model._find_turn(history, turn["prompt_id"])
                if turn and turn["prompt_id"] is not None
                else None
            )
            if record is None:
                continue
            if observation["kind"] == "wait_end":
                identity = (
                    epoch,
                    observation["agent_id"],
                    observation["turn_id"],
                    observation["request_id"],
                )
                if (
                    wait_starts.get(identity, observation["seq"] + 1)
                    >= observation["seq"]
                ):
                    record["active_coverage"] = "incomplete"
            identity = epoch + ":" + str(observation["seq"])
            if not model._remember_id(record, "native_wait_seen", identity):
                continue
            if observation["kind"] == "wait_unknown":
                record["active_coverage"] = "wait_coverage_missing"
                continue
            timer = StatusTimer.load(record.get("active_clock"))
            if timer is None:
                continue
            token = key + ":" + observation["request_id"]
            now = _sample(
                int(round(observation["observed_at_ms"] * 1e6)), record, starting=True
            )
            if observation["kind"] == "wait_start":
                # Other executing loops keep the task active. Exact union
                # coverage of parallel waits is deliberately conservative.
                if record.get("active_agents"):
                    record["active_coverage"] = "incomplete"
                else:
                    timer = timer.pause(token, now)
            else:
                timer = timer.resume(token, now)
            record["active_clock"] = timer.to_dict()
        for key, record, turn, previous, agent in pending_ends:
            pending_exit = record.get("end_source") == "hook_session_end"
            later_ending = (
                agent is None
                and record.get("end_source") == "native_turn_end"
                and turn["ended_at_ms"] is not None
                and turn["ended_at_ms"] * 1e6
                > (record.get("ended_wall_ns") or float("inf"))
            )
            if turn["ended_at_ms"] is None or (
                previous
                and previous.get("confirmed_end") is True
                and not pending_exit
                and not later_ending
            ):
                continue
            record["native_turns"][key]["confirmed_end"] = True
            ended = int(round(turn["ended_at_ms"] * 1e6))
            if agent:
                if not complete_timing or not turn.get("wait_coverage", False):
                    record["active_coverage"] = "wait_coverage_missing"
                reducer._stop_subagent(
                    history, record["prompt_id"], {"agent_id": agent}, ended
                )
            else:
                if any(
                    loop["agent_id"] is None
                    and loop["started_at_ms"] > turn["started_at_ms"]
                    for loop in record["native_turns"].values()
                ):
                    continue  # A completed earlier main phase cannot end later wrap-up.
                if later_ending:
                    record.update(
                        status="running",
                        ended_wall_ns=None,
                        ended_boot_ns=None,
                        duration_ns=None,
                        end_source=None,
                        end_reason=None,
                    )
                    timer = StatusTimer.load(record.get("active_clock"))
                    if timer:
                        record["active_clock"] = timer.reopen().to_dict()
                if "duration_ms" in turn:
                    record["native_duration_ms"] = turn["duration_ms"]
                if not complete_timing or not turn.get("wait_coverage", False):
                    record["active_coverage"] = "wait_coverage_missing"
                elif record["active_coverage"] in ("not_observed", "complete"):
                    record["active_coverage"] = (
                        "complete" if contiguous else "incomplete"
                    )
                pending = record.get("report_aliases") and record.get(
                    "pending_agent_reports"
                )
                active_native = any(
                    loop["agent_id"] is not None
                    and loop["started_at_ms"] <= turn["ended_at_ms"]
                    and (
                        loop["ended_at_ms"] is None
                        or loop["ended_at_ms"] > turn["ended_at_ms"]
                    )
                    for loop in record["native_turns"].values()
                )
                if turn["status"] == "completed" and (
                    record.get("active_agents") or pending or active_native
                ):
                    continue
                candidate = record.get("stop_candidate")
                sample = _sample(ended)
                wall, boot, domain = sample.wall_ns, sample.boot_ns, sample.boot_id
                if candidate and 0 <= ended - candidate["wall_ns"] <= 2_000_000_000:
                    wall, boot, domain = (
                        ended,
                        (candidate["boot_ns"] + ended - candidate["wall_ns"])
                        if type(candidate.get("boot_ns")) is int
                        else None,
                        candidate.get("boot_id"),
                    )
                confirmed = reducer._finish_record(
                    record,
                    turn["status"],
                    wall,
                    boot,
                    domain,
                    "native_turn_end",
                    "native_main_end",
                    updated_wall_ns=ended,
                )
                if confirmed or (
                    record["status"] == turn["status"] and record["status"] != "running"
                ):
                    timer = StatusTimer.load(record.get("active_clock"))
                    if timer:
                        frozen_end = (
                            Sample(wall, boot, domain)
                            if confirmed
                            else Sample(
                                record["ended_wall_ns"],
                                record.get("ended_boot_ns"),
                                record.get("boot_id"),
                            )
                        )
                        record["active_clock"] = timer.finish(frozen_end).to_dict()
            while len(record["native_turns"]) > 256:
                record["native_turns"].pop(next(iter(record["native_turns"])))
        return history.get("current_prompt_id")

    return store._with_store(state["session_id"], transition, config_dir)
