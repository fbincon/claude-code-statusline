import { isDeepStrictEqual } from 'node:util';
import type { TaskDetails } from '@fbincon/statusline-core/contracts/ui';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { packageProgress, receivePackageReview, type PackageManager } from '@fbincon/statusline-core/editor/package-manager';
import { receiveTask, taskPreferenceFailure, taskReadFailure, taskViewerView, type TaskRow, type TaskViewer } from '@fbincon/statusline-core/editor/task-viewer';
import { text, type Language, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import { ACTIVE_REFRESH_MS, IDLE_REFRESH_MS, type RefreshTarget } from './foreground-refresh.js';
import { observeBackend } from './observation-backend.js';
import type { Backend } from './session.js';

const activeTasks = new Set(['running', 'queued', 'pending', 'main', 'waiting', 'waiting agents', 'main wrap-up']);
const taskPanes = new WeakMap<TaskViewer, { width: number; height: number; rows: TaskRow[] }>();

export function externalTaskRows(view: TaskViewer, width: number, height: number): TaskRow[] {
    const rows = taskViewerView(view, width, height);
    taskPanes.set(view, { width, height, rows });
    return rows;
}

export function taskRefreshInterval(view: TaskViewer): number | null {
    if (view.closed || view.busy || view.input || !view.session) return null;
    return activeTasks.has(view.report?.status ?? '') ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS;
}

/** Read time is updated in the report, but is never itself an automatic repaint. */
function sameTaskRows(before: TaskRow[], after: TaskRow[]): boolean {
    return before.length === after.length && before.every((row, index) => {
        const next = after[index]!;
        return row.key === next.key && row.selected === next.selected && row.heading === next.heading &&
            (row.key.startsWith('captured:') || row.text === next.text);
    });
}

/** IPC clones every result. Share unchanged sections so terminal navigation and
 * elapsed-time updates can keep the existing Unicode wrapping cache. */
function shareTaskSections(previous: TaskDetails | null, next: TaskDetails): TaskDetails {
    if (!previous || previous.session_id !== next.session_id || previous.prompt_id !== next.prompt_id) return next;
    const share = <T>(old: T, current: T) => isDeepStrictEqual(old, current) ? old : current;
    return { ...next, agents: share(previous.agents, next.agents), evidence: share(previous.evidence, next.evidence),
        limitations: share(previous.limitations, next.limitations) };
}

export function taskRefresh(view: TaskViewer, backend: Backend, language?: Language): RefreshTarget | null {
    const interval = taskRefreshInterval(view);
    if (interval === null) return null;
    const { session, prompt, generation } = view;
    const current = () => taskRefreshInterval(view) !== null && view.session === session &&
        view.prompt === prompt && view.generation === generation;
    let preferences: Pick<TaskViewer, 'language' | 'warning'> | undefined;
    const applyPreferences = () => {
        if (!preferences) return false;
        const changed = view.language !== preferences.language || !isDeepStrictEqual(view.warning, preferences.warning);
        Object.assign(view, preferences);
        return changed;
    };
    return {
        owner: view, key: JSON.stringify([generation, session, prompt]), interval, rereadOnManualJoin: true,
        async read(signal, reason) {
            if (reason !== 'automatic') {
                try {
                    const result = await observeBackend(backend, 'read_ui_preferences', {}, signal);
                    preferences = { language: language ?? result.ui_language, warning: result.warning };
                } catch {
                    signal.throwIfAborted();
                    preferences = taskPreferenceFailure(language);
                }
            }
            const snapshot = await observeBackend(backend, 'task_details', { session_id: session, prompt_id: prompt }, signal);
            return () => {
                if (signal.aborted || !current()) return false;
                const previous = view.report, previousError = view.error;
                const result = shareTaskSections(previous, snapshot);
                const changed = !previous || !isDeepStrictEqual({ ...previous, captured_at: result.captured_at }, result);
                const before = taskPanes.get(view);
                receiveTask(view, result);
                if (applyPreferences() || previousError || !previous) return true;
                if (reason !== 'automatic' && previous.captured_at !== result.captured_at) return true;
                return changed && (!before || !sameTaskRows(before.rows, externalTaskRows(view, before.width, before.height)));
            };
        },
        failed(error) {
            if (!current()) return false;
            const message = taskReadFailure(view, error);
            const changed = !isDeepStrictEqual(message, view.error);
            view.error = message;
            return applyPreferences() || changed;
        },
    };
}

const packageErrors = new WeakMap<PackageManager, { id: string; message: LocalizedText }>();

export function packageRefreshError(view: PackageManager): LocalizedText | null {
    const failure = packageErrors.get(view);
    return failure && failure.id === packageProgress(view)?.id && !view.input ? failure.message : null;
}

export function packageRefreshInterval(view: PackageManager): number | null {
    if (view.closed || view.input || view.busy) return null;
    const progress = packageProgress(view);
    if (progress && 'control' in progress) {
        if (progress.running === null) return IDLE_REFRESH_MS;
        if (progress.state === 'running') return ACTIVE_REFRESH_MS;
        return progress.running ? IDLE_REFRESH_MS : null;
    }
    return progress?.state === 'running' ? ACTIVE_REFRESH_MS : null;
}

export function packageRefresh(view: PackageManager, backend: Backend): RefreshTarget | null {
    const { owner, generation } = view, active = packageProgress(view);
    if (!active || view.closed || view.input || view.busy) return null;
    const current = () => !view.closed && !view.input && !view.busy &&
        view.owner === owner && view.generation === generation && packageProgress(view) === active;
    const identityError = () => new BackendError('identity', text('package.reason_identity'));
    return {
        owner: view, key: JSON.stringify([generation, owner, active.id]), interval: packageRefreshInterval(view),
        async read(signal) {
            let accept: () => boolean;
            if ('control' in active) {
                const execution = active;
                const next = await observeBackend(backend, 'package_execute_status', { id: execution.id }, signal, execution.control);
                if (next.id !== execution.id || next.prefix !== execution.prefix || next.action !== execution.action ||
                    !isDeepStrictEqual(next.control, execution.control)) throw identityError();
                accept = () => {
                    view.execution = next;
                    return execution.state !== next.state || execution.stage !== next.stage || execution.running !== next.running ||
                        execution.transaction_id !== next.transaction_id || execution.error !== next.error ||
                        !isDeepStrictEqual(execution.results, next.results);
                };
            } else {
                const review = active;
                const next = await observeBackend(backend, 'package_review_status', { id: review.id, owner }, signal, view.execution?.control);
                if (next.id !== review.id || next.owner !== owner || !isDeepStrictEqual(next.request, review.request)) throw identityError();
                accept = () => {
                    const previousMessage = view.message;
                    receivePackageReview(view, next);
                    return previousMessage !== view.message || review.state !== next.state || review.error !== next.error ||
                        !isDeepStrictEqual(review.review, next.review);
                };
            }
            return () => {
                if (signal.aborted || !current()) return false;
                const hadError = packageErrors.delete(view);
                return accept() || hadError;
            };
        },
        failed(error) {
            if (!current()) return false;
            const message = error instanceof BackendError && error.localization ? error.localization : text('package.reason_io_error');
            const changed = !isDeepStrictEqual(packageRefreshError(view), message);
            packageErrors.set(view, { id: active.id, message });
            return changed;
        },
    };
}
