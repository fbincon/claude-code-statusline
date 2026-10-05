"""Resolve explicit loop identities; ambiguous queued prompts remain unbound."""


def canonical(state, prompt_id):
    for _ in range(32):
        target = state["prompt_aliases"].get(prompt_id)
        if isinstance(target, dict):
            agent = state["agents"].get(target["agent_id"])
            target = (
                agent["prompt_id"]
                if agent and agent["epoch"] == target["epoch"]
                else None
            )
            if target is None:
                return None
        if not target or target == prompt_id:
            break
        prompt_id = target
    return prompt_id if prompt_id in state["prompts"] else None


def turn_key(epoch, turn_id, agent_id=None):
    return epoch + ":" + (agent_id or "main") + ":" + str(turn_id)


def owner(state, observation, *, parent=False):
    o = observation
    agent_id = o["parent_agent_id"] if parent else o["agent_id"]
    if o["turn_id"]:
        turn = state["turns"].get(turn_key(o["epoch"], o["turn_id"], agent_id))
        if turn:
            return turn["prompt_id"]
    if agent_id and agent_id in state["agents"]:
        agent = state["agents"][agent_id]
        return agent["prompt_id"] if agent["epoch"] == o["epoch"] else None
    target = canonical(state, o["prompt_id"])
    return (
        target if target and state["prompts"][target]["epoch"] == o["epoch"] else None
    )


def pending_owner(state, epoch):
    bound = {
        turn["prompt_id"]
        for turn in state["turns"].values()
        if turn["agent_id"] is None
    }
    candidates = [
        key
        for key, prompt in state["prompts"].items()
        if prompt["epoch"] == epoch and key not in bound and not prompt["terminal"]
    ]
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        active = state["active_prompt_id"]
        prompt = state["prompts"].get(active)
        if prompt and prompt["epoch"] == epoch and not prompt["terminal"]:
            return active
    return None
