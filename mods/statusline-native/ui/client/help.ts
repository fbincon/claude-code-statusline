import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { dimensions } from '../layout.ts';
import { shortcutRows } from '../components/shortcuts.ts';
import type { Shortcut } from '../components/shortcuts.ts';

const focus: Shortcut = { key: 'Esc', label: 'focus' };

/** Advertise only the controls available in the current editor state. */
export function editorShortcuts(view: View): Shortcut[][] {
  const e = view.editor;
  if (!e) return [[focus]];
  if (view.busy) return [[focus]];
  if (view.uncertain) return [[
    { key: 'K', label: 'check saved state', short: 'check' },
    { key: 'Q', label: 'close (blocked)', short: 'blocked' },
    focus,
  ]];
  if (view.input) return [[
    { key: 'Enter', label: 'accept' },
    { key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' },
    { key: 'Ctrl+U', label: 'clear' },
    { key: 'Backspace', label: 'delete', short: 'del' },
    focus,
  ]];
  const pending = e.modified || view.preferences.some(preferenceChanged);
  const actions: Shortcut[] = [
    { key: 'S', label: 'save' },
    { key: 'F', label: 'finish' },
    { key: 'Q', label: pending ? 'discard' : 'close' },
    { key: 'V', label: 'preview' },
    focus,
  ];
  const contextual: Shortcut[] = [{ key: 'Tab', label: 'page' }];
  if (!e.detail && (e.page === 'main' || e.page === 'subagents')) {
    contextual.push(
      { key: 'Space', label: 'toggle' },
      { key: '↑↓', label: 'select' },
      { key: '←→', label: 'order' },
      { key: 'Ctrl+E', label: 'format' },
      { key: '/', label: 'search' },
    );
  } else {
    contextual.push(
      { key: '↑↓', label: 'select' },
      { key: '←→', label: 'adjust' },
      { key: 'Enter', label: 'edit' },
    );
    if (e.detail) contextual.push({ key: 'Ctrl+G', label: 'back' });
    else if (e.page === 'settings') {
      contextual.push({ key: 'H', label: (e.advanced ? 'hide' : 'show') + ' preferences', short: (e.advanced ? 'hide' : 'show') + ' prefs' });
      if (e.advanced) contextual.push({ key: 'A', label: 'apply separately', short: 'apply' });
      contextual.push({ key: 'R', label: 'reload' });
    }
  }
  if (view.error && e.page !== 'settings') actions.splice(actions.length - 1, 0, { key: 'R', label: 'reload' });
  return [actions, contextual];
}

/** Share footer and viewport budgets between drawing and keyboard paging. */
export function editorLayout(view: View, columns: number, rows: number) {
  let groups = editorShortcuts(view);
  const framed = columns >= 64 && rows >= 20;
  // Keep the header, section edges, filter/selection and one preview row.
  const limit = Math.max(1, rows - (framed ? 10 : 8));
  let footer = shortcutRows(groups, columns);
  if (footer.length > limit) footer = shortcutRows(groups, columns, true);
  for (const key of ['V', 'R', 'Esc']) {
    if (footer.length <= limit) break;
    groups = groups.map((group) => group.filter((hint) => hint.key !== key));
    footer = shortcutRows(groups, columns, true);
  }
  return { ...dimensions(columns, rows, footer.length), footer };
}
