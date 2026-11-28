import type { Operation, ResultFor, SourceContext, SourceDefinition, SourceInspection, SourceJob } from '../contracts/ui.js';
import { text, type LocalizedText } from '../i18n/messages.js';
import { BackendError } from './backend.js';
import type { Editor } from './draft.js';
import { observationContext, sameContext } from './source-compatibility.js';
import type { SourceManager } from './source-manager.js';

export const SOURCE_ACTIVE_REFRESH_MS = 2000;
const IDLE_REFRESH_MS = 10000;
export const SOURCE_MAX_BACKOFF_MS = 30000;

type SourceReadOperation = Extract<Operation, 'source_status' | 'source_inspect'>;
interface SourceReader {
    request<O extends SourceReadOperation>(operation: O, payload: unknown): ResultFor<O> | Promise<ResultFor<O>>;
}

const readErrors = new WeakMap<SourceManager, LocalizedText>();
const finalInspectionRetries = new WeakMap<NonNullable<SourceManager['observation']>, number>();

export function sourceReadFailed(view: SourceManager, error: unknown): boolean {
    const message = error instanceof BackendError && error.localization ? error.localization : text('sources.failed');
    const changed = JSON.stringify(view.message) !== JSON.stringify(message);
    readErrors.set(view, message);
    view.message = message;
    return changed;
}

export function clearSourceReadError(view: SourceManager): boolean {
    if (view.message !== readErrors.get(view)) return false;
    readErrors.delete(view);
    view.message = null;
    return true;
}

/** A deadline projection can precede the worker's durable terminal state. */
export function sourceObservationPending(job: SourceJob): boolean {
    return job.state === 'running' || job.state === 'failed' && job.reason === 'timeout' && !job.result;
}

export function applicableJob(job: SourceJob, source: SourceDefinition, context: SourceContext): boolean {
    return job.source_id === source.id && job.source_revision === source.revision &&
        sameContext(job.context, observationContext(source, context));
}

export function sourceObservationJob(editor: Editor): SourceJob | null {
    const view = editor.sources;
    const point = view?.observation;
    if (!view || view.closed || !point || point.id !== view.selected ||
        !['actions', 'diagnose', 'checks', 'raw'].includes(view.page)) return null;
    const definition = view.library?.sources.find(source => source.id === point.id);
    if (!definition || definition.revision !== point.revision) return null;
    // Newer work started by another consumer cannot replace an explicitly selected job.
    const matches = (job: SourceJob) => applicableJob(job, definition, point.context);
    if (point.job) return matches(point.job) ? point.job : null;
    let latest: SourceJob | null = null;
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
    if (!report) return null;
    if (view.page === 'raw' || view.details.length) return JSON.stringify(report);
    if (view.page === 'checks')
        return JSON.stringify([report.source.settings.repository, report.source.settings.branch, report.checks_context, report.checks_observed_at, report.checks]);
    return JSON.stringify(report, (key, value) => key === 'consumers' ? undefined : value);
}

export function verifySourceInspection(report: SourceInspection, source: SourceDefinition, offset: number, context: SourceContext): SourceInspection {
    if (report.offset !== offset || report.source.id !== source.id || report.source.revision !== source.revision ||
        report.checks_context && !sameContext(report.checks_context, observationContext(source, context)))
        throw new BackendError('source_identity', text('sources.error.identity'));
    return report;
}

/** Hosts supply the scheduler and transport; this read only prepares a guarded UI update. */
export function sourceObservationTarget(editor: Editor) {
    const view = editor.sources;
    const job = sourceObservationJob(editor);
    if (!view || !job || !view.observation) return null;
    const point = view.observation;
    const page = view.page;
    const offset = view.offset;
    const pending = sourceObservationPending(job);
    const retry = finalInspectionRetries.get(point);
    const currentView = () => editor.sources === view && !view.closed && view.observation === point &&
        view.page === page && view.offset === offset && sourceObservationJob(editor) === job;
    return {
        owner: point,
        key: JSON.stringify([job.id, page, offset]),
        interval: pending ? job.state === 'running' ? SOURCE_ACTIVE_REFRESH_MS : IDLE_REFRESH_MS : retry ?? null,
        async read(backend: SourceReader, manual: boolean, active: () => boolean = currentView): Promise<() => boolean> {
            if (!pending && !retry && !manual) return () => false;
            const current = retry && !manual ? job : await backend.request('source_status', { id: job.id });
            if (!active() || !currentView()) return () => false;
            if (!sameJob(job, current)) throw new BackendError('source_identity', text('sources.error.identity'));
            let report: SourceInspection | null = null;
            let inspectionFailure: { error: unknown; retryable: boolean } | null = null;
            if (!sourceObservationPending(current)) {
                try {
                    const source = view.library!.sources.find(source => source.id === point.id)!;
                    const result = await backend.request('source_inspect', { id: point.id, context: point.context, offset });
                    report = verifySourceInspection(result, source, offset, point.context);
                } catch (error) {
                    if (!active() || !currentView()) return () => false;
                    // A verified job result remains valid if the source was removed before this read.
                    const retryable = !(error instanceof BackendError && ['source_identity', 'identity', 'not_found', 'invalid_request'].includes(error.code));
                    inspectionFailure = { error, retryable };
                }
            }
            return () => {
                if (!active() || !currentView()) return false;
                if (inspectionFailure?.retryable)
                    finalInspectionRetries.set(point, retry ? Math.min(SOURCE_MAX_BACKOFF_MS, 2 * retry) : IDLE_REFRESH_MS);
                else finalInspectionRetries.delete(point);
                const noticeChanged = inspectionFailure ? sourceReadFailed(view, inspectionFailure.error) : clearSourceReadError(view);
                const changed = JSON.stringify(current) !== JSON.stringify(job);
                if (!changed && !report) { point.job = job; return noticeChanged; }
                const showJob = job.state !== current.state || job.reason !== current.reason ||
                    sourceObservationPending(job) !== sourceObservationPending(current) ||
                    page === 'raw' && changed || page === 'diagnose' &&
                    (view.details.length ? changed : JSON.stringify(job.result) !== JSON.stringify(current.result));
                const showReport = report && displayedReport(view, report) !== displayedReport(view, view.inspection);
                const replace = (row: SourceJob) => sameJob(row, job) ? current : row;
                point.job = current;
                view.jobs = view.jobs.map(replace);
                if (report) view.inspection = report;
                else if (view.inspection) view.inspection = { ...view.inspection, jobs: view.inspection.jobs.map(replace) };
                if (view.details.length && view.inspection) view.details = JSON.stringify(view.inspection, null, 2).split('\n');
                const clearStarted = !sourceObservationPending(current) && view.message?.key === 'sources.refresh_started';
                if (clearStarted) view.message = null;
                return Boolean(noticeChanged || clearStarted || showJob || showReport);
            };
        },
        failed(error: unknown): boolean {
            return currentView() && sourceReadFailed(view, error);
        },
    };
}
