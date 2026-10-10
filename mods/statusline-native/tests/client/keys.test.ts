import { expect, test } from 'claude-code/testing';
import type { View } from '../../lib/session.ts';
import { Editor } from '../../lib/editor/draft.ts';
import { handleKey } from '../../lib/client/keys.ts';
import { editorLayout } from '../../ui/client/help.ts';
import { formWindow, pageWindow } from '../../lib/editor/navigation.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { description, readResult } from '../fixtures.ts';

function view(): View {
  return { editor: new Editor(description(), readResult()), input: null, preview: null,
    preferences: [], preferencesError: '', error: '', previewError: '', previewBusy: false,
    message: '', busy: '', uncertain: false };
}

test('search input uses the same 256-codepoint limit as the external editor', () => {
  const state=view(), e=state.editor!;
  e.search.main='😀'.repeat(255);
  state.input={kind:'search',scope:'main',original:'',selected:e.selected.main};
  handleKey(state,{key:'界'},80,24);
  handleKey(state,{key:'x'},80,24);
  expect([...e.search.main].length).toBe(256);
  expect(e.search.main.endsWith('界')).toBe(true);
});

test('ordinary controls accept both cases and Shift without consuming Ctrl or Meta combinations', () => {
  for (const [key, effect] of [['s', 'save'], ['f', 'finish'], ['q', 'close'], ['r', 'reload'], ['v', 'retry'], ['k', 'reconcile']]) {
    for (const spelling of [key!, key!.toUpperCase()]) {
      expect(handleKey(view(), { key: spelling }, 80, 24)).toBe(effect);
      expect(handleKey(view(), { key: spelling, shift: true }, 80, 24)).toBe(effect);
      expect(handleKey(view(), { key: spelling, ctrl: true }, 80, 24)).toBeNull();
      expect(handleKey(view(), { key: spelling, meta: true }, 80, 24)).toBeNull();
    }
  }
  for (const key of ['h', 'H']) {
    const state = view();
    handleKey(state, { key: '3' }, 80, 24);
    handleKey(state, { key }, 80, 24);
    expect(state.editor!.advanced).toBe(true);
    for (const apply of ['a', 'A']) expect(handleKey(state, { key: apply }, 80, 24)).toBe('applyPreferences');
    handleKey(state, { key, shift: true }, 80, 24);
    expect(state.editor!.advanced).toBe(false);
  }
  for (const page of ['main', 'subagents', 'layout']) {
    const state = view();
    state.editor!.page = page as NonNullable<View['editor']>['page'];
    for (const key of ['h', 'H', 'a', 'A']) expect(handleKey(state, { key }, 80, 24)).toBeNull();
    expect(state.editor!.advanced).toBe(false);
  }
});

test('mixed-case shortcut characters stay literal in every editing mode', () => {
  for (const kind of ['search', 'field', 'path', 'numeric']) {
    const state = view(), e = state.editor!;
    if (kind === 'search') state.input = { kind, scope: 'main', original: '', selected: e.selected.main };
    if (kind === 'field') { e.detail = { scope: 'main', id: 'model-with-effort' }; state.input = { kind, key: 'item:label', buffer: '' }; }
    if (kind === 'path') state.input = { kind, action: 'export', buffer: '' };
    if (kind === 'numeric') { state.input = { kind, field: 'padding' }; e.setBuffer('padding', ''); }
    for (const key of 'sFqHaRvK 中文 é') expect(handleKey(state, { key }, 32, 12)).toBeNull();
    expect(e.advanced).toBe(false);
    const input = state.input;
    const actual = input?.kind === 'field' || input?.kind === 'path' ? input.buffer : kind === 'search' ? e.search.main : e.buffers.padding;
    expect(actual).toBe('sFqHaRvK 中文 é');
    if (kind === 'field' || kind === 'path') {
      handleKey(state, { key: 'backspace' }, 32, 12);
      expect((state.input as { buffer: string }).buffer).toBe('sFqHaRvK 中文 e');
    }
    handleKey(state, { key: 'U', ctrl: true }, 32, 12);
    const cleared = state.input;
    expect(cleared?.kind === 'field' || cleared?.kind === 'path' ? cleared.buffer : kind === 'search' ? e.search.main : e.buffers.padding).toBe('');
    handleKey(state, { key: 'G', ctrl: true }, 32, 12);
    expect(state.input).toBeNull();
    expect(e.draft.host.padding).toBe(0);
  }
});

test('uppercase controls keep busy, uncertain, Ctrl+E and Shift+Tab boundaries', () => {
  const state = view();
  state.uncertain = true;
  for (const key of ['k', 'K']) expect(handleKey(state, { key }, 80, 24)).toBe('reconcile');
  for (const key of ['q', 'Q']) expect(handleKey(state, { key }, 80, 24)).toBe('close');
  for (const key of ['K', 'k', 'Q', 'q']) {
    expect(handleKey(state, { key, ctrl: true }, 80, 24)).toBeNull();
    expect(handleKey(state, { key, meta: true }, 80, 24)).toBeNull();
  }
  for (const key of ['S', 'F', 'R', 'V', 'H', 'A', 'tab', '3']) expect(handleKey(state, { key }, 80, 24)).toBeNull();
  state.busy = 'Saving…';
  for (const key of ['S', 'F', 'Q', 'K', 'H', 'A']) expect(handleKey(state, { key }, 80, 24)).toBeNull();
  state.busy = ''; state.uncertain = false;
  handleKey(state, { key: 'E', ctrl: true }, 80, 24);
  expect(state.editor!.detail?.id).toBe('model-with-effort');
  handleKey(state, { key: 'G', ctrl: true }, 80, 24);
  expect(state.editor!.detail).toBeNull();
  handleKey(state, { key: 'tab', shift: true }, 80, 24);
  expect(state.editor!.page).toBe('layout');
  handleKey(state, { key: '2' }, 80, 24);
  expect(state.editor!.page).toBe('subagents');
});

test('paging uses the same visible capacity as wrapped footer layouts', () => {
  for (const [columns, rows] of [[32, 12], [64, 18], [64, 20], [80, 24], [120, 30], [80, 48]]) {
    const state = view(), e = state.editor!;
    const keys = e.visible('main').map((item) => item.id);
    handleKey(state, { key: 'home' }, columns!, rows!);
    const first = e.selected.main;
    const capacity = editorLayout(state, columns!, rows!).itemCapacity;
    handleKey(state, { key: 'pagedown' }, columns!, rows!);
    expect(e.selected.main).toBe(keys[Math.min(capacity, keys.length - 1)]);
    const window = pageWindow(keys, e.selected.main, editorLayout(state, columns!, rows!).itemCapacity);
    expect(keys.slice(window.start, window.end)).toContain(e.selected.main);
    handleKey(state, { key: 'pageup' }, columns!, rows!);
    expect(e.selected.main).toBe(first);
    handleKey(state, { key: '3' }, columns!, rows!);
    handleKey(state, { key: 'H' }, columns!, rows!);
    for (let step = 0; step < 10; step++) {
      handleKey(state, { key: 'pagedown' }, columns!, rows!);
      const settings = settingRows(state);
      const form = formWindow(settings, e.setting, editorLayout(state, columns!, rows!).formHeight);
      expect(form.lines.some((line) => line.index !== null && settings[line.index]!.key === e.setting)).toBe(true);
    }
  }
});
