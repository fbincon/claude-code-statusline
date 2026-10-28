import { packageManager, packageKey } from '../editor/package-manager.ts';
import { openDiagnosis, diagnosisKey } from '../editor/diagnosis-view.ts';
import { openColors, colorsKey } from '../editor/color-manager.ts';
import { SCENARIO_IDS, PREVIEW_WIDTHS, cyclePreview } from '../editor/preview-settings.ts';
import { openAlignments, alignmentsKey } from '../editor/alignment-manager.ts';
import { openGroups, groupsKey } from '../editor/group-manager.ts';
import { openSources, sourcesKey } from '../editor/source-manager.ts';
import { openExplanation, explanationKey } from '../editor/explanation.ts';
import { openQuick, controlQuick } from '../editor/quick-setup.ts';
import { openProfiles, profilesKey } from '../editor/profile-manager.ts';
import { inputKey } from '../editor/text-input.ts';
import type { NativeKeyEvent } from './messages.ts';
import { setMessage, failureMessage } from '../i18n/messages.ts';
import { text as localizedText } from '../i18n/index.ts';
import type { View } from '../session.ts';
import { settingRows, adjustSetting } from './settings.ts';
import { formRows, setFormValue } from './forms.ts';
import { canEdit, validPreferenceValue } from '../preferences.ts';
import { editorLayout } from '../../ui/client/help.ts';
import { formSelection, pageSelection } from '../editor/navigation.ts';
import { guidanceLines } from '../editor/guidance.ts';
import { navigateReview } from '../editor/import-review.ts';

export type Effect = 'packages' | 'diagnoseFile' | 'save' | 'finish' | 'close' | 'reload' | 'reconcile' | 'retry' | 'applyPreferences' | 'transfer' | 'previewBackground' | 'uiLanguage' | 'reviewPreview' | 'explain' | 'profiles' | 'sources' | null;

export function cancelInput(view: View): void {
  const input = view.input, e = view.editor;
  if (!e) return;
  if (e.review) { e.review = null; setMessage(view, 'message', localizedText('review.cancelled')); return; }
  if (e.guidanceScroll !== null) { e.guidanceScroll = null; if(e.adding)e.detail=null; return; }
  if (!input) { if(e.adding)e.closePicker(e.page==='main'?'main':'subagent'); else e.detail = null; return; }
  if (input.kind === 'search') {
    e.filter(input.scope, input.original);
    e.selected[input.scope] = input.selected;
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
  if(e.packages)return packageKey(e.packages,event);
  if(e.packageLocked){setMessage(view,'message',localizedText('package.ui.editor_locked'));return key==='escape'||event.ctrl&&key.toLowerCase()==='g'?'close':null;}
  if(e.diagnosis)return diagnosisKey(e,event);
  if(e.colors)return colorsKey(e,event,view.language ?? 'en');
  if(event.ctrl&&key.toLowerCase()==='l'&&!view.input&&!e.sources&&!e.profiles&&!e.groupManager&&!e.alignmentManager&&!e.quick&&!e.review&&!e.explanation){openDiagnosis(e);return null;}
  if (e.alignmentManager) return alignmentsKey(e,event);
  if (e.groupManager) return groupsKey(e, event);
  if (event.ctrl && key.toLowerCase() === 'b' && !view.input && !view.uncertain && !e.sources && !e.profiles && !e.review && !e.quick && !e.explanation && !event.text) { openGroups(e); return null; }
  if (e.sources) return sourcesKey(e,event);
  if (event.ctrl && key.toLowerCase()==='y' && !view.input && !e.review && !e.quick && !e.explanation) {openSources(e);return 'sources';}
  if (e.profiles) return profilesKey(e, { ...event, key: key === 'return' ? 'enter' : key });
  if (event.ctrl && key.toLowerCase() === 'o' && !view.input && !e.detail && !e.adding && !e.review && !e.quick && !e.explanation && !view.uncertain) {
    if (e.acceptNumeric()) { openProfiles(e); return 'profiles'; }
    return null;
  }
  if (event.text && (!view.input || view.input.kind === 'category')) return null;
  if(event.ctrl&&['v','w','n'].includes(key.toLowerCase())&&!view.input){if(key.toLowerCase()==='v'){e.previewScenario=cyclePreview(SCENARIO_IDS,e.previewScenario,1);e.previewOffset=0;}else if(key.toLowerCase()==='w')e.previewWidth=cyclePreview(PREVIEW_WIDTHS,e.previewWidth as typeof PREVIEW_WIDTHS[number],1);else {const scope=e.quick?.previewScope??e.review?.previewScope??(e.page==='subagents'?'subagent':'main');e.previewOffset=(e.previewOffset+1)%Math.max(1,view.preview?.[scope==='main'?'main':'subagents'].length??0);}return null;}
  if(e.explanation) { if(!explanationKey(e.explanation,event.ctrl && key.toLowerCase()==='g'?'cancel':event.ctrl||event.meta?'':key,Math.max(1,rows-10))) e.explanation=null; return null; }
  if (e.quick) return controlQuick(e,event.ctrl && key.toLowerCase()==='g' ? 'cancel' : event.ctrl || event.meta ? '' : key);
  if (event.ctrl && key.toLowerCase()==='p' && !view.input && !e.detail && !e.adding && !e.review && !view.uncertain) {
    if(e.acceptNumeric()) e.quick=openQuick(e.draft); return null;
  }
  if (event.ctrl && key.toLowerCase() === 'g') { const reviewing = !!e.review; cancelInput(view); return reviewing ? 'reviewPreview' : null; }
  if (view.uncertain) return event.ctrl || event.meta ? null : shortcut === 'k' ? 'reconcile' : shortcut === 'q' ? 'close' : null;
  if (e.review) {
    if (event.ctrl || event.meta) return null;
    if (shortcut === 'a' && !e.review.choosing) {
      e.replaceDraft(e.review.result.draft);
      setMessage(view, 'message', localizedText('review.accepted'));
      return 'reviewPreview';
    }
    if (shortcut === 'q') { cancelInput(view); return 'reviewPreview'; }
    const layout = editorLayout(view, columns, rows);
    navigateReview(e.review, key, view.language ?? 'en', Math.max(2, columns - (layout.framed ? 2 : 0)), Math.max(1, layout.bodyRows - 1));
    return 'reviewPreview';
  }
  if (e.guidanceScroll !== null && e.detail) {
    const layout = editorLayout(view, columns, rows);
    const width = Math.max(2, columns - (layout.framed ? 2 : 0));
    const item = e.definition(e.detail.scope,e.detail.id)!;
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
      const value = input.kind === 'search' ? e.search[input.scope] : e.buffers[input.field];
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
  if(!e.detail&&(e.page==='main'||e.page==='subagents')){
    const scope=e.page==='main'?'main':'subagent';
    if(!event.meta && key.toLowerCase()==='a'&&!e.adding){e.openPicker(scope);return null;}
    if(!event.meta && ['d','x'].includes(key.toLowerCase())&&!e.adding){
      if(!e.instanceAction(scope,key.toLowerCase()==='d'?'copy':'remove'))
        setMessage(view,'message',e.compositionError);
      return null;
    }
    if(e.adding&&!event.ctrl&&!event.meta&&(key==='return'||key===' ')){
      if(!e.instanceAction(scope,'add',e.selected[scope]))setMessage(view,'message',e.compositionError);
      return null;
    }
    if(e.adding&&!event.ctrl&&!event.meta&&shortcut==='q'){e.closePicker(scope);return null;}
    if(e.adding&&event.ctrl&&key.toLowerCase()==='y'){e.detail={scope,id:e.selected[scope]};e.guidanceScroll=0;return null;}
    if(e.adding&&['tab','1','2','3','4'].includes(key))return null;
  }
  if (event.ctrl && key.toLowerCase() === 'e' && (e.page === 'main' || e.page === 'subagents')) {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    if (e.selected[scope]) { e.detail = { scope, id: e.selected[scope] }; e.setting = 'item:label'; }
    return null;
  }
  if (event.ctrl && key.toLowerCase() === 'f' && !e.detail && (e.page === 'main' || e.page === 'subagents')) {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    view.input = {kind: 'category', scope, selected: e.category[scope]};
    return null;
  }
  if (event.ctrl || event.meta) return null;
  if (shortcut === 'q') return 'close';
  if (shortcut === 's') return 'save';
  if (shortcut === 'f') return 'finish';
  if (shortcut === 'r') return 'reload';
  if (shortcut === 'v') return 'retry';
  if (shortcut === 'k') return 'reconcile';
  if (shortcut === 'a' && e.page === 'settings' && !e.detail && e.advanced) return 'applyPreferences';
  if (shortcut === 'h' && e.page === 'settings' && !e.detail) { e.advanced = !e.advanced; e.setting = e.advanced ? settingRows(view).find((r) => r.key.startsWith('host-'))!.key : 'colors'; return null; }
  const pages = ['main', 'subagents', 'settings', 'layout'] as const;
  if (key === 'tab') { e.page = pages[(pages.indexOf(e.page) + (event.shift ? 3 : 1)) % 4]!; e.detail = null; if (e.page === 'settings' || e.page === 'layout') e.setting = settingRows(view).find((r) => r.key === e.setting)?.key ?? settingRows(view)[0]!.key; return null; }
  if (['1', '2', '3', '4'].includes(key)) { e.page = pages[Number(key) - 1]!; e.detail = null; if (e.page === 'settings' || e.page === 'layout') e.setting = settingRows(view).find((r) => r.key === e.setting)?.key ?? settingRows(view)[0]!.key; return null; }
  const size = editorLayout(view, columns, rows);
  if (!size.available) return null;
  const isSettings = !!e.detail || e.page === 'settings' || e.page === 'layout';
  const scope = e.page === 'main' ? 'main' : 'subagent';
  const settings = isSettings ? settingRows(view) : [];
  const keys = isSettings ? settings.map((row) => row.key) : e.visible(scope).map((row) => row.id as string);
  const selected = isSettings ? e.setting : e.selected[scope];
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
  else if (key === '/' && !isSettings) { view.input = {kind:'search',scope,original:e.search[scope],selected:e.selected[scope]}; return null; }
  else if (key === 'left' || key === 'right') {
    if (!isSettings && e.filtered(scope)) { setMessage(view, 'message', localizedText('catalog.search.order_disabled')); return null; }
    if (isSettings) adjustSetting(view, key === 'left' ? -1 : 1);
    else {
      const delta = key === 'left' ? -1 : 1;
      if (keys[index + delta] && !e.move(scope, delta)) setMessage(view, 'message', e.compositionError);
    }
    return isSettings && e.setting === 'preview-background' ? 'previewBackground' : isSettings && e.setting === 'ui-language' ? 'uiLanguage' : null;
  } else if (key === 'return' || key === ' ' || key === 'space') {
    if (!isSettings) { if(!e.toggle(scope, selected))setMessage(view,"message",e.compositionError); }
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
  if (isSettings) e.setting = next; else e.selected[scope] = next;
  return null;
}
