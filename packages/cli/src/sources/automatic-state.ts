/** Local scheduling state. Reading it never starts a process or refresh. */
import { join } from 'node:path';
import type { AutomaticStatus, SourceContext, SourceDefinition, SourceJob, SourceRegistry } from '@fbincon/statusline-core/contracts/ui';
import { emptyRegistry, registry, SOURCE_FILENAME, observationContext, MAX_SOURCE_BYTES } from '@fbincon/statusline-core/extensions/model';
import { readJson } from '@fbincon/statusline-core/json-read';
import { sourceError } from '@fbincon/statusline-core/extensions/model';
import { object } from '@fbincon/statusline-core/config/validation';
import { revision } from '@fbincon/statusline-platform/hash';
import { readSourceFile } from '@fbincon/statusline-platform/source-files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { privateDirectory, atomicWrite } from '@fbincon/statusline-platform/files';
import { safeTarget } from '../integration/paths.js';
import { authRevision } from './context.js';

export const LEASE_MS = 15000;
export interface Lease { id: string; session: string; epoch: string; seq: number; expires: number; closed: boolean; keys: string[]; contexts?: SourceContext[] }
export interface Schedule { key: string; source_id: string; job_id: string | null; processed: string | null; next: number; failures: number; paused: string | null; last_attempt: string | null; last_success: string | null }
export interface AutomaticState { version: 1; leases: Lease[]; schedules: Schedule[] }
const pauseReasons = new Set(['auth', 'authentication', 'forbidden', 'permission', 'account', 'identity', 'scope', 'ambiguous', 'missing_program', 'invalid_output', 'output_limit', 'input', 'type', 'invalid']);
/** One classification for normal lifecycle feedback and delayed durable settlement. */
export function automaticOutcome(job: SourceJob): { kind: 'success'; finished_at: string } | { kind: 'cancelled' } | { kind: 'failure'; paused: string | null } {
    if (job.state === 'completed' && ['valid', 'no_pr', 'unknown_checks'].includes(job.reason))
        return { kind: 'success', finished_at: job.result?.finished_at ?? job.started_at };
    if (['lease_expired', 'cancelled', 'no_consumers'].includes(job.reason))
        return { kind: 'cancelled' };
    return { kind: 'failure', paused: pauseReasons.has(job.reason) ? job.reason : null };
}
/** Correct provisional feedback once, without recounting a failure or drifting its retry time. */
export function reconcileAutomaticOutcome(schedule: Schedule, job: SourceJob, intervalMs: number, now: number): boolean {
    if (schedule.processed !== job.id) return false;
    // Renewed review seeds old jobs as processed but deliberately resets their
    // feedback before a fresh dispatch. It is not a consumed timeout projection.
    if (schedule.failures === 0 && schedule.paused === null && schedule.last_success === null) return false;
    const outcome = automaticOutcome(job);
    if (outcome.kind === 'success') {
        // Manual success records the observation timestamp, which may differ
        // from process completion. Only failed feedback needs success repair.
        if (schedule.failures === 0 && schedule.paused === null) return false;
        schedule.failures = 0; schedule.paused = null; schedule.last_success = outcome.finished_at;
        schedule.next = now + intervalMs;
        return true;
    }
    // A public expiry projection can only be failed/timeout. A different
    // terminal reason is authoritative; cancellation never rolls counters back.
    if (outcome.kind === 'failure' && job.state !== 'running' && job.reason !== 'timeout' && schedule.paused !== outcome.paused) {
        schedule.paused = outcome.paused;
        return true;
    }
    return false;
}
const path = (directory: string) => join(directory, 'statusline_runtime', 'sources', 'automatic.json');
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function readAutomatic(directory: string): AutomaticState {
    const bytes = readSourceFile(path(directory));
    if (!bytes) return { version: 1, leases: [], schedules: [] };
    const value: unknown = JSON.parse(decodeUtf8(bytes));
    if (!object(value) || value.version !== 1 || !Array.isArray(value.leases) || !Array.isArray(value.schedules) || value.leases.length > 64 || value.schedules.length > 512 ||
        !value.leases.every(l => object(l) && hash(l.id) && typeof l.session === 'string' && typeof l.epoch === 'string' && Number.isSafeInteger(l.seq) && typeof l.expires === 'number' && Number.isFinite(l.expires) && typeof l.closed === 'boolean' && Array.isArray(l.keys) && l.keys.length <= 32768 && l.keys.every(hash) && (l.contexts === undefined || Array.isArray(l.contexts) && l.contexts.length <= 257 && l.contexts.every(c => object(c) && ['project','session','agent','branch','head'].every(k => c[k] === null || typeof c[k] === 'string')))) ||
        !value.schedules.every(s => object(s) && hash(s.key) && typeof s.source_id === 'string' && (s.job_id === null || typeof s.job_id === 'string') && (s.processed === null || typeof s.processed === 'string') && typeof s.next === 'number' && Number.isFinite(s.next) && Number.isSafeInteger(s.failures) && (s.paused === null || typeof s.paused === 'string') && [s.last_attempt, s.last_success].every(v => v === null || typeof v === 'string' && Number.isFinite(Date.parse(v))))) throw new Error('Invalid automatic refresh state');
    return value as unknown as AutomaticState;
}
export function writeAutomatic(directory: string, state: AutomaticState): void {
    const target = path(directory);
    safeTarget(directory, target); privateDirectory(join(directory, 'statusline_runtime', 'sources')); safeTarget(directory, target);
    const bytes = Buffer.from(JSON.stringify(state) + '\n');
    if (bytes.length > MAX_SOURCE_BYTES) throw new Error('Automatic refresh state exceeds its size limit');
    atomicWrite(target, bytes);
}
export function sourceRegistry(directory: string): SourceRegistry {
    const bytes = readSourceFile(join(directory, SOURCE_FILENAME));
    return bytes ? registry(readJson(decodeUtf8(bytes), { duplicate: () => sourceError('invalid'), constant: () => sourceError('type') })) : emptyRegistry();
}
export function automaticRequested(directory: string): boolean {
    return sourceRegistry(directory).automatic.some(p => p.enabled);
}
export function refreshIdentity(source: SourceDefinition, context: SourceContext): string {
    return revision({ source: source.id, revision: source.revision, scope: source.scope, settings: source.settings, context: observationContext(source, context), auth: source.kind === 'github' ? authRevision() : null });
}
export function activeLease(state: AutomaticState, identity: string, now: number): boolean {
    return state.leases.some(l => !l.closed && l.expires > now && l.keys.includes(identity));
}
export function automaticJobActive(directory: string, job: SourceJob, now: number): boolean {
    const registry = sourceRegistry(directory), source = registry.sources.find(s => s.id === job.source_id), policy = registry.automatic.find(p => p.source_id === job.source_id);
    return Boolean(source?.enabled && policy?.enabled && policy.review_revision === source.revision && (source.kind !== 'github' || policy.auth_revision === authRevision()) && refreshIdentity(source, job.context) === job.identity && activeLease(readAutomatic(directory), job.identity, now));
}
export function manualJobActive(job: SourceJob, now: number): boolean {
    return job.consumers.some(consumer => Date.parse(consumer.expires_at) > now);
}
/** Natural deadline expiry ends execution, not the right to retain its result. */
export function settlementTime(job: SourceJob, now: number): number {
    return Math.min(now, Date.parse(job.deadline_at) - 1);
}
export function automaticStatus(directory: string, source: SourceDefinition, context: SourceContext, now: number, jobs: SourceJob[]): AutomaticStatus {
    const policy = sourceRegistry(directory).automatic.find(p => p.source_id === source.id);
    const base: AutomaticStatus = { state: 'off', reason: 'off', next_at: null, last_attempt: null, last_success: null, interval_seconds: policy?.interval_seconds ?? (source.kind === 'command' ? 300 : Math.max(60, Math.min(86400, source.ttl_seconds))) };
    if (!policy?.enabled || !source.enabled) return base;
    if (source.kind === 'github' && policy.auth_revision !== authRevision()) return { ...base, state: 'paused', reason: 'identity' };
    if (source.kind === 'github' && (!context.head || !context.branch || context.branch !== source.settings.branch)) return { ...base, state: 'paused', reason: 'identity' };
    const identity = refreshIdentity(source, context), state = readAutomatic(directory), schedule = state.schedules.find(s => s.key === identity);
    const result = { ...base, last_attempt: schedule?.last_attempt ?? null, last_success: schedule?.last_success ?? null };
    if (schedule?.paused) return { ...result, state: 'paused', reason: schedule.paused };
    if (!activeLease(state, identity, now)) return { ...result, state: 'waiting', reason: 'no_session' };
    if (jobs.some(j => j.identity === identity && j.state === 'running')) return { ...result, state: 'running', reason: 'running' };
    return { ...result, state: schedule?.failures ? 'backoff' : 'waiting', reason: schedule?.failures ? 'retry' : 'scheduled', next_at: schedule ? new Date(schedule.next).toISOString() : null };
}
