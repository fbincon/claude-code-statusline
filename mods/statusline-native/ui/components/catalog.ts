import type { CatalogItem } from '../../lib/generated-contracts.ts';
import type { Language } from '../../lib/i18n/index.ts';
import { t } from '../../lib/i18n/index.ts';
import { matchText, normalize, segments, snippet } from '../../lib/editor/search.ts';
import type { Match } from '../../lib/editor/search.ts';
import { clip } from '../layout.ts';
import type { TextSpan } from './shortcuts.ts';

export function itemSpans(item: CatalogItem, match: Match, query: string, language: Language, width: number, selected: boolean, enabled: boolean): TextSpan[] {
  const label = t(`items.${item.scope}.${item.id}.label`, language);
  const labelMatch = matchText(label, query);
  const hint = normalize(query).characters.length > 0 && (!labelMatch || labelMatch.rank > match.rank);
  if (hint) match = snippet(match);
  const shown = hint ? clip(label, Math.max(4, Math.floor((width - 6) / (width < 48 ? 3 : 2)))) : label;
  const points = [...shown];
  const positions = labelMatch?.positions.filter(i => points[i] === [...label][i]) ?? [];
  const styled = (text: string, positions: number[]) => segments(text, positions).map(span => ({text: span.text, style: {bold: span.highlighted}}));
  return [
    {text: `${selected ? '›' : ' '} [${enabled ? 'x' : ' '}] `},
    ...styled(shown, positions),
    ...(hint ? [{text: ' · ' + (width < 48 ? '' : t('catalog.search.match', language))}, ...styled(match.text, match.positions)] : []),
  ];
}
