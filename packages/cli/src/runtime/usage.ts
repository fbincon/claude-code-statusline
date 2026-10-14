import { dirname, join, resolve, extname } from 'node:path';
import { object, own, int, string, truth, dictionary, type Data } from '@fbincon/statusline-core/runtime/values';
import * as usage from '@fbincon/statusline-core/runtime/usage';
import { updateTurnMetadata } from '@fbincon/statusline-core/runtime/transcript';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { divideIntegers, fixed } from '@fbincon/statusline-core/numbers';
import { scalarCompare } from '@fbincon/statusline-core/json';
import { sha256 } from '@fbincon/statusline-platform/hash';
import type { RuntimeContext } from './context.js';
import { runtimeIO, readStored, transcriptChunk, type RuntimeIO } from './io.js';
import { TaskService } from './tasks/service.js';
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
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO = runtimeIO()) { this.tasks = new TaskService(context, io); }
    path(): string { return join(this.context.cacheRoot, 'statusline_state.json'); }
    load(): {
        state: Data & {
            sessions: Record<string, usage.UsageEntry>;
        };
        dropped: boolean;
    } {
        try {
            const raw = readStored(this.io, this.path());
            if (object(raw) && object(raw.sessions)) {
                let dropped = false;
                for (const [key, entry] of Object.entries(raw.sessions))
                    if (!object(entry) || !object(entry.files) || !object(entry.ids)) {
                        delete raw.sessions[key];
                        dropped = true;
                    }
                return { state: raw as Data & {
                        sessions: Record<string, usage.UsageEntry>;
                    }, dropped };
            }
        }
        catch { /* A corrupt cache is rebuilt from transcript evidence. */ }
        return { state: { sessions: dictionary() }, dropped: false };
    }
    metadata(entry: usage.UsageEntry, lines: unknown[], session: string, reset = false): void {
        const observations = updateTurnMetadata(entry, lines, reset);
        if (observations.length) {
            try {
                this.tasks.transcript(session, observations);
            }
            catch { /* Accounting survives an unavailable lifecycle ledger. */ }
        }
    }
    updateFile(entry: usage.UsageEntry, path: string, session: string | null = null, trackPrompts = false, trackCost = false): boolean {
        let size: bigint, mtime: bigint;
        try {
            const stat = this.io.stat(path);
            size = stat.size;
            mtime = stat.mtimeNs;
        }
        catch {
            return false;
        }
        const previous = own(entry.files, path), recorded = previous ? int(previous.size)! : 0n;
        const reset = !previous || size < recorded || size === recorded && mtime !== int(previous.mtime_ns);
        if (!reset && size <= recorded)
            return false;
        const { lines, cursor } = transcriptChunk(this.io, path, reset ? 0n : recorded);
        if (!lines.length)
            return false;
        if (!previous)
            entry.files[path] = { size: cursor, mtime_ns: mtime };
        else {
            previous.size = cursor;
            previous.mtime_ns = mtime;
        }
        usage.mergeIds(entry.ids, usage.parseUsage(lines, entry.token_observed));
        if (trackPrompts && session)
            this.metadata(entry, lines, session, reset);
        if (trackCost)
            usage.stageCostSnapshot(entry, lines, sha256);
        else
            usage.stageSubagentDelta(entry, lines);
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
            return this.io.lock(this.path() + '.lock', () => { entered = true; return this.locked(session, path); });
        }
        catch (error) {
            if (entered)
                throw error;
            return null;
        }
    }
    private locked(session: string, path: string): UsageResult {
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
            const { lines } = transcriptChunk(this.io, path, 0n);
            if (lines.length)
                this.metadata(entry, lines, session);
            entry.turn_scan_version = usage.TURN_SCAN_VERSION;
            changed = true;
        }
        if (!equalSettings(entry.usage_scan_version, usage.USAGE_SCAN_VERSION)) {
            const { lines } = transcriptChunk(this.io, path, 0n);
            if (lines.length) {
                usage.parseUsage(lines, entry.token_observed);
                usage.stageCostSnapshot(entry, lines, sha256, true);
            }
            entry.usage_scan_version = usage.USAGE_SCAN_VERSION;
            rescan = true;
            changed = true;
        }
        let root = join(path.slice(0, path.length - extname(path).length), 'subagents');
        const directory = (target: string) => { try {
            this.io.entries(target);
            return true;
        }
        catch {
            return false;
        } };
        if (!directory(root)) {
            const alternative = join(dirname(path), session, 'subagents');
            if (directory(alternative))
                root = alternative;
        }
        for (const sub of this.subagentFiles(root)) {
            if (this.updateFile(entry, sub))
                changed = true;
            if (rescan) {
                const { lines } = transcriptChunk(this.io, sub, 0n);
                if (lines.length) {
                    usage.parseUsage(lines, entry.token_observed);
                    usage.stageSubagentDelta(entry, lines);
                }
            }
        }
        if (usage.collapseIds(entry))
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
                this.io.write(this.path(), Buffer.from(pythonJson(state, { allowNan: true })));
            }
            catch { /* Retain this result even if the cache cannot be saved. */ }
        }
        const displayed = usage.displayTotals(entry, visible);
        return [humanizeTokens(displayed.hit), humanizeTokens(displayed.miss), humanizeTokens(displayed.out), entry.last_pt ?? null, { ...entry, _raw_token_counts: displayed }];
    }
}
