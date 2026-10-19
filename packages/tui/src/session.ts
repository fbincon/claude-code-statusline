import { receivePreset } from '@fbincon/statusline-core/editor/quick-setup';
import type { Operation, ResultFor } from '@fbincon/statusline-core/contracts/ui';
import { createReview } from '@fbincon/statusline-core/editor/import-review';
import { text, t, type Language } from '@fbincon/statusline-core/i18n/messages';
import type { Key } from '@fbincon/statusline-core/terminal/key';
import { terminal, type TerminalOptions } from '@fbincon/statusline-platform/terminal/session';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { EditorRevoked } from '@fbincon/statusline-platform/terminal/bridge';
import { State } from './state.js';
import { frame, ansiFrame } from './drawing.js';
import { dimensions } from './layout.js';
export interface Backend {
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
    if (env.NO_COLOR !== undefined || /^(?:dumb|vt100|vt220|xterm-mono)$/u.test(env.TERM ?? ''))
        return 0;
    if (/256color|direct/u.test(env.TERM ?? '') || /truecolor|24bit/u.test(env.COLORTERM ?? ''))
        return 256;
    return env.TERM === 'linux' ? 8 : 16;
}
export class Session {
    private previewKey = '';
    constructor(public readonly state: State, public readonly backend: Backend, public readonly guard: () => void = () => { }) { }
    static async open(backend: Backend, language?: Language, guard?: () => void): Promise<Session> {
        const description = await backend.request('describe'), current = await backend.request('read'), preference = await backend.request('read_ui_preferences');
        if (description.backend_version !== current.backend_version)
            throw new BackendError('backend_version_mismatch', text('native.hooks.register.the_backend_changed_while_opening_reopen_the_editor'));
        if (!current.installed)
            throw new BackendError('not_installed', text('ui.session.status_line_is_not_installed_for_this'));
        const state = new State(description, current, language ?? preference.ui_language);
        if (preference.warning)
            state.notice(preference.warning);
        return new Session(state, backend, guard);
    }
    async preview(columns: number, rows: number): Promise<void> {
        const e = this.state.editor, width = Math.max(2, dimensions(columns, rows).preview.innerWidth), draft = e.quick?.candidate ?? e.review?.result.draft ?? e.draft;
        const key = JSON.stringify([draft, width]);
        if (key === this.previewKey)
            return;
        this.state.preview = await this.backend.request('preview', { draft, width });
        this.previewKey = key;
    }
    async key(key: Key, columns = 80, rows = 24): Promise<'save' | Outcome | null> {
        const state = this.state, e = state.editor;
        const effect = state.key(key, columns, rows);
        if (effect === 'save')
            return 'save';
        if (effect === 'cancel' || effect === 'interrupt')
            return outcome(effect === 'cancel' ? 'cancelled' : 'interrupted', state.language, effect === 'interrupt' ? 130 : 0);
        try {
            this.guard();
            if (effect === 'language') {
                const result = await this.backend.request('set_ui_language', { ui_language: state.pendingLanguage });
                state.language = result.ui_language;
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
                    e.review = createReview(await this.backend.request('review_import', { draft: e.draft, path: e.path }));
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
        }
        return null;
    }
    failure(error: unknown): void { this.state.notice(error instanceof BackendError && error.localization ? error.localization : error instanceof Error ? error.message : String(error)); }
    async save(): Promise<Outcome> {
        const e = this.state.editor;
        this.guard();
        if (!e.acceptNumeric())
            throw new BackendError('invalid_draft', Object.values(e.fieldErrors).join('; '));
        const result = await this.backend.request('apply', { draft: e.draft, expected_revision: e.baseline.revision });
        e.committed(result);
        const value = outcome(result.changed ? 'updated' : 'already-current', this.state.language);
        if (result.backup_dir)
            value.message += t('ui.session.backup', this.state.language, { backup_dir: result.backup_dir });
        return value;
    }
    async run(options: TerminalOptions = {}, colors = colorCapacity()): Promise<Outcome> {
        const output = options.output ?? process.stdout;
        await this.preview(output.columns || 80, output.rows || 24);
        let result: 'save' | Outcome;
        try {
            result = await terminal<'save' | Outcome>({
                draw: (columns, rows) => ansiFrame(frame(this.state, columns, rows), colors),
                key: (key, columns, rows) => this.key(key, columns, rows),
                guard: this.guard,
                interrupted: signal => outcome('interrupted', this.state.language, ({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129, SIGBREAK: 131 } as Partial<Record<NodeJS.Signals, number>>)[signal] ?? 130),
                timeout: () => outcome('timed-out', this.state.language),
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
            return outcome('error', this.state.language, 2, this.state.message);
        }
    }
}
