import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join, resolve, isAbsolute } from 'node:path';
import { readdirSync, statSync, unlinkSync, mkdirSync, rmdirSync } from 'node:fs';
import type { SourceDefinition, SourceContext, SourceReference, SourceJob, SourceObservation, SourcesResult, SourceMutationResult, SourceView, AutomaticStatus } from '@fbincon/statusline-core/contracts/ui';
import { SOURCE_FILENAME, MAX_SOURCE_BYTES, emptyRegistry, registry, definition, sourceError, sourceId, sourceText, sourceContext, matchesScope, sameContext, observationContext, observationAt, sourceView, emptyObservation, stamp, scalar } from '@fbincon/statusline-core/extensions/model';
import { object, ConfigError, integer } from '@fbincon/statusline-core/config/validation';
import { readJson } from '@fbincon/statusline-core/json-read';
import { revision } from '@fbincon/statusline-platform/hash';
import { readSourceFile } from '@fbincon/statusline-platform/source-files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { privateDirectory, atomicWrite } from '@fbincon/statusline-platform/files';
import { expandUser, which } from '@fbincon/statusline-platform/commands';
import { projectPaths } from '@fbincon/statusline-platform/project-paths';
import type { ConfigurationService } from '../config/service.js';
import { jsonBytes, artifact } from '../config/storage.js';
import { commit } from '../recovery/files.js';
import { safeTarget } from '../integration/paths.js';
import { contextFor, authRevision } from './context.js';
import { automaticJobActive, automaticStatus, refreshIdentity, readAutomatic, writeAutomatic } from './automatic-state.js';
import { readLocal, refreshCommand, refreshGithub, failure } from './providers.js';
interface Stored {
    version: 1;
    current: SourceObservation;
    good: SourceObservation | null;
}
export class SourceService {
    readonly root: string;
    constructor(readonly configuration: ConfigurationService, readonly now: () => number = Date.now, readonly launchWorker?: (job: SourceJob) => void, readonly githubRefresh = refreshGithub) {
        this.root = join(configuration.context.configDir, 'statusline_runtime', 'sources');
    }
    read(): SourcesResult {
        const bytes = readSourceFile(join(this.configuration.context.configDir, SOURCE_FILENAME));
        const value = bytes === null ? emptyRegistry() : registry(readJson(decodeUtf8(bytes), { duplicate: () => sourceError('invalid'), constant: () => sourceError('type') }));
        return { ...value, revision: revision(value) };
    }
    review(id: unknown) { const source = this.source(id); return { source, review_revision: source.revision }; }
    source(id: unknown): SourceDefinition {
        const source = this.read().sources.find(source => source.id === sourceId(id));
        if (!source)
            sourceError('not_found');
        return source;
    }
    private canonical(source: SourceDefinition): SourceDefinition {
        const result = definition(source), s = result.settings;
        if (result.scope.project) {
            const project = projectPaths.canonical(resolve(expandUser(result.scope.project)));
            if (!project)
                sourceError('scope');
            result.scope.project = contextFor(project).project;
        }
        if (s.path)
            s.path = resolve(expandUser(s.path));
        if (s.cwd) {
            const cwd = projectPaths.canonical(resolve(expandUser(s.cwd)));
            if (!cwd)
                sourceError('scope');
            s.cwd = cwd;
        }
        if (s.executable) {
            const found = isAbsolute(s.executable) ? s.executable : which(s.executable);
            if (!found)
                sourceError('missing_program');
            s.executable = resolve(found);
        }
        return result;
    }
    mutate(value: unknown): SourceMutationResult {
        if (!object(value) || typeof value.action !== 'string')
            sourceError('invalid');
        return this.configuration.io.lock(this.configuration.context.configDir, () => {
            const current = this.read();
            if (value.expected_revision !== current.revision)
                sourceError('conflict');
            const path = join(this.configuration.context.configDir, SOURCE_FILENAME), raw = readSourceFile(path);
            const state = registry({ version: 2, sources: current.sources, bindings: current.bindings, automatic: current.automatic });
            let binding: SourceReference | undefined;
            const id = sourceId(value.id), selected = state.sources.find(s => s.id === id);
            if (value.action === 'add' || value.action === 'edit') {
                if (!object(value.source) || (value.action === 'add' ? selected !== undefined : selected === undefined))
                    sourceError('conflict');
                const source = this.canonical(definition({ ...value.source, id, enabled: false, revision: randomUUID() }));
                state.automatic = state.automatic.filter(p => p.source_id !== id);
                if (selected) {
                    this.cancelSource(id);
                    state.sources[state.sources.indexOf(selected)] = source;
                }
                else
                    state.sources.push(source);
            }
            else {
                if (!selected)
                    sourceError('not_found');
                if (value.action === 'auto-on' || value.action === 'auto-off') {
                    if (selected.kind !== 'github') sourceError('invalid');
                    const prior = state.automatic.find(p => p.source_id === id);
                    if (value.action === 'auto-on') {
                        if (!selected.enabled || value.review_revision !== selected.revision) sourceError('review');
                        const interval = value.interval_seconds === undefined ? prior?.interval_seconds ?? Math.max(60, Math.min(86400, selected.ttl_seconds)) : integer(value.interval_seconds, 60, 86400, 'interval_seconds');
                        state.automatic = state.automatic.filter(p => p.source_id !== id);
                        state.automatic.push({ source_id: id, enabled: true, review_revision: selected.revision, interval_seconds: interval, auth_revision: authRevision() });
                        const scheduling = readAutomatic(this.configuration.context.configDir);
                        scheduling.schedules = scheduling.schedules.filter(s => s.source_id !== id);
                        const priorJobs = this.jobs().filter(j => j.source_id === id).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
                        for (const job of priorJobs) if (!scheduling.schedules.some(s => s.key === job.identity))
                            scheduling.schedules.push({ key: job.identity, source_id: id, job_id: job.id, processed: job.id, next: this.now(), failures: 0, paused: null, last_attempt: job.started_at, last_success: null });
                        scheduling.schedules = scheduling.schedules.slice(-512);
                        writeAutomatic(this.configuration.context.configDir, scheduling);
                    } else {
                        if (prior) prior.enabled = false;
                        this.cancelSource(id, true);
                    }
                }
                else if (value.action === 'enable') {
                    if (value.review_revision !== selected.revision)
                        sourceError('review');
                    selected.enabled = true;
                }
                else if (value.action === 'disable') {
                    this.cancelSource(id);
                    state.automatic = state.automatic.filter(p => p.source_id !== id);
                    selected.enabled = false;
                }
                else if (value.action === 'remove') {
                    this.cancelSource(id);
                    state.sources = state.sources.filter(s => s.id !== id);
                    state.automatic = state.automatic.filter(p => p.source_id !== id);
                    state.bindings = state.bindings.filter(b => b.source_id !== id);
                }
                else if (value.action === 'bind') {
                    const bid = randomUUID();
                    state.bindings.push({ id: bid, source_id: id });
                    binding = { binding: bid, hint: selected.name };
                }
                else if (value.action === 'unbind')
                    state.bindings = state.bindings.filter(b => !(b.source_id === id && b.id === value.binding));
                else
                    sourceError('invalid');
            }
            const validated = registry(state), bytes = jsonBytes(validated);
            if (bytes.length > MAX_SOURCE_BYTES)
                sourceError('output_limit');
            const backup = commit(this.configuration.context.configDir, 'source-' + value.action, [{ ...artifact(path, raw), desired: bytes }], this.configuration.io);
            return { ...validated, revision: revision(validated), ...(binding ? { binding } : {}), backup_dir: backup };
        });
    }
    private write(path: string, value: unknown): void {
        safeTarget(this.configuration.context.configDir, path);
        privateDirectory(this.root);
        privateDirectory(join(this.root, 'jobs'));
        privateDirectory(join(this.root, 'observations'));
        safeTarget(this.configuration.context.configDir, path);
        const bytes = jsonBytes(value);
        if (bytes.length > MAX_SOURCE_BYTES)
            sourceError('output_limit');
        atomicWrite(path, bytes);
    }
    private readValue(path: string): unknown {
        const bytes = readSourceFile(path);
        return bytes === null ? null : JSON.parse(decodeUtf8(bytes));
    }
    private jobPath(id: string) { return join(this.root, 'jobs', sourceId(id) + '.json'); }
    job(id: unknown): SourceJob {
        const value = this.readValue(this.jobPath(sourceId(id)));
        if (!object(value) || ![1, 2].includes(value.version as number) || !['running', 'completed', 'failed', 'cancelled'].includes(value.state as string))
            sourceError('not_found');
        sourceId(value.id);
        sourceId(value.source_id);
        sourceId(value.source_revision);
        sourceId(value.owner);
        sourceContext(value.context);
        if (!stamp(value.started_at) || !stamp(value.deadline_at) || typeof value.reason !== 'string')
            sourceError('invalid');
        const job = (value.version === 1 ? { ...value, version: 2, trigger: 'manual', identity: revision([value.source_id, value.source_revision, value.context]) } : value) as unknown as SourceJob;
        if (!['manual', 'automatic'].includes(job.trigger) || !/^[a-f0-9]{64}$/.test(job.identity)) sourceError('invalid');
        if (job.state === 'running' && Date.parse(job.deadline_at) + 2000 < this.now())
            return { ...job, state: 'failed', reason: 'timeout' };
        return job;
    }
    jobs(): SourceJob[] {
        try {
            return readdirSync(join(this.root, 'jobs')).filter(name => /^[A-Za-z0-9_-]+\.json$/u.test(name)).flatMap(name => { try {
                return [this.job(name.slice(0, -5))];
            }
            catch {
                return [];
            } });
        }
        catch {
            return [];
        }
    }
    private cancelSource(id: string, automaticOnly = false): void {
        for (const job of this.jobs())
            if (job.source_id === id && job.state === 'running' && (!automaticOnly || job.trigger === 'automatic'))
                this.write(this.jobPath(job.id), { ...job, state: 'cancelled', reason: 'cancelled' });
    }
    cancel(id: unknown): SourceJob {
        return this.configuration.io.lock(this.configuration.context.configDir, () => {
            const job = this.job(id);
            if (job.state === 'running') {
                job.state = 'cancelled';
                job.reason = 'cancelled';
                this.write(this.jobPath(job.id), job);
                const source = this.source(job.source_id);
                if (source.enabled && source.revision === job.source_revision)
                    this.publish(source, job.context, emptyObservation(source, job.context, 'cancelled'));
            }
            return job;
        });
    }
    start(id: unknown, contextValue: unknown, owner: unknown, trigger: 'manual' | 'automatic' = 'manual'): SourceJob {
        let createdNew = false;
        const actual = sourceContext(contextValue), ownerId = sourceId(owner);
        const job = this.configuration.io.lock(this.configuration.context.configDir, () => {
            const source = this.source(id);
            if (!source.enabled)
                sourceError('disabled');
            if (!matchesScope(source.scope, actual))
                sourceError('scope');
            const context = observationContext(source, actual), identity = refreshIdentity(source, context);
            const existing = this.jobs().find(job => job.source_id === source.id && job.state === 'running' && (source.kind !== 'github' || job.identity === identity));
            if (existing) {
                if (source.kind !== 'github') sourceError('busy');
                if (trigger === 'manual' && existing.trigger === 'automatic') {
                    existing.trigger = 'manual'; existing.owner = ownerId;
                    this.write(this.jobPath(existing.id), existing);
                }
                return existing;
            }
            const created: SourceJob = { version: 2, trigger, identity, id: randomUUID(), source_id: source.id, source_revision: source.revision, owner: ownerId, context,
                started_at: new Date(this.now()).toISOString(), deadline_at: new Date(this.now() + (source.kind === 'github' ? 30000 : source.settings.timeout_ms ?? 5000)).toISOString(), state: 'running', reason: 'running' };
            if (trigger === 'automatic' && !automaticJobActive(this.configuration.context.configDir, created, this.now())) sourceError('disabled');
            this.write(this.jobPath(created.id), created);
            createdNew = true;
            return created;
        });
        if (!createdNew) return job;
        if (this.launchWorker) { this.launchWorker(job); return job; }
        const launch = this.configuration.context.launch;
        const worker = spawn(launch.executable, [...launch.args, 'source', '--config-dir', this.configuration.context.configDir, '_worker', job.id], { detached: true, stdio: 'ignore', windowsHide: true });
        worker.once('error', () => { try {
            this.cancel(job.id);
        }
        catch { /* Expires if the registry is unavailable. */ } });
        worker.unref();
        return job;
    }
    private observationPath(source: SourceDefinition, context: SourceContext): string { return join(this.root, 'observations', source.id + '-' + revision(context) + '.json'); }
    private stored(source: SourceDefinition, context: SourceContext): Stored | null {
        try {
            const raw = this.readValue(this.observationPath(source, context));
            if (!object(raw) || raw.version !== 1)
                return null;
            const parse = (value: unknown): SourceObservation | null => {
                if (value === null)
                    return null;
                if (!object(value) || value.version !== 1 || value.source_id !== source.id || value.source_revision !== source.revision || !['valid', 'missing', 'partial', 'error', 'unsupported'].includes(value.state as string))
                    sourceError('invalid');
                sourceContext(value.context);
                stamp(value.observed_at);
                if (value.value !== null)
                    scalar(value.value);
                if (value.fields !== undefined && (!object(value.fields) || Object.values(value.fields).some(v => v !== null && !['string', 'number', 'boolean'].includes(typeof v))))
                    sourceError('invalid');
                return value as unknown as SourceObservation;
            };
            const current = parse(raw.current);
            return current ? { version: 1, current, good: parse(raw.good) } : null;
        }
        catch {
            return null;
        }
    }
    private publish(source: SourceDefinition, context: SourceContext, observation: SourceObservation): void {
        const previous = this.stored(source, context);
        if (previous && JSON.stringify(previous.current) === JSON.stringify(observation))
            return;
        this.write(this.observationPath(source, context), { version: 1, current: observation, good: observation.value !== null && ['valid', 'partial'].includes(observation.state) ? observation : previous?.good ?? null });
        this.prune();
    }
    view(ref: SourceReference | undefined, context: SourceContext, publishLocal = true, historicalAt?: number): SourceView {
        const registry = this.read(), binding = registry.bindings.find(b => b.id === ref?.binding), source = registry.sources.find(s => s.id === binding?.source_id);
        if (!source || !source.enabled || !matchesScope(source.scope, context))
            return sourceView(source, context, null, null, this.now());
        context = observationContext(source, context);
        if (source.kind === 'json') {
            const observed = readLocal(source, context);
            try {
                if (publishLocal && historicalAt === undefined)
                    this.publish(source, context, observed);
            }
            catch { /* Local cache is optional; report the actual read below. */ }
            const prior = this.stored(source, context);
            return sourceView(source, context, observed, prior?.good ?? null, this.now(), historicalAt);
        }
        const data = this.stored(source, context);
        const identity = historicalAt === undefined ? data?.current.identity ?? data?.good?.identity : (observationAt(data?.current ?? null, historicalAt) ?? observationAt(data?.good ?? null, historicalAt))?.identity;
        if (source.kind === 'github' && identity && (identity.auth_revision !== authRevision() || identity.host !== source.settings.host || identity.repository !== source.settings.repository || identity.account !== source.settings.account))
            return { ...sourceView(source, context, null, null, this.now()), state: 'mismatch', reason: 'identity' };
        return sourceView(source, context, data?.current ?? null, data?.good ?? null, this.now(), historicalAt);
    }
    diagnose(id: unknown, context: SourceContext): {
        source: SourceDefinition;
        view: SourceView;
        jobs: SourceJob[];
        automatic: AutomaticStatus;
    } {
        const source = this.source(id), applicable = matchesScope(source.scope, context);
        if (applicable)
            context = observationContext(source, context);
        const data = applicable ? this.stored(source, context) : null;
        let view = sourceView(source, context, data?.current ?? null, data?.good ?? null, this.now());
        const identity = data?.current.identity ?? data?.good?.identity;
        if (source.kind === 'github' && identity && identity.auth_revision !== authRevision())
            view = { ...view, state: 'mismatch', reason: 'identity', value: null, fields: undefined };
        const jobs = this.jobs().filter(job => job.source_id === source.id);
        return { source, view, jobs, automatic: automaticStatus(this.configuration.context.configDir, source, context, this.now(), jobs) };
    }
    cancelInactiveAutomatic(): void {
        this.configuration.io.lock(this.configuration.context.configDir, () => {
            for (const job of this.jobs()) if (job.trigger === 'automatic' && job.state === 'running' && !automaticJobActive(this.configuration.context.configDir, job, this.now()))
                this.write(this.jobPath(job.id), { ...job, state: 'cancelled', reason: 'lease_expired' });
        });
    }
    async work(id: string): Promise<void> {
        const job = this.job(id);
        if (job.state !== 'running')
            return;
        const claim = this.jobPath(id) + '.claim';
        try {
            mkdirSync(claim, { mode: 0o700 });
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST')
                return;
            throw error;
        }
        const abort = new AbortController();
        const watcher = setInterval(() => {
            try {
                const source = this.source(job.source_id), current = this.job(id);
                if (current.state !== 'running' || source.revision !== job.source_revision || !source.enabled || !automaticJobActive(this.configuration.context.configDir, current, this.now()))
                    abort.abort();
            }
            catch {
                abort.abort();
            }
        }, 100);
        const deadline = setTimeout(() => abort.abort(), Math.max(1, Date.parse(job.deadline_at) - this.now()));
        try {
            const source = this.source(job.source_id);
            if (!source.enabled || source.revision !== job.source_revision || !automaticJobActive(this.configuration.context.configDir, this.job(id), this.now())) return;
            let observation: SourceObservation;
            if (!sameContext(observationContext(source, contextFor(job.context.project, job.context.session, job.context.agent)), job.context))
                observation = emptyObservation(source, job.context, 'identity');
            else
                observation = source.kind === 'json' ? readLocal(source, job.context) : source.kind === 'command' ? await refreshCommand(source, job.context, abort.signal) : await this.githubRefresh(source, job.context, abort.signal);
            if (observation.reason === 'cancelled' && this.now() >= Date.parse(job.deadline_at))
                observation = emptyObservation(source, job.context, 'timeout');
            this.configuration.io.lock(this.configuration.context.configDir, () => {
                const latest = this.source(job.source_id), state = this.job(id);
                if (state.state !== 'running' || !latest.enabled || latest.revision !== job.source_revision) return;
                if (!automaticJobActive(this.configuration.context.configDir, state, this.now())) {
                    this.write(this.jobPath(id), { ...state, state: 'cancelled', reason: 'lease_expired' });
                    return;
                }
                if (!sameContext(observationContext(latest, contextFor(job.context.project, job.context.session, job.context.agent)), job.context))
                    observation = emptyObservation(source, job.context, 'identity');
                if (observation.reason !== 'identity' && observation.reason !== 'account')
                    this.publish(source, job.context, observation);
                else
                    this.write(this.observationPath(source, job.context), { version: 1, current: observation, good: null });
                state.state = observation.state === 'error' ? 'failed' : 'completed';
                state.reason = observation.reason;
                this.write(this.jobPath(id), state);
            });
        }
        catch (error) {
            try {
                const state = this.job(id);
                if (state.state === 'running')
                    this.write(this.jobPath(id), { ...state, state: 'failed', reason: error instanceof ConfigError ? error.code : 'refresh_failed' });
            }
            catch { /* Deadline remains the durable recovery marker. */ }
        }
        finally {
            clearInterval(watcher);
            clearTimeout(deadline);
            try {
                rmdirSync(claim);
            }
            catch { /* A crashed job is not resumed. */ }
            this.prune();
        }
    }
    private prune(): void {
        for (const name of ['jobs', 'observations']) {
            try {
                const root = join(this.root, name), paths = readdirSync(root).filter(file => /^[A-Za-z0-9_-]+\.json$/u.test(file)).map(file => ({ path: join(root, file), age: statSync(join(root, file)).mtimeMs })).sort((a, b) => b.age - a.age);
                for (const entry of paths.slice(512))
                    if (entry.age < this.now() - 60000)
                        unlinkSync(entry.path);
            }
            catch { /* Cleanup cannot alter a completed observation. */ }
        }
    }
}
