import { forEachRecord, recordEntries, recordKeys, recordValues } from '../ordered-record.js';
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
    for (const row of recordValues(object(entry.ids) ? entry.ids : {})) {
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
export function addUsage(out: Record<string, Counters> | null, row: unknown, observed?: Observed): void {
    if (!object(row) || row.type !== 'assistant' || !object(row.message))
        return;
    const { id, usage } = row.message;
    if (typeof id !== 'string' || !id || !hasUsage(usage, [...INPUT, 'output_tokens']))
        return;
    observe(observed, usage, INPUT, ['output_tokens']);
    if (!out) return;
    const record = out[id] ??= { ...BASE };
    for (const [key, field] of [['i', 'input_tokens'], ['o', 'output_tokens'], ['cc', 'cache_creation_input_tokens'], ['cr', 'cache_read_input_tokens']] as const) {
        const value = int(usage[field]);
        if (value !== null && value > record[key])
            record[key] = value;
    }
}
export function parseUsage(lines: readonly unknown[], observed?: Observed): Record<string, Counters> {
    const out = dictionary<Counters>();
    for (const row of lines) addUsage(out, row, observed);
    return out;
}
export function mergeUsageFields(ids: Record<string, Counters>, newIds: Record<string, Counters>, keys: readonly (keyof Totals)[]): void {
    forEachRecord(newIds, (next, id) => {
        const record = ids[id] ??= { ...BASE };
        for (const key of keys)
            for (const field of TOKEN_FIELDS[key])
                if (usageInt(next[field]) > usageInt(record[field]))
                    record[field] = next[field];
    });
}
export function mergeIds(ids: Record<string, Counters>, next: Record<string, Counters>): boolean {
    let changed = false;
    forEachRecord(next, (value, id) => {
        const record = own(ids, id);
        if (record === undefined) {
            ids[id] = value;
            changed = true;
            return;
        }
        for (const key of FIELDS)
            if (usageInt(value[key]) > usageInt(record[key])) {
                record[key] = value[key];
                changed = true;
            }
    });
    return changed;
}
/** Each independently observed token field keeps only IDs after its latest
 * snapshot. Group insertion order matches the legacy final-index rescan. */
export class CostAccumulator {
    private latest: Data | null = null;
    private lastTime: number | null = null;
    private readonly times: Data = {};
    private readonly fields = new Map<keyof Totals, Record<string, Counters>>();
    private groups: Record<string, Counters>[] = [];
    constructor(private readonly observed?: Observed) {}
    push(row: unknown): void {
        if (!object(row)) return;
        const time = timestamp(row.timestamp);
        if (time !== null) this.lastTime = time;
        for (const group of this.groups) addUsage(group, row);
        if (row.type !== 'cost-state' || !object(row.modelUsage) || !recordKeys(row.modelUsage).length) return;
        let hit = 0n, miss = 0n, out = 0n, valid = 0;
        const available = { input: false, output: false };
        forEachRecord(row.modelUsage, usage => {
            const input = ['inputTokens', 'cacheCreationInputTokens', 'cacheReadInputTokens'];
            if (!hasUsage(usage, [...input, 'outputTokens'])) return;
            observe(available, usage, input, ['outputTokens']);
            valid++;
            hit += usageInt(usage.cacheReadInputTokens);
            miss += usageInt(usage.inputTokens) + usageInt(usage.cacheCreationInputTokens);
            out += usageInt(usage.outputTokens);
        });
        if (!valid) return;
        if (this.observed) {
            this.observed.input ||= available.input;
            this.observed.output ||= available.output;
        }
        const totals: Partial<Totals> = {};
        if (available.input) Object.assign(totals, { hit, miss });
        if (available.output) totals.out = out;
        Object.assign(this.latest ??= {}, totals);
        const post = dictionary<Counters>();
        for (const key of Object.keys(totals) as (keyof Totals)[]) {
            this.fields.set(key, post);
            this.times[key] = this.lastTime === null ? null : float(this.lastTime);
        }
        this.groups = [...new Set(this.fields.values())];
    }
    finish(hash: (input: string) => string): Data | null {
        if (!this.latest) return null;
        const latest = this.latest;
        latest.fingerprint = hash(recordKeys(TOKEN_FIELDS).map(key => string(latest[key])).join(':'));
        latest._snapshot_ts = this.times;
        const post = dictionary<Counters>();
        latest._post_ids = post;
        for (const group of this.groups) mergeUsageFields(post, group, [...this.fields].filter(([, value]) => value === group).map(([key]) => key));
        return latest;
    }
}
export function parseCostSnapshot(lines: readonly unknown[], hash: (input: string) => string, observed?: Observed): Data | null {
    const scan = new CostAccumulator(observed);
    for (const row of lines) scan.push(row);
    return scan.finish(hash);
}
export function stageCostSnapshot(entry: UsageEntry, lines: readonly unknown[], hash: (input: string) => string, force = false): void {
    stageParsedCostSnapshot(entry, parseCostSnapshot(lines, hash, entry.token_observed), force);
}
export function stageParsedCostSnapshot(entry: UsageEntry, snapshot: Data | null, force = false): void {
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
        const keys = recordEntries(pending._snapshot_ts).filter(([, value]) => numeric(value) !== null && time > numeric(value)!).map(([key]) => key as keyof Totals);
        if (keys.length)
            mergeUsageFields(post, parseUsage([row]), keys);
    }
}
export function aggregateVisible(entry: Data): Counters {
    const totals = { ...BASE };
    const add = (record: unknown) => {
        if (object(record)) for (const key of FIELDS) totals[key] += usageInt(record[key]);
    };
    add(entry.base ?? BASE);
    if (object(entry.ids)) forEachRecord(entry.ids, add);
    return totals;
}
export function visibleTotals(entry: Data): Totals { const raw = aggregateVisible(entry); return { hit: raw.cr, miss: raw.i + raw.cc, out: raw.o }; }
export function displayTotals(entry: Data, visible = visibleTotals(entry)): Totals {
    const { api_snapshot: snapshot, api_visible_anchor: anchor } = entry;
    if (!object(snapshot) || !object(anchor))
        return visible;
    return Object.fromEntries((recordKeys(TOKEN_FIELDS) as (keyof Totals)[]).map(key => [key, hasUsage(snapshot, [key]) ? usageInt(snapshot[key]) + maxZero(usageInt(visible[key]) - usageInt(anchor[key])) : visible[key]])) as Totals;
}
function maxZero(value: bigint): bigint { return value > 0n ? value : 0n; }
export function acceptPending(entry: UsageEntry, visible: Totals): boolean {
    const pending = entry._pending_api_snapshot;
    delete entry._pending_api_snapshot;
    if (!object(pending))
        return false;
    const post = visibleTotals({ base: { ...BASE }, ids: object(pending._post_ids) ? pending._post_ids : {} }), candidate: Partial<Totals> = {};
    for (const key of recordKeys(TOKEN_FIELDS) as (keyof Totals)[])
        if (hasUsage(pending, [key]))
            candidate[key] = usageInt(pending[key]) + post[key];
    const current = entry.api_snapshot;
    if (object(current)) {
        const displayed = displayTotals(entry, visible);
        if ((recordKeys(candidate) as (keyof Totals)[]).some(key => candidate[key]! < displayed[key]))
            return false;
    }
    const snapshot: Data = object(current) ? { ...current } : {};
    snapshot.fingerprint = pending.fingerprint;
    const anchor: Data = object(entry.api_visible_anchor) ? { ...entry.api_visible_anchor } : {};
    for (const key of recordKeys(candidate) as (keyof Totals)[]) {
        snapshot[key] = pending[key];
        anchor[key] = maxZero(visible[key] - post[key]);
    }
    entry.api_snapshot = snapshot;
    entry.api_visible_anchor = anchor;
    return true;
}
export function collapseIds(entry: UsageEntry): boolean {
    const ids = recordKeys(entry.ids);
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
    const raw = object(entry._raw_token_counts) && recordKeys(entry._raw_token_counts).sort().join(',') === 'hit,miss,out' ? entry._raw_token_counts : displayTotals(entry);
    if (recordValues(raw).some(value => numeric(value) === null || !Number.isFinite(numeric(value)) || numeric(value)! < 0))
        return null;
    const hit = observed.input ? usageInt(raw.hit) : null, miss = observed.input ? usageInt(raw.miss) : null, out = observed.output ? usageInt(raw.out) : null;
    return { hit, miss, out, input_tokens: hit === null || miss === null ? null : hit + miss };
}
