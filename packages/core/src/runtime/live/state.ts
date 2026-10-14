import { equalSettings } from '../../json-equality.js';
import { object, numeric, int, truth, dictionary, type Data } from '../values.js';
import * as model from './model.js';
export interface Ledger extends Data {
    seen: unknown[];
    floor: unknown;
    high: unknown;
    updated_at_ms: unknown;
}
export interface LiveState extends Data {
    session_id: string;
    epoch: string | null;
    loaded_at_ms: unknown;
    heartbeat_at_ms: unknown;
    host_version: unknown;
    invalidated: unknown;
    current_prompt_id: string | null;
    active_prompt_id: string | null;
    current_main_turn_id: string | null;
    epochs: Record<string, Ledger>;
    prompts: Record<string, Data>;
    agents: Record<string, Data>;
    permission: Data | null;
    turns: Record<string, Data>;
    tools: Record<string, Data>;
    checklists: Record<string, Data>;
    prompt_aliases: Data;
    prompt_links: Record<string, string>;
    agent_snapshot: Data | null;
    requests: Record<string, Data>;
    costs: Record<string, Data>;
    wait_events: Record<string, model.Observation>;
}
export function empty(sessionId: string): LiveState {
    return { schema_version: 1, session_id: sessionId, epoch: null, loaded_at_ms: null, heartbeat_at_ms: null, host_version: null, invalidated: null,
        current_prompt_id: null, epochs: dictionary(), prompts: dictionary(), agents: dictionary(), permission: null, active_prompt_id: null,
        current_main_turn_id: null, turns: dictionary(), tools: dictionary(), checklists: dictionary(), prompt_aliases: dictionary(), prompt_links: dictionary(),
        agent_snapshot: null, requests: dictionary(), costs: dictionary(), wait_events: dictionary() };
}
export function validateState(value: unknown, sessionId: string): LiveState | null {
    try {
        const defaults = empty(sessionId);
        if (!object(value) || !['schema_version', 'session_id', 'epochs', 'prompts', 'agents'].every(key => Object.hasOwn(value, key)) || !Object.keys(value).every(key => Object.hasOwn(defaults, key)) || !equalSettings(value.schema_version, 1) || value.session_id !== sessionId || !['epochs', 'prompts', 'agents'].every(key => object(value[key])))
            return null;
        const state = { ...defaults, ...value } as LiveState;
        if (!['turns', 'tools', 'checklists', 'prompt_aliases', 'prompt_links', 'requests', 'costs'].every(key => object(state[key])))
            return null;
        for (const [epoch, ledger] of Object.entries(state.epochs)) {
            model.text(epoch, 'epoch');
            model.exact(ledger, ['seen', 'floor', 'high', 'updated_at_ms'], 'epoch ledger');
            if (!Array.isArray(ledger.seen) || ledger.seen.length > model.MAX_SEEN || ledger.seen.some(seq => int(seq) === null || int(seq)! < 0n) || ['floor', 'high'].some(key => int(ledger[key]) === null || int(ledger[key])! < -1n))
                return null;
        }
        if (state.epoch !== null && (typeof state.epoch !== 'string' || !Object.hasOwn(state.epochs, state.epoch)))
            return null;
        for (const row of Object.values(state.prompts)) {
            if (!object(row) || !['updated_at_ms', 'started_at_ms', 'epoch', 'complete', 'terminal'].every(key => Object.hasOwn(row, key)))
                return null;
            model.number(row.updated_at_ms, 'prompt time');
        }
        for (const row of Object.values(state.agents)) {
            if (!object(row) || !['prompt_id', 'epoch', 'started_at_ms', 'ended_at_ms', 'status', 'updated_at_ms'].every(key => Object.hasOwn(row, key)))
                return null;
            model.number(row.updated_at_ms, 'agent time');
        }
        if (state.permission !== null)
            model.exact(state.permission, ['mode', 'live', 'observed_at_ms', 'source'], 'permission');
        validateViews(state);
        return state;
    }
    catch {
        return null;
    }
}
export function validateViews(state: LiveState): void {
    if (Object.keys(state.prompt_links).length > model.MAX_AGENTS)
        throw new Error('prompt links exceed their bound');
    for (const [alias, target] of Object.entries(state.prompt_links)) {
        model.text(alias, 'prompt link');
        model.text(target, 'message link');
    }
    if (!object(state.wait_events) || Object.keys(state.wait_events).length > model.MAX_SEEN)
        throw new Error('invalid waiting evidence');
    for (const row of Object.values(state.wait_events)) {
        model.validate(row);
        if (!['wait_start', 'wait_end', 'wait_unknown'].includes(row.kind))
            throw new Error('invalid waiting event kind');
    }
    for (const [table, maximum] of [['turns', model.MAX_TURNS], ['tools', model.MAX_TOOLS], ['requests', model.MAX_REQUESTS], ['costs', model.MAX_REQUESTS]] as const) {
        if (Object.keys(state[table]).length > maximum)
            throw new Error('runtime table exceeds its bound');
        for (const row of Object.values(state[table])) {
            if (!object(row))
                throw new Error('invalid runtime view');
            model.text(row.prompt_id, 'owner', true);
            model.number(row.updated_at_ms, 'view time');
            if (['turns', 'tools', 'requests'].includes(table)) {
                model.text(row.agent_id, 'agent', true);
                for (const name of table === 'tools' ? ['started_at_ms'] : ['started_at_ms', 'ended_at_ms'])
                    if (row[name] !== null)
                        model.number(row[name], name);
            }
            if (table === 'turns' && !['running', 'completed', 'failed', 'interrupted'].includes(row.status as string))
                throw new Error('invalid turn status');
            if (table === 'tools') {
                model.text(row.name, 'tool name');
                if (!['started', 'success', 'error', 'denied', 'interrupted'].includes(row.status as string))
                    throw new Error('invalid tool status');
            }
            if (table === 'requests' || table === 'costs') {
                model.usage(row.usage);
                if (typeof row.conflict !== 'boolean')
                    throw new Error('invalid conflict flag');
                if (table === 'requests') {
                    model.text(row.turn_key, 'turn key', false, 1024);
                    model.text(row.epoch, 'request epoch');
                    if (typeof row.native !== 'boolean' || ![null, 'completed', 'failed', 'interrupted'].includes(row.status as null | string))
                        throw new Error('invalid request status');
                    if (row.first_at_ms !== null)
                        model.number(row.first_at_ms, 'first content time');
                }
                else
                    model.number(row.cost_usd, 'cost');
            }
        }
    }
    for (const row of Object.values(state.checklists)) {
        if (!object(row) || !object(row.tasks) || typeof row.complete !== 'boolean' || Object.keys(row.tasks).length > model.MAX_TASKS)
            throw new Error('invalid checklist');
        model.text(row.prompt_id, 'checklist owner', true);
        model.number(row.updated_at_ms, 'checklist time');
        if (Object.values(row.tasks).some(value => !['pending', 'in_progress', 'completed'].includes(value as string)))
            throw new Error('invalid checklist entry');
    }
}
export function fresh(state: LiveState | null, nowMs: number): boolean {
    const stamp = state ? numeric(state.heartbeat_at_ms) : null;
    return state !== null && !truth(state.invalidated) && stamp !== null && nowMs - stamp >= 0 && nowMs - stamp <= model.STALE_MS;
}
