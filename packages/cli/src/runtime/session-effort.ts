import { join } from 'node:path';
import { deepGet } from '@fbincon/statusline-core/rendering/formatters';
import { effortIdentity, SESSION_EFFORT_TTL_MS, type SessionEffortObservation, type SessionEffortReader } from '@fbincon/statusline-core/rendering/subagent-effort';
import { object } from '@fbincon/statusline-core/runtime/values';
import { atomicWrite, isLinkOrReparse, lock, privateDirectory } from '@fbincon/statusline-platform/files';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { readPrivateState } from '@fbincon/statusline-platform/private-state';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import type { RuntimeContext } from './context.js';

const MAX_SESSIONS = 100;
const MAX_BYTES = 512 * 1024;
type CachedObservation = SessionEffortObservation & { namespace: string };
type Snapshot = CachedObservation[] | null;

function paths(context: RuntimeContext) {
    const directory = join(context.runtimeRoot, 'session-effort');
    if (isLinkOrReparse(directory)) throw new Error('Linked session effort directory');
    return { directory, data: join(directory, 'observations.json'), lock: join(directory, 'observations.lock') };
}

function validTime(time: unknown): time is number {
    return typeof time === 'number' && Number.isSafeInteger(time) && time >= 0 && time <= 8_640_000_000_000_000;
}

function readSnapshot(path: string): Snapshot {
    let bytes: Buffer;
    try { bytes = readPrivateState(path, MAX_BYTES); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
    try {
        const data: unknown = JSON.parse(decodeUtf8(bytes));
        if (!object(data) || data.version !== 1 || Object.keys(data).length !== 2 ||
            !Array.isArray(data.observations) || data.observations.length > MAX_SESSIONS) return null;
        const seen = new Set<string>();
        const records: CachedObservation[] = [];
        for (const row of data.observations) {
            if (!object(row) || Object.keys(row).length !== 5 || typeof row.namespace !== 'string' ||
                !/^[0-9a-f]{64}$/u.test(row.namespace) || !validTime(row.observed_at_ms)) return null;
            const session = effortIdentity(row.session_id), model = effortIdentity(row.model_id, 512), effort = effortIdentity(row.effort_level, 64);
            if (!session || (!(model && effort) && !(row.model_id === null && row.effort_level === null))) return null;
            const key = row.namespace + session;
            if (seen.has(key)) return null;
            seen.add(key);
            records.push({ namespace: row.namespace, session_id: session, model_id: model, effort_level: effort, observed_at_ms: row.observed_at_ms });
        }
        return records;
    } catch { return null; }
}

/** Lazily snapshot at most once per render or read-only diagnosis. */
export function sessionEffortReader(context: RuntimeContext): SessionEffortReader {
    const namespace = sha256(context.configDir);
    let snapshot: Snapshot | 'unavailable' | undefined;
    return session => {
        if (snapshot === undefined) {
            try { snapshot = readSnapshot(paths(context).data); }
            catch { snapshot = 'unavailable'; }
        }
        if (snapshot === 'unavailable') return { status: 'source_unavailable' };
        if (snapshot === null) return { status: 'invalid_field' };
        const record = snapshot.find(row => row.namespace === namespace && row.session_id === session);
        if (!record) return { status: 'not_observed' };
        if (record.observed_at_ms > context.nowMs()) return { status: 'invalid_field' };
        return { status: 'observed', observation: record };
    };
}

/** A missing model or effort is a newer negative observation for this session. */
export function publishSessionEffort(context: RuntimeContext, input: unknown, observedAt: number): void {
    if (!object(input) || !validTime(observedAt)) return;
    const session = effortIdentity(input.session_id);
    if (!session) return;
    const model = effortIdentity(deepGet(input, ['model', 'id']), 512);
    const effort = effortIdentity(deepGet(input, ['effort', 'level']), 64);
    const namespace = sha256(context.configDir);
    try {
        const target = paths(context);
        privateDirectory(target.directory);
        const release = lock(target.lock, true);
        try {
            const now = context.nowMs();
            if (now < observedAt || now - observedAt > SESSION_EFFORT_TTL_MS) return;
            const records = (readSnapshot(target.data) ?? []).filter(row => row.observed_at_ms <= now);
            const sameSession = (row: CachedObservation) => row.namespace === namespace && row.session_id === session;
            if (records.some(row => sameSession(row) && row.observed_at_ms >= observedAt)) return;
            const next: CachedObservation = { namespace, session_id: session, model_id: effort ? model : null,
                effort_level: model ? effort : null, observed_at_ms: observedAt };
            const observations = [next, ...records.filter(row => !sameSession(row))]
                .sort((a, b) => b.observed_at_ms - a.observed_at_ms).slice(0, MAX_SESSIONS);
            atomicWrite(target.data, JSON.stringify({ version: 1, observations }) + '\n');
        } finally { release(); }
    } catch { /* Contention and unavailable private state must never delay or alter the main row. */ }
}
