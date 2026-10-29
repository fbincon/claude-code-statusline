import type { DiagnoseResult, Scope } from '../contracts/ui.js';
import type { Editor } from './draft.js';
import { copyDraft } from './draft.js';
import { inputKey, inputView, textInput, type TextInput, type TextKey } from './text-input.js';
import { t, type Language } from '../i18n/messages.js';
import { wrapText } from './text.js';
import { targetLabel } from './profile-manager.js';
export interface DiagnosisView {
    path: string;
    scope: Scope;
    observedAt: string;
    includeLocal: boolean;
    cursor: number;
    input: TextInput | null;
    result: DiagnoseResult | null;
    error: string;
    scroll: number;
    busy: boolean;
    report: boolean;
    generation: number;
}
export function openDiagnosis(e: Editor): void { e.diagnosis = { path: '', scope: e.detail?.scope ?? (e.page === 'subagents' ? 'subagent' : 'main'), observedAt: '', includeLocal: false, cursor: 0, input: null, result: null, error: '', scroll: 0, busy: false, report: false, generation: 0 }; }
export function diagnosisRequest(e: Editor, width: number) { const v = e.diagnosis!; return { draft: copyDraft(e.draft), path: v.path, scope: v.scope, width, observed_at: v.observedAt || null, include_local: v.includeLocal }; }
export function diagnosisKey(e: Editor, event: TextKey): 'diagnoseFile' | null {
    const v = e.diagnosis!, key = event.key, cancel = key === 'escape' || event.ctrl && key.toLowerCase() === 'g';
    if (v.input) {
        if (cancel) {
            v.input = null;
            return null;
        }
        if (key === 'return' && !event.text && !event.paste) {
            v.generation++;
            if (v.cursor === 0)
                v.path = v.input.value;
            else
                v.observedAt = v.input.value;
            v.input = null;
            v.error = '';
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
    if (v.report) {
        if (key === 'up' || key === 'pageup')
            v.scroll = Math.max(0, v.scroll - (key === 'up' ? 1 : 8));
        if (key === 'down' || key === 'pagedown')
            v.scroll += key === 'down' ? 1 : 8;
        if (key === 'home')
            v.scroll = 0;
        if (key === 'end')
            v.scroll = 1000000;
        return null;
    }
    if (event.ctrl)
        return null;
    if (['up', 'down', 'tab'].includes(key))
        v.cursor = Math.max(0, Math.min(6, v.cursor + (key === 'up' ? -1 : 1)));
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
        }
        if (v.cursor === 3) {
            v.generation++;
            v.includeLocal = !v.includeLocal;
        }
        if (v.cursor === 4 && !v.busy) {
            v.generation++;
            return 'diagnoseFile';
        }
        if (v.cursor === 5 && v.result)
            v.report = true;
        if (v.cursor === 6)
            e.diagnosis = null;
    }
    return null;
}
export function diagnosisLines(e: Editor, language: Language, width: number): string[] {
    const v = e.diagnosis!, r = v.result, tr = (key: string, params: Record<string, unknown> = {}) => t('diagnose.' + key, language, params);
    if (!v.report || !r)
        return wrapText([t('diagnosis.target', language, { target: targetLabel(e, language) }),
            ...[t('diagnosis.path', language) + ': ' + v.path, t('diagnosis.scope', language) + ': ' + v.scope, t('diagnosis.time', language) + ': ' + (v.observedAt || tr('unknown')), t('diagnosis.local', language) + ': ' + t('values.' + (v.includeLocal ? 'on' : 'off'), language), t(v.busy ? 'diagnosis.busy' : 'diagnosis.run', language), t('diagnosis.previous', language), t('colors.cancel', language)].map((line, i) => (i === v.cursor ? '› ' : '  ') + line),
            ...(v.input ? [inputView(v.input, width)] : []), v.error, t('diagnosis.help', language)], width);
    const lines = [t('diagnosis.title', language), t('diagnosis.target', language, { target: targetLabel(e, language) }), tr('source', { value: r.source }), tr('times', { input: r.observed_at ?? tr('unknown'), now: r.diagnosed_at }), t(r.include_local ? 'diagnosis.with_local' : 'diagnosis.input_only', language), tr('identity', { session: r.session_id ?? tr('unknown'), prompt: r.prompt_id ?? tr('unknown') }), tr('output', { width: r.width }), ...r.output.map(row => row.spans.map(s => s.text).join(''))];
    for (const item of r.instances) {
        lines.push('', e.instanceLabel(r.scope, item.id, language) + ' (' + item.id + ')');
        for (const reason of item.reasons)
            lines.push(t('explain.reason.' + reason.code, language));
        for (const evidence of item.evidence) {
            lines.push(tr('evidence', { source: evidence.source, scope: evidence.scope, status: tr('status.' + evidence.status), time: evidence.observed_at ?? tr('unknown'), freshness: tr('freshness.' + evidence.freshness) }));
            for (const field of evidence.fields)
                lines.push(field.path + ': ' + tr('status.' + field.status));
        }
        for (const row of item.rows) {
            lines.push(row.row_id + ': ' + tr('layout.' + row.outcome) + (row.truncated ? ' · ' + tr('layout.truncated') : ''));
            for (const reason of row.style_reasons ?? [])
                lines.push(t('explain.style.' + reason.code, language) + (reason.owner_id ? ' (' + reason.owner_id + ')' : ''));
        }
    }
    lines.push('', tr('limits'));
    return wrapText(lines, width);
}
