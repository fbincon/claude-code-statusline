import type { ClientKeyEvent } from 'claude-code';
import type { View } from '../session.ts';
import { settingRows, adjustSetting } from './settings.ts';
import { dimensions } from '../../ui/layout.ts';

export type Effect =
  | 'save'
  | 'finish'
  | 'close'
  | 'reload'
  | 'reconcile'
  | 'retry'
  | 'applyPreferences'
  | null;

export function cancelInput(view: View): void {
  const input = view.input;
  const e = view.editor;
  if (!input || !e) return;
  if (input.kind === 'search') {
    e.filter(input.scope, input.original);
    e.selected[input.scope] = input.selected;
  } else e.cancelNumeric(input.field);
  view.input = null;
}

/** All transitions are pure; persistence remains in the host hooks module. */
export function handleKey(
  view: View,
  event: ClientKeyEvent,
  columns: number,
  rows: number,
): Effect {
  const e = view.editor;
  const key = event.key;
  if (!e || view.busy) return null;
  if (event.ctrl && key.toLowerCase() === 'g') {
    cancelInput(view);
    return null;
  }
  if (view.uncertain) {
    return key === 'k' ? 'reconcile' : key === 'q' ? 'close' : null;
  }
  const input = view.input;
  if (input) {
    if (event.ctrl && key.toLowerCase() === 'u') {
      if (input.kind === 'search') e.filter(input.scope, '');
      else e.setBuffer(input.field, '');
    } else if (key === 'return') {
      if (input.kind === 'search' || e.acceptNumeric(input.field))
        view.input = null;
    } else if (key === 'backspace' || key === 'delete') {
      if (input.kind === 'search')
        e.filter(input.scope, [...e.search[input.scope]].slice(0, -1).join(''));
      else
        e.setBuffer(
          input.field,
          [...e.buffers[input.field]].slice(0, -1).join(''),
        );
    } else if (!event.ctrl && !event.meta && [...key].length === 1) {
      if (input.kind === 'search') {
        if (e.search[input.scope].length < 256)
          e.filter(input.scope, e.search[input.scope] + key);
      } else if (e.buffers[input.field].length < 32)
        e.setBuffer(input.field, e.buffers[input.field] + key);
    }
    return null;
  }
  if (event.ctrl || event.meta) return null;
  if (key === 'q') return 'close';
  if (key === 's') return 'save';
  if (key === 'f') return 'finish';
  if (key === 'r') return 'reload';
  if (key === 'v') return 'retry';
  if (key === 'k') return 'reconcile';
  if (key === 'a' && e.page === 'settings' && e.advanced)
    return 'applyPreferences';
  if (key === 'h' && e.page === 'settings') {
    e.advanced = !e.advanced;
    e.setting = e.advanced ? 'host-theme' : 'colors';
    return null;
  }
  const pages = ['main', 'subagents', 'settings'] as const;
  if (key === 'tab') {
    e.page = pages[(pages.indexOf(e.page) + (event.shift ? 2 : 1)) % 3]!;
    return null;
  }
  if (['1', '2', '3'].includes(key)) {
    e.page = pages[Number(key) - 1]!;
    return null;
  }
  if (!dimensions(columns, rows).available) return null;
  const scope = e.page === 'main' ? 'main' : 'subagent';
  const keys =
    e.page === 'settings'
      ? settingRows(view).map((row) => row.key)
      : e.visible(scope).map((row) => row.id as string);
  const selected = e.page === 'settings' ? e.setting : e.selected[scope];
  let index = Math.max(0, keys.indexOf(selected));
  const layout = dimensions(columns, rows);
  const capacity =
    e.page === 'settings' ? layout.settingCapacity : layout.itemCapacity;
  if (key === 'up') index--;
  else if (key === 'down') index++;
  else if (key === 'pageup') index -= capacity;
  else if (key === 'pagedown') index += capacity;
  else if (key === 'home') index = 0;
  else if (key === 'end') index = keys.length - 1;
  else if (key === '/' && e.page !== 'settings') {
    view.input = {
      kind: 'search',
      scope,
      original: e.search[scope],
      selected: e.selected[scope],
    };
    return null;
  } else if (key === 'left' || key === 'right') {
    if (e.page === 'settings') adjustSetting(view, key === 'left' ? -1 : 1);
    else e.move(scope, key === 'left' ? -1 : 1);
    return null;
  } else if (key === 'return' || key === ' ' || key === 'space') {
    if (e.page !== 'settings') e.toggle(scope, selected);
    else if (e.setting === 'padding' || e.setting === 'refresh_interval') {
      view.input = { kind: 'numeric', field: e.setting };
      e.activeNumeric = e.setting;
    } else adjustSetting(view, 1);
    return null;
  } else return null;
  const next = keys[Math.max(0, Math.min(keys.length - 1, index))] || '';
  if (e.page === 'settings') e.setting = next;
  else e.selected[scope] = next;
  return null;
}
