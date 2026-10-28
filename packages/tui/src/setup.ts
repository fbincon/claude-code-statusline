import { previewWidth, type PreviewScenario } from '@fbincon/statusline-core/editor/preview-settings';
import type { Draft, PreviewResult } from '@fbincon/statusline-core/contracts/ui';
import { SetupState, type SetupEffect } from '@fbincon/statusline-core/editor/setup';
import { quickView } from '@fbincon/statusline-core/editor/quick-setup';
import { wrapText } from '@fbincon/statusline-core/editor/text';
import { t, renderMessage, type Language } from '@fbincon/statusline-core/i18n/messages';
import { terminal, type TerminalOptions } from '@fbincon/statusline-platform/terminal/session';
import { colorCapacity } from './session.js';
import { Canvas, ansiFrame, safe } from './drawing/canvas.js';
import { paint } from './theme.js';

export interface SetupAdapter {
    preset(draft: Draft, id: string): Draft;
    preview(draft: Draft, width: number,scenario?:PreviewScenario): PreviewResult;
    review(draft: Draft, language: Language): string[];
    language(language: Language): void;
}
export function setupFrame(state: SetupState, adapter: SetupAdapter, columns: number, rows: number, colors = colorCapacity()): string {
    const canvas = new Canvas(columns, rows), tr = (key: string) => t('setup.' + key, state.language);
    canvas.line(0, tr('title'), true);
    if (columns < 64 || rows < 18) { canvas.line(2, tr('small')); canvas.line(rows - 1, tr('cancel')); return ansiFrame(canvas.frame(), colors); }
    canvas.line(1, tr(state.phase), true);
    const draft = state.quick?.candidate ?? state.candidate;
    const preview = draft && state.phase !== 'checks' ? adapter.preview(draft,previewWidth(columns-2,state.previewWidth),state.previewScenario) : null;
    const allRows = preview ? (state.phase === 'quick' ? preview[state.quick!.previewScope === 'subagent' ? 'subagents' : 'main'] : [...preview.main, ...preview.subagents]) : [];
    const previewRows=allRows.slice(state.previewOffset%Math.max(1,allRows.length)).slice(0,Math.max(2,Math.min(6,Math.floor(rows/4))));
    const bottom = rows - 3 - previewRows.length - Number(preview !== null), height = bottom - 3;
    if (state.phase === 'quick') {
        quickView(state.quick!, state.language, columns - 2, height).forEach((row, index) => canvas.line(index + 3, row.text, false, row.selected, 1));
    } else {
        const menu = state.phase === 'checks' ? [tr(state.facts.canSave ? 'continue' : 'blocked')]
            : state.phase === 'choice' ? [tr('keep'), tr('choose')]
            : [tr(state.facts.canIntegrate ? 'integrate' : 'integration_blocked'), tr('save'), tr('cancel')];
        menu.forEach((text, index) => canvas.line(3 + index, (state.selected === index ? '> ' : '  ') + text, false, state.selected === index, 1));
        const messages = state.phase === 'checks' ? state.facts.checks.map(check => '[' + check.level + '] ' + renderMessage(check.message, state.language))
            : state.phase === 'review' ? [tr('review_note'), ...adapter.review(state.candidate!, state.language),
                ...state.facts.resources.map(path => tr('resource') + ': ' + path)] : [];
        messages.push(...state.facts.notes.map(note => renderMessage(note, state.language)));
        const lines = wrapText(messages.map(safe), columns - 2), capacity = Math.max(1, height - menu.length - 1);
        const offset = Math.min(state.scroll, Math.max(0, lines.length - capacity));
        lines.slice(offset, offset + capacity).forEach((line, i) => canvas.line(4 + menu.length + i, line, false, false, 1));
    }
    if (preview) {
        canvas.line(bottom,tr('sample')+' · '+t('preview.scenario.'+state.previewScenario,state.language)+' · '+previewWidth(columns-2,state.previewWidth)+'c',true);
        previewRows.forEach((row, index) => canvas.put(bottom + 1 + index, 1, row.map(span => ({ ...paint(span.text), ...span })), columns - 2));
    }
    if (state.message) canvas.line(rows - 2, renderMessage(state.message, state.language));
    canvas.line(rows-1,'Ctrl+V/W/N '+t('preview.controls',state.language)+' · '+tr('keys'));
    return ansiFrame(canvas.frame(), colors);
}
export async function runSetup(state: SetupState, adapter: SetupAdapter, options: TerminalOptions = {}): Promise<SetupEffect> {
    let colors = 16;
    return terminal<SetupEffect>({
        ready: capability => { colors = capability.colors; },
        draw: (columns, rows) => setupFrame(state, adapter, columns, rows, colors),
        key: (event, columns, rows) => {
            if (event.paste || event.text || event.meta) return null;
            const key = event.ctrl&&['v','w','n'].includes(event.key)?({'v':'preview-scenario','w':'preview-width','n':'preview-next'}[event.key]!) : event.ctrl && event.key === 'c' ? 'interrupt' : event.ctrl && event.key === 'g' ? 'cancel' : event.ctrl ? '' : event.key;
            if ((columns < 64 || rows < 18) && !['escape','cancel','interrupt'].includes(key)) return null;
            const oldLanguage = state.language, result = state.key(key);
            if (result === 'language') {
                try { adapter.language(state.language); state.message = null; }
                catch { state.language = oldLanguage; state.message = { key: 'setup.language_failed', params: {}, fallback: t('setup.language_failed', oldLanguage) }; }
            } else if (result === 'preset') state.receive(adapter.preset(state.quick!.base, state.quick!.preset));
            else return result;
            return null;
        },
        interrupted: () => 'interrupt', timeout: () => 'interrupt',
    }, options);
}
