import type { ExplainResult, Scope } from '../contracts/ui.js';
import { t, type Language } from '../i18n/messages.js';
import type { Editor } from './draft.js';
import { itemDetailBullet, itemDetailSection, wrapItemDetailRows, type ItemDetailBlock, type ItemDetailRow } from './item-detail.js';

export interface ExplanationView {
  scope: Scope;
  id: string;
  scroll: number;
  result: ExplainResult | null;
  error: string;
}

export function openExplanation(scope: Scope, id: string): ExplanationView {
  return { scope, id, scroll: 0, result: null, error: '' };
}

function sampleRowLabel(id: string, language: Language): string {
  if (id === 'main' || id === 'preview-running' || id === 'preview-completed') return t('explain.row.' + id, language);
  const number = Number(/^preview-agent-(\d+)$/u.exec(id)?.[1]) + 1;
  return Number.isSafeInteger(number) ? t('explain.row.preview-agent', language, { number }) : t('explain.row.other', language, { id });
}

export function explanationRows(editor: Editor, language: Language, width: number): ItemDetailRow[] {
  const view = editor.explanation;
  if (!view) return [];
  const tr = (key: string, params: Record<string, unknown> = {}) => t('explain.' + key, language, params);
  const def = editor.definition(view.scope, view.id);
  const rows: ItemDetailBlock[] = [{ kind: 'heading', text: editor.instanceLabel(view.scope, view.id, language) }];
  if (def?.examples.length) {
    rows.push({ kind: 'heading', text: tr('examples') });
    for (const example of def.examples) rows.push({ kind: 'example', text: example, prefix: 'indent' });
  }

  const result = view.result;
  const item = result?.instances.find(instance => instance.id === view.id);
  if (view.error || !result || !item) {
    const status = view.error || (result ? tr('unavailable') : tr('loading'));
    rows.push({ kind: 'body', text: '' }, { kind: view.error || result ? 'error' : 'note', text: status });
    return wrapItemDetailRows(rows, width);
  }

  const configuration = [itemDetailBullet(tr(item.enabled ? 'reason.configured_on' : 'reason.configured_off'))];
  for (const { code, origin } of item.reasons) {
    if (origin === 'configuration' && code !== 'configured_on' && code !== 'configured_off') {
      configuration.push(itemDetailBullet(tr('reason.' + code)));
    }
  }
  rows.push(...itemDetailSection(tr('configuration'), configuration));

  const scenario = result.preview.scenario ?? editor.previewScenario;
  const outcomes: ItemDetailBlock[] = [];
  for (const sample of item.samples) {
    outcomes.push({ kind: 'heading', text: sampleRowLabel(sample.row_id, language) }, itemDetailBullet(tr('reason.' + sample.outcome)));
    if (sample.truncated) outcomes.push(itemDetailBullet(tr('reason.sample_truncated')));
    for (const reason of sample.style_reasons ?? []) {
      const owner = reason.owner_id ? ' (' + reason.owner_id + ')' : '';
      outcomes.push(itemDetailBullet(tr('style.' + reason.code) + owner));
    }
  }
  if (!outcomes.length) {
    const reason = !item.enabled ? 'no_sample'
      : item.reasons.some(({ code }) => code === 'scope_disabled') ? 'no_sample_scope_disabled'
      : view.scope === 'subagent' && (scenario === 'no-agents' || scenario === 'missing') ? 'no_sample_agents'
      : 'no_sample_result';
    outcomes.push({ kind: 'body', text: tr(reason) });
  }
  rows.push(...itemDetailSection(tr('sample_result', { scenario: t('preview.scenario.' + scenario, language), width: result.width }), outcomes));

  const evidence = item.reasons.filter(({ origin }) => origin !== 'configuration').map(({ code }) => itemDetailBullet(tr('reason.' + code)));
  rows.push(...itemDetailSection(tr('requirements'), evidence));
  rows.push({ kind: 'body', text: '' }, { kind: 'note', text: tr('panel_note') }, { kind: 'note', text: `${view.scope}:${view.id}` });
  return wrapItemDetailRows(rows, width);
}
