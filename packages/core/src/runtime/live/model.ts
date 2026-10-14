import { int, numeric, object, type Data } from '../values.js';
import { scalarCompare } from '../../json.js';
import { trim } from '../transcript.js';
export const PROTOCOL_VERSION = 2, MAX_BATCH = 256, MAX_BYTES = 1048576, MAX_SESSIONS = 100, MAX_EPOCHS = 32, MAX_SEEN = 4096, MAX_PROMPTS = 32, MAX_AGENTS = 256, MAX_TURNS = 256, MAX_TOOLS = 1024, MAX_TASKS = 1000, MAX_REQUESTS = 2048, STALE_MS = 15000;
export const TIMING_KINDS = new Set(['heartbeat', 'invalidate', 'prompt', 'prompt_alias', 'prompt_link', 'agent_start', 'agent_end', 'turn_start', 'turn_end', 'agents', 'wait_start', 'wait_end', 'wait_unknown']);
export const OBSERVATION_KEYS = ['session_id', 'epoch', 'seq', 'observed_at_ms', 'source', 'kind', 'prompt_id', 'turn_id', 'agent_id', 'parent_agent_id', 'request_id', 'payload'];
export const USAGE_KEYS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
export class ObservationError extends Error {
}
export function exact(value: unknown, keys: readonly string[], name: string): asserts value is Data {
    if (!object(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)))
        throw new ObservationError(`${name} must contain exactly: ${[...keys].sort(scalarCompare).join(', ')}`);
}
export function text(value: unknown, name: string, nullable = false, maximum = 256): string | null {
    if (nullable && value === null)
        return null;
    if (typeof value !== 'string' || !trim(value) || [...value].length > maximum || /[\p{Cc}\p{Cs}]/u.test(value))
        throw new ObservationError(`${name} must be nonempty safe text (up to ${maximum} characters)`);
    return value;
}
export function number(value: unknown, name: string, integer = false): number {
    const result = numeric(value);
    if (result === null || result < 0 || result > Number.MAX_SAFE_INTEGER || !Number.isFinite(result) || integer && int(value) === null)
        throw new ObservationError(`${name} must be a finite nonnegative ${integer ? 'integer' : 'number'}`);
    return result;
}
export function usage(value: unknown): unknown {
    if (value !== null) {
        exact(value, USAGE_KEYS, 'usage');
        for (const key of USAGE_KEYS)
            number(value[key], key, true);
    }
    return value;
}
export interface Observation extends Data {
    session_id: string;
    epoch: string;
    seq: unknown;
    observed_at_ms: unknown;
    source: string;
    kind: string;
    prompt_id: string | null;
    turn_id: string | null;
    agent_id: string | null;
    parent_agent_id: string | null;
    request_id: string | null;
    payload: Data;
}
export function validate(value: unknown): Observation {
    exact(value, OBSERVATION_KEYS, 'observation');
    for (const key of ['session_id', 'epoch'])
        text(value[key], key);
    for (const key of ['prompt_id', 'turn_id', 'agent_id', 'parent_agent_id', 'request_id'])
        text(value[key], key, true);
    number(value.seq, 'seq', true);
    number(value.observed_at_ms, 'observed_at_ms');
    if (!['native', 'classic_hook', 'otel'].includes(value.source as string))
        throw new ObservationError('unknown observation source');
    const payload = value.payload, kind = value.kind;
    if (kind === 'heartbeat') {
        exact(payload, ['host_version', 'loaded_at_ms'], 'heartbeat');
        text(payload.host_version, 'host_version');
        number(payload.loaded_at_ms, 'loaded_at_ms');
        if (numeric(payload.loaded_at_ms)! > numeric(value.observed_at_ms)!)
            throw new ObservationError('heartbeat predates module loading');
        if (value.source !== 'native')
            throw new ObservationError('heartbeats require a native source');
    }
    else if (kind === 'invalidate') {
        exact(payload, ['reason'], 'invalidation');
        text(payload.reason, 'reason');
    }
    else if (kind === 'prompt') {
        exact(payload, [], 'prompt');
        text(value.prompt_id, 'prompt_id');
        if (value.agent_id !== null)
            throw new ObservationError('a human prompt belongs to main');
    }
    else if (kind === 'prompt_link') {
        exact(payload, ['message_id'], 'official prompt link');
        text(value.prompt_id, 'prompt_id');
        text(payload.message_id, 'message_id');
        if (value.source !== 'otel')
            throw new ObservationError('prompt links require official telemetry');
    }
    else if (kind === 'prompt_alias') {
        exact(payload, ['agent_id'], 'prompt alias');
        text(value.prompt_id, 'prompt_id');
        text(payload.agent_id, 'agent_id');
    }
    else if (kind === 'turn_start' || kind === 'turn_end') {
        text(value.turn_id, 'turn_id');
        if (kind === 'turn_start')
            exact(payload, [], kind);
        else {
            exact(payload, object(payload) && Object.hasOwn(payload, 'duration_ms') ? ['status', 'duration_ms', 'wait_coverage'] : ['status'], kind);
            if (Object.hasOwn(payload, 'duration_ms')) {
                number(payload.duration_ms, 'native duration');
                if (typeof payload.wait_coverage !== 'boolean')
                    throw new ObservationError('wait_coverage must be a boolean');
            }
            if (!['completed', 'failed', 'interrupted'].includes(payload.status as string))
                throw new ObservationError('invalid turn status');
        }
    }
    else if (kind === 'wait_start' || kind === 'wait_end' || kind === 'wait_unknown') {
        text(value.turn_id, 'turn_id');
        if (kind === 'wait_unknown') {
            exact(payload, ['reason'], kind);
            text(payload.reason, 'wait reason');
        }
        else {
            text(value.request_id, 'wait request id');
            exact(payload, [], kind);
        }
    }
    else if (kind === 'agents') {
        exact(payload, ['agents'], 'agent snapshot');
        if (!Array.isArray(payload.agents) || payload.agents.length > MAX_AGENTS)
            throw new ObservationError('too many agents');
        const ids = new Set<string>();
        for (const agent of payload.agents) {
            exact(agent, ['id', 'parent_id', 'status', 'local'], 'agent');
            text(agent.id, 'agent id');
            text(agent.parent_id, 'parent_id', true);
            if (typeof agent.local !== 'boolean' || !['pending', 'running', 'waiting', 'idle', 'completed', 'failed', 'killed'].includes(agent.status as string))
                throw new ObservationError('invalid agent snapshot');
            ids.add(agent.id as string);
        }
        if (ids.size !== payload.agents.length)
            throw new ObservationError('duplicate agent identity');
    }
    else if (kind === 'tool_start' || kind === 'tool_end') {
        text(value.request_id, 'tool use id');
        exact(payload, kind === 'tool_start' ? ['name'] : ['name', 'status'], kind);
        text(payload.name, 'tool name');
        if (kind === 'tool_end' && !['success', 'error', 'denied', 'interrupted'].includes(payload.status as string))
            throw new ObservationError('invalid tool outcome');
    }
    else if (kind === 'task_snapshot' || kind === 'task_update') {
        exact(payload, kind === 'task_snapshot' ? ['provider', 'tasks'] : ['provider', 'id', 'status'], kind);
        if (!['tasks', 'todos'].includes(payload.provider as string))
            throw new ObservationError('unknown checklist provider');
        const tasks = kind === 'task_snapshot' ? payload.tasks : [{ id: payload.id, status: payload.status }];
        if (!Array.isArray(tasks) || tasks.length > MAX_TASKS)
            throw new ObservationError('too many checklist entries');
        const ids = new Set<string>();
        for (const task of tasks) {
            exact(task, ['id', 'status'], 'task');
            text(task.id, 'task id');
            if (!['pending', 'in_progress', 'completed', 'deleted'].includes(task.status as string))
                throw new ObservationError('invalid checklist status');
            ids.add(task.id as string);
        }
        if (ids.size !== tasks.length)
            throw new ObservationError('duplicate checklist identity');
    }
    else if (kind === 'permission') {
        exact(payload, ['mode', 'live'], 'permission');
        text(payload.mode, 'mode', false, 64);
        if (typeof payload.live !== 'boolean')
            throw new ObservationError('permission.live must be boolean');
        if (payload.live && value.source !== 'otel')
            throw new ObservationError('live permission requires a verified change feed');
    }
    else if (['request_start', 'request_first', 'request_end', 'request_cost', 'turn_usage'].includes(kind as string)) {
        if (kind !== 'request_cost' && value.source !== 'native')
            throw new ObservationError('request measurements require native observations');
        if (kind === 'turn_usage') {
            text(value.turn_id, 'turn_id');
            exact(payload, ['usage'], kind);
        }
        else {
            text(value.request_id, 'request_id');
            if (kind !== 'request_cost')
                text(value.turn_id, 'turn_id');
            exact(payload, kind === 'request_start' || kind === 'request_first' ? [] : kind === 'request_end' ? ['usage', 'native', 'status'] : ['cost_usd', 'usage'], kind as string);
        }
        if (['request_end', 'request_cost', 'turn_usage'].includes(kind as string))
            usage(payload.usage);
        if (kind === 'request_end') {
            if (typeof payload.native !== 'boolean' || !['completed', 'failed', 'interrupted'].includes(payload.status as string))
                throw new ObservationError('invalid request outcome');
            if (!payload.native && payload.usage !== null)
                throw new ObservationError('synthetic requests cannot claim official usage');
        }
        if (kind === 'request_cost') {
            if (value.source !== 'otel')
                throw new ObservationError('cost requires official telemetry evidence');
            number(payload.cost_usd, 'cost_usd');
        }
    }
    else if (kind === 'agent_start' || kind === 'agent_end') {
        const key = kind === 'agent_start' ? 'started_at_ms' : 'ended_at_ms';
        exact(payload, kind === 'agent_start' ? [key] : [key, 'status'], kind);
        text(value.agent_id, 'agent_id');
        number(payload[key], key);
        if (kind === 'agent_end' && !['completed', 'failed', 'killed', 'interrupted'].includes(payload.status as string))
            throw new ObservationError('unknown terminal agent status');
    }
    else
        throw new ObservationError('unknown observation kind');
    return value as Observation;
}
export function validateBatch(values: unknown): Observation[] {
    if (!Array.isArray(values) || values.length < 1 || values.length > MAX_BATCH)
        throw new ObservationError(`observations must contain 1 through ${MAX_BATCH} records`);
    return values.map(validate);
}
