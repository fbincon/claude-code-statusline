import type {
    Operation, PackageCleanupReview, PackageControl, PackageExecution, PackageReviewJob, PackageReviewRequest, PackageStatus, ResultFor,
} from '../contracts/ui.js';
import { text, type LocalizedText } from '../i18n/messages.js';
import { BackendError } from './backend.js';
import type { Editor } from './draft.js';
import { closeSourceDraft } from './source-manager.js';
import { resolveShortcut } from './shortcut-map.js';
import type { EditorShortcuts } from './shortcut-settings.js';
import { inputKey, textInput, type TextInput, type TextKey } from './text-input.js';
import type { PackageRow } from './package-view.js';

export type PackagePage = 'status' | 'installation' | 'channel' | 'history' | 'review' | 'execution' |
    'draft' | 'execute-confirm' | 'cleanup' | 'cleanup-confirm';
export type PackageChannel = PackageReviewRequest['channel'];
type Field = 'prefix' | 'target' | 'export_path';
type Effect = 'load' | 'start' | 'status' | 'cancel' | 'close' | 'execute' | 'save-draft' | 'discard-draft' |
    'export-draft' | 'reconcile-draft' | 'cleanup-review' | 'cleanup-apply';

export type PackageCommand =
    | { kind: 'open'; page: 'installation' | 'channel' | 'history' | 'review' | 'execution' }
    | { kind: 'input'; field: Field }
    | { kind: 'channel'; value: PackageChannel }
    | { kind: 'review'; action: PackageReviewRequest['action']; backup?: string }
    | { kind: 'cleanup'; id: string }
    | { kind: 'page'; offset: number }
    | { kind: 'effect'; effect: 'cleanup-review' | 'cleanup-apply' | 'execute' | 'save-draft' | 'discard-draft' | 'reconcile-draft' }
    | { kind: 'back' };

interface PagePosition {
    mode: PackagePage;
    selected: string;
    part: number;
    rowIndex: number;
    scroll: number;
}

export interface PackageManager extends PagePosition {
    owner: string;
    status: PackageStatus | null;
    job: PackageReviewJob | null;
    execution: PackageExecution | null;
    cleanup: PackageCleanupReview | null;
    prefix: string;
    target: string;
    channel: PackageChannel;
    historyOffset: number;
    cleanupOffset: number;
    parents: PagePosition[];
    rows: PackageRow[];
    capacity: number;
    input: TextInput | null;
    editing: Field | null;
    export_path: string;
    message: LocalizedText | string | null;
    effect: Effect | null;
    cleanupId: string | null;
    draftPrepared: boolean;
    draftSaveLocked: boolean;
    reviewInvalidated: boolean;
    action: PackageReviewRequest['action'];
    backup: string | null;
    busy: boolean;
    closed: boolean;
    generation: number;
}

export const PACKAGE_RECORDS_PER_PAGE = 16;
export const PACKAGE_CHANNELS = [null, 'latest', 'beta'] as const;

export function packageManager(): PackageManager {
    return {
        owner: 'viewer-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
        status: null, job: null, execution: null, cleanup: null,
        prefix: '', target: '', channel: null, historyOffset: 0, cleanupOffset: 0,
        mode: 'status', selected: 'target', part: 0, rowIndex: 0, scroll: 0, parents: [], rows: [], capacity: 1,
        input: null, editing: null, export_path: 'statusline-before-update.json', message: null, effect: 'load',
        cleanupId: null, draftPrepared: false, draftSaveLocked: false, reviewInvalidated: false,
        action: 'check', backup: null, busy: false, closed: false, generation: 0,
    };
}

export interface PackageBackend {
    request<O extends Operation>(operation: O, payload?: unknown): ResultFor<O> | Promise<ResultFor<O>>;
    control?<O extends Operation>(control: PackageControl, operation: O, payload?: unknown): ResultFor<O> | Promise<ResultFor<O>>;
}

function request<O extends Operation>(view: PackageManager, backend: PackageBackend, operation: O, payload: unknown) {
    return view.execution && backend.control
        ? backend.control(view.execution.control, operation, payload)
        : backend.request(operation, payload);
}

function focus(view: PackageManager, selected: string) {
    view.selected = selected;
    view.part = 0;
}

function showPage(view: PackageManager, mode: PackagePage, selected = '') {
    Object.assign(view, { mode, selected, part: 0, rowIndex: 0, scroll: 0, rows: [] });
}

function openPage(view: PackageManager, mode: PackagePage, selected = '') {
    const { mode: parent, selected: key, part, rowIndex, scroll } = view;
    view.parents.push({ mode: parent, selected: key, part, rowIndex, scroll });
    showPage(view, mode, selected);
}

function leavePage(view: PackageManager) {
    const parent = view.parents.pop();
    if (view.mode === 'cleanup-confirm') view.cleanupId = null;
    if (view.mode === 'draft' || view.mode === 'execute-confirm') view.draftPrepared = false;
    if (parent) Object.assign(view, parent, { rows: [] });
    else showPage(view, 'status');
}

function showExecution(view: PackageManager, execution: PackageExecution, editor?: Editor) {
    view.execution = execution;
    if (editor) editor.packageLocked = true;
    view.parents.length = 0;
    showPage(view, 'status', 'execution');
    openPage(view, 'execution', 'execution-status');
}

export function packageCanReview(view: PackageManager): boolean {
    return !!view.status?.prefix && (!view.execution || view.execution.running === false);
}

export function packageCanExecute(view: PackageManager): boolean {
    const job = view.job, review = job?.review;
    return !view.reviewInvalidated && (!view.execution || view.execution.running === false) &&
        job?.state === 'complete' && !!review?.compatible && job.request.action !== 'check' &&
        (review.artifact_verified || job.request.action === 'restore-config');
}

export function packageProgress(view: PackageManager): PackageExecution | PackageReviewJob | null {
    if (view.mode === 'execution') return view.execution;
    if (view.mode === 'review') return view.job;
    if (view.mode !== 'status') return null;
    return view.execution && view.execution.running !== false ? view.execution : view.job ?? view.execution;
}

/** Keep footer hints and keyboard routing in agreement on the available controls. */
export function packageControls(view: PackageManager) {
    const pick = view.mode !== 'execution' && (view.mode !== 'installation' || !view.execution);
    const reload = view.mode === 'status' || view.mode === 'installation' || view.mode === 'history' || view.mode === 'review';
    const cancel = (view.mode === 'status' || view.mode === 'review') && !!view.job &&
        (!view.execution || view.execution.running === false);
    return { pick, reload, cancel, refresh: reload || view.mode === 'execution' || view.mode === 'cleanup' };
}

export async function closePackage(view: PackageManager, backend: PackageBackend): Promise<void> {
    if (view.closed) return;
    view.closed = true;
    view.generation++;
    if (view.execution) {
        try {
            await request(view, backend, 'package_execute_detach', { id: view.execution.id, owner: view.owner });
        } catch { /* Detach never cancels an executor. */ }
    }
    if (view.job) {
        try {
            await request(view, backend, 'package_review_cancel', { id: view.job.id, owner: view.owner });
        } catch { /* Review deadlines still bound disconnected views. */ }
    }
}

const cancellationRequested = () => text('package.ui.cancel_requested', { key: 'R' });
const lastPageOffset = (total: number) => Math.max(0, Math.floor((total - 1) / PACKAGE_RECORDS_PER_PAGE) * PACKAGE_RECORDS_PER_PAGE);

export function receivePackageReview(view: PackageManager, job: PackageReviewJob) {
    view.job = job;
    if (typeof view.message === 'object' && view.message?.key === 'package.ui.cancel_requested' && job.state !== 'running')
        view.message = job.state === 'cancelled' ? text('package.cancelled') : null;
}

async function cancelReview(view: PackageManager, backend: PackageBackend, current: () => boolean): Promise<boolean> {
    if (!view.job) return true;
    const job = await request(view, backend, 'package_review_cancel', { id: view.job.id, owner: view.owner });
    if (!current()) return false;
    if (job.state !== 'cancelled') {
        view.job = job;
        view.message = cancellationRequested();
        return false;
    }
    view.job = null;
    view.reviewInvalidated = false;
    return true;
}

async function loadStatus(view: PackageManager, backend: PackageBackend, current: () => boolean, editor?: Editor) {
    if (view.job && (view.prefix || view.reviewInvalidated) && view.job.request.prefix !== view.prefix &&
        !await cancelReview(view, backend, current)) return;
    const payload = { prefix: view.prefix || null, offset: view.historyOffset };
    let status = await request(view, backend, 'package_status', payload);
    if (!current()) return;
    const offset = lastPageOffset(status.total);
    if (status.offset > offset) {
        status = await request(view, backend, 'package_status', { ...payload, offset });
        if (!current()) return;
    }
    if (view.job && status.revision !== view.job.request.expected_revision) {
        view.job = { ...view.job, state: 'failed', review: null, error: 'conflict' };
        view.reviewInvalidated = true;
        view.message = text('package.ui.changed');
    }
    view.status = status;
    view.historyOffset = status.offset;
    view.prefix = status.prefix ?? view.prefix;
    if (status.execution && status.execution.id !== view.execution?.id) showExecution(view, status.execution, editor);
    else if (status.execution) view.execution = status.execution;
}

async function startReview(view: PackageManager, backend: PackageBackend, current: () => boolean) {
    const status = view.status;
    if (!status?.prefix) throw new BackendError('prefix', text('package.reason_prefix'));
    if (!packageCanReview(view)) return;
    if (view.job?.state === 'running') {
        view.message = text('package.ui.review_busy');
        return;
    }
    const previous = view.job;
    let target = view.action === 'recover-package' ? status.pending?.version ?? (view.target || null) : view.target || null;
    let integrity: string | null = null;
    if (!view.reviewInvalidated && view.action === 'update' && previous?.state === 'complete' &&
        previous.request.action === 'check' && previous.request.expected_revision === status.revision && previous.review &&
        (!target || target === previous.review.target) && (!view.channel || view.channel === previous.review.channel || !!target)) {
        target = previous.review.target;
        integrity = previous.review.integrity;
    }
    const reviewRequest: PackageReviewRequest = {
        action: view.action, prefix: status.prefix, expected_revision: status.revision,
        target: view.action === 'restore-config' ? null : target,
        channel: !target && (view.action === 'check' || view.action === 'update') ? view.channel : null,
        backup_id: view.action === 'restore-config' ? view.backup : null, expected_integrity: integrity,
    };
    if (previous && !await cancelReview(view, backend, current)) return;
    if (!current()) return;
    const job = await request(view, backend, 'package_review_start', { request: reviewRequest, owner: view.owner });
    if (!current()) {
        await request(view, backend, 'package_review_cancel', { id: job.id, owner: view.owner });
        return;
    }
    view.job = job;
    view.reviewInvalidated = false;
    view.draftPrepared = false;
    view.message = null;
    openPage(view, 'review', 'job');
}

function confirmExecution(view: PackageManager) {
    if (view.mode === 'draft') showPage(view, 'execute-confirm', 'execute-confirm');
    else openPage(view, 'execute-confirm', 'execute-confirm');
}

async function executeReview(view: PackageManager, backend: PackageBackend, current: () => boolean, editor?: Editor) {
    if (!editor || !packageCanExecute(view) || !view.job) throw new BackendError('integrity', text('package.reason_integrity'));
    if (editor.saveState !== 'idle') {
        view.draftPrepared = false;
        view.draftSaveLocked = true;
        if (view.mode === 'execute-confirm') showPage(view, 'draft', 'draft-cancel');
        else openPage(view, 'draft', 'draft-cancel');
        view.message = text('editor.save_locked');
        return;
    }
    if (!view.draftPrepared) {
        if (!editor.acceptNumeric()) {
            view.message = text('package.ui.draft_required');
            return;
        }
        view.draftSaveLocked = false;
        if (editor.modified) openPage(view, 'draft', 'draft-cancel');
        else confirmExecution(view);
        return;
    }
    editor.packageLocked = true;
    const execution = await request(view, backend, 'package_execute_start', { id: view.job.id, owner: view.owner });
    view.execution = execution;
    if (current()) {
        showExecution(view, execution, editor);
        view.message = null;
    }
    await closeSourceDraft(editor, { request: (operation, payload) => request(view, backend, operation, payload) });
    if (!current()) await request(view, backend, 'package_execute_detach', { id: execution.id, owner: view.owner });
}

function invalidateSavedReview(view: PackageManager) {
    view.job = null;
    view.reviewInvalidated = false;
    view.status = null;
    // Saving or reconciling consumes the review and returns to its originating page.
    if (view.mode === 'draft') leavePage(view);
    if (view.mode === 'review') leavePage(view);
}

async function readCleanup(view: PackageManager, backend: PackageBackend, offset: number) {
    const prefix = view.prefix;
    if (!prefix) throw new BackendError('prefix', text('package.reason_prefix'));
    const first = await request(view, backend, 'package_cleanup_review', { prefix, offset });
    const last = lastPageOffset(first.total);
    return first.offset > last ? request(view, backend, 'package_cleanup_review', { prefix, offset: last }) : first;
}

function receiveCleanup(view: PackageManager, snapshot: PackageCleanupReview) {
    view.cleanup = snapshot;
    view.cleanupOffset = snapshot.offset;
}

export async function performPackage(view: PackageManager, backend: PackageBackend, editor?: Editor): Promise<void> {
    const effect = view.effect;
    if (!effect || view.closed) return;
    if (effect === 'close') {
        view.effect = null;
        await closePackage(view, backend);
        return;
    }
    if (view.busy) return;
    view.effect = null;
    view.busy = true;
    const generation = view.generation;
    const current = () => !view.closed && generation === view.generation;
    try {
        switch (effect) {
            case 'load':
                await loadStatus(view, backend, current, editor);
                break;
            case 'start':
                await startReview(view, backend, current);
                break;
            case 'execute':
                await executeReview(view, backend, current, editor);
                break;
            case 'discard-draft':
                if (!editor || editor.saveState !== 'idle') throw new BackendError('configuration_conflict', text('editor.save_locked'));
                editor.replaceDraft(editor.baseline.draft);
                confirmExecution(view);
                break;
            case 'save-draft': {
                if (!editor || editor.saveState !== 'idle') throw new BackendError('configuration_conflict', text('editor.save_locked'));
                if (!editor.acceptNumeric()) {
                    view.message = text('package.ui.draft_required');
                    break;
                }
                const submitted = editor.beginSave();
                try {
                    const saved = await backend.request('apply', { draft: submitted.draft, expected_revision: submitted.revision,
                        ...(submitted.target ? { target: submitted.target } : {}) });
                    editor.committed(saved);
                } catch (error) {
                    editor.saveFailed(error instanceof BackendError ? error.code : '');
                    view.draftSaveLocked = editor.saveState !== 'idle';
                    throw error;
                }
                invalidateSavedReview(view);
                view.message = text('package.ui.review_again');
                if (current()) await loadStatus(view, backend, current, editor);
                break;
            }
            case 'export-draft':
                if (!editor || editor.saveState !== 'idle') throw new BackendError('configuration_conflict', text('editor.save_locked'));
                await backend.request('export', { draft: editor.draft, path: view.export_path, overwrite: false });
                if (current()) {
                    confirmExecution(view);
                    view.message = text('package.ui.exported');
                }
                break;
            case 'reconcile-draft': {
                if (!editor?.pendingSave) break;
                const pending = editor.pendingSave;
                editor.setSaveState('pending');
                try {
                    const saved = await backend.request('read', pending.target ? { target: pending.target } : {});
                    view.message = text('editor.' + editor.reconcileSave(saved));
                } catch (error) {
                    editor.setSaveState('unknown');
                    throw error;
                }
                invalidateSavedReview(view);
                if (current()) await loadStatus(view, backend, current, editor);
                break;
            }
            case 'cleanup-review': {
                const snapshot = await readCleanup(view, backend, view.cleanupOffset);
                if (current()) receiveCleanup(view, snapshot);
                break;
            }
            case 'cleanup-apply': {
                if (!view.cleanup || !view.cleanupId) throw new BackendError('conflict', text('package.reason_conflict'));
                const id = view.cleanupId;
                const snapshot = await request(view, backend, 'package_cleanup_apply', {
                    prefix: view.prefix, revision: view.cleanup.revision, ids: [id],
                });
                if (!current()) break;
                if (view.status && id.startsWith('pkg-')) {
                    view.status = { ...view.status, total: Math.max(0, view.status.total - 1),
                        history: view.status.history.filter(record => record.id !== id) };
                }
                leavePage(view);
                const offset = Math.min(view.cleanupOffset, lastPageOffset(snapshot.total));
                receiveCleanup(view, snapshot);
                view.message = text('package.ui.cleaned');
                // The deletion receipt already supplies a usable first page.
                // A failed follow-up read must not turn a completed deletion into a retry.
                if (offset !== snapshot.offset) {
                    try {
                        const page = await readCleanup(view, backend, offset);
                        if (current()) receiveCleanup(view, page);
                    } catch { /* Retain the first page and successful deletion notice. */ }
                }
                break;
            }
            case 'cancel':
                if (await cancelReview(view, backend, current) && current()) {
                    view.message = text('package.cancelled');
                    if (view.mode === 'review') leavePage(view);
                }
                break;
            case 'status': {
                const progress = packageProgress(view);
                if (!progress) break;
                if ('control' in progress) {
                    const execution = await request(view, backend, 'package_execute_status', { id: progress.id });
                    if (current()) view.execution = execution;
                } else {
                    const job = await request(view, backend, 'package_review_status', { id: progress.id, owner: view.owner });
                    if (current()) receivePackageReview(view, job);
                }
                break;
            }
        }
    } catch (error) {
        if (effect === 'execute' && editor && !view.execution && error instanceof BackendError &&
            ['arguments', 'conflict', 'integrity', 'identity', 'busy', 'development', 'permission', 'configuration', 'journal'].includes(error.code))
            editor.packageLocked = false;
        if (current()) {
            if (effect === 'cleanup-apply' && view.mode === 'cleanup-confirm') {
                leavePage(view);
                view.cleanup = null;
            }
            view.message = error instanceof BackendError && error.localization ? error.localization : text('package.reason_io_error');
        }
    } finally {
        if (current()) view.busy = false;
    }
}

function editField(view: PackageManager, event: TextKey, key: string, commandKey: boolean, back: boolean): 'packages' | null {
    const field = view.editing!, input = view.input!;
    if (back) {
        view.input = null;
        view.editing = null;
        view.message = null;
        return null;
    }
    if (commandKey && !event.ctrl && key === 'enter') {
        view.input = null;
        view.editing = null;
        view.message = null;
        if (field === 'export_path') {
            view.export_path = input.value;
            view.effect = 'export-draft';
            return 'packages';
        }
        if (view[field] === input.value) return null;
        view[field] = input.value;
        if (view.job) view.reviewInvalidated = true;
        if (field === 'prefix') {
            view.status = null;
            view.cleanup = null;
            view.historyOffset = view.cleanupOffset = 0;
            view.effect = 'load';
            return 'packages';
        }
        if (view.job) {
            view.effect = 'cancel';
            return 'packages';
        }
        return null;
    }
    const limit = field === 'target' ? 100 : 4096;
    const result = inputKey(input.value, input, event, limit);
    view.input = result.state;
    view.message = result.error ? text('input.' + result.error, { limit }) : null;
    return null;
}

function activate(view: PackageManager, command: PackageCommand): 'packages' | null {
    switch (command.kind) {
        case 'open':
            openPage(view, command.page, {
                installation: 'prefix', channel: 'channel:' + (view.channel ?? 'inherit'), history: 'history-context',
                review: 'job', execution: 'execution-status',
            }[command.page]);
            return null;
        case 'input':
            view.editing = command.field;
            view.input = textInput(view[command.field]);
            view.message = null;
            return null;
        case 'channel': {
            const changed = view.channel !== command.value;
            view.channel = command.value;
            leavePage(view);
            if (!changed || !view.job) return null;
            view.reviewInvalidated = true;
            view.effect = 'cancel';
            break;
        }
        case 'review':
            if (!packageCanReview(view)) return null;
            view.action = command.action;
            view.backup = command.backup ?? null;
            view.effect = 'start';
            break;
        case 'cleanup':
            view.cleanupId = command.id;
            openPage(view, 'cleanup-confirm', 'cleanup-confirm');
            return null;
        case 'page':
            if (view.mode === 'cleanup') {
                view.cleanupOffset = command.offset;
                view.effect = 'cleanup-review';
            } else {
                view.historyOffset = command.offset;
                view.effect = 'load';
            }
            break;
        case 'effect':
            if (command.effect === 'cleanup-review') {
                if (!packageCanReview(view)) return null;
                openPage(view, 'cleanup', 'cleanup-message');
            }
            if (command.effect === 'execute') view.draftPrepared = view.mode === 'execute-confirm';
            view.effect = command.effect;
            break;
        case 'back':
            leavePage(view);
            return null;
    }
    return 'packages';
}

/** Report pages also use the cursor to read lines without an Enter action. */
export function packageRowCanFocus(view: PackageManager, row: PackageRow): boolean {
    if (row.heading) return false;
    switch (view.mode) {
        case 'status':
        case 'channel':
        case 'draft':
            return !!row.command && row.part === 0;
        default:
            return true;
    }
}

function move(view: PackageManager, key: string) {
    const positions = view.rows.flatMap((row, index) => packageRowCanFocus(view, row) ? [index] : []);
    if (!positions.length) return;
    const index = view.rowIndex;
    const next = positions.find(position => position > index) ?? positions.at(-1)!;
    const previous = positions.findLast(position => position < index) ?? positions[0]!;
    let destination: number;
    switch (key) {
        case 'up': destination = previous; break;
        case 'down': destination = next; break;
        case 'pageup': destination = positions.findLast(position => position <= index - view.capacity) ?? positions[0]!; break;
        case 'pagedown': destination = positions.find(position => position >= index + view.capacity) ?? positions.at(-1)!; break;
        case 'home': destination = positions[0]!; view.scroll = 0; break;
        case 'end': destination = positions.at(-1)!; break;
        default: return;
    }
    const row = view.rows[destination]!;
    view.selected = row.key;
    view.part = row.part;
    view.rowIndex = destination;
}

export function packageKey(view: PackageManager, event: TextKey, shortcuts?: EditorShortcuts): 'packages' | null {
    const key = event.key === 'return' ? 'enter' : event.key;
    const commandKey = !event.text && !event.paste && !event.meta && !event.overflow;
    const back = commandKey && (event.ctrl ? key.toLowerCase() === 'g' : key === 'escape' || key === 'esc');
    if (view.input && view.editing) return editField(view, event, key, commandKey, back);
    if (!commandKey) return null;

    const action = shortcuts ? shortcuts.action('packages', event) : resolveShortcut('native', 'packages', event, {});
    if (back || action === 'close-packages') {
        if (view.mode !== 'status') {
            if (!view.busy) leavePage(view);
            return null;
        }
        view.effect = 'close';
        return 'packages';
    }
    if (view.busy) return null;
    const controls = packageControls(view);
    if (action === 'refresh-package' && controls.refresh) {
        view.effect = view.mode === 'cleanup' ? 'cleanup-review' : packageProgress(view) ? 'status' : 'load';
        return 'packages';
    }
    if (action === 'reload-packages' && controls.reload) {
        view.effect = 'load';
        return 'packages';
    }
    if (action === 'cancel-package-review' && controls.cancel) {
        view.reviewInvalidated = true;
        view.effect = 'cancel';
        return 'packages';
    }
    if (event.ctrl) return null;
    if (key === 'enter') {
        const row = view.rows[view.rowIndex];
        return row?.command && row.key === view.selected && row.part === view.part ? activate(view, row.command) : null;
    }
    move(view, key);
    return null;
}
