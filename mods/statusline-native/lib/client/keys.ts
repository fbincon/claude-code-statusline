import type { ClientKeyEvent } from 'claude-code';
import type { View } from '../session.ts';
import { settingRows, adjustSetting } from './settings.ts';
import { formRows, setFormValue } from './forms.ts';
import { canEdit, validPreferenceValue } from '../preferences.ts';
import { dimensions } from '../../ui/layout.ts';

export type Effect = 'save' | 'finish' | 'close' | 'reload' | 'reconcile' | 'retry' | 'applyPreferences' | 'transfer' | null;

export function cancelInput(view: View): void {
  const input = view.input, e = view.editor;
  if (!e) return;
  if (!input) { e.detail = null; return; }
  if (input.kind === 'search') {
    e.filter(input.scope, input.original);
    e.selected[input.scope] = input.selected;
  } else if (input.kind === 'numeric') e.cancelNumeric(input.field);
  view.input = null;
}

/** All transitions are pure; persistence remains in the host hooks module. */
export function handleKey(view: View, event: ClientKeyEvent, columns: number, rows: number): Effect {
  const e = view.editor, key = event.key === 'space' ? ' ' : event.key;
  if (!e || view.busy) return null;
  if (event.ctrl && key.toLowerCase() === 'g') { cancelInput(view); return null; }
  if (view.uncertain) return key === 'k' ? 'reconcile' : key === 'q' ? 'close' : null;
  const input = view.input;
  if (input?.kind === 'field' || input?.kind === 'path') {
    if (event.ctrl && key.toLowerCase() === 'u') input.buffer = '';
    else if (key === 'return') {
      if (input.kind === 'path') {
        if (!input.buffer.trim()) { view.message = 'Enter a file path.'; return null; }
        e.path = input.buffer; e.pendingTransfer = input.action; view.input = null; return 'transfer';
      }
      const field = formRows(view).find((row) => row.key === input.key);
      if (field && !setFormValue(view, field, input.buffer)) return null;
      if (!field) {
        const p = view.preferences.find((p) => 'host-' + p.row.key === input.key);
        if (!p || !canEdit(p)) { view.message = 'Host row is unavailable or locked.'; return null; }
        const previous = p.value;
        p.value = p.row.kind === 'number' ? Number(input.buffer) : input.buffer;
        if (!validPreferenceValue(p) || (p.row.kind === 'number' && !input.buffer.trim())) {
          p.value = previous; view.message = 'Invalid host value.'; return null;
        }
        p.result = '';
      }
      view.input = null;
    } else if (key === 'backspace' || key === 'delete') input.buffer = [...input.buffer].slice(0, -1).join('');
    else if (!event.ctrl && !event.meta && [...key].length === 1 && [...input.buffer].length < (input.kind === 'path' ? 4096 : 256)) input.buffer += key;
    return null;
  }
  if (input) {
    if (event.ctrl && key.toLowerCase() === 'u') {
      if (input.kind === 'search') e.filter(input.scope, ''); else e.setBuffer(input.field, '');
    } else if (key === 'return') {
      if (input.kind === 'search' || e.acceptNumeric(input.field)) view.input = null;
    } else if (key === 'backspace' || key === 'delete') {
      if (input.kind === 'search') e.filter(input.scope, [...e.search[input.scope]].slice(0, -1).join(''));
      else e.setBuffer(input.field, [...e.buffers[input.field]].slice(0, -1).join(''));
    } else if (!event.ctrl && !event.meta && [...key].length === 1) {
      if (input.kind === 'search') { if (e.search[input.scope].length < 256) e.filter(input.scope, e.search[input.scope] + key); }
      else if (e.buffers[input.field].length < 32) e.setBuffer(input.field, e.buffers[input.field] + key);
    }
    return null;
  }
  if (event.ctrl && key.toLowerCase() === 'e' && (e.page === 'main' || e.page === 'subagents')) {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    if (e.selected[scope]) { e.detail = { scope, id: e.selected[scope] }; e.setting = 'item:label'; }
    return null;
  }
  if (event.ctrl || event.meta) return null;
  if (key === 'q') return 'close';
  if (key === 's') return 'save';
  if (key === 'f') return 'finish';
  if (key === 'r') return 'reload';
  if (key === 'v') return 'retry';
  if (key === 'k') return 'reconcile';
  if (key === 'a' && e.page === 'settings' && e.advanced) return 'applyPreferences';
  if (key === 'h' && e.page === 'settings') { e.advanced = !e.advanced; e.setting = e.advanced ? 'host-theme' : 'colors'; return null; }
  const pages = ['main', 'subagents', 'settings', 'layout'] as const;
  if (key === 'tab') { e.page = pages[(pages.indexOf(e.page) + (event.shift ? 3 : 1)) % 4]!; e.detail = null; if (e.page === 'settings' || e.page === 'layout') e.setting = settingRows(view).find((r) => r.key === e.setting)?.key ?? settingRows(view)[0]!.key; return null; }
  if (['1', '2', '3', '4'].includes(key)) { e.page = pages[Number(key) - 1]!; e.detail = null; if (e.page === 'settings' || e.page === 'layout') e.setting = settingRows(view).find((r) => r.key === e.setting)?.key ?? settingRows(view)[0]!.key; return null; }
  if (!dimensions(columns, rows).available) return null;
  const isSettings = !!e.detail || e.page === 'settings' || e.page === 'layout';
  const scope = e.page === 'main' ? 'main' : 'subagent';
  const keys = isSettings ? settingRows(view).map((row) => row.key) : e.visible(scope).map((row) => row.id as string);
  const selected = isSettings ? e.setting : e.selected[scope];
  let index = Math.max(0, keys.indexOf(selected));
  const size = dimensions(columns, rows);
  const capacity = isSettings ? size.settingCapacity : size.itemCapacity;
  if (key === 'up') index--;
  else if (key === 'down') index++;
  else if (key === 'pageup') index -= capacity;
  else if (key === 'pagedown') index += capacity;
  else if (key === 'home') index = 0;
  else if (key === 'end') index = keys.length - 1;
  else if (key === '/' && !isSettings) { view.input = {kind:'search',scope,original:e.search[scope],selected:e.selected[scope]}; return null; }
  else if (key === 'left' || key === 'right') {
    if (isSettings) adjustSetting(view, key === 'left' ? -1 : 1); else e.move(scope, key === 'left' ? -1 : 1);
    return null;
  } else if (key === 'return' || key === ' ' || key === 'space') {
    if (!isSettings) e.toggle(scope, selected);
    else if (e.setting === 'preset-apply') { e.pendingTransfer = 'preset'; return 'transfer'; }
    else if (e.setting === 'import-file' || e.setting === 'export-file') {
      view.input = {kind:'path',action:e.setting === 'import-file' ? 'import' : 'export',buffer:e.path};
    } else if (e.setting === 'padding' || e.setting === 'refresh_interval') {
      view.input = {kind:'numeric',field:e.setting}; e.activeNumeric = e.setting;
    } else {
      const field = formRows(view).find((row) => row.key === e.setting);
      const p = view.preferences.find((p) => 'host-' + p.row.key === e.setting);
      if (field && (field.spec.kind === 'integer' || field.spec.kind === 'text')) view.input = {kind:'field',key:field.key,buffer:field.value};
      else if (p && canEdit(p) && (p.row.kind === 'text' || p.row.kind === 'number')) view.input = {kind:'field',key:e.setting,buffer:String(p.value)};
      else adjustSetting(view, 1);
    }
    return null;
  } else return null;
  const next = keys[Math.max(0, Math.min(keys.length - 1, index))] || '';
  if (isSettings) e.setting = next; else e.selected[scope] = next;
  return null;
}
