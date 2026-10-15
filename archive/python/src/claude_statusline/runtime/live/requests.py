"""Request deduplication and read-only token/timing/cost views."""

from claude_statusline.runtime.live import model, ownership

ITEMS = (
    "ttft",
    "output-rate",
    "prompt-input-tokens",
    "prompt-output-tokens",
    "prompt-cost",
)


def key(o):
    return o["epoch"] + ":" + o["request_id"]


def _bounded(state, rows):
    while len(rows) > model.MAX_REQUESTS:
        old = rows.pop(min(rows, key=lambda k: rows[k]["updated_at_ms"]))
        prompt = state["prompts"].get(old["prompt_id"])
        if prompt:
            prompt["complete"] = False


def apply(state, o):
    stamp, kind = o["observed_at_ms"], o["kind"]
    target = ownership.owner(state, o)
    if kind == "turn_usage":
        turn = state["turns"].get(
            ownership.turn_key(o["epoch"], o["turn_id"], o["agent_id"])
        )
        if turn:
            turn["usage"] = o["payload"]["usage"]
        return
    if kind == "request_cost":
        if target is not None and not any(
            t["prompt_id"] == target for t in state["turns"].values()
        ):
            return
        previous = state["costs"].get(o["request_id"])
        value = {
            "prompt_id": target,
            "owner_alias": o["prompt_id"],
            "cost_usd": o["payload"]["cost_usd"],
            "usage": o["payload"]["usage"],
            "updated_at_ms": stamp,
            "request_key": key(o) if o["turn_id"] else None,
            "conflict": False,
        }
        if previous is None:
            state["costs"][o["request_id"]] = value
        elif any(previous[k] != value[k] for k in ("cost_usd", "usage")) or (
            previous.get("owner_alias") != value["owner_alias"]
            and previous["prompt_id"] != target
        ):
            previous["conflict"] = True
        _bounded(state, state["costs"])
        return
    request = state["requests"].setdefault(
        key(o),
        {
            "prompt_id": target,
            "agent_id": o["agent_id"],
            "turn_key": ownership.turn_key(o["epoch"], o["turn_id"], o["agent_id"]),
            "epoch": o["epoch"],
            "started_at_ms": None,
            "first_at_ms": None,
            "ended_at_ms": None,
            "usage": None,
            "native": False,
            "status": None,
            "conflict": False,
            "updated_at_ms": stamp,
        },
    )
    if request["prompt_id"] is None:
        request["prompt_id"] = target
    if target is not None and request["prompt_id"] != target:
        request["conflict"] = True
        return
    field = {
        "request_start": "started_at_ms",
        "request_first": "first_at_ms",
        "request_end": "ended_at_ms",
    }[kind]
    if request[field] is None:
        request[field] = stamp
    if kind == "request_end":
        payload = o["payload"]
        if request["status"] is None:
            request.update(payload)
        elif any(request[k] != payload[k] for k in ("usage", "native", "status")):
            request["conflict"] = True
    request["updated_at_ms"] = max(stamp, request["updated_at_ms"])
    _bounded(state, state["requests"])


def reconcile(state, agent_id, prompt_id):
    for request in state["requests"].values():
        if (
            request["agent_id"] == agent_id
            and request["epoch"] == state["epoch"]
            and request["prompt_id"] is None
        ):
            request["prompt_id"] = prompt_id


def reconcile_costs(state):
    for row in state["costs"].values():
        if row["prompt_id"] is None:
            target = ownership.canonical(state, row.get("owner_alias"))
            if target and any(
                turn["prompt_id"] == target
                and turn["started_at_ms"] <= row["updated_at_ms"]
                for turn in state["turns"].values()
            ):
                row["prompt_id"] = target


def metrics(state, selected, point, *, live, terminal):
    reconcile_costs(state)
    points = {item: point(reason="not_observed") for item in ITEMS}
    if selected is None:
        return points
    rows = {
        key: row
        for key, row in state["requests"].items()
        if row["prompt_id"] == selected
    }
    if not live and not terminal:
        return points
    main = [
        row
        for row in rows.values()
        if row["agent_id"] is None and row["started_at_ms"] is not None
    ]
    if main:
        latest = max(main, key=lambda row: row["started_at_ms"])
        start, first, end = (
            latest["started_at_ms"],
            latest["first_at_ms"],
            latest["ended_at_ms"],
        )
        bad_clock = (
            (first is not None and first < start)
            or (end is not None and end < start)
            or (first is not None and end is not None and first > end)
        )
        reason = (
            "inconsistent_request"
            if latest["conflict"]
            else "abnormal_clock"
            if bad_clock
            else "synthetic_response"
            if latest["status"] is not None and not latest["native"]
            else "missing_stream"
        )
        if not latest["conflict"] and not bad_clock and first is not None:
            points["ttft"] = point(
                (first - start) / 1000, source="native.turn.step", at=first
            )
        else:
            points["ttft"] = point(reason=reason)
        if (
            not latest["conflict"]
            and not bad_clock
            and latest["native"]
            and latest["usage"] is not None
            and end is not None
            and end > start
        ):
            points["output-rate"] = point(
                latest["usage"]["output_tokens"] * 1000 / (end - start),
                source="native.turn.step",
                at=end,
            )
        else:
            points["output-rate"] = point(
                reason="abnormal_clock" if end == start else reason
            )
    valid = [
        row
        for row in rows.values()
        if row["native"] and row["usage"] is not None and not row["conflict"]
    ]
    prompt = state["prompts"].get(selected, {})
    partial = not terminal or not prompt.get("complete") or len(valid) != len(rows)
    for identity, agent in state["agents"].items():
        if agent["prompt_id"] == selected and (
            agent["ended_at_ms"] is None
            or not any(row["agent_id"] == identity for row in valid)
        ):
            partial = True
    turns = [row for row in state["turns"].values() if row["prompt_id"] == selected]
    for turn in turns:
        turn_rows = [
            row for row in valid if state["turns"].get(row["turn_key"]) is turn
        ]
        totals = {
            k: sum(row["usage"][k] for row in turn_rows) for k in model.USAGE_KEYS
        }
        if (
            turn.get("usage") is None
            or turn.get("ended_at_ms") is None
            or totals != turn["usage"]
        ):
            partial = True
    if valid:
        at = max(row["updated_at_ms"] for row in valid)
        points["prompt-input-tokens"] = point(
            sum(
                row["usage"]["input_tokens"]
                + row["usage"]["cache_read_input_tokens"]
                + row["usage"]["cache_creation_input_tokens"]
                for row in valid
            ),
            "incomplete" if partial else None,
            source="native.requests",
            at=at,
            partial=partial,
        )
        points["prompt-output-tokens"] = point(
            sum(row["usage"]["output_tokens"] for row in valid),
            "incomplete" if partial else None,
            source="native.requests",
            at=at,
            partial=partial,
        )
    costs = [
        row
        for row in state["costs"].values()
        if row["prompt_id"] == selected and not row["conflict"]
    ]
    if costs:
        joined = {row["request_key"] for row in costs if row["request_key"] in rows}
        cost_partial = partial or not rows or joined != set(rows)
        points["prompt-cost"] = point(
            sum(row["cost_usd"] for row in costs),
            "request_join_unavailable" if cost_partial else None,
            source="otel.api_request",
            at=max(row["updated_at_ms"] for row in costs),
            partial=cost_partial,
        )
    return points
