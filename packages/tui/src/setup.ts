import { previewWidth, type PreviewScenario } from '@fbincon/statusline-core/editor/preview-settings';
import type { Draft, PreviewResult } from '@fbincon/statusline-core/contracts/ui';
import { SetupState, type SetupEffect, type SetupViewport } from '@fbincon/statusline-core/editor/setup';
import { quickAction, quickAdjusts, quickView } from '@fbincon/statusline-core/editor/quick-setup';
import { wrapText } from '@fbincon/statusline-core/editor/text';
import { t, renderMessage, type Language } from '@fbincon/statusline-core/i18n/messages';
import { terminal, type TerminalOptions } from '@fbincon/statusline-platform/terminal/session';
import { colorCapacity } from './session.js';
import { Canvas, ansiFrame, paintLine, safe } from './drawing/canvas.js';
import { paint } from './theme.js';
import { shortcuts, type Hint } from './drawing/shortcuts.js';

export interface SetupAdapter {
    preset(draft: Draft, id: string): Draft;
    preview(draft: Draft, width: number,scenario?:PreviewScenario): PreviewResult;
    review(draft: Draft, language: Language): string[];
    language(language: Language): void;
}
function setupPage(state: SetupState, adapter: SetupAdapter, columns: number, rows: number) {
    const tr = (key: string) => t('setup.' + key, state.language);
    const draft = state.quick?.candidate ?? state.candidate;
    const previewRows = draft && state.phase !== 'checks' ? Math.max(2, Math.min(6, Math.floor((rows - 10) / 4))) : 0;
    const bottom = rows - 3 - previewRows - Number(previewRows > 0);
    const width = columns - 2, height = bottom - 3;
    const menu = state.choices.map(tr), action = state.choices[state.selected];
    const checks = (select?: 'ok' | 'issues') => state.facts.checks.filter(check => !select || (check.level === 'OK') === (select === 'ok'))
        .map(check => '[' + check.level + '] ' + renderMessage(check.message, state.language));
    const notes = state.facts.notes.map(note => renderMessage(note, state.language));
    let detail: string[] = [];
    if (state.phase === 'checks') {
        detail = state.facts.canSave ? [...checks(), ...notes] : [tr('blocked'), ...checks('issues'), ...notes, ...checks('ok')];
    } else if (state.phase === 'review') {
        const effects = action === 'integrate' ? [tr('review_note'), ...state.facts.resources.map(path => tr('resource') + ': ' + path)]
            : action === 'save' ? [tr('review_save_only')] : [];
        detail = [...(!state.facts.canIntegrate ? [tr('integration_blocked'), ...checks('issues')] : []), ...notes.slice(0, 1), ...effects, ...notes.slice(1),
            ...adapter.review(state.candidate!, state.language)];
    }
    const lines = wrapText(detail.map(safe), width), detailCapacity = Math.max(0, height - menu.length);
    const viewport: SetupViewport = { language: state.language, width, height, detailCount: lines.length, detailCapacity };
    return { draft, previewRows, bottom, viewport, menu, lines };
}

export function setupFrame(state: SetupState, adapter: SetupAdapter, columns: number, rows: number, colors = colorCapacity()): string {
    const canvas = new Canvas(columns, rows), tr = (key: string) => t('setup.' + key, state.language);
    canvas.line(0, tr('title'), true);
    if (columns < 64 || rows < 18) {
        canvas.line(2, tr('small'));
        canvas.line(rows - 1, 'Esc ' + tr('cancel'));
        return ansiFrame(canvas.frame(), colors);
    }
    const quick = state.phase === 'quick' ? state.quick : null;
    canvas.line(1, tr(state.phase) + (quick ? ' · ' + t('quick.' + quick.step, state.language) : ''), true);
    const { draft, previewRows, bottom, viewport, menu, lines } = setupPage(state, adapter, columns, rows);
    const { width, height, detailCapacity } = viewport;
    if (quick) {
        quickView(quick, state.language, width, height).forEach((row, index) => canvas.put(index + 3, 1, paintLine(row, width, row.selected)));
    } else {
        menu.forEach((text, index) => canvas.line(3 + index, (state.selected === index ? '> ' : '  ') + text, false, state.selected === index, 1));
        const offset = Math.min(state.scroll, Math.max(0, lines.length - detailCapacity));
        lines.slice(offset, offset + detailCapacity).forEach((line, i) => canvas.line(3 + menu.length + i, line, false, false, 1));
    }
    if (previewRows && draft) {
        const columns = previewWidth(width, state.previewWidth);
        const preview = adapter.preview(draft, columns, state.previewScenario);
        const allRows = quick ? preview[quick.previewScope === 'subagent' ? 'subagents' : 'main'] : [...preview.main, ...preview.subagents];
        const sample = allRows.slice(state.previewOffset % Math.max(1, allRows.length), state.previewOffset % Math.max(1, allRows.length) + previewRows);
        canvas.line(bottom, tr('sample') + ' · ' + t('preview.scenario.' + state.previewScenario, state.language) + ' · ' + columns + 'c', true);
        sample.forEach((row, index) => canvas.put(bottom + 1 + index, 1, row.map(span => ({ ...paint(span.text), ...span })), width));
    }
    if (state.message) canvas.line(rows - 3, renderMessage(state.message, state.language));
    const hint = (key: string, label: string): Hint => [key, t(label, state.language)];
    const action = quick ? t(quickAction(quick), state.language) : menu[state.selected]!;
    const controls: Hint[] = [
        ...(quick || menu.length > 1 ? [hint('↑↓', 'ui.hints.select')] : []),
        ...(quick && quickAdjusts(quick) ? [hint('←→', 'ui.hints.adjust')] : []),
        ...(quick ? [hint('Tab', 'ui.hints.preview')] : []),
        ...(quick || lines.length > detailCapacity ? [hint('PgUp/PgDn', 'ui.hints.scroll')] : []),
        hint('L', 'setup.change_language'),
        ...(previewRows ? [hint('Ctrl+V/W/N', 'preview.controls')] : []),
    ];
    canvas.put(rows - 2, 0, shortcuts([
        ['Enter', action], ['Esc', tr('cancel')],
        ...(state.phase !== 'checks' ? [hint('Backspace', 'ui.hints.back')] : []),
    ], columns));
    canvas.put(rows - 1, 0, shortcuts(controls, columns));
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
            const viewport = key === 'pageup' || key === 'pagedown' ? setupPage(state, adapter, columns, rows).viewport : undefined;
            const oldLanguage = state.language, result = state.key(key, viewport);
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
