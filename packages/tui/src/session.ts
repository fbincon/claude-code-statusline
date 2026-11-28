import { performChanges, openChanges } from '@fbincon/statusline-core/editor/change-review';
import { performReuse } from '@fbincon/statusline-core/editor/reuse-manager';
import { performPackage, closePackage } from '@fbincon/statusline-core/editor/package-manager';
import { diagnosisRequest, receiveDiagnosis, receiveDiagnosisFailure } from '@fbincon/statusline-core/editor/diagnosis-view';
import { previewWidth } from '@fbincon/statusline-core/editor/preview-settings';
import { editorPreviewDraft } from '@fbincon/statusline-core/editor/preview-view';
import { performSourceAction, closeSources, closeSourceDraft } from '@fbincon/statusline-core/editor/source-manager';
import { receivePreset } from '@fbincon/statusline-core/editor/quick-setup';
import { performProfileAction } from '@fbincon/statusline-core/editor/profile-manager';
import type { Operation, ResultFor, PackageControl } from '@fbincon/statusline-core/contracts/ui';
import { createReview } from '@fbincon/statusline-core/editor/import-review';
import { text, t, renderMessage, type Language } from '@fbincon/statusline-core/i18n/messages';
import type { Key } from '@fbincon/statusline-core/terminal/key';
import { terminal, type TerminalOptions } from '@fbincon/statusline-platform/terminal/session';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { copyDraft, isSaveConflict } from '@fbincon/statusline-core/editor/draft';
import { defaultShortcuts } from '@fbincon/statusline-core/editor/shortcut-settings';
import { EditorRevoked } from '@fbincon/statusline-platform/terminal/bridge';
import { State } from './state.js';
import { frame, ansiFrame } from './drawing.js';
import { dimensions } from './layout.js';
import { colorCapability } from '@fbincon/statusline-platform/terminal/capabilities';
import { ForegroundRefresh, type RefreshTarget } from './foreground-refresh.js';
import { managerRefresh, manualManagerRefresh } from './manager-refresh.js';
import { packageRefresh, taskRefresh } from './report-refresh.js';
import type { ObserveOperation } from './observation-backend.js';
export type { ObserveOperation } from './observation-backend.js';
export interface Backend {
    control?<O extends Operation>(control:PackageControl,operation:O,payload?:unknown):ResultFor<O>|Promise<ResultFor<O>>;
    request<O extends Operation>(operation: O, payload?: unknown): ResultFor<O> | Promise<ResultFor<O>>;
    observe?<O extends ObserveOperation>(operation: O, payload: unknown, signal: AbortSignal, control?: PackageControl): Promise<ResultFor<O>>;
}
export interface Outcome {
    outcome: 'updated' | 'already-current' | 'cancelled' | 'interrupted' | 'timed-out' | 'error';
    exit_code: number;
    message: string;
}
export const outcome = (kind: Outcome['outcome'], language: Language, exit_code = 0, detail?: string): Outcome => ({
    outcome: kind, exit_code, message: detail ?? t({ updated: 'ui.session.status_line_configuration_updated', 'already-current': 'ui.session.status_line_configuration_already_current', cancelled: 'ui.session.status_line_configuration_unchanged', interrupted: 'ui.session.interactive_status_line_configuration_interrupted_no_changes', 'timed-out': 'ui.session.interactive_status_line_configuration_timed_out_no', error: 'ui.session.cannot_initialize_terminal_for_configure' }[kind], language),
});
export function colorCapacity(env: NodeJS.ProcessEnv = process.env): number {
    return colorCapability({environment:env,platform:process.platform,tty:true,windowsVT:false}).colors;
}
const localFailure = (error: unknown) => error instanceof BackendError && error.localization
    ? error.localization : error instanceof Error ? error.message : String(error);

export class Session {
    private previewKey = '';
    private explanationKey = '';
    constructor(public readonly state: State, public readonly backend: Backend, public readonly guard: () => void = () => { }, public languageOverride?: Language) { }
    static async open(backend: Backend, language?: Language, guard?: () => void, languageOverride?: Language): Promise<Session> {
        const description = await backend.request('describe'), current = await backend.request('read'), preference = await backend.request('read_ui_preferences');
        if (description.backend_version !== current.backend_version)
            throw new BackendError('backend_version_mismatch', text('native.hooks.register.the_backend_changed_while_opening_reopen_the_editor'));
        if (!current.installed)
            throw new BackendError('not_installed', text('ui.session.status_line_is_not_installed_for_this'));
        const state = new State(description, current, language ?? preference.ui_language);
        try { state.editor.shortcuts.snapshot = await backend.request('read_editor_shortcuts'); }
        catch (error) { state.editor.shortcuts.snapshot = defaultShortcuts(text('shortcuts.read-failed', { detail: error instanceof Error ? error.message : String(error) })); }
        const warning = preference.warning ?? state.editor.shortcuts.snapshot.warning;
        if (warning) state.notice(warning);
        return new Session(state, backend, guard, languageOverride);
    }
    async preview(columns: number, rows: number): Promise<void> {
        const state = this.state, e = state.editor;
        if (e.diagnosis || e.taskViewer || e.packages || e.shortcuts.panel) return;
        const width = previewWidth(dimensions(columns, rows).preview.innerWidth, e.previewWidth);
        const draft = editorPreviewDraft(e), view = e.explanation, scenario = e.previewScenario;
        const key = JSON.stringify([draft, width, scenario]);
        try {
            if (view) {
                const identity = JSON.stringify([key, view.scope, view.id]);
                if (identity !== this.explanationKey || !view.result) {
                    const result = await this.backend.request('explain', { draft, scope: view.scope, width, scenario });
                    if (result.scope !== view.scope || result.width !== width) throw new Error('Explanation response does not match the request');
                    view.result = result;
                    view.error = '';
                    this.explanationKey = identity;
                }
                state.preview = view.result.preview;
            } else if (key !== this.previewKey) {
                state.preview = await this.backend.request('preview', { draft, width, scenario });
            }
            state.previewError = null;
            this.previewKey = key;
        } catch (error) {
            state.preview = null;
            state.previewError = localFailure(error);
            this.previewKey = '';
            if (view) view.error = renderMessage(state.previewError, state.language);
        }
    }
    private refreshTarget(columns: number, rows: number): RefreshTarget | null {
        const state = this.state, e = state.editor;
        if (!e.packages && !e.taskViewer && !e.sources && !e.profiles) return null;
        if (!dimensions(columns, rows).available || state.exitChoice || state.input || e.shortcuts.panel ||
            e.changeReview || e.reuse || e.saveState === 'pending') return null;
        if (e.packages) return packageRefresh(e.packages, this.backend);
        if (e.packageLocked) return null;
        if (e.taskViewer) return taskRefresh(e.taskViewer, this.backend, this.languageOverride);
        if (e.diagnosis || e.colors || e.alignmentManager || e.groupManager) return null;
        return managerRefresh(e, this.backend);
    }
    private async readNow(columns: number, rows: number, refresh?: ForegroundRefresh): Promise<void> {
        if (refresh) { refresh.immediate(); return; }
        // Callers that drive the editor one key at a time have no terminal event loop.
        const target = this.refreshTarget(columns, rows);
        if (!target) return;
        try {
            const apply = await target.read(new AbortController().signal, 'manual');
            apply();
        } catch (error) { target.failed(error); }
    }
    async key(key: Key, columns = 80, rows = 24, refresh?: ForegroundRefresh): Promise<'save' | Outcome | null> {
        const state = this.state, e = state.editor;
        const effect = state.key(key, columns, rows);
        const transferInput = effect === 'transfer' && state.input?.kind === 'path' ? state.input : null;
        const hasTransferInput = () => state.editor === e && state.input === transferInput;
        if (effect === 'save')
            return 'save';
        if (effect === 'cancel' || effect === 'interrupt')
            return outcome(effect === 'cancel' ? 'cancelled' : 'interrupted', state.language, effect === 'interrupt' ? 130 : 0, e.saveState !== 'idle' ? t('editor.save_unknown', state.language, { check: 'Ctrl+K' }) : undefined);
        try {
            if (effect === 'reconcile') { await this.reconcile(); return null; }
            if(!e.packageLocked)this.guard();
            if (effect === 'save-shortcuts' || effect === 'read-shortcuts') {
                await e.shortcuts.perform(effect, async (operation, payload) => this.backend.request(operation, payload));
                return null;
            }
            if ((e.sources || e.profiles) && dimensions(columns, rows).available && manualManagerRefresh(e, key)) {
                await this.readNow(columns, rows, refresh);
                return null;
            }
            if (effect === 'packages' && e.packages) {
                const view = e.packages;
                if (view.effect === 'status') {
                    view.effect = null;
                    await this.readNow(columns, rows, refresh);
                } else {
                    refresh?.invalidate();
                    await performPackage(view, this.backend, e);
                    if (view.closed) e.packages = null;
                }
                return null;
            }
            if (effect === 'tasks' && e.taskViewer) {
                await this.readNow(columns, rows, refresh);
                return null;
            }
            if (effect === 'diagnoseFile') {
                const view = e.diagnosis!, generation = view.generation;
                const width = previewWidth(dimensions(columns, rows).preview.innerWidth, e.previewWidth);
                view.busy = true;
                try {
                    const result = await this.backend.request('diagnose_file', diagnosisRequest(e, width));
                    if (e.diagnosis === view && view.generation === generation) receiveDiagnosis(view, result);
                } catch (error) {
                    if (e.diagnosis === view && view.generation === generation) receiveDiagnosisFailure(view, localFailure(error));
                } finally {
                    view.busy = false;
                }
                return null;
            }
            if (effect === 'changes') {await performChanges(e,this.backend);return null;}
            if (effect === 'reuse') {await performReuse(e,this.backend);return null;}
            if (effect === 'sources' || effect === 'profiles') refresh?.invalidate();
            if (effect === 'sources') await performSourceAction(e,this.backend);
            if (effect === 'profiles') await performProfileAction(e, this.backend);
            else if (effect === 'language') {
                const result = await this.backend.request('set_ui_language', { ui_language: state.pendingLanguage });
                state.language = result.ui_language;
                if(this.languageOverride)this.languageOverride=result.ui_language;
                state.pendingLanguage = null;
                state.notice('');
            }
            else if (effect === 'transfer') {
                const action = e.pendingTransfer;
                e.pendingTransfer = null;
                if (action === 'preset') {
                    const result = await this.backend.request('preset', { draft: e.quick?.base ?? e.draft, preset: e.preset });
                    if (e.quick) {
                        receivePreset(e.quick, result.draft);
                        state.notice('');
                    } else {
                        e.replaceDraft(result.draft);
                        state.notice(text('shortcuts.preset-expanded', { key: e.shortcuts.hint(state.shortcutContext, 'save') }));
                    }
                }
                else if (action === 'import') {
                    const draft = copyDraft(e.draft);
                    const result = await this.backend.request('review_import', { draft, path: e.path });
                    if (!hasTransferInput()) return null;
                    e.review = createReview(result, draft);
                    state.input = null;
                    state.notice('');
                }
                else if (action === 'export') {
                    const result = await this.backend.request('export', { draft: copyDraft(e.draft), path: e.path, overwrite: false });
                    if (!hasTransferInput()) return null;
                    state.input = null;
                    state.notice(text('ui.session.exported_current_draft_may_be_unsaved', { value0: result.path }));
                }
            }
            await this.preview(columns, rows);
        }
        catch (error) {
            if (transferInput && !hasTransferInput()) return null;
            state.pendingLanguage = null;
            e.pendingTransfer = null;
            this.failure(error);
            if(this.state.editor.explanation) this.state.editor.explanation.error=this.state.message;
        }
        return null;
    }
    failure(error: unknown): void { this.state.notice(localFailure(error)); }
    async reconcile(): Promise<void> {
        const e = this.state.editor, submitted = e.pendingSave;
        if (e.saveState !== 'unknown' || !submitted) return;
        try {
            this.guard();
            e.setSaveState('pending');
            const current = await this.backend.request('read', submitted.target ? { target: submitted.target } : {});
            this.state.notice(text('editor.' + e.reconcileSave(current)));
        } catch (error) {
            e.setSaveState('unknown');
            const detail = error instanceof BackendError && error.localization ? error.localization
                : error instanceof Error ? error.message : String(error);
            this.state.notice(text('editor.still_unknown', { detail }));
        }
    }
    async save(): Promise<Outcome> {
        const e = this.state.editor;
        this.guard();
        if (!e.acceptNumeric())
            throw new BackendError('invalid_draft', Object.values(e.fieldErrors).join('; '));
        const submitted=e.beginSave();
        let result: ResultFor<'apply'>;
        try {
            result = await this.backend.request('apply', { draft: submitted.draft, expected_revision: submitted.revision,
                ...(submitted.target ? { target: submitted.target } : {}) });
            e.committed(result);
        } catch(error) {
            const code = error instanceof BackendError ? error.code : '';
            e.saveFailed(code);
            if (isSaveConflict(code)) {
                openChanges(e);e.changeReview!.effect='read';await performChanges(e,this.backend);
            }
            throw error;
        }
        const value = outcome(result.changed ? 'updated' : 'already-current', this.state.language);
        if (result.backup_dir)
            value.message += t('ui.session.backup', this.state.language, { backup_dir: result.backup_dir });
        return value;
    }
    async run(options: TerminalOptions = {}, colors?: number): Promise<Outcome> {
        const output = options.output ?? process.stdout;
        let selectedColors = colors ?? 16;
        await this.preview(output.columns || 80, output.rows || 24);
        const refresh = new ForegroundRefresh(
            () => this.refreshTarget(output.columns || 80, output.rows || 24), options.now,
        );
        let result: 'save' | Outcome;
        try {
            result = await terminal<'save' | Outcome>({
                ready: capability => { selectedColors = colors ?? capability.colors; },
                draw: (columns, rows) => ansiFrame(frame(this.state, columns, rows), selectedColors),
                observe: submit => { refresh.bind(submit); refresh.tick(); },
                closing: () => refresh.close(),
                key: async (key, columns, rows) => {
                    const action=await this.key(key,columns,rows,refresh);
                    if(action!=='save') return action;
                    try { return await this.save(); }
                    catch(error) {
                        if(error instanceof EditorRevoked) throw error;
                        this.failure(error);return null;
                    }
                },
                guard: () => {if(!this.state.editor.packageLocked)this.guard();},
                interrupted: signal => outcome('interrupted', this.state.language, ({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129, SIGBREAK: 131 } as Partial<Record<NodeJS.Signals, number>>)[signal] ?? 130, this.state.editor.saveState !== 'idle' ? t('editor.save_unknown', this.state.language, { check: 'Ctrl+K' }) : undefined),
                timeout: () => outcome('timed-out', this.state.language, 0, this.state.editor.saveState !== 'idle' ? t('editor.save_unknown', this.state.language, { check: 'Ctrl+K' }) : undefined),
            }, options);
            if (result !== 'save')
                return result;
            if (options.deadline !== undefined && (options.now ?? (() => performance.now()))() >= options.deadline)
                return outcome('timed-out', this.state.language);
            return await this.save();
        }
        catch (error) {
            if (error instanceof EditorRevoked)
                return outcome('interrupted', this.state.language, 130);
            this.failure(error);
            if(this.state.editor.explanation) this.state.editor.explanation.error=this.state.message;
            return outcome('error', this.state.language, 2, this.state.message);
        } finally { if(this.state.editor.packages)await closePackage(this.state.editor.packages,this.backend); if(!this.state.editor.packageLocked){await closeSources(this.state.editor,this.backend); await closeSourceDraft(this.state.editor,this.backend);} }
    }
}
