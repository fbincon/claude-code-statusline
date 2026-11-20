import { join } from 'node:path';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { lock } from '@fbincon/statusline-platform/files';
import { readPrivateState } from '@fbincon/statusline-platform/private-state';
import { decodeJsonBytes } from '@fbincon/statusline-platform/utf8';
import { readJson } from '@fbincon/statusline-core/json-read';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { numeric, object } from '@fbincon/statusline-core/runtime/values';
import { empty, fresh, validateState, type LiveState } from '@fbincon/statusline-core/runtime/live/state';
import { applyObservation, mergePermission } from '@fbincon/statusline-core/runtime/live/reducer';
import { reconcileBindings } from '@fbincon/statusline-core/runtime/live/bindings';
import { MAX_SESSIONS, STALE_MS, TIMING_KINDS, number, text, type Observation } from '@fbincon/statusline-core/runtime/live/model';
import { storeFromState, type TaskStore as History } from '@fbincon/statusline-core/runtime/tasks/model';
import { observeNative } from '@fbincon/statusline-core/runtime/tasks/native';
import type { RuntimeContext } from '../context.js';
import { runtimeIO, readStored, type RuntimeIO } from '../io.js';
import { TaskStore } from '../tasks/store.js';

const MAX_HOOK_STATE_BYTES = 32 * 1024 * 1024;

export class LiveStore {
    readonly tasks: TaskStore;
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO = runtimeIO()) { this.tasks = new TaskStore(context, io); }
    directory(): string { return join(this.context.runtimeRoot, 'live'); }
    path(session: string): string { return join(this.directory(), sha256(session) + '.json'); }
    private publish(target: string, state: LiveState): void {
        this.io.write(target, Buffer.from(pythonJson(state, { ensureAscii: false, compact: true })));
    }
    load(session: string): LiveState | null {
        try {
            const path = this.path(session);
            return this.io.isLink(path) ? null : validateState(readStored(this.io, path, true), session);
        }
        catch {
            return null;
        }
    }
    history(session: string): History | null {
        try {
            const raw = readStored(this.io, this.tasks.path(session), true);
            return object(raw) && raw.session_id === session ? storeFromState(raw, session) : null;
        }
        catch {
            return null;
        }
    }
    /** Settings hooks supplement the current native epoch without joining the Mod's sequence ledger. */
    observeHookPermission(session: string, mode: string, observedAt: number): void {
        text(session, 'session_id');
        text(mode, 'mode', false, 64);
        number(observedAt, 'permission observation time');
        const target = this.path(session);
        this.io.stat(target, false);
        const release = lock(target.slice(0, -5) + '.lock', true);
        try {
            const size = Number(this.io.stat(target, false).size);
            if (size < 1 || size > MAX_HOOK_STATE_BYTES) return;
            const state = validateState(readJson(decodeJsonBytes(readPrivateState(target, size))), session);
            if (!state?.epoch) return;
            const now = this.context.nowMs();
            if (!fresh(state, now) || observedAt < (numeric(state.loaded_at_ms) ?? Infinity) || now < observedAt || now - observedAt > STALE_MS)
                return;
            if (mergePermission(state, { mode, live: false }, observedAt, 'classic_hook'))
                this.publish(target, state);
        } finally { release(); }
    }
    observe(observations: readonly Observation[], { timing = false, completeTiming = true, advanced = true } = {}): {
        accepted: number;
        ignored: number;
    } {
        let accepted = 0, ignored = 0;
        const grouped = new Map<string, Observation[]>();
        for (const item of observations) {
            if (!grouped.has(item.session_id))
                grouped.set(item.session_id, []);
            grouped.get(item.session_id)!.push(item);
        }
        for (const [session, rows] of grouped) {
            const target = this.path(session);
            this.io.lock(target.slice(0, -5) + '.lock', () => {
                const state = this.load(session) ?? empty(session);
                for (const item of rows) {
                    if (applyObservation(state, item, !advanced && !TIMING_KINDS.has(item.kind)))
                        accepted++;
                    else
                        ignored++;
                }
                reconcileBindings(state, this.history(session));
                // Always acquire live before task. Task writers never acquire a live lock.
                if (timing)
                    this.tasks.mutate(session, history => observeNative(history, state, this.context.sample, completeTiming));
                this.publish(target, state);
            });
        }
        this.prune();
        return { accepted, ignored };
    }
    prune(): void {
        try {
            const entries = this.io.entries(this.directory()).filter(entry => entry.file && !entry.link && entry.name.endsWith('.json'));
            const ranked = entries.map(entry => ({ ...entry, stamp: this.io.stat(entry.path).mtimeNs })).sort((a, b) => a.stamp > b.stamp ? -1 : a.stamp < b.stamp ? 1 : 0);
            for (const entry of ranked.slice(MAX_SESSIONS))
                this.io.lock(entry.path.slice(0, -5) + '.lock', () => this.io.remove(entry.path));
        }
        catch { /* Cleanup cannot invalidate an already published observation. */ }
    }
}
