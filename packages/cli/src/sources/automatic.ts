/** Session-owned scheduling; no daemon and no render/editor entry point. */
import type { SourceContext } from '@fbincon/statusline-core/contracts/ui';
import { exact, integer } from '@fbincon/statusline-core/config/validation';
import { sourceId, sourceText, matchesScope, observationContext } from '@fbincon/statusline-core/extensions/model';
import { VERSION } from '@fbincon/statusline-core/release';
import { revision } from '@fbincon/statusline-platform/hash';
import { contextFor, authRevision } from './context.js';
import { readAutomatic, writeAutomatic, refreshIdentity, LEASE_MS } from './automatic-state.js';
import { SourceService } from './service.js';

const pauseReasons = new Set(['auth', 'authentication', 'forbidden', 'permission', 'account', 'identity', 'scope', 'ambiguous']);
export class AutomaticRefresh {
    constructor(readonly sources: SourceService, readonly context = contextFor) {}
    lifecycle(payload: unknown): { backend_version: string; enabled: boolean; scheduled: number } {
        exact(payload, ['session_id', 'epoch', 'seq', 'project', 'host_version', 'event'], 'source lifecycle');
        const session = sourceId(payload.session_id), epoch = sourceId(payload.epoch), seq = integer(payload.seq, 0, Number.MAX_SAFE_INTEGER, 'seq');
        const project = sourceText(payload.project), host = sourceText(payload.host_version, 64), event = payload.event;
        if (event !== 'tick' && event !== 'end') throw new Error('Invalid lifecycle event');
        const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(host)?.slice(1).map(Number);
        const supported = Boolean(version && (version[0]! > 2 || version[0] === 2 && (version[1]! > 1 || version[1] === 1 && version[2]! >= 289)));
        const directory = this.sources.configuration.context.configDir, now = this.sources.now(), id = revision([session, epoch]);
        const actual = event === 'tick' && supported ? this.context(project, session, null) : null;
        const requests: { source: string; context: SourceContext; key: string }[] = [];
        const enabled = this.sources.configuration.io.lock(directory, () => {
            const registry = this.sources.read(), state = readAutomatic(directory);
            let lease = state.leases.find(l => l.id === id);
            if (lease && (lease.closed || seq <= lease.seq)) return registry.automatic.some(p => p.enabled);
            if (!lease) {
                lease = { id, session, epoch, seq, expires: now + LEASE_MS, closed: false, keys: [] };
                state.leases = state.leases.filter(l => l.expires > now - 86400000).slice(-63);
                state.leases.push(lease);
            }
            lease.seq = seq; lease.expires = now + LEASE_MS; lease.closed = event === 'end' || !supported; lease.keys = [];
            if (actual && !lease.closed) for (const policy of registry.automatic) {
                const source = registry.sources.find(s => s.id === policy.source_id)!;
                if (!policy.enabled || !source.enabled || policy.review_revision !== source.revision || policy.auth_revision !== authRevision() || !matchesScope(source.scope, actual) || !actual.head || !actual.branch || actual.branch !== source.settings.branch) continue;
                const context = observationContext(source, actual), key = refreshIdentity(source, context);
                lease.keys.push(key);
                let schedule = state.schedules.find(s => s.key === key);
                if (!schedule) {
                    schedule = { key, source_id: source.id, job_id: null, processed: null, next: now, failures: 0, paused: null, last_attempt: null, last_success: null };
                    state.schedules.push(schedule);
                }
                const jobs = this.sources.jobs().filter(j => j.identity === key).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
                const latest = jobs[0];
                if (latest && latest.state !== 'running' && latest.id !== schedule.processed) {
                    schedule.processed = latest.id; schedule.last_attempt = latest.started_at;
                    if (latest.state === 'completed' && !pauseReasons.has(latest.reason)) {
                        schedule.failures = 0; schedule.paused = null; schedule.last_success = new Date(now).toISOString();
                    } else if (latest.reason !== 'lease_expired' && latest.reason !== 'cancelled') {
                        schedule.failures = Math.min(10, schedule.failures + 1);
                        schedule.paused = pauseReasons.has(latest.reason) ? latest.reason : null;
                    }
                    schedule.next = now + Math.min(86400000, policy.interval_seconds * 1000 * 2 ** schedule.failures);
                }
                if (latest?.state === 'running' || schedule.paused || schedule.next > now) continue;
                // Reserve under the same configuration lock used by job creation.
                schedule.next = now + 30000;
                requests.push({ source: source.id, context, key });
            }
            const activeKeys = new Set(state.leases.filter(l => !l.closed && l.expires > now).flatMap(l => l.keys));
            state.schedules = state.schedules.filter(s => activeKeys.has(s.key) || s.next > now - 86400000).slice(-512);
            writeAutomatic(directory, state);
            return registry.automatic.some(p => p.enabled);
        });
        this.sources.cancelInactiveAutomatic();
        let scheduled = 0;
        for (const request of requests) {
            try {
                const job = this.sources.start(request.source, request.context, 'automatic-' + id.slice(0, 32), 'automatic');
                this.sources.configuration.io.lock(directory, () => {
                    const state = readAutomatic(directory), schedule = state.schedules.find(s => s.key === request.key);
                    if (schedule) { schedule.job_id = job.id; schedule.last_attempt = job.started_at; }
                    writeAutomatic(directory, state);
                });
                scheduled++;
            } catch { /* Disabled/expired/revised while dispatching: next heartbeat reconciles. */ }
        }
        return { backend_version: VERSION, enabled, scheduled };
    }
}
