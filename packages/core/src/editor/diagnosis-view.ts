import type { DiagnoseResult, Scope } from '../contracts/ui.js';
import type { Editor } from './draft.js';
import { copyDraft } from './draft.js';
import { inputKey, prefixedInputView, textInput, type TextInput, type TextKey } from './text-input.js';
import { renderMessage, t, text, type Language, type LocalizedText } from '../i18n/messages.js';
import { clip, displayWidth } from '../unicode/index.js';
import { targetLabel } from './profile-manager.js';
import type { EditorLine } from './hints.js';
import { itemDetailBullet, itemDetailSection, itemDetailWindow, wrapItemDetailRows, type ItemDetailBlock, type ItemDetailRow } from './item-detail.js';

export interface DiagnosisView {
    path: string;
    scope: Scope;
    observedAt: string;
    includeLocal: boolean;
    cursor: number;
    input: TextInput | null;
    result: DiagnoseResult | null;
    error: LocalizedText | string | null;
    scroll: number;
    outputScroll: number;
    reportFocus: 'details' | 'output';
    busy: boolean;
    report: boolean;
    generation: number;
}

export function openDiagnosis(e: Editor): void {
    e.diagnosis = { path: '', scope: e.detail?.scope ?? (e.page === 'subagents' ? 'subagent' : 'main'),
        observedAt: '', includeLocal: false, cursor: 0, input: null, result: null, error: null, scroll: 0,
        outputScroll: 0, reportFocus: 'details', busy: false, report: false, generation: 0 };
}

export function receiveDiagnosis(view: DiagnosisView, result: DiagnoseResult): void {
    view.result = result;
    view.error = null;
    view.report = true;
    view.scroll = 0;
    view.outputScroll = 0;
    view.reportFocus = 'details';
}

export function receiveDiagnosisFailure(view: DiagnosisView, message: LocalizedText | string): void {
    view.error = message;
    if (typeof message === 'string') return;
    switch (message.key) {
        case 'diagnose.error.path':
        case 'diagnose.error.file':
        case 'diagnose.error.read':
        case 'diagnose.error.json':
        case 'diagnose.error.input':
            view.cursor = 0;
            break;
        case 'diagnose.error.scope':
            view.cursor = 1;
            break;
        case 'diagnose.error.time':
            view.cursor = 2;
            break;
    }
}

const formActions = ['edit', 'adjust', 'edit', 'toggle', 'read file', 'previous report', 'back'] as const;
export function diagnosisControls(view: DiagnosisView) {
    if (view.report) return {
        enter: null,
        tab: (view.result?.output.length ?? 0) > 1 ? view.reportFocus === 'details' ? 'report output' : 'report details' : null,
    } as const;
    return { enter: view.input ? 'accept' : view.cursor === 4 && view.busy ? null : formActions[view.cursor], tab: null };
}

export function diagnosisRequest(e: Editor, width: number) { const v = e.diagnosis!; return { draft: copyDraft(e.draft), path: v.path, scope: v.scope, width, observed_at: v.observedAt || null, include_local: v.includeLocal }; }
export function diagnosisKey(e: Editor, event: TextKey, language: Language = 'en', width = 80, capacity = 8, outputCapacity = 2): 'diagnoseFile' | null {
    const v = e.diagnosis!, key = event.key;
    const cancel = !event.text && !event.paste && !event.meta && (key === 'escape' || event.ctrl && key.toLowerCase() === 'g');
    if (v.input) {
        if (cancel) {
            v.input = null;
            return null;
        }
        if (key === 'return' && !event.text && !event.paste && !event.ctrl && !event.meta) {
            v.generation++;
            if (v.cursor === 0)
                v.path = v.input.value;
            else
                v.observedAt = v.input.value;
            v.input = null;
            v.error = null;
        }
        else
            v.input = inputKey(v.input.value, v.input, event, v.cursor === 0 ? 4096 : 128).state;
        return null;
    }
    if (event.text || event.paste || event.meta)
        return null;
    if (cancel) {
        if (v.report) {
            v.report = false;
            v.generation++;
        }
        else
            e.diagnosis = null;
        return null;
    }
    if (v.report && v.result) {
        if (event.ctrl) return null;
        if (key === 'tab' && diagnosisControls(v).tab) {
            v.reportFocus = v.reportFocus === 'details' ? 'output' : 'details';
        } else if (['up', 'down', 'pageup', 'pagedown', 'home', 'end'].includes(key)) {
            if (v.reportFocus === 'output')
                v.outputScroll = itemDetailWindow(v.result.output, v.outputScroll, outputCapacity, key).start;
            else v.scroll = itemDetailWindow(reportLines(e, language, width), v.scroll, capacity, key).start;
        }
        return null;
    }
    if (event.ctrl)
        return null;
    if (['up', 'down', 'tab'].includes(key)) {
        v.cursor = Math.max(0, Math.min(6, v.cursor + (key === 'up' ? -1 : 1)));
        if (v.cursor === 5 && !v.result) v.cursor = key === 'up' ? 4 : 6;
    }
    if (key === 'home')
        v.cursor = 0;
    if (key === 'end')
        v.cursor = 6;
    if (['return', 'left', 'right'].includes(key)) {
        if (v.cursor === 0 || v.cursor === 2) {
            v.generation++;
            v.input = textInput(v.cursor === 0 ? v.path : v.observedAt);
        }
        if (v.cursor === 1) {
            v.generation++;
            v.scope = v.scope === 'main' ? 'subagent' : 'main';
            v.error = null;
        }
        if (v.cursor === 3) {
            v.generation++;
            v.includeLocal = !v.includeLocal;
            v.error = null;
        }
        if (key !== 'return') return null;
        if (v.cursor === 4 && !v.busy) {
            if (!v.path.trim()) {
                v.cursor = 0;
                v.error = text('diagnosis.path_required');
                return null;
            }
            v.error = null;
            v.generation++;
            return 'diagnoseFile';
        }
        if (v.cursor === 5 && v.result) {
            v.generation++;
            v.report = true;
        }
        if (v.cursor === 6)
            e.diagnosis = null;
    }
    return null;
}
function reportLines(e: Editor, language: Language, width: number): ItemDetailRow[] {
    const r = e.diagnosis!.result!;
    const tr = (key: string, params: Record<string, unknown> = {}) => t('diagnose.' + key, language, params);
    const lines: ItemDetailBlock[] = [
        { kind: 'heading', text: r.output.length ? t('diagnosis.visible_rows', language, { rows: r.output.length, width: r.width }) : t('diagnosis.no_output', language) },
        { kind: 'body', text: t(r.include_local ? 'diagnosis.with_local' : 'diagnosis.input_only', language) },
        { kind: 'body', text: tr('source', { value: r.source }) },
        { kind: 'body', text: t('diagnosis.target', language, { target: targetLabel(e, language) }) },
        { kind: 'body', text: t('diagnosis.scope', language) + ' · ' + t('review.sections.' + r.scope, language) },
        { kind: 'body', text: tr('times', { input: r.observed_at ?? tr('unknown'), now: r.diagnosed_at }) },
        { kind: 'body', text: tr('identity', { session: r.session_id ?? tr('unknown'), prompt: r.prompt_id ?? tr('unknown') }) },
    ];
    for (const item of r.instances) {
        const component: ItemDetailBlock[] = [];
        for (const row of item.rows) {
            component.push(itemDetailBullet(row.row_id + ': ' + tr('layout.' + row.outcome) + (row.truncated ? ' · ' + tr('layout.truncated') : '')));
            for (const reason of row.style_reasons ?? [])
                component.push(itemDetailBullet(t('explain.style.' + reason.code, language) + (reason.owner_id ? ' (' + reason.owner_id + ')' : '')));
        }
        for (const { code } of item.reasons)
            component.push(itemDetailBullet(t(code === 'host_supported' ? 'diagnosis.host_supported' : 'explain.reason.' + code, language)));
        for (const evidence of item.evidence) {
            component.push(itemDetailBullet(tr('evidence', { source: evidence.source, scope: evidence.scope,
                status: tr('status.' + evidence.status), time: evidence.observed_at ?? tr('unknown'), freshness: tr('freshness.' + evidence.freshness) })));
            for (const field of evidence.fields)
                component.push({ kind: 'body', prefix: 'indent', text: field.path + ': ' + tr('status.' + field.status) });
        }
        lines.push(...itemDetailSection(e.instanceLabel(r.scope, item.id, language) + ' (' + item.id + ')', component));
    }
    lines.push({ kind: 'body', text: '' }, { kind: 'note', text: tr('limits') });
    return wrapItemDetailRows(lines, width);
}

export function diagnosisOutput(view: DiagnosisView | null, language: Language, titleWidth: number, capacity: number) {
    if (!view?.report || !view.result) return null;
    const { output } = view.result;
    const window = itemDetailWindow(output, view.outputScroll, capacity);
    const active = view.reportFocus === 'output' ? '› ' : '';
    const range = output.length > capacity ? ' ' + window.summary : '';
    const title = t('diagnosis.output', language);
    const label = displayWidth(active + title + range) <= titleWidth ? title : t('diagnosis.output_short', language);
    return { title: active + label + range, rows: window.rows.map(row => row.spans), empty: t('diagnosis.no_output', language) };
}

type DiagnosisLine = EditorLine & { kind?: ItemDetailRow['kind'] };

export function diagnosisPage(e: Editor, language: Language, width: number, capacity: number): { lines: readonly DiagnosisLine[]; summary: EditorLine } {
    const v = e.diagnosis!;
    const count = Math.max(1, capacity);
    if (v.report && v.result) {
        const window = itemDetailWindow(reportLines(e, language, width), v.scroll, count);
        const focus = v.reportFocus === 'details' ? '› ' : '';
        return { lines: window.rows, summary: { text: focus + t('diagnosis.details', language) + ' ' + window.summary } };
    }

    const fields = [
        [t('diagnosis.path', language), v.path],
        [t('diagnosis.scope', language), t('review.sections.' + v.scope, language)],
        [t('diagnosis.time', language), v.observedAt || t('diagnose.unknown', language)],
        [t('diagnosis.local', language), t(v.includeLocal ? 'values.on' : 'values.off', language)],
        [t(v.busy ? 'diagnosis.busy' : 'diagnosis.run', language)],
        [t('diagnosis.previous', language)],
        [t('colors.cancel', language)],
    ] as const;
    const lines: DiagnosisLine[] = [{ text: clip(t('diagnosis.target', language, { target: targetLabel(e, language) }), width) }];
    let selected = 0;
    for (const [index, [label, value]] of fields.entries()) {
        if (index === 5 && !v.result) continue;
        if (index === v.cursor) selected = lines.length;
        if (index === v.cursor && v.input) {
            const prefix = '› ' + clip(label, Math.floor(width / 2)) + ' ';
            lines.push(prefixedInputView(prefix, { ...v.input }, width));
        } else {
            const content = value === undefined ? label : label + ': ' + value;
            lines.push({ text: clip((index === v.cursor ? '› ' : '  ') + content, width) });
        }
    }
    const error = v.error ? wrapItemDetailRows([{ kind: 'error', text: renderMessage(v.error, language) }], width) : [];
    const visibleError = error.slice(0, count - 1);
    const available = count - visibleError.length;
    const start = Math.max(0, selected + 1 - available);
    return { lines: [...visibleError, ...lines.slice(start, start + available)],
        summary: { text: !visibleError.length && error.length ? error[0]!.text : t('diagnosis.read_only', language) } };
}
