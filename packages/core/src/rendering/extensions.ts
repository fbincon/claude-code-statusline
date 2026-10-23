import { grouped } from './numeric-format.js';
import type { InstanceDraft, SourceView, FormattingDraft } from '../contracts/ui.js';
import type { RenderEnvironment } from './context.js';
import { safeLink } from '../terminal/links.js';
import { sanitizePayloadText } from './formatters.js';
export function externalPresentation(node: InstanceDraft, view: SourceView | undefined, env: RenderEnvironment, format?: FormattingDraft): {
    text: string;
    target: string | null;
} {
    const value = view ?? { state: 'unbound', reason: 'unbound', freshness: 'unknown', value: null, unit: null, name: '' };
    const tr = (key: string) => env.language.text('source.' + key);
    let label = node.options.label ?? (node.type_id === 'github-pr' ? 'GitHub PR' : node.type_id === 'github-ci' ? 'GitHub CI' : value.name || node.source?.hint || tr('value'));
    label = sanitizePayloadText(label) ?? tr('value');
    let text = value.value === null ? '—' : String(value.value);
    if (typeof value.value === 'number' && format?.number_format === 'grouped')
        text = grouped(text);
    if (typeof value.value === 'number' && format?.number_format === 'compact' && Math.abs(value.value) >= 1000) {
        const divisor = Math.abs(value.value) >= 1000000 ? 1000000 : 1000;
        text = String(Math.round(value.value / divisor * 10) / 10) + (divisor === 1000000 ? 'M' : 'K');
    }
    let target: string | null = null;
    if (view?.fields && view.value !== null) {
        if (node.type_id === 'github-ci')
            text = tr(String(view.fields.ci ?? 'unknown_checks'));
        if (node.type_id === 'github-pr')
            text = typeof view.fields.pr === 'number' ? '#' + view.fields.pr + (view.fields.review ? ' · ' + view.fields.review : '') : tr(view.reason);
        target = safeLink(node.type_id === 'github-ci' ? view.fields.ci_url : view.fields.url);
    }
    const state = value.state === 'valid' ? value.freshness === 'current' ? null : value.freshness : value.state;
    const marker = state ? '! [' + tr(state) + '] ' : '';
    const unit = value.unit ? ' ' + (sanitizePayloadText(value.unit) ?? '') : '';
    // Status is part of the value: hiding labels or overriding an icon cannot conceal it.
    const icon = node.options.icon ?? (format?.icons === 'ascii' ? '>' : format?.icons === 'unicode' ? '◇' : '');
    return { text: marker + (icon ? icon + ' ' : '') + (format?.labels === 'off' && node.options.label === null ? '' : label + ': ') + (sanitizePayloadText(text) ?? '—') + unit, target };
}
export function sampleSource(node: InstanceDraft): SourceView {
    return { source_id: 'sample', name: 'Sample', state: 'valid', reason: 'valid', observed_at: '2026-01-01T00:00:00.000Z', freshness: 'current', value: 42, unit: null,
        ...(node.type_id.startsWith('github-') ? { fields: { pr: 42, ci: 'success', review: 'APPROVED', url: 'https://github.com/example/project/pull/42', ci_url: 'https://github.com/example/project/pull/42/checks' } } : {}) };
}
