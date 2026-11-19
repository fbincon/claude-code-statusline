import type { CatalogItem } from '../../lib/generated-contracts.ts';
import type { Language } from '../../lib/i18n/index.ts';
import { t } from '../../lib/i18n/index.ts';
import { matchText, normalize, segments, snippet } from '../../lib/editor/search.ts';
import type { Match } from '../../lib/editor/search.ts';
import type { ComponentMarker } from '../../lib/editor/instances.ts';
import { clip, displayWidth } from '../layout.ts';
import type { TextSpan } from './shortcuts.ts';

export function itemSpans(item: CatalogItem & {type_id?:string;custom_label?:string|null;ordinal?:number}, match: Match, query: string, language: Language, width: number, selected: boolean, marker: ComponentMarker, typeCount = 0): TextSpan[] {
  const label = (item.custom_label || t(`items.${item.scope}.${item.type_id ?? item.id}.label`, language)) + (item.ordinal ? ` (${item.ordinal})` : "");
  const labelMatch = matchText(label, query);
  const hint = normalize(query).characters.length > 0 && (!labelMatch || labelMatch.rank > match.rank);
  if (hint) match = snippet(match);
  const suffix = typeCount > 1 ? ` (${typeCount})` : '';
  const labelWidth = hint ? Math.max(4, Math.floor((width - 6) / (width < 48 ? 3 : 2))) : width - 6;
  const shown = clip(label, Math.max(1, labelWidth - displayWidth(suffix))) + suffix;
  const points = [...shown];
  const positions = labelMatch?.positions.filter(i => points[i] === [...label][i]) ?? [];
  const styled = (text: string, positions: number[]) => segments(text, positions).map(span => ({text: span.text, style: {bold: span.highlighted}}));
  return [
    {text: `${selected ? '›' : ' '} [${marker}] `},
    ...styled(shown, positions),
    ...(hint ? [{text: ' · ' + (width < 48 ? '' : t('catalog.search.match', language))}, ...styled(match.text, match.positions)] : []),
  ];
}
