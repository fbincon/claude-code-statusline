import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { clip, dimensions, displayWidth } from '../layout.ts';
import { shortcutRows } from '../components/shortcuts.ts';
import type { Shortcut } from '../components/shortcuts.ts';
import { translatedShortcuts } from '../../lib/i18n/presentation.ts';

const focus: Shortcut = { key: 'Esc', label: 'focus' };

/** Advertise only the controls available in the current editor state. */
export function editorShortcuts(view: View): Shortcut[][] {
  const e = view.editor;
  if (!e) return [[focus]];
  if (e.changeReview?.kind === 'changes' && !e.changeReview.input && !e.changeReview.confirm) {
    return [[{key:'U',label:'undo'}, {key:'R',label:'redo'}, {key:'Q',label:'back'}, focus],
      [{key:'↑↓ PgUp/PgDn',label:'scroll'}]];
  }
  if(e.changeReview||e.reuse)return [[{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓ PgUp/PgDn',label:'scroll'}]];
  if(e.packages)return [[{key:'Enter',label:'select'},{key:'R',label:'reload'},{key:'C',label:'cancel'},{key:'Q',label:'close'},focus],[{key:'↑↓',label:'select'},{key:'PgUp/PgDn',label:'page'},{key:'L',label:'reload'}]];
  if (view.busy) return [[focus]];
  if(e.colors)return [[{key:'Ctrl+S',label:'accept draft'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'Enter',label:'edit'}]];
  if (e.diagnosis) {
    if (e.diagnosis.report) return [[{ key: 'Ctrl+G', label: 'back' }, focus], [{ key: '↑↓ PgUp/PgDn', label: 'scroll' }]];
    return [[{ key: 'Enter', label: 'accept' }, { key: 'Ctrl+G', label: 'back' }, focus],
      e.diagnosis.input ? [{ key: '←→ Home/End', label: 'edit' }, { key: 'Ctrl+U', label: 'clear' }] : [{ key: '↑↓', label: 'select' }]];
  }
  if (view.uncertain) return [[
    { key: 'K', label: 'check saved state', short: 'check' },
    { key: 'Q', label: 'close (blocked)', short: 'blocked' },
    focus,
  ]];
  if (e.groupManager || e.alignmentManager) return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'←→',label:'adjust'}]];
  if (e.sources) return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'Ctrl+S',label:'save'}]];
  if (e.profiles) return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'R',label:'reload'}]];
  if (e.quick) return [[{key:'Enter',label:'accept'},{key:'Backspace',label:'back'},{key:'Ctrl+G',label:'cancel'},focus],[{key:'↑↓',label:'select'},{key:'←→',label:'adjust'},{key:'Tab',label:'preview'},{key:'PgUp/PgDn',label:'scroll'}]];
  if (e.review) return [
    [{key:'A', label:'accept draft', short:'accept'}, {key:'Q', label:'cancel review', short:'cancel'}],
    [{key:'Enter', label:'details'}, {key:'↑↓', label:'section'}],
    [{key:'PgUp/PgDn', label:'scroll'}, {key:'Tab', label:'preview'}], [focus],
  ];
  if (view.input?.kind === 'category') return [[{key: 'Enter', label: 'accept'}, {key: 'Ctrl+G', label: 'cancel'}, focus], [{key: '↑↓', label: 'select'}]];
  if (e.guidanceScroll !== null || e.explanation) return [[{key:'Ctrl+G', label:'back'}, focus], [{key:'↑↓', label:'scroll'}, {key:'PgUp/PgDn', label:'page'}]];
  if (view.input) return [[
    { key: 'Enter', label: 'accept' },
    { key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' },
    { key: 'Ctrl+U', label: 'clear' },
    { key: 'Backspace/Delete', label: 'delete', short: 'del' },
    { key: '←→ Home/End', label: 'edit' },
    focus,
  ]];
  if (e.adding) return [
    [{key:'Enter/Space',label:'add enable'}, {key:'Ctrl+G',label:'back'}, focus],
    [{key:'↑↓',label:'select'}, {key:'/',label:'search'}, {key:'Ctrl+F',label:'category'}, {key:'Ctrl+U',label:'clear'}, {key:'Ctrl+E',label:'details'}],
  ];
  const pending = e.modified || view.preferences.some(preferenceChanged);
  const actions: Shortcut[] = [
    { key: 'S', label: 'save' },
    { key: 'F', label: 'finish' },
    { key: 'Q', label: pending ? 'discard' : 'close' },
    { key: 'V', label: 'preview' },
    focus,
  ];
  const contextual: Shortcut[] = [{ key: 'Tab', label: 'page' }];
  if(!e.detail) contextual.push({key:'Ctrl+P',label:'quick setup'});
  if (!e.detail && (e.page === 'main' || e.page === 'subagents')) {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    if (e.filtered(scope)) contextual.unshift({key:'Ctrl+G',label:'clear filters',short:'clear'});
    if (e.category[scope] !== 'all') contextual.unshift({key:'A',label:'catalog'});
    contextual.push(
      { key: 'A/D/X', label: 'add/copy/remove', short:'add/copy/remove' },
      { key: 'Enter/Space', label: 'toggle' },
      { key: '↑↓', label: 'select' },
      ...(e.filtered(scope) ? [] : [{ key: '←→', label: 'order' }]),
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
  return [actions, contextual,[{key:'Ctrl+/',label:'undo'},{key:'Ctrl+R',label:'redo'},{key:'Ctrl+T',label:'changes'},{key:'Ctrl+V/W/N',label:'preview'}]];
}

/** Share footer and viewport budgets between drawing and keyboard paging. */
export function editorLayout(view: View, columns: number, rows: number) {
  let groups = translatedShortcuts(editorShortcuts(view), view.language);
  if (view.editor?.adding) {
    const activation = groups[0]?.find(hint => hint.key === 'Enter/Space');
    if (activation) activation.short = clip(activation.label, columns - displayWidth(activation.key) - 1);
  }
  const framed = columns >= 64 && rows >= 20;
  // Keep the header, section edges, filter/selection and one preview row.
  const limit = Math.max(1, rows - (framed ? 10 : 8));
  let footer = shortcutRows(groups, columns);
  if (footer.length > limit) footer = shortcutRows(groups, columns, true);
  const optional = ['Ctrl+V/W/N','Ctrl+/','Ctrl+R','Ctrl+T','V', 'R', 'Esc', '↑↓', '←→', '/', '←→ Home/End', 'Ctrl+U'];
  if (view.editor?.adding) optional.push('Ctrl+E', 'Ctrl+F');
  for (const key of optional) {
    if (footer.length <= limit) break;
    groups = groups.map((group) => group.filter((hint) => hint.key !== key));
    footer = shortcutRows(groups, columns, true);
  }
  // Translated action labels can remain longer than the available footer even
  // after optional hints are removed. Keep the keys and their group order while
  // shortening only labels, so content and a real preview row retain their space.
  for (let cells = 8; footer.length > limit && cells >= 1; cells--) {
    const bounded = groups.map(group => group.map(hint => ({
      key: hint.key, label: clip(hint.short ?? hint.label, cells),
    })));
    footer = shortcutRows(bounded, columns);
  }
  return { ...dimensions(columns, rows, footer.length), footer };
}
