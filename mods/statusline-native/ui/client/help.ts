import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { dimensions } from '../layout.ts';
import { shortcutRows } from '../components/shortcuts.ts';
import type { Shortcut } from '../components/shortcuts.ts';
import { translatedShortcuts } from '../../lib/i18n/presentation.ts';

const focus: Shortcut = { key: 'Esc', label: 'focus' };

/** Advertise only the controls available in the current editor state. */
export function editorShortcuts(view: View): Shortcut[][] {
  const e = view.editor;
  if (!e) return [[focus]];
  if(e.changeReview||e.reuse)return [[{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓ PgUp/PgDn',label:'scroll'}]];
  if(e.packages)return [[{key:'Enter',label:'select'},{key:'R',label:'reload'},{key:'C',label:'cancel'},{key:'Q',label:'close'},focus],[{key:'↑↓',label:'select'},{key:'PgUp/PgDn',label:'page'},{key:'L',label:'reload'}]];
  if (view.busy) return [[focus]];
  if(e.colors)return [[{key:'Ctrl+S',label:'accept draft'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'Enter',label:'edit'}]];
  if(e.diagnosis)return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'PgUp/PgDn',label:'scroll'}]];
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
  if(e.adding)return [[{key:'Enter',label:'add'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'/',label:'search'},{key:'Ctrl+F',label:'category'},{key:'Ctrl+E',label:'details'}]];
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
    contextual.push(
      { key: 'A/D/X', label: 'add/copy/remove', short:'add/copy/remove' },
      { key: 'Space', label: 'toggle' },
      { key: '↑↓', label: 'select' },
      ...(e.filtered(e.page === 'main' ? 'main' : 'subagent') ? [] : [{ key: '←→', label: 'order' }]),
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
  return [actions, contextual,[{key:'Ctrl+_/R',label:'undo / redo'},{key:'Ctrl+T',label:'changes'},{key:'Ctrl+V/W/N',label:'preview'}]];
}

/** Share footer and viewport budgets between drawing and keyboard paging. */
export function editorLayout(view: View, columns: number, rows: number) {
  let groups = translatedShortcuts(editorShortcuts(view), view.language);
  const framed = columns >= 64 && rows >= 20;
  // Keep the header, section edges, filter/selection and one preview row.
  const limit = Math.max(1, rows - (framed ? 10 : 8));
  let footer = shortcutRows(groups, columns);
  if (footer.length > limit) footer = shortcutRows(groups, columns, true);
  for (const key of ['Ctrl+_/R','Ctrl+T','Ctrl+V/W/N','V', 'R', 'Esc', '↑↓', '←→', '/', '←→ Home/End', 'Ctrl+U']) {
    if (footer.length <= limit) break;
    groups = groups.map((group) => group.filter((hint) => hint.key !== key));
    footer = shortcutRows(groups, columns, true);
  }
  return { ...dimensions(columns, rows, footer.length), footer };
}
