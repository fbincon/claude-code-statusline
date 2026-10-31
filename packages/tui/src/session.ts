import { performChanges, changePreview, openChanges } from '@fbincon/statusline-core/editor/change-review';
import { performReuse } from '@fbincon/statusline-core/editor/reuse-manager';
import { performPackage, closePackage } from '@fbincon/statusline-core/editor/package-manager';
import { readTask } from '@fbincon/statusline-core/editor/task-viewer';
import { diagnosisRequest } from '@fbincon/statusline-core/editor/diagnosis-view';
import { colorDraft } from '@fbincon/statusline-core/editor/color-manager';
import { previewWidth } from '@fbincon/statusline-core/editor/preview-settings';
import { performSourceAction, closeSources, closeSourceDraft } from '@fbincon/statusline-core/editor/source-manager';
import { receivePreset } from '@fbincon/statusline-core/editor/quick-setup';
import { performProfileAction } from '@fbincon/statusline-core/editor/profile-manager';
import type { Operation, ResultFor, PackageControl } from '@fbincon/statusline-core/contracts/ui';
import { createReview } from '@fbincon/statusline-core/editor/import-review';
import { text, t, type Language } from '@fbincon/statusline-core/i18n/messages';
import type { Key } from '@fbincon/statusline-core/terminal/key';
import { terminal, type TerminalOptions } from '@fbincon/statusline-platform/terminal/session';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { isSaveConflict } from '@fbincon/statusline-core/editor/draft';
import { EditorRevoked } from '@fbincon/statusline-platform/terminal/bridge';
import { State } from './state.js';
import { frame, ansiFrame } from './drawing.js';
import { dimensions } from './layout.js';
import { colorCapability } from '@fbincon/statusline-platform/terminal/capabilities';
export interface Backend {
    control?<O extends Operation>(control:PackageControl,operation:O,payload?:unknown):ResultFor<O>|Promise<ResultFor<O>>;
    request<O extends Operation>(operation: O, payload?: unknown): ResultFor<O> | Promise<ResultFor<O>>;
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
        if (preference.warning)
            state.notice(preference.warning);
        return new Session(state, backend, guard, languageOverride);
    }
    async preview(columns: number, rows: number): Promise<void> {
        const e = this.state.editor, width = previewWidth(dimensions(columns, rows).preview.innerWidth,e.previewWidth), draft = e.changeReview ? changePreview(e) : e.reuse?.result && !e.reuse.result.blocked.length ? e.reuse.result.draft : e.colors ? colorDraft(e) : e.profiles?.candidate ? { ...e.draft, display: e.profiles.candidate } : e.quick?.candidate ?? e.review?.result.draft ?? e.draft;
        if(e.diagnosis || e.taskViewer || e.packages)return;
        const key = JSON.stringify([draft, width,e.previewScenario]);
        if(e.explanation) {
            const view=e.explanation, identity=JSON.stringify([key,view.scope,view.id]);
            if(identity!==this.explanationKey || !view.result) {
                const result=await this.backend.request('explain',{draft,scope:view.scope,width,scenario:e.previewScenario});
                if(result.scope!==view.scope || result.width!==width) throw new Error('Explanation response does not match the request');
                view.result=result;view.error='';this.state.preview=result.preview;this.explanationKey=identity;
            }
            this.previewKey=key;return;
        }
        if (key === this.previewKey)
            return;
        this.state.preview = await this.backend.request('preview', { draft, width,scenario:e.previewScenario });
        this.previewKey = key;
    }
    async key(key: Key, columns = 80, rows = 24): Promise<'save' | Outcome | null> {
        const state = this.state, e = state.editor;
        const effect = state.key(key, columns, rows);
        if (effect === 'save')
            return 'save';
        if (effect === 'cancel' || effect === 'interrupt')
            return outcome(effect === 'cancel' ? 'cancelled' : 'interrupted', state.language, effect === 'interrupt' ? 130 : 0, e.saveState !== 'idle' ? t('editor.save_unknown',state.language) : undefined);
        try {
            if(!e.packageLocked)this.guard();
            if(effect==='packages' && e.packages){await performPackage(e.packages,this.backend,e);if(e.packages.closed)e.packages=null;return null;}
            if(effect==='tasks' && e.taskViewer){await readTask(e.taskViewer,this.backend,undefined,this.languageOverride);return null;}
            if(effect==='diagnoseFile'){const view=e.diagnosis!,generation=view.generation;view.busy=true;try{const result=await this.backend.request('diagnose_file',diagnosisRequest(e,previewWidth(dimensions(columns,rows).preview.innerWidth,e.previewWidth)));if(e.diagnosis===view&&view.generation===generation){view.result=result;view.error='';view.report=true;view.scroll=0;}}catch(error){if(e.diagnosis===view&&view.generation===generation){this.failure(error);view.error=this.state.message;}}finally{view.busy=false;}return null;}
            if (effect === 'changes') {await performChanges(e,this.backend);return null;}
            if (effect === 'reuse') {await performReuse(e,this.backend);return null;}
            if (effect === 'reconcile') {await this.reconcile();return null;}
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
                if (e.pendingTransfer === 'preset') {
                    const result = await this.backend.request('preset', { draft: e.quick?.base ?? e.draft, preset: e.preset });
                    if (e.quick) receivePreset(e.quick,result.draft); else e.replaceDraft(result.draft);
                    state.notice(text('ui.session.preset_expanded_ctrl_s_saves_esc_discards'));
                }
                else if (e.pendingTransfer === 'import') {
                    e.review = createReview(await this.backend.request('review_import', { draft: e.draft, path: e.path }), e.draft);
                    state.notice('');
                }
                else {
                    const result = await this.backend.request('export', { draft: e.draft, path: e.path, overwrite: false });
                    state.notice(text('ui.session.exported_current_draft_may_be_unsaved', { value0: result.path }));
                }
                e.pendingTransfer = null;
            }
            await this.preview(columns, rows);
        }
        catch (error) {
            state.pendingLanguage = null;
            e.pendingTransfer = null;
            this.failure(error);
            if(this.state.editor.explanation) this.state.editor.explanation.error=this.state.message;
        }
        return null;
    }
    failure(error: unknown): void { this.state.notice(error instanceof BackendError && error.localization ? error.localization : error instanceof Error ? error.message : String(error)); }
    async reconcile(): Promise<void> {
        const e=this.state.editor,submitted=e.pendingSave;
        if(e.saveState!=='unknown'||!submitted)return;
        this.guard();e.setSaveState('pending');
        try {
            const current=await this.backend.request('read',submitted.target?{target:submitted.target}:{});
            this.state.notice(text('editor.'+e.reconcileSave(current)));
        }catch(error) {
            e.setSaveState('unknown');
            this.state.notice(text('editor.still_unknown',{detail:error instanceof Error?error.message:String(error)}));
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
        let result: 'save' | Outcome;
        try {
            result = await terminal<'save' | Outcome>({
                ready: capability => { selectedColors = colors ?? capability.colors; },
                draw: (columns, rows) => ansiFrame(frame(this.state, columns, rows), selectedColors),
                key: async (key, columns, rows) => {
                    const action=await this.key(key,columns,rows);
                    if(action!=='save') return action;
                    try { return await this.save(); }
                    catch(error) {
                        if(error instanceof EditorRevoked) throw error;
                        this.failure(error);return null;
                    }
                },
                guard: () => {if(!this.state.editor.packageLocked)this.guard();},
                interrupted: signal => outcome('interrupted', this.state.language, ({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129, SIGBREAK: 131 } as Partial<Record<NodeJS.Signals, number>>)[signal] ?? 130, this.state.editor.saveState!=='idle'?t('editor.save_unknown',this.state.language):undefined),
                timeout: () => outcome('timed-out', this.state.language,0,this.state.editor.saveState!=='idle'?t('editor.save_unknown',this.state.language):undefined),
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
