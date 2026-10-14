import { delta, type Sample } from '../../timing/sample.js';
import { int, truth, string, object, maxInt, compareInt, numeric, type Data } from '../values.js';
import { orderedRecord } from '../../ordered-record.js';
export const SCHEMA = 1, LIFECYCLE_SCHEMA = 4, MAX_TURNS_PER_SESSION = 32, MAX_AGENT_HISTORY = 256;
export const TURN_FIELDS = ['prompt_id', 'status', 'started_wall_ns', 'started_boot_ns', 'ended_wall_ns', 'ended_boot_ns', 'duration_ns', 'boot_id', 'start_source', 'end_source', 'end_reason', 'error', 'last_assistant_wall_ns', 'updated_wall_ns', 'phase', 'had_subagents', 'active_agents', 'duration_source', 'agent_ids', 'prompt_aliases', 'report_aliases', 'pending_agent_reports', 'stop_candidate', 'native_duration_ms', 'native_turns', 'active_clock', 'active_coverage', 'submission_verified', 'native_wait_seen', 'historical_frozen'] as const;
export const TERMINAL_STATUSES = new Set(['completed', 'failed', 'interrupted', 'withdrawn', 'ignored', 'unknown']);
export const END_PRIORITY: Readonly<Record<string, number>> = { next_prompt: 10, session_start: 20, registry_withdrawn: 30, registry_idle: 40, transcript_interrupt: 95, local_command: 50, transcript_duration: 60, transcript_stop: 85, session_exit_pending: 50, hook_session_end: 95, hook_stop: 55, native_turn_end: 90, hook_stop_failure: 100 };
export interface Turn extends Data {
    prompt_id: string;
    status: string;
    phase: string;
    had_subagents: boolean;
    active_agents: Record<string, Data>;
    agent_ids: string[];
    prompt_aliases: string[];
    report_aliases: string[];
    pending_agent_reports: string[];
    native_turns: Record<string, Data>;
    native_wait_seen: string[];
    submission_verified: boolean;
    historical_frozen: boolean;
}
export interface TaskStore extends Data {
    schema: 4;
    session_id: string;
    current_prompt_id: string | null;
    turns: Turn[];
    updated_wall_ns: bigint;
}
export function recordKey(record: Data): bigint { return int(record.updated_wall_ns, false) ?? int(record.started_wall_ns, false) ?? 0n; }
export function cleanIds(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item)))].slice(-MAX_AGENT_HISTORY) : []; }
export function rememberId(record: Data, field: string, value: string): boolean {
    const values = (record[field] ??= []) as string[];
    if (values.includes(value))
        return false;
    values.push(value);
    if (values.length > MAX_AGENT_HISTORY)
        values.splice(0, values.length - MAX_AGENT_HISTORY);
    return true;
}
export function agentNotificationId(content: unknown): string | null {
    return typeof content === 'string' ? content.match(/^[\p{White_Space}\x1c-\x1f]*<task-notification>[\p{White_Space}\x1c-\x1f]*<task-id>([^<>\p{White_Space}\x1c-\x1f]+)<\/task-id>/u)?.[1] ?? null : null;
}
export function cleanActiveAgents(value: unknown): Record<string, Data> {
    if (!object(value))
        return {};
    return orderedRecord(Object.entries(value).filter(([id]) => Boolean(id)).map(([id, raw]) => {
        const details = object(raw) ? raw : {};
        return [id, { agent_type: truth(details.agent_type) ? string(details.agent_type) : 'Agent', started_wall_ns: int(details.started_wall_ns, false) ?? 0n }];
    })) as Record<string, Data>;
}
export function elapsedNs(record: Data, wall: unknown, boot: unknown, domain: unknown): bigint | null {
    const start = int(record.started_wall_ns), end = int(wall);
    if (start === null || end === null)
        return null;
    return delta({ wall_ns: start, boot_ns: int(record.started_boot_ns), boot_id: typeof record.boot_id === 'string' ? record.boot_id : null }, { wall_ns: end, boot_ns: int(boot), boot_id: typeof domain === 'string' ? domain : null });
}
export function cleanRecord(record: unknown): Turn | null {
    if (!object(record) || !truth(record.prompt_id))
        return null;
    const cleaned = Object.fromEntries(TURN_FIELDS.map(key => [key, record[key] ?? null])) as Turn;
    cleaned.prompt_id = string(record.prompt_id);
    cleaned.status = truth(cleaned.status) ? string(cleaned.status) : 'unknown';
    cleaned.phase = ['main', 'waiting_subagents', 'resuming_main', 'stop_pending'].includes(cleaned.phase) ? cleaned.phase : 'main';
    cleaned.had_subagents = truth(cleaned.had_subagents);
    cleaned.active_agents = cleanActiveAgents(cleaned.active_agents);
    for (const field of ['agent_ids', 'prompt_aliases', 'pending_agent_reports'] as const)
        cleaned[field] = cleanIds(cleaned[field]);
    cleaned.report_aliases = cleanIds(cleaned.report_aliases ?? record.prompt_aliases);
    for (const agent of Object.keys(cleaned.active_agents))
        rememberId(cleaned, 'agent_ids', agent);
    cleaned.native_turns = object(cleaned.native_turns) ? cleaned.native_turns : {};
    cleaned.active_coverage = truth(cleaned.active_coverage) ? cleaned.active_coverage : 'not_observed';
    cleaned.native_wait_seen = cleanIds(cleaned.native_wait_seen);
    cleaned.submission_verified = cleaned.submission_verified === true;
    cleaned.historical_frozen = cleaned.historical_frozen === true;
    if (cleaned.status !== 'running') {
        cleaned.active_agents = {};
        if (int(cleaned.duration_ns, false) === null)
            cleaned.duration_ns = elapsedNs(cleaned, cleaned.ended_wall_ns, cleaned.ended_boot_ns, cleaned.boot_id);
        cleaned.duration_source = truth(cleaned.duration_source) ? cleaned.duration_source : 'legacy';
    }
    return cleaned;
}
export function legacyRecord(state: unknown, historical = false): Turn | null {
    if (!object(state) || !truth(state.prompt_id))
        return null;
    const record = Object.fromEntries(TURN_FIELDS.map(key => [key, state[key] ?? null]));
    record.prompt_id = string(record.prompt_id);
    record.status = truth(record.status) ? string(record.status) : 'unknown';
    if (historical && record.status !== 'running' && int(record.duration_ns) !== null)
        record.historical_frozen = true;
    if (!truth(record.start_source))
        record.start_source = 'legacy';
    if (record.status !== 'running' && !truth(record.end_source))
        record.end_source = 'legacy';
    return cleanRecord(record);
}
export function pruneTurns(store: TaskStore): void {
    if (!Array.isArray(store.turns)) {
        store.turns = [];
        return;
    }
    store.turns.sort((a, b) => compareInt(recordKey(a), recordKey(b)));
    if (store.turns.length <= MAX_TURNS_PER_SESSION)
        return;
    const kept = store.turns.slice(-MAX_TURNS_PER_SESSION), current = store.current_prompt_id;
    if (current && !kept.some(item => item.prompt_id === current)) {
        const record = store.turns.find(item => item.prompt_id === current);
        if (record) {
            kept[0] = record;
            kept.sort((a, b) => compareInt(recordKey(a), recordKey(b)));
        }
    }
    store.turns = kept;
}
export function storeFromState(raw: unknown, sessionId: unknown): TaskStore {
    const state = object(raw) ? raw : {}, lifecycle = state.lifecycle;
    const turns: Turn[] = [];
    let current: string | null = null;
    const historical = !object(lifecycle) || numeric(lifecycle.schema) !== LIFECYCLE_SCHEMA;
    if (object(lifecycle) && [2, 3, LIFECYCLE_SCHEMA].includes(numeric(lifecycle.schema) ?? -1) && Array.isArray(lifecycle.turns)) {
        const seen = new Set<string>();
        for (const item of lifecycle.turns) {
            const record = cleanRecord(item);
            if (!record || seen.has(record.prompt_id))
                continue;
            seen.add(record.prompt_id);
            if (historical && record.status !== 'running' && int(record.duration_ns) !== null)
                record.historical_frozen = true;
            turns.push(record);
        }
        current = truth(lifecycle.current_prompt_id) ? string(lifecycle.current_prompt_id) : null;
        for (const source of [state.previous_running, state]) {
            const legacy = legacyRecord(source, historical);
            if (!legacy)
                continue;
            const index = turns.findIndex(item => item.prompt_id === legacy.prompt_id);
            if (index < 0)
                turns.push(legacy);
            else if (recordKey(legacy) > recordKey(turns[index]!))
                turns[index] = legacy;
        }
        const top = legacyRecord(state);
        if (top && recordKey(top) >= (int(lifecycle.updated_wall_ns, false) ?? 0n))
            current = top.prompt_id;
    }
    else {
        const previous = legacyRecord(state.previous_running, historical);
        if (previous)
            turns.push(previous);
        const record = legacyRecord(state, historical);
        if (record) {
            if (!turns.some(item => item.prompt_id === record.prompt_id))
                turns.push(record);
            current = record.prompt_id;
        }
    }
    const store: TaskStore = { schema: LIFECYCLE_SCHEMA, session_id: string(sessionId), current_prompt_id: current, turns, updated_wall_ns: maxInt(turns.map(recordKey)) };
    pruneTurns(store);
    return store;
}
export function findTurn(store: TaskStore, promptId: unknown = null): Turn | null {
    const explicit = promptId !== null;
    if (promptId === null)
        promptId = store.current_prompt_id;
    const prompt = truth(promptId) ? string(promptId) : null;
    if (prompt) {
        const found = store.turns.find(item => item.prompt_id === prompt || item.prompt_aliases.includes(prompt));
        if (found)
            return found;
        if (explicit)
            return null;
    }
    return store.turns.reduce<Turn | null>((best, item) => !best || recordKey(item) > recordKey(best) ? item : best, null);
}
export function newRecord(promptId: unknown, clocks: Sample, source = 'hook_submit'): Turn {
    return {
        prompt_id: string(promptId), status: 'running', started_wall_ns: clocks.wall_ns, started_boot_ns: clocks.boot_ns, ended_wall_ns: null, ended_boot_ns: null,
        duration_ns: null, duration_source: 'task', stop_candidate: null, native_duration_ms: null, native_turns: {}, active_clock: null, active_coverage: 'not_observed',
        submission_verified: source === 'transcript', native_wait_seen: [], historical_frozen: false, agent_ids: [], prompt_aliases: [], report_aliases: [], pending_agent_reports: [],
        boot_id: clocks.boot_id, start_source: source, end_source: null, end_reason: null, error: null, last_assistant_wall_ns: null, updated_wall_ns: clocks.wall_ns,
        phase: 'main', had_subagents: false, active_agents: {},
    };
}
export function upsertTurn(store: TaskStore, promptId: unknown, clocks: Sample, source = 'hook_submit'): Turn | null {
    if (!truth(promptId))
        return null;
    const prompt = string(promptId);
    let record = findTurn(store, prompt);
    if (!record) {
        record = newRecord(prompt, clocks, source);
        store.turns.push(record);
    }
    return record;
}
export function terminalRecord(store: TaskStore, promptId: unknown, clocks: Sample): Turn {
    const found = findTurn(store, promptId);
    if (found)
        return found;
    const record = newRecord(promptId, clocks, 'missing_start');
    record.started_wall_ns = null;
    record.started_boot_ns = null;
    record.boot_id = null;
    store.turns.push(record);
    return record;
}
export function mirrorState(sessionId: unknown, store: TaskStore, preferredPromptId: unknown = null): Data | null {
    pruneTurns(store);
    const selected = findTurn(store, preferredPromptId);
    if (!selected)
        return null;
    store.updated_wall_ns = maxInt(store.turns.map(recordKey));
    const state: Data = { ...Object.fromEntries(TURN_FIELDS.map(key => [key, selected[key] ?? null])), schema: SCHEMA, session_id: string(sessionId), lifecycle: store };
    const running = store.turns.filter(item => item.status === 'running' && item.prompt_id !== selected.prompt_id);
    if (['ignored', 'withdrawn'].includes(selected.status) && running.length)
        state.previous_running = { ...running.reduce((best, item) => recordKey(item) > recordKey(best) ? item : best) };
    return state;
}
