import { dirname, join, resolve, extname } from 'node:path';
import { object, own, int, string, truth, dictionary, type Data } from '@fbincon/statusline-core/runtime/values';
import * as usage from '@fbincon/statusline-core/runtime/usage';
import { applyTurnMetadata, TurnAccumulator, type TurnEvents } from '@fbincon/statusline-core/runtime/transcript';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { divideIntegers, fixed } from '@fbincon/statusline-core/numbers';
import { scalarCompare } from '@fbincon/statusline-core/json';
import { sha256 } from '@fbincon/statusline-platform/hash';
import type { RuntimeContext } from './context.js';
import { runtimeIO, visitTranscript, type RuntimeIO } from './io.js';
import { TaskService } from './tasks/service.js';
import { readDataJson, dumpDataJson } from './json-data.js';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { orderedDataRecord, recordEntries } from '@fbincon/statusline-core/ordered-record';
import { UsageIndex } from './usage-index.js';
import { safeTarget } from '../integration/paths.js';
export function humanizeTokens(value: bigint): string {
    if (value >= 1000000n)
        return fixed(divideIntegers(value, 1000000n), 2).replace(/0+$/u, '').replace(/\.$/u, '') + 'M';
    if (value >= 1000n)
        return fixed(divideIntegers(value, 1000n), 1) + 'K';
    return String(value > 0n ? value : 0n);
}
export type UsageResult = [
    string,
    string,
    string,
    unknown,
    usage.UsageEntry
];
export class UsageCollector {
    readonly tasks: TaskService;
    private index: UsageIndex | null = null;
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO = runtimeIO()) { this.tasks = new TaskService(context, io); }
    path(): string { return join(this.context.cacheRoot, 'statusline_usage_v2/state.json'); }
    load(): {
        state: Data & {
            sessions: Record<string, usage.UsageEntry>;
        };
        dropped: boolean;
    } {
        try {
            const current = this.io.read(this.path()), bytes = current ?? this.io.read(join(this.context.cacheRoot, 'statusline_state.json'));
            const raw = bytes === null ? null : readDataJson(decodeUtf8(bytes));
            if (object(raw) && object(raw.sessions)) {
                const sessions = orderedDataRecord(raw.sessions);
                Object.setPrototypeOf(sessions, null);
                raw.sessions = sessions;
                let dropped = false;
                for (const [key, entry] of recordEntries(sessions))
                    if (!object(entry) || !object(entry.files) || !object(entry.ids)) {
                        delete sessions[key];
                        dropped = true;
                    }
                    else {
                        entry.ids = orderedDataRecord(entry.ids);
                        Object.setPrototypeOf(entry.ids, null);
                        if (current === null && object(entry.base) && Object.values(entry.base).some(value => usage.usageInt(value) > 0n)) entry.usage_incomplete = true;
                    }
                return { state: raw as Data & {
                        sessions: Record<string, usage.UsageEntry>;
                    }, dropped: dropped || current === null };
            }
        }
        catch { /* A corrupt cache is rebuilt from transcript evidence. */ }
        return { state: { sessions: dictionary() }, dropped: false };
    }
    private scan(entry: usage.UsageEntry, path: string, start: bigint, mode: 'merge' | 'observe' | 'none', prompts = false, cost = false, reset = false) {
        const observed = entry.token_observed ? { ...entry.token_observed } : undefined;
        const ids = mode === 'merge' ? dictionary<usage.Counters>() : null;
        const turns = prompts ? new TurnAccumulator(reset ? null : entry.transcript_prompt_id ?? null) : null;
        const costs = cost ? new usage.CostAccumulator(observed) : null;
        const pending = !cost && mode !== 'none' && object(entry._pending_api_snapshot) && object(entry._pending_api_snapshot._snapshot_ts) ? { ...entry._pending_api_snapshot, _post_ids: dictionary<usage.Counters>() } : null;
        const delta = { _pending_api_snapshot: pending } as unknown as usage.UsageEntry;
        const read = visitTranscript(this.io, path, start, row => {
            if (mode !== 'none') usage.addUsage(ids, row, observed);
            turns?.push(row);
            costs?.push(row);
            if (pending) usage.stageSubagentDelta(delta, [row]);
        });
        return read ? { ...read, ids, observed, turns: turns?.result, snapshot: costs?.finish(sha256) ?? null, post: pending?._post_ids } : null;
    }
    private metadata(entry: usage.UsageEntry, result: TurnEvents, session: string): void {
        const observations = applyTurnMetadata(entry, result);
        if (observations.length) {
            try { this.tasks.transcript(session, observations); }
            catch { /* Accounting survives an unavailable lifecycle ledger. */ }
        }
    }
    private applyScan(entry: usage.UsageEntry, scan: NonNullable<ReturnType<UsageCollector['scan']>>, session: string | null, cost: boolean, force = false): void {
        if (scan.observed && entry.token_observed) Object.assign(entry.token_observed, scan.observed);
        if (scan.ids) {
            if (!this.index) {
                this.index = new UsageIndex(join(this.context.cacheRoot, 'statusline_usage_v2', sha256(session ?? this.activeSession)), this.context.cacheRoot, this.io, entry.usage_index);
                if (entry.usage_index == null) {
                    // Seed exact retained identities without changing their totals.
                    this.index.merge(entry.ids, { ids: dictionary(), base: { ...usage.BASE }, files: dictionary() });
                }
            }
            this.index.merge(scan.ids, entry);
            entry.usage_index = this.index.publish();
        }
        if (scan.turns && session) this.metadata(entry, scan.turns, session);
        if (cost) usage.stageParsedCostSnapshot(entry, scan.snapshot, force);
        else if (scan.post && object(entry._pending_api_snapshot)) {
            const pending = entry._pending_api_snapshot;
            usage.mergeIds((pending._post_ids ??= dictionary<usage.Counters>()) as Record<string, usage.Counters>, scan.post);
        }
    }
    updateFile(entry: usage.UsageEntry, path: string, session: string | null = null, trackPrompts = false, trackCost = false): boolean {
        let size: bigint, mtime: bigint, identity: bigint[];
        try {
            const stat = this.io.stat(path);
            size = stat.size;
            mtime = stat.mtimeNs;
            identity = [stat.dev, stat.ino];
        }
        catch {
            return false;
        }
        const previous = own(entry.files, path), recorded = previous ? int(previous.size)! : 0n;
        const reset = !previous || !equalSettings(previous.identity, identity) || size < recorded || size === recorded && mtime !== int(previous.mtime_ns);
        if (!reset && size <= recorded)
            return false;
        const scan = this.scan(entry, path, reset ? 0n : recorded, 'merge', trackPrompts && Boolean(session), trackCost, reset);
        if (!scan?.count)
            return false;
        if (!previous)
            entry.files[path] = { size: scan.cursor, mtime_ns: mtime, identity };
        else {
            previous.size = scan.cursor;
            previous.mtime_ns = mtime;
            previous.identity = identity;
        }
        this.applyScan(entry, scan, session, trackCost);
        return true;
    }
    subagentFiles(root: string): string[] {
        const paths: string[] = [];
        const walk = (directory: string) => {
            let entries;
            try {
                entries = this.io.entries(directory);
            }
            catch {
                return;
            }
            for (const entry of entries) {
                if (entry.directory && !entry.link)
                    walk(entry.path);
                else if (!entry.directory && entry.name.startsWith('agent-') && entry.name.endsWith('.jsonl'))
                    paths.push(entry.path);
            }
        };
        walk(root);
        return paths.sort(scalarCompare);
    }
    collect(data: unknown): UsageResult | null {
        if (!object(data) || !truth(data.session_id) || !truth(data.transcript_path))
            return null;
        const session = string(data.session_id), path = resolve(data.transcript_path as string);
        // Lock acquisition failures are soft; failures inside a collector are observable
        // to the renderer's existing boundary and are never mistaken for valid totals.
        let entered = false;
        try {
            safeTarget(this.context.cacheRoot, this.path());
            return this.io.lock(this.path() + '.lock', () => { entered = true; return this.locked(session, path); });
        }
        catch (error) {
            if (entered)
                throw error;
            return null;
        }
    }
    private activeSession = '';
    private pruneIndex(): void { this.index?.prune(); }
    private locked(session: string, path: string): UsageResult | null {
        this.index = null;
        this.activeSession = session;
        const { state, dropped } = this.load();
        const entry = state.sessions[session] ??= { files: dictionary(), ids: dictionary(), base: { ...usage.BASE } };
        let changed = dropped, rescan = false;
        if (!object(entry.token_observed)) {
            entry.token_observed = usage.tokenObservations(entry, true);
            changed = true;
        }
        if (this.updateFile(entry, path, session, true, true))
            changed = true;
        if (!equalSettings(entry.turn_scan_version, usage.TURN_SCAN_VERSION)) {
            for (const key of ['last_pt', 'last_prompt_id', 'last_interrupt', 'last_local_command', 'last_assistant_ts'])
                delete entry[key];
            const scan = this.scan(entry, path, 0n, 'none', true);
            if (scan?.count) this.applyScan(entry, scan, session, false);
            entry.turn_scan_version = usage.TURN_SCAN_VERSION;
            changed = true;
        }
        if (!equalSettings(entry.usage_scan_version, usage.USAGE_SCAN_VERSION)) {
            const scan = this.scan(entry, path, 0n, 'observe', false, true);
            if (scan?.count) this.applyScan(entry, scan, null, true, true);
            entry.usage_scan_version = usage.USAGE_SCAN_VERSION;
            rescan = true;
            changed = true;
        }
        let root = join(path.slice(0, path.length - extname(path).length), 'subagents');
        const directory = (target: string) => {
            try {
                this.io.entries(target);
                return true;
            }
            catch {
                return false;
            }
        };
        if (!directory(root)) {
            const alternative = join(dirname(path), session, 'subagents');
            if (directory(alternative))
                root = alternative;
        }
        for (const sub of this.subagentFiles(root)) {
            if (this.updateFile(entry, sub))
                changed = true;
            if (rescan) {
                const scan = this.scan(entry, sub, 0n, 'observe');
                if (scan?.count) this.applyScan(entry, scan, null, false);
            }
        }
        while (usage.collapseIds(entry))
            changed = true;
        const visible = usage.visibleTotals(entry);
        if (usage.acceptPending(entry, visible))
            changed = true;
        if (changed) {
            delete state.sessions[session];
            state.sessions[session] = entry;
            while (Object.keys(state.sessions).length > usage.MAX_SESSIONS)
                delete state.sessions[Object.keys(state.sessions)[0]!];
            try {
                this.io.write(this.path(), Buffer.from(dumpDataJson(state)));
                this.pruneIndex();
                UsageIndex.pruneSessions(join(this.context.cacheRoot, 'statusline_usage_v2'), this.context.cacheRoot, Object.keys(state.sessions), this.io);
            }
            catch { /* Retain this result even if the cache cannot be saved. */ }
        }
        const displayed = usage.displayTotals(entry, visible);
        if (entry.usage_incomplete === true) return null;
        return [humanizeTokens(displayed.hit), humanizeTokens(displayed.miss), humanizeTokens(displayed.out), entry.last_pt ?? null, { ...entry, _raw_token_counts: displayed }];
    }
}
