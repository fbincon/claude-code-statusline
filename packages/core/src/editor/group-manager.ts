/** Group edits affect the display draft only; Save retains its existing boundary. */
import type { Editor } from './draft.js';
import type { GroupDraft, Scope } from '../contracts/ui.js';
import type { TextKey } from './text-input.js';
import { t, text, renderMessage, type LocalizedText, type Language } from '../i18n/messages.js';
import { AlignmentReferenceError } from './alignments.js';
import { editGroup, groupScope, type GroupEdit } from './groups.js';
import { newInstance } from './instances.js';
import { wrapEditorLine, type EditorLine } from './hints.js';

export interface GroupManager {
  scope: Scope; page: 'list' | 'actions' | 'form'; cursor: number; selected: string | null;
  first: string; last: string; primary: string; linked: boolean; shared: boolean; error: boolean;
  errorMessage?: LocalizedText;
  message?: LocalizedText;
}
export function openGroups(e: Editor): void {
  e.groupManager = { scope: e.detail?.scope ?? (e.page === 'subagents' ? 'subagent' : 'main'), page: 'list', cursor: 0, selected: null,
    first: '', last: '', primary: '', linked: true, shared: false, error: false };
}
const actions = ['edit', 'up', 'down', 'copy', 'ungroup'];
const fields = ['first', 'last', 'primary', 'linked', 'shared', 'apply'];
function form(e: Editor, g?: GroupDraft): void {
  const m = e.groupManager!, target = groupScope(e.draft.display, m.scope), candidates = target.instances.filter(n => n.type_id !== 'spacer');
  const initial = candidates.findIndex(n => n.id === e.selected[m.scope]);
  m.first = g?.member_ids[0] ?? candidates[Math.max(0, initial)]?.id ?? '';
  m.last = g?.member_ids.at(-1) ?? candidates[Math.min(candidates.length - 1, Math.max(0, initial) + 1)]?.id ?? '';
  m.primary = g?.primary_id ?? candidates.find(n => n.id === m.first && n.type_id !== 'text')?.id ?? candidates.find(n => n.id === m.last && n.type_id !== 'text')?.id ?? '';
  m.linked = g?.link_visibility ?? true; m.shared = g?.shared_powerline ?? false;
  m.selected = g?.id ?? null; m.page = 'form'; m.cursor = 0; m.error = false; m.message = undefined;
}
function apply(e: Editor, edit: GroupEdit): void {
  const m = e.groupManager!;
  if (!e.canMutateDraft()) { m.error=true;m.errorMessage=e.compositionError;return; }
  try {
    const display = editGroup(e.draft.display, m.scope, edit, () => newInstance('text', groupScope(e.draft.display, m.scope).instances).id, false);
    const generation = e.mutationGeneration;
    if (!e.applyStructure({ ...e.draft, display })) {
      m.error = true; m.errorMessage = e.compositionError;
      return;
    }
    m.page = 'list'; m.cursor = 0; m.error = false;
    m.message = e.structureProposal ? undefined
      : text(generation === e.mutationGeneration ? 'review.empty' : 'composition.groups.draft_changed');
  } catch (error) { m.error = true; m.errorMessage = error instanceof AlignmentReferenceError ? text('alignment.references', { ids: error.ids.join(', ') }) : undefined; }
}

function groupMove(target: ReturnType<typeof groupScope>, group: GroupDraft, down: boolean): GroupEdit | null {
  const edge = target.instances.findIndex(node => node.id === (down ? group.member_ids.at(-1) : group.member_ids[0]));
  const next = target.instances[edge + (down ? 1 : -1)];
  if (!next) return null;
  const adjacent = target.groups.find(value => value.member_ids.includes(next.id));
  const anchor = adjacent ? (down ? adjacent.member_ids.at(-1)! : adjacent.member_ids[0]!) : next.id;
  return { action: 'move', id: group.id, ...(down ? { after: anchor } : { before: anchor }) };
}

/** Use the active row to choose which group actions to advertise. */
export function groupControls(e: Editor): { enter: string | null; adjust: boolean } {
  const m = e.groupManager!;
  const target = groupScope(e.draft.display, m.scope);
  if (m.page === 'list') {
    return m.cursor === 0 ? { enter: 'composition.groups.switch_scope', adjust: true }
      : { enter: target.groups[m.cursor - 1] ? 'composition.groups.open' : 'composition.groups.create', adjust: false };
  }
  if (m.page === 'actions') {
    const action = actions[m.cursor]!;
    const group = target.groups.find(value => value.id === m.selected);
    const available = !['up', 'down'].includes(action) || group && groupMove(target, group, action === 'down');
    return { enter: available ? 'composition.groups.' + action : null, adjust: false };
  }
  return m.cursor === fields.length - 1 ? { enter: 'composition.groups.apply', adjust: false }
    : { enter: m.cursor >= 3 ? 'ui.hints.toggle' : 'ui.hints.adjust', adjust: true };
}

export function groupsTitle(e: Editor, language: Language): string {
  const m = e.groupManager!;
  const title = t('composition.groups.' + (m.page === 'form' ? (m.selected ? 'edit' : 'create') : 'title'), language);
  const selected = groupScope(e.draft.display, m.scope).groups.find(group => group.id === m.selected);
  return m.page === 'list' ? title
    : title + ' · ' + (selected ? e.instanceLabel(m.scope, selected.primary_id, language) : t('composition.groups.' + m.scope, language));
}

export function groupsKey(e: Editor, event: TextKey): null {
  const m = e.groupManager!;
  if (event.text || event.paste || event.meta || event.overflow) return null;
  const key = event.key === 'return' ? 'enter' : event.key;
  if (key === 'escape' || event.ctrl && key.toLowerCase() === 'g') {
    if (m.page === 'list') e.groupManager = null;
    else { m.page = 'list'; m.cursor = 0; m.error = false; m.message = undefined; }
    return null;
  }
  if (event.ctrl) return null;
  const target = groupScope(e.draft.display, m.scope);
  const length = m.page === 'list' ? target.groups.length + 2 : m.page === 'actions' ? actions.length : fields.length;
  if (key === 'up' || key === 'down' || key === 'tab') m.cursor = Math.max(0, Math.min(length - 1, m.cursor + (key === 'up' ? -1 : 1)));
  if (key === 'home') m.cursor = 0;
  if (key === 'end') m.cursor = length - 1;
  if (m.page === 'list') {
    if (m.cursor === 0 && ['left', 'right', 'enter'].includes(key)) {
      m.scope = m.scope === 'main' ? 'subagent' : 'main'; m.error = false; m.message = undefined;
    }
    else if (key === 'enter') {
      const g = target.groups[m.cursor - 1];
      if (g) { m.selected = g.id; m.page = 'actions'; m.cursor = 0; m.message = undefined; }
      else form(e);
    }
  } else if (m.page === 'actions' && key === 'enter') {
    const g = target.groups.find(g => g.id === m.selected);
    if (!g) return null;
    if (actions[m.cursor] === 'edit') form(e, g);
    else if (actions[m.cursor] === 'copy' || actions[m.cursor] === 'ungroup') apply(e, { action: actions[m.cursor] as 'copy' | 'ungroup', id: g.id });
    else {
      const edit = groupMove(target, g, actions[m.cursor] === 'down');
      if (edit) apply(e, edit);
    }
  } else if (m.page === 'form') {
    if (m.cursor === 5 && key === 'enter') {
      const first = target.instances.findIndex(n => n.id === m.first), last = target.instances.findIndex(n => n.id === m.last);
      apply(e, { action: m.selected ? 'set' : 'create', ...(m.selected ? { id: m.selected } : {}), member_ids: first < 0 || last < first ? [] : target.instances.slice(first, last + 1).map(n => n.id), primary_id: m.primary, link_visibility: m.linked, shared_powerline: m.shared });
    } else if (['left', 'right', 'enter'].includes(key)) {
      if (m.cursor === 3) m.linked = !m.linked;
      else if (m.cursor === 4) m.shared = !m.shared;
      else if (m.cursor < 3) {
        const name = fields[m.cursor] as 'first' | 'last' | 'primary';
        const choices = target.instances.filter(n => n.type_id !== 'spacer' && (name !== 'primary' || n.type_id !== 'text')).map(n => n.id);
        if (choices.length) m[name] = choices[(Math.max(0, choices.indexOf(m[name])) + (key === 'left' ? choices.length - 1 : 1)) % choices.length]!;
      }
      m.error = false;
    }
  }
  return null;
}

export function groupsView(e: Editor, language: Language, width: number, height: number): (EditorLine & { selected?: boolean })[] {
  const m = e.groupManager!, target = groupScope(e.draft.display, m.scope);
  const tr = (key: string) => t('composition.groups.' + key, language);
  const label = (id: string) => e.instance(m.scope, id) ? e.instanceLabel(m.scope, id, language) + ' (' + id + ')' : '—';
  const values = m.page === 'list' ? [t('composition.groups.scope', language, { scope: tr(m.scope) }), ...target.groups.map(g => label(g.primary_id) + ' · ' + g.member_ids.length), tr('create')]
    : m.page === 'actions' ? actions.map(tr)
      : [tr('first') + ': ' + label(m.first), tr('last') + ': ' + label(m.last), tr('primary') + ': ' + label(m.primary),
        tr('linked') + ': ' + t('values.' + (m.linked ? 'on' : 'off'), language), tr('shared') + ': ' + t('values.' + (m.shared ? 'on' : 'off'), language), tr('apply')];
  const status = m.error ? (m.errorMessage ? renderMessage(m.errorMessage, language) : tr('invalid'))
    : m.message ? renderMessage(m.message, language) : m.page === 'list' && !target.groups.length ? tr('empty')
    : !groupControls(e).enter ? tr('move_unavailable') : '';
  const note = status ? wrapEditorLine({ text: status }, width) : [];
  const capacity = Math.max(1, height - Math.min(2, note.length));
  const start = Math.max(0, Math.min(values.length - capacity, m.cursor - capacity + 1));
  const visible = values.slice(start, start + capacity);
  return [...visible.map((text, i) => ({ text: (start + i === m.cursor ? '› ' : '  ') + text, selected: start + i === m.cursor })),
    ...note.slice(0, height - visible.length)];
}
