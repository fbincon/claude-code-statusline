import { equalSettings } from '../../json-equality.js';
import { LosslessNumber, pythonFloat } from '../../json.js';
import { divideIntegers } from '../../numbers.js';
import { int, numeric, object, own, maxNumber, truth, type Data } from '../values.js';
import { float } from '../transcript.js';
import { MAX_REQUESTS, USAGE_KEYS, type Observation } from './model.js';
import { owner, canonicalPrompt, turnKey } from './ownership.js';
import type { LiveState } from './state.js';
export const ITEMS = ['ttft', 'output-rate', 'prompt-input-tokens', 'prompt-output-tokens', 'prompt-cost'] as const;
export function key(o: Observation): string { return o.epoch + ':' + o.request_id; }
function bounded(state: LiveState, rows: Record<string, Data>): void {
    while (Object.keys(rows).length > MAX_REQUESTS) {
        const oldest = Object.keys(rows).reduce((a, b) => numeric(rows[b]!.updated_at_ms)! < numeric(rows[a]!.updated_at_ms)! ? b : a);
        const old = rows[oldest]!;
        delete rows[oldest];
        const prompt = typeof old.prompt_id === 'string' ? own(state.prompts, old.prompt_id) : undefined;
        if (prompt)
            prompt.complete = false;
    }
}
export function applyRequest(state: LiveState, o: Observation): void {
    const stamp = o.observed_at_ms, kind = o.kind, target = owner(state, o);
    if (kind === 'turn_usage') {
        const turn = own(state.turns, turnKey(o.epoch, o.turn_id, o.agent_id));
        if (turn)
            turn.usage = o.payload.usage;
        return;
    }
    if (kind === 'request_cost') {
        if (target !== null && !Object.values(state.turns).some(turn => turn.prompt_id === target))
            return;
        const previous = own(state.costs, o.request_id!);
        const value = { prompt_id: target, owner_alias: o.prompt_id, cost_usd: o.payload.cost_usd, usage: o.payload.usage, updated_at_ms: stamp, request_key: o.turn_id ? key(o) : null, conflict: false };
        if (!previous)
            state.costs[o.request_id!] = value;
        else if (['cost_usd', 'usage'].some(k => !equalSettings(previous[k], value[k as keyof typeof value])) || previous.owner_alias !== value.owner_alias && previous.prompt_id !== target)
            previous.conflict = true;
        bounded(state, state.costs);
        return;
    }
    let request = own(state.requests, key(o));
    if (!request) {
        request = { prompt_id: target, agent_id: o.agent_id, turn_key: turnKey(o.epoch, o.turn_id, o.agent_id), epoch: o.epoch, started_at_ms: null, first_at_ms: null, ended_at_ms: null, usage: null, native: false, status: null, conflict: false, updated_at_ms: stamp };
        state.requests[key(o)] = request;
    }
    if (request.prompt_id === null)
        request.prompt_id = target;
    if (target !== null && request.prompt_id !== target) {
        request.conflict = true;
        return;
    }
    const field = kind === 'request_start' ? 'started_at_ms' : kind === 'request_first' ? 'first_at_ms' : 'ended_at_ms';
    if (request[field] === null)
        request[field] = stamp;
    if (kind === 'request_end') {
        if (request.status === null)
            Object.assign(request, o.payload);
        else if (['usage', 'native', 'status'].some(k => !equalSettings(request![k], o.payload[k])))
            request.conflict = true;
    }
    request.updated_at_ms = maxNumber(stamp, request.updated_at_ms);
    bounded(state, state.requests);
}
export function reconcileRequests(state: LiveState, agentId: unknown, promptId: unknown): void {
    for (const request of Object.values(state.requests))
        if (request.agent_id === agentId && request.epoch === state.epoch && request.prompt_id === null)
            request.prompt_id = promptId;
}
export function reconcileCosts(state: LiveState): void {
    for (const row of Object.values(state.costs))
        if (row.prompt_id === null) {
            const target = canonicalPrompt(state, row.owner_alias);
            if (target && Object.values(state.turns).some(turn => turn.prompt_id === target && numeric(turn.started_at_ms)! <= numeric(row.updated_at_ms)!))
                row.prompt_id = target;
        }
}
export interface PointOptions {
    source?: string | null;
    at?: unknown;
    partial?: boolean;
}
export interface Point {
    value: unknown;
    reason: string | null;
    source: string | null;
    observed_at_ms: unknown;
    partial: boolean;
}
export function point(value: unknown = null, reason: string | null = null, options: PointOptions = {}): Point {
    return { value, reason, source: options.source ?? null, observed_at_ms: options.at ?? null, partial: options.partial ?? false };
}
function latest(rows: Data[], field: string): Data { return rows.reduce((best, row) => numeric(row[field])! > numeric(best[field])! ? row : best); }
function sumIntegers(rows: Data[], fields: readonly string[]): bigint { return rows.reduce((total, row) => total + fields.reduce((sum, field) => sum + int((row.usage as Data)[field])!, 0n), 0n); }
/** Preserve integer sums; finite floats use compensated summation. */
export function sumNumbers(values: readonly unknown[]): bigint | LosslessNumber {
    let integer = 0n, high = 0, low = 0, floating = false;
    for (const value of values) {
        const whole = int(value);
        if (!floating && whole !== null) {
            integer += whole;
            continue;
        }
        if (!floating) {
            high = Number(integer);
            floating = true;
        }
        const x = numeric(value)!, next = high + x;
        low += Math.abs(high) >= Math.abs(x) ? (high - next) + x : (x - next) + high;
        high = next;
    }
    return floating ? new LosslessNumber(pythonFloat(Number.isFinite(low) && low !== 0 ? high + low : high)) : integer;
}
export function requestMetrics(state: LiveState, selected: string | null, live: boolean, terminal: boolean): Record<string, Point> {
    reconcileCosts(state);
    const points: Record<string, Point> = Object.fromEntries(ITEMS.map(item => [item, point(null, 'not_observed')]));
    if (selected === null || !live && !terminal)
        return points;
    const rows = Object.fromEntries(Object.entries(state.requests).filter(([, row]) => row.prompt_id === selected)), values = Object.values(rows);
    const main = values.filter(row => row.agent_id === null && row.started_at_ms !== null);
    if (main.length) {
        const last = latest(main, 'started_at_ms'), start = numeric(last.started_at_ms)!, first = numeric(last.first_at_ms), end = numeric(last.ended_at_ms);
        const badClock = first !== null && first < start || end !== null && end < start || first !== null && end !== null && first > end;
        const reason = truth(last.conflict) ? 'inconsistent_request' : badClock ? 'abnormal_clock' : last.status !== null && !truth(last.native) ? 'synthetic_response' : 'missing_stream';
        points.ttft = !truth(last.conflict) && !badClock && first !== null ? point(float((first - start) / 1000), null, { source: 'native.turn.step', at: last.first_at_ms }) : point(null, reason);
        if (!truth(last.conflict) && !badClock && truth(last.native) && object(last.usage) && end !== null && end > start) {
            const tokens = int(last.usage.output_tokens)! * 1000n, startInt = int(last.started_at_ms), endInt = int(last.ended_at_ms);
            const rate = startInt !== null && endInt !== null ? divideIntegers(tokens, endInt - startInt) : Number(tokens) / (end - start);
            points['output-rate'] = point(float(rate), null, { source: 'native.turn.step', at: last.ended_at_ms });
        }
        else
            points['output-rate'] = point(null, end === start ? 'abnormal_clock' : reason);
    }
    const valid = values.filter(row => truth(row.native) && row.usage !== null && !truth(row.conflict));
    const prompt = own(state.prompts, selected) ?? {};
    let partial = !terminal || !truth(prompt.complete) || valid.length !== values.length;
    for (const [identity, agent] of Object.entries(state.agents))
        if (agent.prompt_id === selected && (agent.ended_at_ms === null || !valid.some(row => row.agent_id === identity)))
            partial = true;
    const turns = Object.values(state.turns).filter(turn => turn.prompt_id === selected);
    for (const turn of turns) {
        const turnRows = valid.filter(row => own(state.turns, row.turn_key as string) === turn), totals = Object.fromEntries(USAGE_KEYS.map(key => [key, sumIntegers(turnRows, [key])]));
        if (turn.usage == null || turn.ended_at_ms == null || !equalSettings(totals, turn.usage))
            partial = true;
    }
    if (valid.length) {
        const at = latest(valid, 'updated_at_ms').updated_at_ms;
        points['prompt-input-tokens'] = point(sumIntegers(valid, ['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']), partial ? 'incomplete' : null, { source: 'native.requests', at, partial });
        points['prompt-output-tokens'] = point(sumIntegers(valid, ['output_tokens']), partial ? 'incomplete' : null, { source: 'native.requests', at, partial });
    }
    const costs = Object.values(state.costs).filter(row => row.prompt_id === selected && !truth(row.conflict));
    if (costs.length) {
        const joined = new Set(costs.filter(row => typeof row.request_key === 'string' && Object.hasOwn(rows, row.request_key)).map(row => row.request_key));
        const costPartial = partial || !values.length || joined.size !== values.length;
        points['prompt-cost'] = point(sumNumbers(costs.map(row => row.cost_usd)), costPartial ? 'request_join_unavailable' : null, { source: 'otel.api_request', at: latest(costs, 'updated_at_ms').updated_at_ms, partial: costPartial });
    }
    return points;
}
