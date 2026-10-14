import { int, truth, object, dictionary, own, maxInt, type Data } from '../values.js';
import { cleanActiveAgents, findTurn, rememberId, recordKey, type TaskStore } from './model.js';
import { reopenLowPriority } from './transitions.js';
export function agentId(data: Data): string | null { return typeof data.agent_id === 'string' && data.agent_id ? data.agent_id : null; }
export function agentType(data: Data): string {
    for (const key of ['agent_type', 'name', 'type'])
        if (typeof data[key] === 'string' && data[key])
            return data[key];
    return 'Agent';
}
export function authoritativeSubagents(tasks: unknown, existing: unknown, wall: bigint): Record<string, Data> | null {
    if (!Array.isArray(tasks))
        return null;
    const current = cleanActiveAgents(existing), snapshot = dictionary<Data>();
    for (const task of tasks) {
        if (!object(task) || task.type !== 'subagent' || typeof task.id !== 'string' || !task.id || Object.hasOwn(snapshot, task.id))
            continue;
        snapshot[task.id] = own(current, task.id) ?? { agent_type: agentType(task), started_wall_ns: wall };
    }
    return snapshot;
}
export function agentPrompt(store: TaskStore, prompt: string | null, agent: string | null, starting = false): string | null {
    if (starting && prompt)
        return prompt;
    let owners = store.turns.filter(record => agent !== null && Object.hasOwn(record.active_agents, agent));
    if (owners.length === 1)
        return owners[0]!.prompt_id;
    owners = store.turns.filter(record => agent !== null && record.agent_ids.includes(agent));
    if (owners.length === 1)
        return owners[0]!.prompt_id;
    return prompt ?? (store.turns.length === 1 ? store.current_prompt_id : null);
}
export function startSubagent(store: TaskStore, prompt: string | null, data: Data, wall: bigint): string | null {
    const agent = agentId(data), target = agentPrompt(store, prompt, agent, true), record = findTurn(store, target);
    if (!target || !record || !agent || wall < (int(record.started_wall_ns, false) ?? 0n) || !reopenLowPriority(record, wall))
        return store.current_prompt_id;
    const active = cleanActiveAgents(record.active_agents), previous = own(active, agent);
    if (!previous)
        Object.defineProperty(active, agent, { value: { agent_type: agentType(data), started_wall_ns: wall }, enumerable: true, configurable: true, writable: true });
    else {
        const started = int(previous.started_wall_ns, false);
        if (started === null || started <= 0n || wall < started)
            previous.started_wall_ns = wall;
    }
    record.active_agents = active;
    if (object(record.stop_candidate) && wall > (int(record.stop_candidate.wall_ns) ?? wall)) {
        record.stop_candidate = null;
        record.phase = 'main';
    }
    record.had_subagents = true;
    if (rememberId(record, 'agent_ids', agent))
        rememberId(record, 'pending_agent_reports', agent);
    if (record.phase === 'resuming_main')
        record.phase = 'main';
    record.updated_wall_ns = maxInt([recordKey(record), wall]);
    return target;
}
export function stopSubagent(store: TaskStore, prompt: string | null, data: Data, wall: bigint): string | null {
    const agent = agentId(data), target = agentPrompt(store, prompt, agent), record = findTurn(store, target);
    if (!target || !record || record.status !== 'running' || !agent || wall < (int(record.started_wall_ns, false) ?? 0n))
        return store.current_prompt_id;
    record.had_subagents = true;
    if (rememberId(record, 'agent_ids', agent))
        rememberId(record, 'pending_agent_reports', agent);
    const active = cleanActiveAgents(record.active_agents);
    if (Object.hasOwn(active, agent)) {
        delete active[agent];
        record.active_agents = active;
        record.updated_wall_ns = maxInt([recordKey(record), wall]);
        if (record.phase === 'waiting_subagents' && !truth(active))
            record.phase = 'resuming_main';
    }
    return target;
}
