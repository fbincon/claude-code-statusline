import type { SourceInspection, SourceJob, SourcesResult } from '@fbincon/statusline-core/contracts/ui';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import type { Editor } from '@fbincon/statusline-core/editor/draft';
import { receiveProfileList, type ProfileManager } from '@fbincon/statusline-core/editor/profile-manager';
import type { SourceManager } from '@fbincon/statusline-core/editor/source-manager';
import type { TextKey } from '@fbincon/statusline-core/editor/text-input';
import { observationContext, sameContext } from '@fbincon/statusline-core/extensions/model';
import { text, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import { ACTIVE_REFRESH_MS, IDLE_REFRESH_MS, MAX_REFRESH_BACKOFF_MS, type RefreshTarget } from './foreground-refresh.js';
import { observeBackend } from './observation-backend.js';
import type { Backend } from './session.js';

type Manager = SourceManager | ProfileManager;
const readErrors = new WeakMap<Manager, LocalizedText>();
const finalInspectionRetries = new WeakMap<NonNullable<SourceManager['observation']>, number>();

function failed(view: Manager, error: unknown): boolean {
    const message = error instanceof BackendError && error.localization ? error.localization :
        'jobs' in view ? text('sources.failed') : text('profiles.failed', { value: error instanceof Error ? error.message : String(error) });
    const changed = JSON.stringify(view.message) !== JSON.stringify(message);
    readErrors.set(view, message);
    view.message = message;
    return changed;
}

function clearReadError(view: Manager): boolean {
    if (view.message !== readErrors.get(view)) return false;
    readErrors.delete(view);
    view.message = null;
    return true;
}

/** The registry revision covers the whole library. Preserve the currently highlighted identity. */
function receiveSources(view: SourceManager, next: SourcesResult): void {
    const old = view.library!.sources, selected = old[view.cursor];
    const index = selected ? next.sources.findIndex(source => source.id === selected.id) :
        next.sources.length + view.cursor - old.length;
    view.library = next;
    // An externally removed source cannot redirect Enter to a different source.
    view.cursor = index < 0 ? next.sources.length : index;
}

function listTarget(view: Manager, backend: Backend): RefreshTarget {
    const before = view.library;
    return {
        owner: view, key: 'list', interval: null,
        async read(signal) {
            if ('jobs' in view) {
                const result = await observeBackend(backend, 'sources_read', {}, signal);
                return () => {
                    if (signal.aborted || view.closed || view.page !== 'list' || view.library !== before) return false;
                    view.refreshList = false;
                    const cleared = clearReadError(view);
                    if (result.revision === before?.revision) return cleared;
                    receiveSources(view, result);
                    return true;
                };
            }
            const result = await observeBackend(backend, 'profiles_read', {}, signal);
            return () => {
                if (signal.aborted || view.uncertain || view.page !== 'list' || view.library !== before) return false;
                view.refreshList = false;
                const cleared = clearReadError(view);
                if (result.revision === before?.revision) return cleared;
                receiveProfileList(view, result);
                return true;
            };
        },
        failed: error => failed(view, error),
    };
}

/** A deadline projection has no execution receipt and can precede a later durable success. */
export function sourceObservationPending(job: SourceJob): boolean {
    return job.state === 'running' || job.state === 'failed' && job.reason === 'timeout' && !job.result;
}

export function sourceObservationJob(editor: Editor): SourceJob | null {
    const view = editor.sources, point = view?.observation;
    if (!view || view.closed || !point || point.id !== view.selected || !['actions','diagnose','checks'].includes(view.page)) return null;
    const definition = view.library?.sources.find(source => source.id === point.id);
    if (!definition || definition.revision !== point.revision) return null;
    const context = observationContext(definition, point.context);
    const matches = (job: SourceJob) => job.source_id === point.id && job.source_revision === point.revision &&
        sameContext(job.context, context);
    // A fresh inspection may list newer jobs started by another viewer. The
    // user's selected job stays pinned until an explicit action selects again.
    if (point.job) return matches(point.job) ? point.job : null;
    let latest: SourceJob | null = null;
    // The report can include other worktrees and other views' jobs. Only a
    // manual start/join adds a job to view.jobs and acquires a consumer.
    for (const job of [...(view.inspection?.jobs ?? []), ...view.jobs]) {
        if (matches(job) && (!latest || Date.parse(job.started_at) >= Date.parse(latest.started_at))) latest = job;
    }
    return latest;
}

function sameJob(previous: SourceJob, next: SourceJob): boolean {
    return previous.id === next.id && previous.source_id === next.source_id && previous.source_revision === next.source_revision &&
        previous.identity === next.identity && previous.owner === next.owner && sameContext(previous.context, next.context);
}

function displayedReport(view: SourceManager, report: SourceInspection | null): string | null {
    if (view.page === 'actions' || !report) return null;
    if (view.details.length) return JSON.stringify(report);
    if (view.page === 'checks')
        return JSON.stringify([report.source.settings.repository, report.source.settings.branch, report.checks_context, report.checks_observed_at, report.checks]);
    return JSON.stringify(report, (key, value) => key === 'consumers' ? undefined : value);
}

function jobTarget(editor: Editor, view: SourceManager, job: SourceJob, backend: Backend): RefreshTarget {
    const point = view.observation!, page = view.page, offset = view.offset;
    const pending = sourceObservationPending(job);
    const retry = finalInspectionRetries.get(point);
    return {
        owner: point, key: JSON.stringify([job.id, page, offset]),
        interval: pending ? job.state === 'running' ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS : retry ?? null,
        async read(signal, reason) {
            if (!pending && !retry && reason !== 'manual') return () => false;
            const current = retry && reason !== 'manual' ? job : await observeBackend(backend, 'source_status', { id: job.id }, signal);
            if (!sameJob(job, current)) throw new BackendError('source_identity', text('sources.error.identity'));
            let report: SourceInspection | null = null;
            let inspectionFailure: { error: unknown; retryable: boolean } | null = null;
            if (!sourceObservationPending(current)) {
                try {
                    const result = await observeBackend(backend, 'source_inspect', { id: point.id, context: point.context, offset }, signal);
                    if (result.offset !== offset || result.source.id !== point.id || result.source.revision !== point.revision ||
                        result.checks_context && !sameContext(result.checks_context, job.context))
                        throw new BackendError('source_identity', text('sources.error.identity'));
                    report = result;
                } catch (error) {
                    signal.throwIfAborted();
                    // The job can finish while another editor removes its source.
                    // Display the verified terminal state independently of this read.
                    const retryable = !(error instanceof BackendError && ['source_identity', 'identity', 'not_found', 'invalid_request'].includes(error.code));
                    inspectionFailure = { error, retryable };
                }
            }
            return () => {
                if (signal.aborted || editor.sources !== view || view.observation !== point || view.page !== page ||
                    view.offset !== offset || sourceObservationJob(editor) !== job) return false;
                if (inspectionFailure?.retryable)
                    finalInspectionRetries.set(point, retry ? Math.min(MAX_REFRESH_BACKOFF_MS, 2 * retry) : IDLE_REFRESH_MS);
                else finalInspectionRetries.delete(point);
                const noticeChanged = inspectionFailure ? failed(view, inspectionFailure.error) : clearReadError(view);
                const changed = JSON.stringify(current) !== JSON.stringify(job);
                if (!changed && !report) { point.job = job; return noticeChanged; }
                const showJob = job.state !== current.state || job.reason !== current.reason ||
                    sourceObservationPending(job) !== sourceObservationPending(current) ||
                    view.page === 'diagnose' && (view.details.length ? changed : JSON.stringify(job.result) !== JSON.stringify(current.result));
                const showReport = report && displayedReport(view, report) !== displayedReport(view, view.inspection);
                const next = (row: SourceJob) => sameJob(row, job) ? current : row;
                // An inspected job can fall outside the newest page of 16 jobs.
                // Retain its confirmed result without acquiring someone else's consumer.
                point.job = current;
                view.jobs = view.jobs.map(next);
                if (report) view.inspection = report;
                else if (view.inspection) view.inspection = { ...view.inspection, jobs: view.inspection.jobs.map(next) };
                if (view.details.length && view.inspection) view.details = JSON.stringify(view.inspection, null, 2).split('\n');
                const clearStarted = !sourceObservationPending(current) && view.message?.key === 'sources.refresh_started';
                if (clearStarted) view.message = null;
                return Boolean(noticeChanged || clearStarted || showJob || showReport);
            };
        },
        failed: error => failed(view, error),
    };
}

export function managerRefresh(editor: Editor, backend: Backend): RefreshTarget | null {
    if (editor.saveState !== 'idle' || editor.packageLocked) return null;
    const sources = editor.sources;
    if (sources && !sources.closed) {
        if (sources.page === 'list' && sources.library && sources.refreshList) return listTarget(sources, backend);
        const job = sourceObservationJob(editor);
        return job ? jobTarget(editor, sources, job, backend) : null;
    }
    const profiles = editor.profiles;
    return profiles?.page === 'list' && profiles.library && profiles.refreshList && !profiles.uncertain
        ? listTarget(profiles, backend) : null;
}

/** Consume only the explicit read shortcut. The initial open and unknown-write recovery keep their own effects. */
export function manualManagerRefresh(editor: Editor, event?: TextKey): boolean {
    if (editor.saveState !== 'idle' || editor.packageLocked) return false;
    const sources = editor.sources;
    if (sources && !sources.closed && (!event || editor.shortcuts.action('sources', event) === 'reload-sources')) {
        if (sources.effect === 'observe-job') {
            sources.effect = null;
            return sourceObservationJob(editor) !== null;
        }
        if (sources.page === 'list' && sources.effect === 'load' && sources.library) {
            sources.effect = null;
            sources.refreshList = true;
            return true;
        }
    }
    const profiles = editor.profiles;
    if (profiles?.page === 'list' && !profiles.uncertain && profiles.effect?.kind === 'load' && profiles.library &&
        (!event || editor.shortcuts.action('profiles', event) === 'reload-profiles')) {
        profiles.effect = null;
        profiles.refreshList = true;
        return true;
    }
    return false;
}
