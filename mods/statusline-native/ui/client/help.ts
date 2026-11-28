import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { clip, dimensions, displayWidth } from '../layout.ts';
import { shortcutRows } from '../components/shortcuts.ts';
import type { Shortcut } from '../components/shortcuts.ts';
import { translatedShortcuts } from '../../lib/i18n/presentation.ts';

import { shortcutContext } from '../../lib/client/settings.ts';
import { reviewShortcutContext } from '../../lib/editor/import-review.ts';
import { itemDecorationKind } from '../../lib/editor/forms.ts';

const focus: Shortcut = { key: 'Esc', label: 'focus', optional: 6 };

/** Advertise only the controls available in the current editor state. */
export function editorShortcuts(view: View): Shortcut[][] {
  const e = view.editor;
  if (!e) return [[focus]];
  const keys = e.shortcuts;
  if (e.changeReview?.kind === 'changes' && !e.changeReview.input && !e.changeReview.confirm) {
    return [[{key: keys.hint('history', 'undo'), label:'undo'}, {key: keys.hint('history', 'redo'), label:'redo'},
      {key: keys.hint('history', 'close-history'), label:'back'}, focus], [{key:'↑↓ PgUp/PgDn',label:'scroll'}]];
  }
  if (e.changeReview || e.reuse) return [[{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓ PgUp/PgDn',label:'scroll'}]];
  if (e.packages) {
    if (e.packages.input) return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus]];
    return [[{key:'Enter',label:'select'},{key: keys.hint('packages', 'refresh-package'),label:'reload'},
        ...(e.packages.job && !e.packages.execution ? [{key: keys.hint('packages', 'cancel-package-review'),label:'cancel'}] : []),
        {key: keys.hint('packages', 'close-packages'),label:'close'},focus],
      [{key:'↑↓',label:'select'},{key:'PgUp/PgDn',label:'page'},{key: keys.hint('packages', 'reload-packages'),label:'reload'}]];
  }
  if (view.busy) return [[focus]];
  if (e.colors) return [
    [e.colors.input ? {key: 'Enter', label:'accept'} : {key: keys.hint('colors', 'apply-color'), label:'accept draft'}, {key:'Ctrl+G', label:'back'}, focus],
    e.colors.input ? [{key:'←→ Home/End', label:'edit'}, {key:'Ctrl+U', label:'clear'}] : [{key:'↑↓', label:'select'}, {key:'Enter', label:'edit'}],
  ];
  if (e.diagnosis) {
    if (e.diagnosis.report) return [[{ key: 'Ctrl+G', label: 'back' }, focus], [{ key: '↑↓ PgUp/PgDn', label: 'scroll' }]];
    return [[{ key: 'Enter', label: 'accept' }, { key: 'Ctrl+G', label: 'back' }, focus],
      e.diagnosis.input ? [{ key: '←→ Home/End', label: 'edit', optional: 10 }, { key: 'Ctrl+U', label: 'clear', optional: 11 }] : [{ key: '↑↓', label: 'select', optional: 7 }]];
  }
  if (view.uncertain) return [[
    { key: 'K', label: 'check saved state', short: 'check' },
    { key: 'Q', label: 'close (blocked)', short: 'blocked' },
    focus,
  ]];
  if (e.groupManager || e.alignmentManager) return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'←→',label:'adjust'}]];
  if (e.sources) {
    const help: Shortcut[] = [{key:'↑↓',label:'select'}];
    if (e.sources.page === 'form') help.push({key: keys.hint('source-form', 'save-source'),label:'save'});
    if (e.sources.page === 'list') help.push({key: keys.hint('sources', 'reload-sources'),label:'reload'});
    if (e.sources.page === 'checks' || e.sources.page === 'bindings') help.push({key:'←→',label:'page'});
    return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus], help];
  }
  if (e.profiles) return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus],
    [{key:'↑↓',label:'select'}, ...(e.profiles.page === 'form' ? [] : [{key: e.profiles.uncertain ? 'R' : keys.hint('profiles', 'reload-profiles'),label:'reload'}])]];
  if (e.quick) return [[{key:'Enter',label:'accept'},{key:'Backspace',label:'back'},{key:'Ctrl+G',label:'cancel'},focus],
    [{key:'↑↓',label:'select'},{key:'←→',label:'adjust'},{key:'Tab',label:'preview'},{key:'PgUp/PgDn',label:'scroll'}],
    [{key: keys.hint('quick', 'preview-scenario', 'preview-width', 'preview-row'), label:'preview', optional: 0}]];
  if (e.review) {
    const context = reviewShortcutContext(e.review);
    return [
      [...(e.review.choosing ? [] : [{key: keys.hint(context, 'accept-import'), label:'accept draft', short:'accept'}]),
        {key: keys.hint(context, 'cancel-import'), label:'cancel review', short:'cancel'}],
      [{key:'Enter', label: e.review.choosing ? 'accept' : 'details'}, {key:'↑↓', label:'section'}],
      [{key:'PgUp/PgDn', label:'scroll'}, {key:'Tab', label:'preview'}],
      [{key: keys.hint(context, 'preview-scenario', 'preview-width', 'preview-row'), label:'preview', optional: 0}, focus],
    ];
  }
  if (view.input?.kind === 'category') return [[{key: 'Enter', label: 'accept'}, {key: 'Ctrl+G', label: 'cancel'}, focus], [{key: '↑↓', label: 'select'}]];
  if (e.guidanceScroll !== null || e.explanation) return [[{key:'Ctrl+G', label:'back'}, focus], [{key:'↑↓', label:'scroll'}, {key:'PgUp/PgDn', label:'page'}]];
  if (view.input) return [[
    { key: 'Enter', label: 'accept' },
    { key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' },
    { key: 'Ctrl+U', label: 'clear', optional: 11 },
    { key: 'Backspace/Delete', label: 'delete', short: 'del' },
    { key: '←→ Home/End', label: 'edit', optional: 10 },
    focus,
  ]];
  const context = shortcutContext(view);
  const saveActions: Shortcut[] = [
    { key: keys.hint(context, 'save'), label: 'save and continue', short: 'save' },
    { key: keys.hint(context, 'finish'), label: 'save and exit', short: 'finish' },
  ];
  if (e.adding) return [
    [{key:'Enter/Space',label:'add enable'}, {key:keys.hint('picker','close-picker') + '/Ctrl+G',label:'back'}, focus],
    [{key:'↑↓',label:'select'}, {key:keys.hint('picker','search'),label:'search',optional:9},
      {key:keys.hint('picker','category'),label:'category',optional:13}, {key:'Ctrl+U',label:'clear',optional:11},
      {key:keys.hint('picker','item-details'),label:'details',optional:12},
      ...saveActions.map(hint => ({ ...hint, optional: 0 }))],
  ];
  const pending = e.modified || view.preferences.some(preferenceChanged);
  const actions: Shortcut[] = [
    ...saveActions,
    { key: keys.hint(context, 'close'), label: pending ? 'discard' : 'close' },
    { key: keys.hint(context, 'retry-preview'), label: 'preview', optional: 4 },
    focus,
  ];
  const contextual: Shortcut[] = [{ key: 'Tab', label: 'page' }, { key: '↑↓', label: 'select' }];
  if (context === 'list') {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const filtered = e.filtered(scope);
    contextual.push({ key: keys.aliases(context, 'toggle-item'), label: 'toggle' });
    if (filtered) contextual.push({ key: 'Ctrl+G', label: 'clear filters', short: 'clear filters short' });
    contextual.push(
      { key: keys.hint(context, 'search'), label: 'search' },
      { key: keys.hint(context, 'category'), label: 'category', optional: 9 },
    );
    if (e.category[scope] !== 'all') contextual.push({ key: keys.hint(context, 'add-item'), label: 'catalog', optional: 10 });
    contextual.push({ key: keys.hint(context, 'add-item', 'copy-item', 'remove-item'), label: 'add/copy/remove', short: 'add copy remove short', optional: 8 });
    if (!filtered) contextual.push({ key: keys.hint(context, 'move-left', 'move-right'), label: 'order', optional: 7 });
    contextual.push({ key: keys.hint(context, 'item-details'), label: 'format', optional: 7 });
  } else {
    const decoration = e.detail && itemDecorationKind(e.setting);
    if (decoration === 'preset') contextual.push({ key: '←→/Enter', label: 'switch preset', short: 'adjust' });
    else {
      if (decoration !== 'custom') contextual.push({ key: '←→', label: 'adjust', optional: 8 });
      contextual.push({ key: 'Enter', label: 'edit' });
    }
    if (e.detail) contextual.push({ key: 'Ctrl+G', label: 'back' });
    else if (e.page === 'settings') {
      contextual.push({ key: keys.hint(context, 'show-host-preferences'), label: (e.advanced ? 'hide' : 'show') + ' preferences', short: (e.advanced ? 'hide' : 'show') + ' prefs' });
      if (e.advanced) contextual.push({ key: keys.hint(context, 'apply-host-preferences'), label: 'apply separately', short: 'apply' });
      contextual.push({ key: keys.hint(context, 'reload'), label: 'reload', optional: 5 });
    }
  }
  if (view.error && e.page !== 'settings') actions.splice(actions.length - 1, 0, { key: keys.hint(context, 'reload'), label: 'reload', optional: 5 });
  const tools: Shortcut[] = [
    {key: keys.hint(context,'undo'),label:'undo',optional:1},
    {key: keys.hint(context,'redo'),label:'redo',optional:2},{key: keys.hint(context,'history'),label:'changes',optional:3},
    {key: keys.hint(context,'preview-scenario','preview-width','preview-row'),label:'preview',optional:0},
  ];
  if (!e.detail) tools.push({ key: keys.hint(context, 'quick-setup'), label: 'quick setup', optional: 0 });
  const notice = view.localized?.message;
  if (notice && notice.fallback === view.message && (notice.key === 'shortcuts.native-preset-applied' || notice.key === 'shortcuts.host-preferences-pending')) {
    // A clipped notice leaves its save, discard and apply instructions to the footer.
    // Drop navigation before shortening those action labels on small panes.
    for (const hint of contextual) {
      if (hint.optional === undefined && hint.label !== 'apply separately') hint.optional = 14;
    }
  }
  return [actions, contextual, tools];
}

/** Share footer and viewport budgets between drawing and keyboard paging. */
export function editorLayout(view: View, columns: number, rows: number) {
  // A required hint must still fit when its translated label alone is long.
  let groups = translatedShortcuts(editorShortcuts(view), view.language).map(group => group.map(hint => {
    const room = columns - displayWidth(hint.key) - 1;
    const short = hint.short ?? hint.label;
    return hint.optional === undefined && displayWidth(short) > room ? { ...hint, short: clip(short, room) } : hint;
  }));
  const framed = columns >= 64 && rows >= 20;
  // Keep the header, section edges, filter/selection and one preview row.
  const limit = Math.max(1, rows - (framed ? 10 : 8));
  let footer = shortcutRows(groups, columns);
  if (footer.length > limit) footer = shortcutRows(groups, columns, true);
  const optional = [...new Set(groups.flatMap(group => group.flatMap(hint => hint.optional === undefined ? [] : [hint.optional])))].sort((a, b) => a - b);
  for (const rank of optional) {
    if (footer.length <= limit) break;
    groups = groups.map(group => group.filter(hint => hint.optional !== rank));
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
