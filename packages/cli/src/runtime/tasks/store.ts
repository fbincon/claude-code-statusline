import { join, dirname } from 'node:path';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { object, truth, string, type Data } from '@fbincon/statusline-core/runtime/values';
import { storeFromState, findTurn, mirrorState, type TaskStore as State, type Turn } from '@fbincon/statusline-core/runtime/tasks/model';
import type { RuntimeContext } from '../context.js';
import { runtimeIO, readStored, type RuntimeIO } from '../io.js';
export class TaskStore {
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO = runtimeIO()) { }
    directory(): string { return join(this.context.runtimeRoot, 'turns'); }
    path(sessionId: string): string { return join(this.directory(), sha256(sessionId) + '.json'); }
    raw(sessionId: string): Data | null {
        try {
            const state = readStored(this.io, this.path(sessionId));
            return object(state) && equalSettings(state.schema, 1) && state.session_id === sessionId ? state : null;
        }
        catch {
            return null;
        }
    }
    load(sessionId: unknown): State | null {
        if (!truth(sessionId))
            return null;
        const session = string(sessionId), raw = this.raw(session);
        return raw ? storeFromState(raw, session) : null;
    }
    state(sessionId: unknown, promptId: unknown = null): Turn | null {
        const state = this.load(sessionId);
        if (!state)
            return null;
        const record = findTurn(state, promptId);
        return record ? { ...record } : null;
    }
    write(sessionId: string, state: Data): void {
        this.io.privateDirectory(dirname(this.directory()));
        this.io.privateDirectory(this.directory());
        this.io.write(this.path(sessionId), Buffer.from(pythonJson(state, { compact: true, sortKeys: true, allowNan: true })));
    }
    mutate(sessionId: unknown, transition: (store: State) => unknown): Data | null {
        const session = string(sessionId);
        this.io.privateDirectory(dirname(this.directory()));
        this.io.privateDirectory(this.directory());
        return this.io.lock(this.path(session).slice(0, -5) + '.lock', () => {
            const raw = this.raw(session), state = storeFromState(raw ?? {}, session), preferred = transition(state);
            const updated = mirrorState(session, state, preferred ?? null);
            if (updated && !equalSettings(updated, raw))
                this.write(session, updated);
            return updated;
        });
    }
    prune(): void {
        try {
            const entries = this.io.entries(this.directory()).filter(entry => entry.file && !entry.link && entry.name.endsWith('.json'));
            const ranked = entries.map(entry => ({ ...entry, stamp: this.io.stat(entry.path, false).mtimeNs })).sort((a, b) => a.stamp > b.stamp ? -1 : a.stamp < b.stamp ? 1 : 0);
            for (const entry of ranked.slice(100)) {
                try {
                    this.io.remove(entry.path);
                }
                catch { /* Retain inaccessible history. */ }
            }
        }
        catch { /* History cleanup never blocks a published observation. */ }
    }
}
