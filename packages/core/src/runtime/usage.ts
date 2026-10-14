import { object, int, numeric, own, dictionary, string, type Data } from './values.js';
import { timestamp, float } from './transcript.js';
export const BASE = { i: 0n, o: 0n, cc: 0n, cr: 0n }, MAX_IDS = 5000, MAX_SESSIONS = 100, TURN_SCAN_VERSION = 6, USAGE_SCAN_VERSION = 3;
export const TOKEN_FIELDS = { hit: ['cr'], miss: ['i', 'cc'], out: ['o'] } as const;
const FIELDS = ['i', 'o', 'cc', 'cr'] as const;
const INPUT = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];
export type Counters = typeof BASE;
export type Totals = {
    hit: bigint;
    miss: bigint;
    out: bigint;
};
export type Observed = {
    input: boolean;
    output: boolean;
};
export interface UsageEntry extends Data {
    files: Record<string, Data>;
    ids: Record<string, Counters>;
    base: Counters;
    token_observed?: Observed;
}
export function usageInt(value: unknown): bigint { const result = int(value); return result !== null && result >= 0n ? result : 0n; }
export function hasUsage(value: unknown, fields: readonly string[]): value is Data { return object(value) && fields.some(field => { const n = int(value[field]); return n !== null && n >= 0n; }); }
export function tokenObservations(entry: Data, positiveOnly = false): Observed {
    if (object(entry.token_observed))
        return { input: entry.token_observed.input === true, output: entry.token_observed.output === true };
    const has = (record: unknown, fields: readonly string[]) => positiveOnly ? object(record) && fields.some(field => usageInt(record[field]) > 0n) : hasUsage(record, fields);
    const observed = { input: false, output: false };
    for (const row of Object.values(object(entry.ids) ? entry.ids : {})) {
        observed.input ||= has(row, ['i', 'cc', 'cr']);
        observed.output ||= has(row, ['o']);
        if (observed.input && observed.output)
            break;
    }
    observed.input ||= has(entry.api_snapshot, ['hit', 'miss']);
    observed.output ||= has(entry.api_snapshot, ['out']);
    if (object(entry.base)) {
        observed.input ||= ['i', 'cc', 'cr'].some(key => usageInt((entry.base as Data)[key]) > 0n);
        observed.output ||= usageInt(entry.base.o) > 0n;
    }
    return observed;
}
function observe(observed: Observed | undefined, usage: unknown, input: readonly string[], output: readonly string[]): void {
    if (observed) {
        observed.input ||= hasUsage(usage, input);
        observed.output ||= hasUsage(usage, output);
    }
}
export function parseUsage(lines: readonly unknown[], observed?: Observed): Record<string, Counters> {
    const out = dictionary<Counters>();
    for (const row of lines) {
        if (!object(row) || row.type !== 'assistant' || !object(row.message))
            continue;
        const { id, usage } = row.message;
        if (typeof id !== 'string' || !id || !hasUsage(usage, [...INPUT, 'output_tokens']))
            continue;
        observe(observed, usage, INPUT, ['output_tokens']);
        const record = out[id] ??= { ...BASE };
        for (const [key, field] of [['i', 'input_tokens'], ['o', 'output_tokens'], ['cc', 'cache_creation_input_tokens'], ['cr', 'cache_read_input_tokens']] as const) {
            const value = int(usage[field]);
            if (value !== null && value > record[key])
                record[key] = value;
        }
    }
    return out;
}
export function mergeUsageFields(ids: Record<string, Counters>, newIds: Record<string, Counters>, keys: readonly (keyof Totals)[]): void {
    for (const [id, next] of Object.entries(newIds)) {
        const record = ids[id] ??= { ...BASE };
        for (const key of keys)
            for (const field of TOKEN_FIELDS[key])
                if (usageInt(next[field]) > usageInt(record[field]))
                    record[field] = next[field];
    }
}
export function mergeIds(ids: Record<string, Counters>, next: Record<string, Counters>): boolean {
    let changed = false;
    for (const [id, value] of Object.entries(next)) {
        const record = own(ids, id);
        if (record === undefined) {
            ids[id] = value;
            changed = true;
            continue;
        }
        for (const key of FIELDS)
            if (usageInt(value[key]) > usageInt(record[key])) {
                record[key] = value[key];
                changed = true;
            }
    }
    return changed;
}
export function parseCostSnapshot(lines: readonly unknown[], hash: (input: string) => string, observed?: Observed): Data | null {
    let latest: Data | null = null, lastTime: number | null = null;
    const indices: Partial<Record<keyof Totals, number>> = {}, times: Data = {};
    for (const [index, row] of lines.entries()) {
        if (!object(row))
            continue;
        const time = timestamp(row.timestamp);
        if (time !== null)
            lastTime = time;
        if (row.type !== 'cost-state' || !object(row.modelUsage) || !Object.keys(row.modelUsage).length)
            continue;
        let hit = 0n, miss = 0n, out = 0n, valid = 0;
        const available = { input: false, output: false };
        for (const usage of Object.values(row.modelUsage)) {
            const input = ['inputTokens', 'cacheCreationInputTokens', 'cacheReadInputTokens'];
            if (!hasUsage(usage, [...input, 'outputTokens']))
                continue;
            observe(available, usage, input, ['outputTokens']);
            valid++;
            hit += usageInt(usage.cacheReadInputTokens);
            miss += usageInt(usage.inputTokens) + usageInt(usage.cacheCreationInputTokens);
            out += usageInt(usage.outputTokens);
        }
        if (!valid)
            continue;
        if (observed) {
            observed.input ||= available.input;
            observed.output ||= available.output;
        }
        const totals: Data = {};
        if (available.input)
            Object.assign(totals, { hit, miss });
        if (available.output)
            totals.out = out;
        const merged: Data = {};
        Object.assign(merged, latest, totals);
        latest = merged;
        for (const key of Object.keys(totals) as (keyof Totals)[]) {
            indices[key] = index;
            times[key] = lastTime === null ? null : float(lastTime);
        }
    }
    if (latest) {
        latest.fingerprint = hash(Object.keys(TOKEN_FIELDS).map(key => string(latest![key])).join(':'));
        latest._snapshot_ts = times;
        const post = dictionary<Counters>();
        latest._post_ids = post;
        for (const index of new Set(Object.values(indices)))
            mergeUsageFields(post, parseUsage(lines.slice(index + 1)), (Object.keys(indices) as (keyof Totals)[]).filter(key => indices[key] === index));
    }
    return latest;
}
export function stageCostSnapshot(entry: UsageEntry, lines: readonly unknown[], hash: (input: string) => string, force = false): void {
    const snapshot = parseCostSnapshot(lines, hash, entry.token_observed);
    if (snapshot && (force || snapshot.fingerprint !== (object(entry.api_snapshot) ? entry.api_snapshot.fingerprint : null)))
        entry._pending_api_snapshot = snapshot;
}
export function stageSubagentDelta(entry: UsageEntry, lines: readonly unknown[]): void {
    const pending = entry._pending_api_snapshot;
    if (!object(pending) || !object(pending._snapshot_ts))
        return;
    const post = (pending._post_ids ??= dictionary<Counters>()) as Record<string, Counters>;
    for (const row of lines) {
        if (!object(row) || row.type !== 'assistant')
            continue;
        const time = timestamp(row.timestamp);
        if (time === null)
            continue;
        const keys = Object.entries(pending._snapshot_ts).filter(([, value]) => numeric(value) !== null && time > numeric(value)!).map(([key]) => key as keyof Totals);
        if (keys.length)
            mergeUsageFields(post, parseUsage([row]), keys);
    }
}
export function aggregateVisible(entry: Data): Counters {
    const totals = { ...BASE }, records = [entry.base ?? BASE, ...Object.values(object(entry.ids) ? entry.ids : {})];
    for (const record of records)
        for (const key of FIELDS)
            totals[key] += object(record) ? usageInt(record[key]) : 0n;
    return totals;
}
export function visibleTotals(entry: Data): Totals { const raw = aggregateVisible(entry); return { hit: raw.cr, miss: raw.i + raw.cc, out: raw.o }; }
export function displayTotals(entry: Data, visible = visibleTotals(entry)): Totals {
    const { api_snapshot: snapshot, api_visible_anchor: anchor } = entry;
    if (!object(snapshot) || !object(anchor))
        return visible;
    return Object.fromEntries((Object.keys(TOKEN_FIELDS) as (keyof Totals)[]).map(key => [key, hasUsage(snapshot, [key]) ? usageInt(snapshot[key]) + maxZero(usageInt(visible[key]) - usageInt(anchor[key])) : visible[key]])) as Totals;
}
function maxZero(value: bigint): bigint { return value > 0n ? value : 0n; }
export function acceptPending(entry: UsageEntry, visible: Totals): boolean {
    const pending = entry._pending_api_snapshot;
    delete entry._pending_api_snapshot;
    if (!object(pending))
        return false;
    const post = visibleTotals({ base: { ...BASE }, ids: object(pending._post_ids) ? pending._post_ids : {} }), candidate: Partial<Totals> = {};
    for (const key of Object.keys(TOKEN_FIELDS) as (keyof Totals)[])
        if (hasUsage(pending, [key]))
            candidate[key] = usageInt(pending[key]) + post[key];
    const current = entry.api_snapshot;
    if (object(current)) {
        const displayed = displayTotals(entry, visible);
        if ((Object.keys(candidate) as (keyof Totals)[]).some(key => candidate[key]! < displayed[key]))
            return false;
    }
    const snapshot: Data = object(current) ? { ...current } : {};
    snapshot.fingerprint = pending.fingerprint;
    const anchor: Data = object(entry.api_visible_anchor) ? { ...entry.api_visible_anchor } : {};
    for (const key of Object.keys(candidate) as (keyof Totals)[]) {
        snapshot[key] = pending[key];
        anchor[key] = maxZero(visible[key] - post[key]);
    }
    entry.api_snapshot = snapshot;
    entry.api_visible_anchor = anchor;
    return true;
}
export function collapseIds(entry: UsageEntry): boolean {
    const ids = Object.keys(entry.ids);
    if (ids.length <= MAX_IDS)
        return false;
    for (const id of ids.slice(0, Math.floor(ids.length / 2))) {
        const row = entry.ids[id]!;
        delete entry.ids[id];
        for (const key of FIELDS)
            entry.base[key] = usageInt(entry.base[key]) + usageInt(row[key]);
    }
    return true;
}
export interface SessionTokenCounts {
    hit: bigint | null;
    miss: bigint | null;
    out: bigint | null;
    input_tokens: bigint | null;
}
export function sessionTokenCounts(entry: unknown): SessionTokenCounts | null {
    if (!object(entry))
        return null;
    const observed = tokenObservations(entry);
    if (!observed.input && !observed.output)
        return null;
    const raw = object(entry._raw_token_counts) && Object.keys(entry._raw_token_counts).sort().join(',') === 'hit,miss,out' ? entry._raw_token_counts : displayTotals(entry);
    if (Object.values(raw).some(value => numeric(value) === null || !Number.isFinite(numeric(value)) || numeric(value)! < 0))
        return null;
    const hit = observed.input ? usageInt(raw.hit) : null, miss = observed.input ? usageInt(raw.miss) : null, out = observed.output ? usageInt(raw.out) : null;
    return { hit, miss, out, input_tokens: hit === null || miss === null ? null : hit + miss };
}
