import type { CatalogItem } from '../generated-contracts.ts';
import type { Language } from '../i18n/index.ts';
import { t } from '../i18n/index.ts';
import { wrapText } from '../../ui/text.ts';

export function guidanceLines(item: CatalogItem, language: Language, width: number): string[] {
  const guide = item.guidance;
  const tr = (key: string, params: Record<string, unknown> = {}) => t('guidance.' + key, language, params);
  return wrapText([
    t(`items.${item.scope}.${item.id}.label`, language) + ` (${item.scope}:${item.id})`,
    tr('static'), '', tr('scope', {value:tr('scopes.' + guide.measurement_scope)}),
    tr('sources', {value: guide.source_kinds.map(source => tr('sources.' + source)).join(', ')}),
    tr('fields', {value: item.sources.join(', ')}),
    item.minimum_version ? tr('version', {value:item.minimum_version}) : tr('version_unknown'),
    '', tr('requirements'), ...guide.requirements.map(requirement => tr('requirements.' + requirement)),
    '', tr('reasons'), ...item.unavailable_reasons.map(reason => tr('reasons.' + reason)),
    '', tr('setup'), ...guide.setup,
  ], width);
}
