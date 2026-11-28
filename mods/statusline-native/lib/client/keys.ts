import { openChanges, changesKey, stepDraftHistory } from '../editor/change-review.ts';
import { openReuse, reuseKey } from '../editor/reuse-manager.ts';
import { packageManager, packageKey, packageView } from '../editor/package-manager.ts';
import { openDiagnosis, diagnosisKey } from '../editor/diagnosis-view.ts';
import { openColors, colorsKey } from '../editor/color-manager.ts';
import { applyPreviewShortcut } from '../editor/preview-settings.ts';
import { openAlignments, alignmentsKey } from '../editor/alignment-manager.ts';
import { openGroups, groupsKey } from '../editor/group-manager.ts';
import { openSources, sourcesKey } from '../editor/source-manager.ts';
import { openExplanation, explanationKey } from '../editor/explanation.ts';
import { openQuick, controlQuick } from '../editor/quick-setup.ts';
import { openProfiles, profilesKey } from '../editor/profile-manager.ts';
import { inputKey } from '../editor/text-input.ts';
import { cycleEditorPage, EDITOR_PAGES } from '../editor/draft.ts';
import type { NativeKeyEvent } from './messages.ts';
import { setMessage, failureMessage } from '../i18n/messages.ts';
import { text as localizedText } from '../i18n/index.ts';
import type { View } from '../session.ts';
import { settingRows, adjustSetting, shortcutContext } from './settings.ts';
import { formRows, setFormValue } from './forms.ts';
import { canEdit, validPreferenceValue } from '../preferences.ts';
import { contentColumns } from '../../ui/layout.ts';
import { editorLayout } from '../../ui/client/help.ts';
import { formSelection, pageSelection } from '../editor/navigation.ts';
import { guidanceLines } from '../editor/guidance.ts';
import { navigateReview, reviewShortcutContext } from '../editor/import-review.ts';
import type { ShortcutEffect } from '../editor/shortcut-settings.ts';

export type Effect = 'changes' | 'reuse' | 'packages' | 'diagnoseFile' | 'save' | 'finish' | 'close' | 'reload' | 'reconcile' | 'retry' | 'applyPreferences' | 'transfer' | 'previewBackground' | 'uiLanguage' | 'reviewPreview' | 'explain' | 'profiles' | 'sources' | ShortcutEffect | null;

export function cancelInput(view: View): void {
  const input = view.input, e = view.editor;
  if (!e) return;
  if (e.review) { e.review = null; setMessage(view, 'message', localizedText('review.cancelled')); return; }
  if (e.guidanceScroll !== null) { e.guidanceScroll = null; if(e.adding)e.detail=null; return; }
  if (!input) {
    if (e.detail) e.detail = null;
    else if (e.adding) e.closePicker();
    else if (!view.uncertain && (e.page === 'main' || e.page === 'subagents')) {
      e.clearListFilters(e.page === 'main' ? 'main' : 'subagent');
    }
    return;
  }
  if (input.kind === 'search') {
    e.filter(input.scope, input.original);
    e.selectItem(input.scope, input.selected);
  } else if (input.kind === 'numeric') e.cancelNumeric(input.field);
  view.input = null;
}

/** All transitions are pure; persistence remains in the host hooks module. */
export function handleKey(view: View, event: NativeKeyEvent, columns: number, rows: number): Effect {
  const e = view.editor, key = event.key === 'space' ? ' ' : event.key;
  const shortcut = /^[A-Z]$/.test(key) ? key.toLowerCase() : key;
  if (e) e.setSaveState(view.uncertain ? 'unknown' : view.busy ? 'pending' : 'idle');
  if (!e || view.busy) return null;
  if (event.overflow) { setMessage(view, 'message', localizedText('input.overflow')); return null; }
  if ((columns < 32 || rows < 12) && !view.input && !e.packages && !event.ctrl && !event.meta && !event.text && shortcut === 'q') return 'close';
  if (e.shortcuts.panel) return e.shortcuts.key(event, view.language ?? 'en', columns, rows - 1, event.shift);
  if (e.changeReview) return changesKey(e, event, view.language ?? 'en', contentColumns(columns, rows), editorLayout(view, columns, rows).bodyRows);
  if (e.reuse) return reuseKey(e, event, view.language ?? 'en', contentColumns(columns, rows), editorLayout(view, columns, rows).bodyRows);
  if (e.packages) {
    packageView(e.packages, view.language ?? 'en', contentColumns(columns, rows), editorLayout(view, columns, rows).bodyRows, e.shortcuts);
    return packageKey(e.packages, event, e.shortcuts);
  }
  if (e.packageLocked) {
    setMessage(view, 'message', localizedText('package.ui.editor_locked'));
    return key === 'escape' || event.ctrl && shortcut === 'g' ? 'close' : null;
  }
  if (e.diagnosis) return diagnosisKey(e, event, view.language ?? 'en', contentColumns(columns, rows), editorLayout(view, columns, rows).bodyRows - 1);
  if (e.colors) return colorsKey(e, event, view.language ?? 'en');
  if (e.alignmentManager) return alignmentsKey(e, event);
  if (e.groupManager) return groupsKey(e, event);
  if (e.sources) return sourcesKey(e, event);
  if (e.profiles) return profilesKey(e, event);
  if (event.text && (!view.input || view.input.kind === 'category')) return null;
  const context = e.quick ? 'quick' : e.review ? reviewShortcutContext(e.review) : shortcutContext(view);
  const action = view.input ? null : e.shortcuts.action(context, event);
  if ((e.inDraftView || e.quick || e.review) && applyPreviewShortcut(e, action, view.preview)) return null;
  if (e.inDraftView) {
    if (action === 'history') { openChanges(e); return null; }
    if (action === 'undo' || action === 'redo') {
      setMessage(view, 'message', stepDraftHistory(e, action === 'redo'));
      return null;
    }
    if (action === 'diagnose') { openDiagnosis(e); return null; }
    if (action === 'groups' && !view.uncertain) { openGroups(e); return null; }
    if (action === 'sources') { openSources(e); return 'sources'; }
    if (action === 'profiles' && !view.uncertain) {
      if (e.acceptNumeric()) { openProfiles(e); return 'profiles'; }
      return null;
    }
  }
  if (e.explanation) {
    if (!explanationKey(e.explanation, event.ctrl && shortcut === 'g' ? 'cancel' : event.ctrl || event.meta ? '' : key, Math.max(1, rows - 10))) e.explanation = null;
    return null;
  }
  if (e.quick) return controlQuick(e, event.ctrl && shortcut === 'g' ? 'cancel' : event.ctrl || event.meta ? '' : key);
  if (action === 'quick-setup' && !view.uncertain && e.inDraftView) {
    if (e.acceptNumeric()) e.quick = openQuick(e.draft);
    return null;
  }
  if (event.ctrl && shortcut === 'g') { const reviewing = !!e.review; cancelInput(view); return reviewing ? 'reviewPreview' : null; }
  if (view.uncertain) return event.ctrl || event.meta ? null : shortcut === 'k' ? 'reconcile' : shortcut === 'q' ? 'close' : null;
  if (e.review) {
    if (action === 'accept-import') {
      e.replaceDraft(e.review.result.draft);
      setMessage(view, 'message', localizedText('review.accepted'));
      return 'reviewPreview';
    }
    if (action === 'cancel-import') { cancelInput(view); return 'reviewPreview'; }
    if (event.meta || event.ctrl && !action) return null;
    const layout = editorLayout(view, columns, rows);
    navigateReview(e.review, event.ctrl ? '' : key, view.language ?? 'en', Math.max(2, columns - (layout.framed ? 2 : 0)), Math.max(1, layout.bodyRows - 1), action);
    return 'reviewPreview';
  }
  if (e.guidanceScroll !== null && e.detail) {
    const layout = editorLayout(view, columns, rows);
    const width = Math.max(2, columns - (layout.framed ? 2 : 0));
    const item = e.detailItem!;
    const capacity = Math.max(1, layout.bodyRows - 1), maximum = Math.max(0, guidanceLines(item, view.language ?? 'en', width).length - capacity);
    if (key === 'up') e.guidanceScroll--;
    else if (key === 'down') e.guidanceScroll++;
    else if (key === 'pageup') e.guidanceScroll -= capacity;
    else if (key === 'pagedown') e.guidanceScroll += capacity;
    else if (key === 'home') e.guidanceScroll = 0;
    else if (key === 'end') e.guidanceScroll = maximum;
    e.guidanceScroll = Math.max(0, Math.min(maximum, e.guidanceScroll));
    return null;
  }
  const input = view.input;
  if (input?.kind === 'category') {
    view.message = '';
    const categories = e.categories(input.scope);
    const index = categories.indexOf(input.selected);
    if (key === 'return') { e.chooseCategory(input.scope, input.selected); view.input = null; }
    else if (key === 'up' || key === 'left') input.selected = categories[Math.max(0, index - 1)]!;
    else if (key === 'down' || key === 'right') input.selected = categories[Math.min(categories.length - 1, index + 1)]!;
    else if (key === 'home' || key === 'pageup') input.selected = categories[0]!;
    else if (key === 'end' || key === 'pagedown') input.selected = categories.at(-1)!;
    return null;
  }
  if (input?.kind === 'field' || input?.kind === 'path') {
    if (!event.text && key === 'return') {
      if (input.kind === 'path') {
        if (!input.buffer.trim()) { setMessage(view, "message", localizedText("native.lib.client.keys.enter_a_file_path")); return null; }
        e.path = input.buffer; e.pendingTransfer = input.action; view.input = null; return 'transfer';
      }
      const field = formRows(view).find((row) => row.key === input.key);
      if (field && !setFormValue(view, field, input.buffer)) return null;
      if (!field) {
        const p = view.preferences.find((p) => 'host-' + p.row.key === input.key);
        if (!p || !canEdit(p)) { setMessage(view, "message", localizedText("native.lib.client.keys.host_row_is_unavailable_or_locked")); return null; }
        const previous = p.value;
        p.value = p.row.kind === 'number' ? Number(input.buffer) : input.buffer;
        if (!validPreferenceValue(p) || (p.row.kind === 'number' && !input.buffer.trim())) {
          p.value = previous; setMessage(view, "message", localizedText("native.lib.client.keys.invalid_host_value")); return null;
        }
        p.result = '';
      }
      view.input = null;
    } else {
      const limit = input.kind === 'path' ? 4096 : 256;
      const result = inputKey(input.buffer, input.edit, {...event,key}, limit);
      input.edit = result.state; input.buffer = result.state.value;
      if (result.error) setMessage(view, 'message', localizedText('input.' + result.error, {limit}));
      else { view.message = ''; if (view.localized) delete view.localized.message; }
    }
    return null;
  }
  if (input) {
    if (input.kind === 'search') view.message = '';
    if (!event.text && key === 'return') {
      if (input.kind === 'search' || e.acceptNumeric(input.field)) view.input = null;
    } else {
      const value = input.kind === 'search' ? e.listContext(input.scope).search : e.buffers[input.field];
      const limit = input.kind === 'search' ? 256 : 32;
      const result = inputKey(value, input.edit, {...event,key}, limit);
      input.edit = result.state;
      if (input.kind === 'search') e.filter(input.scope, result.state.value);
      else e.setBuffer(input.field, result.state.value);
      if (result.error) setMessage(view, 'message', localizedText('input.' + result.error, {limit}));
      else { view.message = ''; if (view.localized) delete view.localized.message; }
    }
    return null;
  }
  const numberedPage = /^[1-9]$/u.test(key) ? EDITOR_PAGES[Number(key) - 1] : undefined;
  if(!e.detail&&(e.page==='main'||e.page==='subagents')){
    const scope=e.page==='main'?'main':'subagent';
    if(action === 'add-item'){e.openPicker(scope);return null;}
    if(action === 'copy-item' || action === 'remove-item'){
      if(!e.instanceAction(scope,action === 'copy-item' ? 'copy' : 'remove'))
        setMessage(view,'message',e.compositionError);
      return null;
    }
    if(e.adding&&!event.ctrl&&!event.meta&&(key==='return'||key===' ')){
      e.activatePicker(scope, e.shortcuts.hint('list', 'copy-item'));
      return null;
    }
    if(action === 'close-picker'){e.closePicker();return null;}
    if(event.ctrl&&!event.meta&&shortcut==='u'){e.filter(scope, '');return null;}
    if (e.adding && (key === 'tab' || numberedPage)) return null;
  }
  if (action === 'item-details' && (e.page === 'main' || e.page === 'subagents')) {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const { selected } = e.listContext(scope);
    if (selected) {
      e.detail = { scope, id: selected };
      if (e.adding) e.guidanceScroll = 0;
      else e.setting = 'item:label';
    }
    return null;
  }
  if (action === 'category') {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    view.input = {kind: 'category', scope, selected: e.listContext(scope).category};
    return null;
  }
  if (action === 'close' || action === 'save' || action === 'finish' || action === 'reload') return action;
  if (action === 'retry-preview') return 'retry';
  if (action === 'apply-host-preferences') return 'applyPreferences';
  if (action === 'show-host-preferences') {
    e.advanced = !e.advanced;
    e.setting = e.advanced ? settingRows(view).find(r => r.key.startsWith('host-'))!.key : 'colors';
    return null;
  }
  if (action === 'search') {
    const scope = e.page === 'main' ? 'main' : 'subagent', { search, selected } = e.listContext(scope);
    view.input = { kind: 'search', scope, original: search, selected };
    return null;
  }
  if (action === 'toggle-item' || action === 'move-left' || action === 'move-right') {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    if (action !== 'toggle-item' && e.filtered(scope)) setMessage(view, 'message', localizedText('catalog.search.order_disabled'));
    else if (!(action === 'toggle-item' ? e.toggle(scope, e.listContext(scope).selected) : e.move(scope, action === 'move-left' ? -1 : 1)))
      setMessage(view, 'message', e.compositionError);
    return null;
  }
  if (event.ctrl || event.meta) return null;
  if (shortcut === 'k') return 'reconcile';
  const page = key === 'tab' ? cycleEditorPage(e.page, event.shift) : numberedPage;
  if (page) {
    e.page = page;
    e.detail = null;
    if (page === 'layout' || page === 'settings') {
      const settings = settingRows(view);
      e.setting = settings.find(row => row.key === e.setting)?.key ?? settings[0]!.key;
    }
    return null;
  }
  const size = editorLayout(view, columns, rows);
  if (!size.available) return null;
  const isSettings = !!e.detail || e.page === 'settings' || e.page === 'layout';
  const scope = e.page === 'main' ? 'main' : 'subagent';
  const settings = isSettings ? settingRows(view) : [];
  const keys = isSettings ? settings.map((row) => row.key) : e.visible(scope).map((row) => row.id as string);
  const selected = isSettings ? e.setting : e.listContext(scope).selected;
  let index = Math.max(0, keys.indexOf(selected));
  if (key === 'up') index--;
  else if (key === 'down') index++;
  else if (key === 'pageup' || key === 'pagedown') {
    const delta = key === 'pageup' ? -1 : 1;
    const target = isSettings ? formSelection(settings, selected, size.formHeight, delta)
      : pageSelection(keys, selected, size.itemCapacity, delta);
    index = keys.indexOf(target);
  }
  else if (key === 'home') index = 0;
  else if (key === 'end') index = keys.length - 1;
  else if (isSettings && (key === 'left' || key === 'right')) {
    adjustSetting(view, key === 'left' ? -1 : 1);
    return e.setting === 'preview-background' ? 'previewBackground' : e.setting === 'ui-language' ? 'uiLanguage' : null;
  } else if (isSettings && (key === 'return' || key === ' ')) {
    if (e.setting === 'keyboard-shortcuts') { e.shortcuts.open(); return null; }
    if(e.setting==='change-history'){openChanges(e);return null;}
    else if(e.setting==='reuse-style'||e.setting==='reuse-groups'){openReuse(e,e.setting==='reuse-style'?'style':'groups');return null;}
    else if(e.setting==='diagnose-file'){openDiagnosis(e);return null;}
    else if(openColors(e,e.setting))return null;
    else if (e.setting === 'row-alignment') { openAlignments(e); return null; }
    else if (e.setting === 'component-groups') { openGroups(e); return null; }
    else if (e.setting === 'sources') {openSources(e);return 'sources';}
    else if (e.setting === 'package-management') {e.packages=packageManager();return 'packages';}
    else if (e.setting === 'profiles') { if (e.acceptNumeric()) { openProfiles(e); return 'profiles'; } }
    else if (e.setting === 'quick-setup') { if (e.acceptNumeric()) e.quick=openQuick(e.draft); }
    else if(e.setting==='item-explain' && e.detail) { e.explanation=openExplanation(e.detail.scope,e.detail.id); return 'explain'; }
    else if (e.setting === 'item-guidance') e.guidanceScroll = 0;
    else if (e.setting === 'preset-apply') { e.pendingTransfer = 'preset'; return 'transfer'; }
    else if (e.setting === 'import-file' || e.setting === 'export-file') {
      view.input = {kind:'path',action:e.setting === 'import-file' ? 'import' : 'export',buffer:e.path};
    } else if (e.setting === 'padding' || e.setting === 'refresh_interval') {
      view.input = {kind:'numeric',field:e.setting}; e.activeNumeric = e.setting;
    } else {
      const field = formRows(view).find((row) => row.key === e.setting);
      const p = view.preferences.find((p) => 'host-' + p.row.key === e.setting);
      if (field && (field.spec.kind === 'integer' || field.spec.kind === 'text')) view.input = {kind:'field',key:field.key,buffer:field.value,original:field.value};
      else if (p && canEdit(p) && (p.row.kind === 'text' || p.row.kind === 'number')) view.input = {kind:'field',key:e.setting,buffer:String(p.value),original:String(p.value)};
      else adjustSetting(view, 1);
    }
    return isSettings && e.setting === 'preview-background' ? 'previewBackground' : isSettings && e.setting === 'ui-language' ? 'uiLanguage' : null;
  } else return null;
  const next = keys[Math.max(0, Math.min(keys.length - 1, index))] || '';
  if (isSettings) e.setting = next; else e.selectItem(scope, next);
  return null;
}
