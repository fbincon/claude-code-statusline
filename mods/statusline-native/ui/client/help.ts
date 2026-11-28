import type { View } from '../../lib/session.ts';
import { canEdit, preferenceChanged, preferenceForKey } from '../../lib/preferences.ts';
import { clip, dimensions, displayWidth } from '../layout.ts';
import { shortcutRows } from '../components/shortcuts.ts';
import type { Shortcut } from '../components/shortcuts.ts';
import { translatedShortcuts } from '../../lib/i18n/presentation.ts';

import { shortcutContext } from '../../lib/client/settings.ts';
import { canAcceptImport, reviewShortcutContext } from '../../lib/editor/import-review.ts';
import { automaticRowBoundary, itemDecorationKind } from '../../lib/editor/forms.ts';
import { groupControls } from '../../lib/editor/group-manager.ts';
import { colorControls } from '../../lib/editor/color-manager.ts';
import { packageControls } from '../../lib/editor/package-manager.ts';
import { diagnosisControls } from '../../lib/editor/diagnosis-view.ts';
import { profileControls } from '../../lib/editor/profile-manager.ts';
import { sourcesControls } from '../../lib/editor/source-manager.ts';
import { usesFullEditorBody } from '../../lib/editor/navigation.ts';
import { quickAction, quickAdjusts } from '../../lib/editor/quick-setup.ts';
import { t } from '../../lib/i18n/index.ts';

const focus: Shortcut = { key: 'Esc', label: 'focus', optional: 6 };

/** Advertise only the controls available in the current editor state. */
export function editorShortcuts(view: View): Shortcut[][] {
  const e = view.editor;
  if (!e) return [[focus]];
  const keys = e.shortcuts;
  if (e.changeReview?.input || e.reuse?.page === 'path') return [
    [{ key: 'Enter', label: e.changeReview ? 'export new file' : 'read file' }, { key: 'Ctrl+G', label: 'back' }, focus],
    [{ key: '←→ Home/End', label: 'edit', optional: 10 }, { key: 'Ctrl+U', label: 'clear', optional: 11 },
      ...(e.changeReview?.message || e.reuse?.message ? [{ key: 'PgUp/PgDn', label: 'scroll' }] : [])],
  ];
  if (e.changeReview?.kind === 'structure') return [
    [{ key: keys.hint('repair', 'accept-repair'), label: 'accept draft', short: 'accept' }, { key: 'Ctrl+G', label: 'back' }, focus],
    [{ key: 'Enter', label: 'details' }, { key: '↑↓ PgUp/PgDn', label: 'scroll' }],
  ];
  if (e.changeReview?.kind === 'changes' && !e.changeReview.input && !e.changeReview.confirm) {
    return [[{key: keys.hint('history', 'undo'), label:'undo'}, {key: keys.hint('history', 'redo'), label:'redo'},
      {key: keys.hint('history', 'close-history'), label:'back'}, focus], [{key:'↑↓ PgUp/PgDn',label:'scroll'}]];
  }
  if (e.changeReview || e.reuse) return [[{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓ PgUp/PgDn',label:'scroll'}]];
  if (e.packages) {
    if (e.packages.input) return [[{ key: 'Enter', label: e.packages.editing === 'export_path' ? 'export new file' : 'accept' },
      { key: 'Ctrl+G', label: 'back' }, focus], [{ key: '←→ Home/End', label: 'edit', optional: 10 },
      { key: 'Ctrl+U', label: 'clear', optional: 11 }, ...(e.packages.message ? [{ key: 'PgUp/PgDn', label: 'scroll' }] : [])]];
    const { pick, refresh, reload, cancel, scroll } = packageControls(e.packages);
    const actions: Shortcut[] = [
      ...(pick ? [{ key: 'Enter', label: 'select' }] : []),
      { key: keys.hint('packages', 'close-packages') + '/Ctrl+G', label: e.packages.mode === 'status' ? 'close' : 'back' },
    ];
    if (refresh) actions.push({ key: keys.hint('packages', 'refresh-package'), label: 'reload' });
    actions.push(focus);
    const navigation: Shortcut[] = pick || scroll
      ? [{ key: '↑↓', label: pick ? 'select' : 'scroll' }, { key: 'PgUp/PgDn', label: 'page', optional: 9 }] : [];
    if (reload) navigation.push({ key: keys.hint('packages', 'reload-packages'), label: 'reload', optional: 8 });
    if (cancel) navigation.push({ key: keys.hint('packages', 'cancel-package-review'), label: 'cancel' });
    return [actions, navigation];
  }
  if (view.busy) return [[focus]];
  if (e.colors) {
    const { apply, enter } = colorControls(e);
    const action = enter ? { key: 'Enter', label: enter, short: enter === 'choose_candidate' ? 'choose' : enter } : null;
    return [
      [...(apply ? [{ key: keys.hint('colors', 'apply-color'), label: 'accept draft', short: 'to draft' }] : []),
        ...(e.colors.input && action ? [action] : []), { key:'Ctrl+G', label:'back' }, focus],
      e.colors.input ? [{key:'←→ Home/End', label:'edit'}, {key:'Ctrl+U', label:'clear', optional: 11}]
        : [...(action ? [action] : []), { key: '↑↓', label: 'browse' }, { key: 'PgUp/PgDn', label: 'page', optional: 8 }],
    ];
  }
  if (e.diagnosis) {
    const { enter, tab } = diagnosisControls(e.diagnosis);
    if (e.diagnosis.report) return [
      [{ key: 'Ctrl+G', label: 'back' }, ...(tab ? [{ key: 'Tab', label: tab }] : []), focus],
      [{ key: '↑↓ PgUp/PgDn', label: 'scroll' }, { key: 'Home/End', label: 'scroll', optional: 9 }],
    ];
    return [[...(enter ? [{ key: 'Enter', label: enter }] : []), { key: 'Ctrl+G', label: 'back' }, focus],
      e.diagnosis.input ? [{ key: '←→ Home/End', label: 'edit', optional: 10 }, { key: 'Ctrl+U', label: 'clear', optional: 11 }] : [{ key: '↑↓', label: 'select', optional: 7 }]];
  }
  if (e.groupManager) {
    const controls = groupControls(e);
    return [[...(controls.enter ? [{ key: 'Enter', label: t(controls.enter, view.language), short: 'accept' }] : []),
      { key: 'Ctrl+G', label: 'back' }, focus],
      [{ key: '↑↓', label: 'select' }, ...(controls.adjust ? [{ key: '←→', label: 'adjust' }] : [])]];
  }
  if (e.alignmentManager) return [[{key:'Enter',label:'accept'},{key:'Ctrl+G',label:'back'},focus],[{key:'↑↓',label:'select'},{key:'←→',label:'adjust'}]];
  if (e.sources) {
    const control = sourcesControls(e);
    const actions: Shortcut[] = [{ key: 'Ctrl+G', label: control.back }];
    if (control.enter) actions.unshift({ key: 'Enter', label: 'select', labelKey: control.enter, short: 'select' });
    if (control.movement === 'fields') actions.push({ key: keys.hint('source-form', 'save-source'), label: 'save', labelKey: 'sources.save', short: 'save' });
    actions.push(focus);
    const help: Shortcut[] = [];
    if (control.movement === 'select') help.push({ key: '↑↓', label: 'select' });
    if (control.movement === 'scroll') help.push({ key: '↑↓ PgUp/PgDn', label: 'scroll' });
    if (control.movement === 'fields') help.push({ key: 'Tab/↑↓', label: 'next field' }, { key: '←→', label: 'edit', optional: 10 });
    if (control.page) help.push({ key: '←→', label: 'page' });
    if (control.adjust) help.push({ key: '←→', label: 'adjust' });
    if (control.reload) help.push({ key: keys.hint('sources', 'reload-sources'), label: 'reload',
      labelKey: control.reload === 'registry' ? 'sources.reload' : 'ui.refresh.read_now', short: 'reload' });
    return [actions, help];
  }
  if (e.profiles) {
    const control = profileControls(e);
    const labels = { next: 'next field', review: 'review', read: 'read file', select: 'select', confirm: 'confirm' };
    return [[
      ...(control.enter ? [{ key: 'Enter', label: labels[control.enter] }] : []),
      ...(control.back ? [{ key: 'Ctrl+G', label: 'back' }] : []),
      ...(control.refresh ? [{ key: control.refresh, label: 'reload' }] : []), focus,
    ], [
      ...(control.select ? [{ key: '↑↓', label: 'select' }] : []),
      ...(control.nextField ? [{ key: 'Tab', label: 'next field' }] : []),
      ...(control.input ? [{ key: '←→', label: 'edit', optional: 10 }] : []),
      ...(control.scroll ? [{ key: 'PgUp/PgDn', label: 'scroll' }] : []),
    ]];
  }
  if (e.quick) return [[{key:'Enter',label:t(quickAction(e.quick), view.language),short:'accept'},{key:'Ctrl+G',label:'cancel'},focus],
    [{key:'↑↓',label:'select'}, ...(quickAdjusts(e.quick) ? [{key:'←→',label:'adjust'}] : []),
      {key:'Tab',label:'preview'},{key:'PgUp/PgDn',label:'scroll'},{key:'Backspace',label:e.quick.step === 'scenario' ? 'cancel' : 'back',optional:7}],
    [{key: keys.hint('quick', 'preview-scenario', 'preview-width', 'preview-row'), label:'preview', optional: 0}]];
  if (e.review) {
    const review = e.review, context = reviewShortcutContext(review);
    const reviewActions: Shortcut[] = review.choosing ? [{ key: 'Space', label: 'toggle' }, { key: 'Enter', label: 'details' }]
      : canAcceptImport(review) ? [{ key: keys.hint(context, 'accept-import'), label: 'accept draft', short: 'accept' }]
        : review.base ? [{ key: keys.hint(context, 'select-import'), label: t('review.select_scope', view.language) }] : [];
    return [
      [...reviewActions, {key: keys.hint(context, 'cancel-import'), label:'cancel review', short:'cancel'}],
      [...(!review.choosing && review.result.changes.length ? [{ key: 'Enter', label: 'details' }] : []),
        ...(review.choosing || review.result.changes.length ? [{ key: '↑↓', label: review.choosing ? 'select' : 'section' }] : []),
        { key: 'PgUp/PgDn', label: review.choosing ? 'page' : 'scroll' }, ...(review.choosing ? [] : [{ key: 'Tab', label: 'preview' }])],
      [{key: keys.hint(context, 'preview-scenario', 'preview-width', 'preview-row'), label:'preview', optional: 0}, focus],
    ];
  }
  if (view.input?.kind === 'category') return [[{key: 'Enter', label: 'accept'}, {key: 'Ctrl+G', label: 'cancel'}, focus], [{key: '↑↓', label: 'select'}]];
  if (e.guidanceScroll !== null || e.explanation) return [[{key:'Ctrl+G', label:'back'}, focus], [{key:'↑↓', label:'scroll'}, {key:'PgUp/PgDn', label:'page'}]];
  if (view.input) return [[
    { key: 'Enter', label: view.input.kind === 'path' ? view.input.action === 'import' ? 'read file' : 'export new file' : 'accept' },
    { key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' },
    { key: 'Ctrl+U', label: 'clear', optional: 11 },
    { key: 'Backspace/Delete', label: 'delete', short: 'del' },
    { key: '←→ Home/End', label: 'edit', optional: 10 },
    focus,
  ]];
  if (view.uncertain) return [[
    { key: 'K', label: 'check saved state', short: 'check' },
    { key: 'Q', label: 'close (blocked)', short: 'blocked' },
    focus,
  ]];
  const context = shortcutContext(view);
  const saveActions: Shortcut[] = [
    { key: keys.hint(context, 'save'), label: 'save and continue', short: 'save' },
    { key: keys.hint(context, 'finish'), label: 'save and exit', short: 'finish' },
  ];
  if (e.adding) {
    const selected = e.listContext(e.picker!.scope).selected;
    return [
    [...(selected ? [{key:'Enter/Space',label:'add enable'}] : []), {key:keys.hint('picker','close-picker') + '/Ctrl+G',label:'back'}, focus],
    [...(selected ? [{key:'↑↓',label:'select'}] : []), {key:keys.hint('picker','search'),label:'search',optional:9},
      {key:keys.hint('picker','category'),label:'category',optional:13}, {key:'Ctrl+U',label:'clear',optional:11},
      ...(selected ? [{key:keys.hint('picker','item-details'),label:'details',optional:12}] : []),
      ...saveActions.map(hint => ({ ...hint, optional: 0 }))],
    ];
  }
  const pending = e.modified || view.preferences.some(preferenceChanged);
  const actions: Shortcut[] = [
    ...saveActions,
    { key: keys.hint(context, 'close'), label: pending ? 'discard' : 'close' },
    { key: keys.hint(context, 'retry-preview'), label: 'preview', optional: 4 },
    focus,
  ];
  const contextual: Shortcut[] = [{ key: 'Tab', label: 'page' }];
  if (context === 'list') {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const filtered = e.filtered(scope), selected = e.listContext(scope).selected;
    if (selected) contextual.push({ key: '↑↓', label: 'select' }, { key: keys.aliases(context, 'toggle-item'), label: 'toggle' });
    if (filtered) contextual.push({ key: 'Ctrl+G', label: 'clear filters', short: 'clear filters short' });
    contextual.push(
      { key: keys.hint(context, 'search'), label: 'search' },
      { key: keys.hint(context, 'category'), label: 'category', optional: 9 },
    );
    contextual.push({ key: keys.hint(context, 'add-item'), label: filtered ? 'catalog' : 'add', short: 'add' });
    if (selected) {
      contextual.push({ key: keys.hint(context, 'copy-item', 'remove-item'), label: 'copy/remove', short: 'copy/rm', optional: 8 });
      if (!filtered) contextual.push({ key: keys.hint(context, 'move-left', 'move-right'), label: 'order', optional: 7 });
      contextual.push({ key: keys.hint(context, 'item-details'), label: 'item format', short: 'format' });
    }
  } else {
    contextual.push({ key: '↑↓', label: 'select' });
    const decoration = e.detail && itemDecorationKind(e.setting);
    if (context === 'host-settings' && e.setting.startsWith('host-')) {
      const preference = preferenceForKey(view.preferences, e.setting);
      if (preference && canEdit(preference)) {
        const kind = preference.row.kind;
        if (kind === 'text') contextual.push({ key: 'Enter', label: 'edit' });
        else if (kind === 'number') contextual.push({ key: '←→', label: 'adjust', optional: 8 }, { key: 'Enter', label: 'edit' });
        else contextual.push({ key: '←→/Enter', label: kind === 'boolean' ? 'toggle' : 'adjust' });
      }
    } else if (automaticRowBoundary(view)) contextual.push({ key: 'Enter', label: 'review layout' });
    else if (decoration === 'preset') contextual.push({ key: '←→/Enter', label: 'switch preset', short: 'adjust' });
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
  const e = view.editor;
  const hostField = !view.input && e?.page === 'settings' && e.advanced && !e.detail && e.setting.startsWith('host-');
  // Keep the header, section edges, filter/selection and one preview row.
  const limit = Math.max(1, rows - (framed || e?.colors ? 10 : hostField ? 9 : 8));
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
  const layout = dimensions(columns, rows, footer.length, !!e && usesFullEditorBody(e));
  const hostRows = hostField ? Math.min(3, layout.bodyRows - 1) : 0;
  return { ...layout, footer, hostRows, ...(hostRows && {
    formHeight: layout.bodyRows - hostRows,
    tableHeading: false, showSummary: false,
  }) };
}
