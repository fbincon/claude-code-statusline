import type { Draft, ImportReviewResult, Scope } from '../contracts/ui.js';
import { IMPORT_FIELDS, selectImport, type ImportField } from './import-selection.js';
import { differences } from './import-differences.js';
import type { Language } from '../i18n/messages.js';
import { renderMessage, t } from '../i18n/messages.js';
import { wrapText } from './text.js';

export const REVIEW_SECTIONS = ['main','subagent','formatting','layout','language','host'] as const;
export interface ReviewState {
  result: ImportReviewResult;
  selected: string;
  expanded: string[];
  scroll: number;
  previewScope: Scope;
  base?: Draft;
  incoming?: ImportReviewResult;
  choosing?: boolean;
  selection?: ImportField[];
  cursor?: number;
}
export interface ReviewRow { text: string; section: string; heading: boolean }
export function sections(review: ReviewState): string[] {
  return REVIEW_SECTIONS.filter(section => review.result.changes.some(change => change.section === section));
}
export function createReview(result: ImportReviewResult, base?: Draft): ReviewState {
  const review: ReviewState = {result, selected:'', expanded:[], scroll:0, previewScope:'main'};
  if (base) Object.assign(review, { base: JSON.parse(JSON.stringify(base)), incoming: result, selection: [], cursor: 0 });
  review.selected = sections(review)[0] ?? '';
  return review;
}
export function reviewRows(review: ReviewState, language: Language, width: number): ReviewRow[] {
  if (review.choosing) return IMPORT_FIELDS.map((key, index) => ({ heading: true, section: key,
    text: `${review.cursor === index ? '› ' : '  '}[${review.selection?.includes(key) ? 'x' : ' '}] ${selectionLabel(key, language)}` }));
  const rows: ReviewRow[] = [];
  for (const section of sections(review)) {
    const changes = review.result.changes.filter(change => change.section === section);
    rows.push({section, heading:true, text:`${review.selected === section ? '› ' : '  '}${review.expanded.includes(section) ? '[-]' : '[+]'} ${t('review.sections.' + section, language)} (${changes.length})`});
    if (review.expanded.includes(section)) for (const change of changes) {
      const paragraphs = [renderMessage(change.label, language),
        t('review.before', language, {value:JSON.stringify(change.before)}),
        t('review.after', language, {value:JSON.stringify(change.after)})];
      rows.push(...wrapText(paragraphs, width).map(text => ({text, section, heading:false})));
    }
  }
  return rows.length ? rows : [{text:t('review.empty', language),section:'',heading:false}];
}
export function navigateReview(review: ReviewState, key: string, language: Language, width: number, capacity: number): void {
  if (review.base && review.incoming && key.toLowerCase() === 's') {
    review.choosing = true; review.scroll = 0; review.cursor = 0; review.selected = IMPORT_FIELDS[0];
    updateSelection(review); return;
  }
  if (review.base && review.incoming && key.toLowerCase() === 'f') {
    review.choosing = false; review.result = review.incoming; review.selected = sections(review)[0] ?? ''; review.scroll = 0; return;
  }
  if (review.choosing) {
    let cursor = review.cursor ?? 0;
    if (key === 'up') cursor--;
    if (key === 'down') cursor++;
    if (key === 'home') cursor = 0;
    if (key === 'end') cursor = IMPORT_FIELDS.length - 1;
    if (key === 'pageup') cursor -= capacity;
    if (key === 'pagedown') cursor += capacity;
    review.cursor = Math.max(0, Math.min(IMPORT_FIELDS.length - 1, cursor));
    review.selected = IMPORT_FIELDS[review.cursor]!;
    if (key === 'space' || key === ' ') {
      const field = IMPORT_FIELDS[review.cursor]!, values = review.selection ?? [];
      review.selection = values.includes(field) ? values.filter(v => v !== field) : [...values, field]; updateSelection(review);
    }
    if (key === 'return' || key === 'enter') { review.choosing = false; review.selected = sections(review)[0] ?? ''; review.scroll = 0; }
    else review.scroll = Math.max(0, Math.min(review.scroll, review.cursor));
    if (review.choosing && review.cursor >= review.scroll + capacity) review.scroll = review.cursor - capacity + 1;
    return;
  }
  const groups = sections(review);
  let follow = false;
  if (key === 'up' || key === 'down') {
    review.selected = groups[Math.max(0, Math.min(groups.length - 1, groups.indexOf(review.selected) + (key === 'up' ? -1 : 1)))] ?? '';
    follow = true;
  } else if (key === 'return' && review.selected) {
    review.expanded = review.expanded.includes(review.selected) ? review.expanded.filter(group => group !== review.selected) : [...review.expanded, review.selected];
    follow = true;
  } else if (key === 'tab') review.previewScope = review.previewScope === 'main' ? 'subagent' : 'main';
  else if (key === 'pageup') review.scroll -= capacity;
  else if (key === 'pagedown') review.scroll += capacity;
  else if (key === 'home') review.scroll = 0;
  else if (key === 'end') review.scroll = Number.MAX_SAFE_INTEGER;
  const rows = reviewRows(review, language, width);
  if (follow) review.scroll = Math.max(0, rows.findIndex(row => row.heading && row.section === review.selected));
  review.scroll = Math.max(0, Math.min(Math.max(0, rows.length - capacity), review.scroll));
}

function updateSelection(review: ReviewState): void {
  const draft = selectImport(review.base!, review.incoming!.draft, review.selection ?? []);
  review.result = { draft, changes: differences(review.base!, draft) };
}
function selectionLabel(key: ImportField, language: Language): string {
  if (key === 'main' || key === 'subagent') return t('review.selection.' + key, language);
  if (key === 'formatting.thresholds') return t('review.selection.thresholds', language);
  const message = ['use_colors','palette','directory_style','separator_style','scope_labels'].includes(key) ? 'review.fields.' + key : 'fields.global.' + key + '.label';
  return t(message, language);
}
