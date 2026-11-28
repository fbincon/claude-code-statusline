import { EDITOR_FIELDS, type Draft, type ImportChange, type ImportReviewResult, type Scope } from '../contracts/ui.js';
import type { Editor } from './draft.js';
import { IMPORT_FIELDS, selectImport, type ImportField } from './import-selection.js';
import { differences } from './import-differences.js';
import type { Language } from '../i18n/messages.js';
import { LANGUAGE_NAMES, renderMessage, t, text, type LocalizedText } from '../i18n/messages.js';
import { wrapText } from './text.js';
import { resolveShortcut, type ShortcutAction, type ShortcutContext } from './shortcut-map.js';
import type { EditorShortcuts } from './shortcut-settings.js';
import { hintLine, type EditorLine } from './hints.js';

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
  selective?: boolean;
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

const choiceFields = new Set(['mode', 'palette', 'directory_style', 'separator_style', 'scope_labels', 'refresh_interval',
  ...[...EDITOR_FIELDS.global, ...EDITOR_FIELDS.item].filter(field => field.kind === 'choice').map(field => field.key.split('.').at(-1)!)]);
const safeValue = (value: string) => value.replace(/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/gu, ' ');

/** Describe editor values without exposing their storage representation. */
export function formatReviewValue(change: ImportChange, value: unknown, language: Language, draft: Draft): string {
  const tr = (key: string, params?: Record<string, unknown>) => t(key, language, params);
  const field = change.path.at(-1)!;
  const scope = change.scope ?? (change.section === 'subagent' ? 'subagent' : 'main');
  const nodes = scope === 'main' ? draft.display.instances : draft.display.subagents.instances;
  const component = (type: string) => t('items.' + scope + '.' + type + '.label', language, {}, type);
  const namedId = (id: unknown): string => {
    const node = nodes.find(row => row.id === id);
    return node ? `${safeValue(node.options.label || component(node.type_id))} (${node.id})` : safeValue(String(id));
  };
  const describe = (entry: unknown, key: string): string => {
    const labelOrIcon = key === 'label' || key === 'icon';
    if (entry == null) {
      if (labelOrIcon) return tr('item-decoration.use-preset');
      if (key === 'foreground' || key === 'background') return tr('colors.inherit');
      if (key.endsWith('_gradient')) return tr('colors.off');
      return tr('review.value.unset');
    }
    if (typeof entry === 'boolean') return tr('values.' + (entry ? 'on' : 'off'));
    if (typeof entry === 'number') return String(entry);
    if (typeof entry === 'string') {
      if (!entry) return tr(labelOrIcon ? 'values.hidden' : 'review.value.empty_text');
      if (key === 'statusline_language' && Object.hasOwn(LANGUAGE_NAMES, entry)) return LANGUAGE_NAMES[entry as Language];
      if (key === 'type_id') return component(entry);
      if (key === 'kind' && ['instance', 'group'].includes(entry)) return tr('review.value.kind.' + entry);
      if (choiceFields.has(key)) return t('values.' + entry, language, {}, safeValue(entry));
      return labelOrIcon || key === 'text' ? '“' + safeValue(entry) + '”' : safeValue(entry);
    }
    if (Array.isArray(entry)) {
      if (!entry.length) return tr('review.value.none');
      if (key === 'rows') return entry.map((row, index) => tr('review.value.row', {
        number: index + 1, items: Array.isArray(row) ? row.map(namedId).join(', ') : namedId(row),
      })).join(' · ');
      const label = key === 'member_ids' || change.kind === 'reorder' ? namedId : (item: unknown) => describe(item, '');
      return entry.map(label).join(', ');
    }
    if (typeof entry !== 'object') return safeValue(String(entry));
    const object = entry as Record<string, unknown>;
    if (typeof object.type_id === 'string') return [
      component(object.type_id) + ' (' + safeValue(String(object.id)) + ')',
      tr('review.value.' + (object.enabled ? 'enabled' : 'disabled')),
      ...(typeof object.text === 'string' ? [describe(object.text, 'text')] : []),
    ].join(' · ');
    const entries = Object.entries(object);
    return entries.length ? entries.map(([name, next]) => {
      const label = t('review.value.' + name, language, {}, safeValue(name.replaceAll('_', ' ')));
      return label + ' ' + (name === 'primary_id' ? namedId(next) : describe(next, name));
    }).join(' · ') : tr('review.value.none');
  };
  return value == null && (change.kind === 'add' || change.kind === 'remove') ? tr('review.value.absent') : describe(value, field);
}

export function canAcceptImport(review: ReviewState): boolean {
  return !review.choosing && review.result.changes.length > 0;
}

export function acceptImport(e: Editor): LocalizedText | null {
  const review = e.review!;
  if (!canAcceptImport(review)) return null;
  return e.replaceDraft(review.result.draft) ? text('review.accepted') : e.compositionError;
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
        t('review.before', language, { value: formatReviewValue(change, change.before, language, review.base ?? review.result.draft) }),
        t('review.after', language, { value: formatReviewValue(change, change.after, language, review.result.draft) })];
      rows.push(...wrapText(paragraphs, width).map(text => ({text, section, heading:false})));
    }
  }
  const empty = review.selective && !review.selection?.length ? 'review.empty_selection' : 'review.empty';
  return rows.length ? rows : wrapText([t(empty, language)], width).map(text => ({ text, section: '', heading: false }));
}
export const reviewShortcutContext = (review: ReviewState): ShortcutContext => review.choosing ? 'import-selection' : 'import-review';

export function importShortcutHelp(review: ReviewState, keys: EditorShortcuts, language: Language): EditorLine {
  if (!review.base) return { text: t('review.intro', language) };
  const full = keys.hint('import-review', 'full-import');
  if (review.choosing) return hintLine('shortcuts.import-selection-help', language, { space: 'Space', enter: 'Enter', full });
  const select = keys.hint('import-review', 'select-import');
  if (!canAcceptImport(review)) return hintLine('shortcuts.import-empty-help', language, { select, full });
  return hintLine('shortcuts.import-help', language, { select, full, accept: keys.hint('import-review', 'accept-import') });
}

export function navigateReview(review: ReviewState, key: string, language: Language, width: number, capacity: number,
  action: ShortcutAction | null = resolveShortcut('native', reviewShortcutContext(review), { key }, {})): void {
  if (review.base && review.incoming && action === 'select-import') {
    review.choosing = true; review.selective = true; review.scroll = 0; review.cursor = 0; review.selected = IMPORT_FIELDS[0];
    updateSelection(review); return;
  }
  if (review.base && review.incoming && action === 'full-import') {
    review.choosing = false; review.selective = false; review.result = review.incoming; review.selected = sections(review)[0] ?? ''; review.scroll = 0; return;
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
