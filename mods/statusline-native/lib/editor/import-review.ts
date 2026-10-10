import type { ImportReviewResult, Scope } from '../generated-contracts.ts';
import type { Language } from '../i18n/index.ts';
import { renderMessage, t } from '../i18n/index.ts';
import { wrapText } from '../../ui/text.ts';

export const REVIEW_SECTIONS = ['main','subagent','formatting','layout','language','host'] as const;
export interface ReviewState {
  result: ImportReviewResult;
  selected: string;
  expanded: string[];
  scroll: number;
  previewScope: Scope;
}
export interface ReviewRow { text: string; section: string; heading: boolean }
export function sections(review: ReviewState): string[] {
  return REVIEW_SECTIONS.filter(section => review.result.changes.some(change => change.section === section));
}
export function createReview(result: ImportReviewResult): ReviewState {
  const review: ReviewState = {result, selected:'', expanded:[], scroll:0, previewScope:'main'};
  review.selected = sections(review)[0] ?? '';
  return review;
}
export function reviewRows(review: ReviewState, language: Language, width: number): ReviewRow[] {
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
