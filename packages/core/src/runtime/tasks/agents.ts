import { int, object, own, dictionary, maxInt, type Data } from '../values.js';
import { cleanAgentEvidence, findTurn, lifecycleId, rememberId, recordKey, MAX_AGENT_HISTORY, type AgentEvidence, type TaskStore, type Turn } from './model.js';

export function agentType(data: Data): string {
    for (const key of ['agent_type', 'name', 'type'])
        if (typeof data[key] === 'string' && data[key])
            return data[key];
    return 'Agent';
}
export function agentEvidence(record: Turn, agent: string): AgentEvidence {
    const existing = own(record.agent_evidence, agent);
    if (existing)
        return existing;
    const evidence = cleanAgentEvidence(null);
    Object.defineProperty(record.agent_evidence, agent, { value: evidence, enumerable: true, writable: true, configurable: true });
    rememberId(record, 'agent_ids', agent);
    const excess = Object.keys(record.agent_evidence).length - MAX_AGENT_HISTORY;
    if (excess > 0)
        for (const id of Object.keys(record.agent_evidence).filter(id => id !== agent && !own(record.active_agents, id) && !record.pending_agent_reports.includes(id)).slice(0, excess))
            delete record.agent_evidence[id];
    return evidence;
}
export function expectedReports(record: Turn): string[] {
    return Object.entries(record.agent_evidence).filter(([, row]) => row.background_wall_ns !== null &&
        (row.started_wall_ns !== null || row.stopped_wall_ns !== null) && row.queued_wall_ns === null && row.delivered_wall_ns === null).map(([id]) => id);
}
export function syncAgentReports(record: Turn): void {
    record.pending_agent_reports = expectedReports(record);
}
export function agentWorkPending(record: Turn): boolean {
    return Object.keys(record.active_agents).length > 0 || expectedReports(record).length > 0;
}
export function agentsObservedThrough(record: Turn): bigint {
    return maxInt(Object.values(record.agent_evidence).flatMap(row => [row.started_wall_ns, row.stopped_wall_ns, row.queued_wall_ns, row.delivered_wall_ns].filter((stamp): stamp is bigint => stamp !== null)));
}
export function hasObservedAgentEnd(record: Turn): boolean {
    return Object.values(record.agent_evidence).some(row => row.started_wall_ns !== null &&
        (row.stopped_wall_ns !== null || row.queued_wall_ns !== null || row.delivered_wall_ns !== null));
}
export function findAgentOwner(store: TaskStore, agent: string, prompt: string | null, wall: bigint): Turn | null {
    const candidates = store.turns.filter(record => !record.configuration_prompt && (record.agent_ids.includes(agent) || own(record.agent_evidence, agent)) &&
        wall >= (own(record.agent_evidence, agent)?.started_wall_ns ?? int(record.started_wall_ns, false) ?? 0n));
    const native = candidates.filter(record => own(record.agent_evidence, agent)?.native_owner);
    const explicit = prompt === null ? null : findTurn(store, prompt);
    if (native.length)
        return native.length === 1 ? native[0]! : explicit && native.includes(explicit) ? explicit : null;
    if (explicit && candidates.includes(explicit))
        return explicit;
    const observed = candidates.filter(record => {
        const row = own(record.agent_evidence, agent);
        return row && (row.started_wall_ns !== null || row.stopped_wall_ns !== null);
    });
    return candidates.length === 1 ? candidates[0]! : observed.length === 1 ? observed[0]! : null;
}
function activate(record: Turn, agent: string, data: Data, wall: bigint): void {
    const previous = own(record.active_agents, agent);
    if (!previous)
        Object.defineProperty(record.active_agents, agent, { value: { agent_type: agentType(data), started_wall_ns: wall }, enumerable: true, configurable: true, writable: true });
    else if (wall < (int(previous.started_wall_ns, false) ?? wall))
        previous.started_wall_ns = wall;
}
export function syncAgentPhase(record: Turn): void {
    if (record.phase === 'waiting_subagents' && Object.keys(record.active_agents).length === 0)
        record.phase = 'resuming_main';
}
export function startSubagent(store: TaskStore, prompt: string | null, data: Data, wall: bigint, nativeOwner = false, newExecution = false): string | null {
    const agent = lifecycleId(data.agent_id), explicit = prompt ? findTurn(store, prompt) : null;
    if (!agent)
        return store.current_prompt_id;
    const owner = findAgentOwner(store, agent, prompt, wall);
    const record = nativeOwner ? explicit : owner ?? explicit ?? (prompt === null && store.turns.length === 1 ? store.turns[0]! : null);
    if (!record || record.configuration_prompt || record.historical_frozen || wall < (int(record.started_wall_ns, false) ?? 0n) ||
        record.status !== 'running' && !nativeOwner)
        return store.current_prompt_id;
    const previous = own(record.agent_evidence, agent);
    const closed = previous && maxInt([previous.stopped_wall_ns ?? 0n, previous.queued_wall_ns ?? 0n, previous.delivered_wall_ns ?? 0n]);
    if (closed && (!newExecution || wall <= closed) && previous.started_wall_ns !== null) {
        if (nativeOwner && wall <= closed)
            previous.native_owner = true;
        return store.current_prompt_id;
    }
    const row = agentEvidence(record, agent);
    if (closed && newExecution && wall > closed)
        Object.assign(row, cleanAgentEvidence({ background_wall_ns: row.background_wall_ns, previous_delivery_aliases:
            [...row.previous_delivery_aliases, ...row.delivery_aliases] }));
    row.native_owner ||= nativeOwner;
    row.started_wall_ns = row.started_wall_ns === null || wall < row.started_wall_ns ? wall : row.started_wall_ns;
    if (record.status !== 'running' || row.stopped_wall_ns !== null || row.queued_wall_ns !== null || row.delivered_wall_ns !== null)
        return store.current_prompt_id;
    activate(record, agent, data, row.started_wall_ns);
    const candidate = record.stop_candidate;
    if (object(candidate) && wall > (int(candidate.wall_ns) ?? wall)) {
        record.stop_candidate = null;
        record.phase = 'main';
    }
    record.had_subagents = true;
    syncAgentReports(record);
    if (record.phase === 'resuming_main')
        record.phase = 'main';
    record.updated_wall_ns = maxInt([recordKey(record), wall]);
    return record.prompt_id;
}
export function stopSubagent(store: TaskStore, prompt: string | null, data: Data, wall: bigint, nativeOwner = false): string | null {
    const agent = lifecycleId(data.agent_id), explicit = prompt ? findTurn(store, prompt) : null;
    if (!agent)
        return store.current_prompt_id;
    const owner = findAgentOwner(store, agent, prompt, wall);
    const record = nativeOwner ? explicit : owner ?? explicit ?? (prompt === null && store.turns.length === 1 ? store.turns[0]! : null);
    if (!record || record.configuration_prompt || record.historical_frozen || wall < (int(record.started_wall_ns, false) ?? 0n) ||
        record.status !== 'running' && !nativeOwner)
        return store.current_prompt_id;
    const previous = own(record.agent_evidence, agent);
    if (previous && (previous.started_wall_ns !== null && wall < previous.started_wall_ns || previous.stopped_wall_ns !== null))
        return store.current_prompt_id;
    const row = agentEvidence(record, agent);
    row.stopped_wall_ns = wall;
    row.native_owner ||= nativeOwner;
    if (Array.isArray(data.background_tasks) && data.background_tasks.some(task => object(task) && task.type === 'subagent' && task.id === agent))
        row.background_wall_ns = row.background_wall_ns === null || row.background_wall_ns < wall ? wall : row.background_wall_ns;
    record.had_subagents = true;
    delete record.active_agents[agent];
    syncAgentReports(record);
    syncAgentPhase(record);
    if (record.status === 'running')
        record.updated_wall_ns = maxInt([recordKey(record), wall]);
    return record.prompt_id;
}
export function reconcileBackground(store: TaskStore, record: Turn, tasks: unknown, wall: bigint): void {
    if (!Array.isArray(tasks) || tasks.length > MAX_AGENT_HISTORY || tasks.some(task => !object(task) || typeof task.type !== 'string' || !lifecycleId(task.id)) ||
        wall <= (int(record.background_snapshot_wall_ns, false) ?? -1n))
        return;
    const snapshot = dictionary<Data>();
    for (const task of tasks) {
        if (task.type !== 'subagent' || ['completed', 'failed', 'killed', 'cancelled', 'interrupted'].includes(task.status))
            continue;
        const agent = task.id as string, owner = findAgentOwner(store, agent, null, wall);
        if (owner && owner !== record || store.turns.some(item => item !== record && own(item.agent_evidence, agent)?.native_owner))
            continue;
        snapshot[agent] = task;
    }
    record.background_snapshot_wall_ns = wall;
    for (const [agent, task] of Object.entries(snapshot)) {
        const row = agentEvidence(record, agent);
        if (wall < (row.started_wall_ns ?? 0n) || row.queued_wall_ns !== null || row.delivered_wall_ns !== null)
            continue;
        row.background_wall_ns = wall;
        record.had_subagents = true;
        if (row.stopped_wall_ns === null)
            activate(record, agent, task, row.started_wall_ns ?? wall);
    }
    const expected = new Set(expectedReports(record));
    for (const [agent, active] of Object.entries(record.active_agents)) {
        const row = own(record.agent_evidence, agent);
        if (!own(snapshot, agent) && !row?.native_owner && !expected.has(agent) && wall >= (int(active.started_wall_ns, false) ?? 0n))
            delete record.active_agents[agent];
    }
    syncAgentReports(record);
    syncAgentPhase(record);
}
export function clearSnapshotOnlyAgents(record: Turn, wall: bigint, present: ReadonlySet<string> = new Set()): void {
    for (const agent of Object.keys(record.active_agents)) {
        const row = own(record.agent_evidence, agent);
        if (!present.has(agent) && row && row.background_wall_ns !== null && wall > row.background_wall_ns && row.started_wall_ns === null && row.stopped_wall_ns === null)
            delete record.active_agents[agent];
    }
    syncAgentReports(record);
    syncAgentPhase(record);
}
