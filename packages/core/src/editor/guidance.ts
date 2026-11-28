import type { CatalogItem } from '../contracts/ui.js';
import { t, type Language } from '../i18n/messages.js';
import { itemDetailBullet, itemDetailSection, wrapItemDetailRows, type ItemDetailBlock, type ItemDetailRow } from './item-detail.js';

export function guidanceRows(item: CatalogItem, language: Language, width: number): ItemDetailRow[] {
  const guide = item.guidance;
  const tr = (key: string, params: Record<string, unknown> = {}) => t('guidance.' + key, language, params);
  const component = `items.${item.scope}.${item.id}`;
  const rows: ItemDetailBlock[] = [
    { kind: 'heading', text: t(component + '.label', language, {}, item.label) },
    { kind: 'body', text: t(component + '.description', language, {}, item.description) },
  ];
  const configured = item.id === 'text' || item.id === 'spacer';
  const source = item.capabilities?.source;
  const sources = source === 'external' ? [t('sources.json', language), t('sources.command', language)]
    : source === 'github' ? [t('sources.github', language)]
    : guide.source_kinds.map(kind => tr('sources.' + kind));
  const overview: ItemDetailBlock[] = [{ kind: 'body', text: tr('sources', { value: sources.join(', ') }) }];
  if (!configured) overview.push({ kind: 'body', text: tr('scope', { value: tr('scopes.' + guide.measurement_scope) }) });
  rows.push(...itemDetailSection(tr('overview'), overview));

  const conditions: ItemDetailBlock[] = [];
  if (item.scope === 'subagent') {
    conditions.push(itemDetailBullet(tr('requirements.subagent_rows')), itemDetailBullet(t('agent_rows.reason.callback-gap', language)));
  }
  for (const requirement of guide.requirements) {
    if (requirement !== 'subagent_rows' || item.scope !== 'subagent') conditions.push(itemDetailBullet(tr('requirements.' + requirement)));
  }
  if (configured) conditions.push(itemDetailBullet(tr('requirements.' + item.id)));
  if (item.id === 'spacer') {
    const key = item.scope === 'main' ? 'composition.errors.main_spacer' : 'composition.errors.subagent_spacer';
    conditions.push(itemDetailBullet(t(key, language)));
  }
  if (source === 'external' || source === 'github') conditions.push(itemDetailBullet(tr('requirements.source_binding')));
  rows.push(...itemDetailSection(tr('requirements'), conditions));
  rows.push(...itemDetailSection(tr('reasons'), item.unavailable_reasons.map(reason => itemDetailBullet(tr('reasons.' + reason)))));

  if (!configured) {
    rows.push(...itemDetailSection(tr('details'), [
      { kind: 'body', text: tr('fields', { value: item.sources.join(', ') }) },
      { kind: 'body', text: item.minimum_version ? tr('version', { value: item.minimum_version }) : tr('version_unknown') },
    ]));
  }
  const setup: ItemDetailBlock[] = guide.setup.map(text => ({ kind: 'example', text, prefix: 'indent' }));
  if (guide.setup.some(command => /^claude-statusline install(?: |$)/u.test(command))) {
    setup.push({ kind: 'note', text: tr('setup_restart') });
  }
  rows.push(...itemDetailSection(tr('setup'), setup));
  rows.push({ kind: 'body', text: '' }, { kind: 'note', text: tr('static') }, { kind: 'note', text: `${item.scope}:${item.id}` });
  return wrapItemDetailRows(rows, width);
}
