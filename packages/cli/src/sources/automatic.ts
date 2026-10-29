/** Session leases are the only automatic dispatch entry; rendering never calls it. */
import type { SourceContext, SourceDefinition } from '@fbincon/statusline-core/contracts/ui';
import { exact, integer, object } from '@fbincon/statusline-core/config/validation';
import { sourceId, sourceText, matchesScope, observationContext } from '@fbincon/statusline-core/extensions/model';
import { VERSION } from '@fbincon/statusline-core/release';
import { revision } from '@fbincon/statusline-platform/hash';
import { contextFor, authRevision } from './context.js';
import { readAutomatic, writeAutomatic, refreshIdentity, LEASE_MS, type Schedule } from './automatic-state.js';
import { SourceService } from './service.js';
const pauseReasons = new Set(['auth', 'authentication', 'forbidden', 'permission', 'account', 'identity', 'scope', 'ambiguous', 'missing_program', 'invalid_output', 'output_limit', 'input', 'type', 'invalid']);
function applicable(source: SourceDefinition, context: SourceContext): boolean {
    return matchesScope(source.scope, context) && (source.kind !== 'github' || !!context.head && !!context.branch && context.branch === source.settings.branch);
}
export class AutomaticRefresh {
    constructor(readonly sources: SourceService, readonly context = contextFor) {}
    lifecycle(payload: unknown): { backend_version: string; enabled: boolean; scheduled: number } {
        exact(payload, ['session_id', 'epoch', 'seq', 'project', 'host_version', 'event', ...(object(payload) && Object.hasOwn(payload, 'agents') ? ['agents'] : [])], 'source lifecycle');
        const session = sourceId(payload.session_id), epoch = sourceId(payload.epoch), seq = integer(payload.seq, 0, Number.MAX_SAFE_INTEGER, 'seq');
        const project = sourceText(payload.project), host = sourceText(payload.host_version, 64), event = payload.event;
        if (event !== 'tick' && event !== 'end') throw new Error('Invalid lifecycle event');
        const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(host)?.slice(1).map(Number);
        const supported = Boolean(version && (version[0]! > 2 || version[0] === 2 && (version[1]! > 1 || version[1] === 1 && version[2]! >= 289)));
        const directory = this.sources.configuration.context.configDir, now = this.sources.now(), id = revision([session, epoch]);
        const contexts: SourceContext[] = [];
        if (event === 'tick' && supported) {
            const main = this.context(project, session, null); contexts.push(main);
            if (payload.agents !== undefined) {
                if (!Array.isArray(payload.agents) || payload.agents.length > 256) throw new Error('Invalid source agents');
                const projects = new Map([[project, main]]), ids = new Set<string>();
                for (const raw of payload.agents) {
                    exact(raw, ['id', 'project'], 'source agent');
                    const agent = sourceId(raw.id), path = sourceText(raw.project);
                    if (ids.has(agent)) throw new Error('Duplicate source agent'); ids.add(agent);
                    let actual = projects.get(path);
                    if (!actual) { actual = this.context(path, session, null); projects.set(path, actual); }
                    contexts.push({ ...actual, agent });
                }
            }
        }
        const requests: { source: string; context: SourceContext; key: string }[] = [];
        const enabled = this.sources.configuration.io.lock(directory, () => {
            const registry = this.sources.read(), state = readAutomatic(directory), allJobs = this.sources.jobs();
            let lease = state.leases.find(l => l.id === id);
            if (lease && (lease.closed || seq <= lease.seq)) return registry.automatic.some(p => p.enabled);
            if (!lease) {
                lease = { id, session, epoch, seq, expires: now + LEASE_MS, closed: false, keys: [], contexts: [] };
                state.leases = state.leases.filter(l => l.expires > now - 86400000).slice(-63); state.leases.push(lease);
            }
            lease.seq = seq; lease.expires = now + LEASE_MS; lease.closed = event === 'end' || !supported; lease.contexts = contexts;
            const active = state.leases.filter(l => !l.closed && l.expires > now);
            const due: { source: SourceDefinition; schedule: Schedule; context: SourceContext; interval: number }[] = [];
            for (const l of active) l.keys = [];
            // Keep a bounded schedule index; expired contexts cannot accumulate forever.
            state.schedules = state.schedules.filter(s => s.paused || s.next > now - 86400000).slice(-512);
            for (const policy of registry.automatic) {
                const source = registry.sources.find(s => s.id === policy.source_id)!;
                if (!policy.enabled || !source.enabled || policy.review_revision !== source.revision || source.kind === 'github' && policy.auth_revision !== authRevision()) continue;
                const unique = new Map<string, SourceContext>();
                for (const l of active) for (const actual of l.contexts ?? []) {
                    if (!applicable(source, actual)) continue;
                    const context = observationContext(source, actual), key = refreshIdentity(source, context);
                    unique.set(key, context); if (!l.keys.includes(key)) l.keys.push(key);
                }
                for (const [key, context] of unique) {
                    let schedule = state.schedules.find(s => s.key === key);
                    if (!schedule) {
                        if (state.schedules.length >= 512) continue;
                        schedule = { key, source_id: source.id, job_id: null, processed: null, next: now, failures: 0, paused: null, last_attempt: null, last_success: null };
                        state.schedules.push(schedule);
                    }
                    const processed=allJobs.find(j=>j.id===schedule!.processed);
                    const latest = allJobs.filter(j => j.identity === key && (!processed || j.id===processed.id || Date.parse(j.started_at)>Date.parse(processed.started_at))).sort((a,b) => Date.parse(b.started_at)-Date.parse(a.started_at) || b.id.localeCompare(a.id))[0];
                    if (latest && latest.state !== 'running' && latest.id !== schedule.processed) {
                        schedule.processed = latest.id; schedule.last_attempt = latest.started_at;
                        if (latest.state === 'completed' && ['valid', 'no_pr', 'unknown_checks'].includes(latest.reason)) {
                            schedule.failures = 0; schedule.paused = null; schedule.last_success = latest.result?.finished_at ?? latest.started_at;
                        } else if (!['lease_expired', 'cancelled', 'no_consumers'].includes(latest.reason)) {
                            schedule.failures = Math.min(10, schedule.failures + 1); schedule.paused = pauseReasons.has(latest.reason) ? latest.reason : null;
                        }
                        schedule.next = now + Math.min(86400000, policy.interval_seconds * 1000 * 2 ** schedule.failures);
                    }
                    if (!schedule.paused && schedule.next <= now) due.push({source,schedule,context,interval:policy.interval_seconds*1000});
                }
            }
            due.sort((a,b) => a.schedule.next-b.schedule.next || (a.schedule.last_attempt ?? '').localeCompare(b.schedule.last_attempt ?? '') || a.schedule.key.localeCompare(b.schedule.key));
            const selected = new Set<string>();
            for (const item of due) {
                const {source,schedule,context,interval}=item;
                if (allJobs.some(j=>j.state==='running' && (source.kind==='command'?j.source_id===source.id:j.identity===schedule.key)) || source.kind==='command' && selected.has(source.id)) {
                    schedule.next=now+interval; continue; // Skip this tick; never queue catch-up executions.
                }
                schedule.next=now+interval; selected.add(source.id); requests.push({source:source.id,context,key:schedule.key});
            }
            writeAutomatic(directory,state); return registry.automatic.some(p=>p.enabled);
        });
        this.sources.cancelInactiveAutomatic();
        let scheduled=0;
        for (const request of requests) try {
            const job=this.sources.start(request.source,request.context,'automatic-'+id.slice(0,32),'automatic');
            this.sources.configuration.io.lock(directory,()=>{
                const state=readAutomatic(directory), schedule=state.schedules.find(s=>s.key===request.key);
                if(schedule){schedule.job_id=job.id;schedule.last_attempt=job.started_at;}writeAutomatic(directory,state);
            }); scheduled++;
        } catch { /* Revision/lease changes between reservation and dispatch remain closed. */ }
        return {backend_version:VERSION,enabled,scheduled};
    }
}
