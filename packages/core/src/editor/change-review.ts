/** Shared review/recovery UI. File effects are injected by each editor host. */
import type { Editor } from './draft.js';
import type { Draft, Operation, ReadResult, ResultFor } from '../contracts/ui.js';
import { text, t, renderMessage, type Language, type LocalizedText } from '../i18n/messages.js';
import { createReview, navigateReview, reviewRows, type ReviewState } from './import-review.js';
import { differences } from './import-differences.js';
import { clone, semantic } from './history.js';
import { inputKey, inputView, textInput, type TextInput, type TextKey } from './text-input.js';
import { wrapText } from './text.js';
import { hintLine, wrapEditorLine, type EditorLine } from './hints.js';

export interface ChangeReview {
  kind: 'changes' | 'structure'; generation: number; target: string; comparison: number;
  review: ReviewState; current: ReadResult | null; external: ReviewState | null; replacement: ReviewState | null;
  confirm: boolean; input: TextInput | null; message: LocalizedText | null;
  effect: 'read' | 'export' | 'reload' | null;
}
export function targetIdentity(current: ReadResult): string {
  return semantic([current.configuration?.target ?? { kind: 'user' }, current.configuration?.profile_id ?? null, current.installation, current.backend_version, current.installed]);
}
export function openChanges(e: Editor, structure = false): void {
  const candidate = structure ? e.structureProposal!.draft : e.draft;
  e.changeReview = { kind: structure ? 'structure' : 'changes', generation: e.mutationGeneration, target: targetIdentity(e.baseline), comparison: 0,
    review: createReview({ draft: clone(candidate), changes: differences(structure ? e.draft : e.baseline.draft, candidate) }),
    current: null, external: null, replacement: null, confirm: false, input: null, message: null, effect: null };
}
function active(m: ChangeReview): ReviewState { return m.comparison === 1 ? m.external ?? m.review : m.comparison === 2 ? m.replacement ?? m.review : m.review; }
export function changePreview(e: Editor): Draft { return e.changeReview ? active(e.changeReview).result.draft : e.draft; }
export function stepDraftHistory(e: Editor, redo: boolean): LocalizedText {
  return e.undo(redo)
    ? text('history.counts', { undo: e.history.undo.length, redo: e.history.redo.length })
    : e.compositionError;
}
export function changesKey(e: Editor, event: TextKey, language: Language, width: number, height: number): 'changes' | null {
  const m = e.changeReview!, key = event.key === 'enter' ? 'return' : event.key;
  if (event.overflow) return null;
  if (!event.text && !event.paste && (key === 'escape' || event.ctrl && key.toLowerCase() === 'g')) {
    if (m.input) m.input = null; else if (m.confirm) m.confirm = false; else { e.changeReview = null; e.structureProposal = null; }
    return null;
  }
  if (m.input) {
    if (key === 'return' && !event.text && !event.paste) { if (m.input.value.trim()) { m.effect = 'export'; return 'changes'; } }
    else m.input = inputKey(m.input.value, m.input, event, 4096).state;
    return null;
  }
  if (event.text || event.paste || event.meta) return null;
  if (m.confirm) {
    if (!event.ctrl && key === 'return' && e.canMutateDraft()) { m.effect = 'reload'; return 'changes'; }
    return null;
  }
  const action = e.shortcuts.action(m.kind === 'changes' ? 'history' : 'repair', event);
  if (action === 'close-history') { e.changeReview = null; e.structureProposal = null; return null; }
  if (action === 'accept-repair') {
    if (!e.acceptProposal()) m.message = text('history.stale');
    return null;
  }
  if (m.kind === 'changes') {
    if (action === 'undo' || action === 'redo') {
      if (e.undo(action === 'redo')) openChanges(e);
      else m.message = e.compositionError;
      return null;
    }
    if (action === 'compare-saved') { m.effect = 'read'; return 'changes'; }
    if (action === 'export-draft') { m.input = textInput('statusline-draft.json'); return null; }
    if (action === 'discard-to-saved') {
      if (!e.canMutateDraft()) m.message = e.compositionError;
      else m.confirm = true;
      return null;
    }
    if (!event.ctrl && key.toLowerCase() === 'k') {
      if (m.current && e.adoptRevision(m.current, m.generation, m.target)) { e.changeReview = null; e.compositionError = text('history.retry_ready'); }
      else m.message = text('history.retry_blocked');
      return null;
    }
    if (!event.ctrl && key === 'tab' && m.current) { m.comparison = (m.comparison + 1) % 3; return null; }
  }
  if (!event.ctrl) navigateReview(active(m), key, language, width, Math.max(1, height - 3), null);
  return null;
}
export function changesView(e: Editor, language: Language, width: number, height: number): (EditorLine & { selected?: boolean })[] {
  const m = e.changeReview!, title = t(m.kind === 'structure' ? 'history.structure' : 'history.title', language);
  const back = e.shortcuts.surface === 'native' ? 'Ctrl+G' : 'Esc/Ctrl+G';
  if (m.input) return [
    ...wrapText([title, t('history.export_path', language)], width).map(text => ({ text })),
    inputView({ ...m.input }, width),
    ...wrapEditorLine(hintLine('history.input_help', language, { enter: 'Enter', back }), width),
  ].slice(0, height);
  if (m.confirm) return [
    { text: title }, ...wrapEditorLine(hintLine('history.confirm_discard', language, { enter: 'Enter', back }), width),
  ].slice(0, height);
  const view = active(m), rows = reviewRows(view, language, width), capacity = Math.max(1, height - 3);
  const scroll = Math.max(0, Math.min(view.scroll, rows.length - capacity));
  const summary = m.kind === 'structure' ? t('history.repairs', language, { ids: e.structureProposal?.repairs.map(r => r.id).join(', ') ?? '' })
    : t('history.counts', language, { undo: e.history.undo.length, redo: e.history.redo.length }) + ' · ' + t('history.comparison.' + m.comparison, language);
  const keys = e.shortcuts;
  const help = m.kind === 'structure'
    ? hintLine('history.structure_help', language, { accept: keys.hint('repair', 'accept-repair'), enter: 'Enter', close: keys.hint('repair', 'close-history') })
    : hintLine('history.help', language, { undo: keys.hint('history', 'undo'), redo: keys.hint('history', 'redo'), compare: keys.hint('history', 'compare-saved'),
      ...(m.current ? { tab: 'Tab', retry: 'K' } : {}),
      export: keys.hint('history', 'export-draft'), reload: keys.hint('history', 'discard-to-saved'), close: keys.hint('history', 'close-history') },
      { tab: 'Tab', retry: 'K' });
  return [{ text: title }, { text: wrapText([m.message ? renderMessage(m.message, language) : summary], width)[0] ?? '' },
    ...rows.slice(scroll, scroll + capacity).map(row => ({ text: row.text, selected: row.heading && row.section === view.selected })),
    { ...help, text: help.text + (e.history.trimmed ? ' · ' + t('history.trimmed', language) : '') }].slice(0, height);
}
export interface ReviewBackend { request<O extends Operation>(operation: O, payload?: unknown): Promise<ResultFor<O>> | ResultFor<O> }
export async function performChanges(e: Editor, backend: ReviewBackend): Promise<void> {
  const m = e.changeReview, effect = m?.effect;
  if (!m || !effect) return;
  m.effect = null;
  try {
    const permitted = () => e.changeReview === m && m.generation === e.mutationGeneration && m.target === targetIdentity(e.baseline);
    if (!permitted()) throw new Error('history.stale');
    if (effect === 'export') {
      await backend.request('export', { draft: clone(e.draft), path: m.input!.value, overwrite: false });
      if (permitted()) { m.input = null; m.message = text('history.exported'); }
      return;
    }
    const current = await backend.request('read', e.baseline.configuration ? { target: e.baseline.configuration.target } : {});
    if (!permitted()) throw new Error('history.stale');
    if (effect === 'reload') {
      if (!e.canMutateDraft()) throw new Error('editor.save_locked');
      e.committed(current); e.changeReview = null; return;
    }
    m.current = clone(current); m.external = createReview({ draft: clone(current.draft), changes: differences(e.baseline.draft, current.draft) });
    m.replacement = createReview({ draft: clone(e.draft), changes: differences(current.draft, e.draft) });
    m.comparison = 1; m.message = null;
  } catch (error) { if (e.changeReview === m) m.message = text('history.failed', { detail: error instanceof Error ? error.message : String(error) }); }
}
