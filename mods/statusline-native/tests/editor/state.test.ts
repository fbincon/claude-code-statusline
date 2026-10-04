import { expect, test } from 'claude-code/testing';
import { Editor } from '../../lib/editor/draft.ts';
import { description, readResult } from '../fixtures.ts';

test('independent metrics coexist with compounds in both scopes and preserve order', () => {
  const editor = new Editor(description(), readResult());
  for (const id of ['model', 'effort', 'context-tokens', 'api-duration']) {
    editor.toggle('main', id);
  }
  expect(editor.draft.display.items).toEqual([
    'model-with-effort', 'model', 'effort', 'context-tokens', 'api-duration',
  ]);
  for (const id of ['model-with-effort', 'model', 'effort', 'context-tokens', 'context-window-size']) {
    editor.toggle('subagent', id);
  }
  expect(editor.draft.display.subagents.items).toEqual([
    'status-elapsed', 'name', 'model-with-effort', 'model', 'effort', 'context-tokens', 'context-window-size',
  ]);
  editor.filter('main', 'api-duration');
  expect(editor.visible('main').map((item) => item.id)).toEqual(['api-duration']);
  expect(editor.baseline.draft.display.items).toEqual(['model-with-effort']);
});

test('item changes preserve the baseline, exclusions and filtered ordering', () => {
  const current = readResult();
  const editor = new Editor(description(), current);
  editor.toggle('main', 'git');
  editor.toggle('main', 'current-dir');
  editor.filter('main', 'git');
  expect(editor.visible('main').map((item) => item.id)).toEqual(['git']);
  expect(editor.move('main', -1)).toBe(false);
  editor.filter('main', '');
  editor.selected.main = 'git';
  expect(editor.move('main', -1)).toBe(true);
  // Disabled hostname/project rows remain valid neighbours, just as in curses.
  expect(editor.move('main', -1)).toBe(true);
  expect(editor.move('main', -1)).toBe(true);
  expect(editor.draft.display.items).toEqual([
    'model-with-effort',
    'git',
    'current-dir',
  ]);
  expect(current.draft.display.items).toEqual(['model-with-effort']);
  editor.toggle('subagent', 'status');
  expect(editor.draft.display.subagents.items).toEqual(['name', 'status']);
  editor.toggle('subagent', 'elapsed');
  editor.toggle('subagent', 'status-elapsed');
  expect(editor.draft.display.subagents.items).toEqual([
    'status-elapsed',
    'name',
  ]);
  expect(editor.modified).toBe(true);
});

test('numeric edits validate together, keep invalid buffers and commit explicit boundaries', () => {
  const editor = new Editor(description(), readResult());
  editor.setBuffer('padding', '33');
  editor.setBuffer('refresh_interval', 'event');
  expect(editor.acceptNumeric()).toBe(false);
  expect(editor.draft.host.refresh_interval).toBe(1);
  expect(editor.fieldErrors.padding).toBeDefined();
  editor.setBuffer('padding', '32');
  expect(editor.acceptNumeric()).toBe(true);
  expect(editor.draft.host).toEqual({
    padding: 32,
    refresh_interval: 'event',
    hide_vim_mode_indicator: false,
  });
  for (const invalid of ['', '-1', '1.5', 'NaN', 'Infinity', '1e2']) {
    editor.setBuffer('padding', invalid);
    expect(editor.acceptNumeric()).toBe(false);
  }
  editor.cancelNumeric();
  expect(editor.buffers.padding).toBe('32');
  editor.committed(readResult(editor.draft, '1'.repeat(64)));
  expect(editor.modified).toBe(false);
});

test('disabled rows move in the filtered full order without changing the saved enabled set', () => {
  const editor = new Editor(description(), readResult());
  editor.selected.main = 'git';
  const before = [...editor.draft.display.items];
  expect(editor.move('main', -1)).toBe(true);
  expect(editor.draft.display.items).toEqual(before);
  editor.toggle('main', 'git');
  expect(editor.items('main')).toEqual(['model-with-effort', 'git']);
  editor.filter('main', 'model-with-effort');
  expect(editor.selected.main).toBe('model-with-effort');
  expect(editor.move('main', 1)).toBe(false);
  editor.filter('main', 'no matches');
  expect(editor.selected.main).toBe('');
  expect(editor.toggle('main', '')).toBe(false);
});

test('accepting one numeric field neither validates nor discards another pending field', () => {
  const editor = new Editor(description(), readResult());
  editor.setBuffer('refresh_interval', '3601');
  editor.setBuffer('padding', '4');
  expect(editor.acceptNumeric('padding')).toBe(true);
  expect(editor.draft.host.padding).toBe(4);
  expect(editor.buffers.refresh_interval).toBe('3601');
  expect(editor.acceptNumeric()).toBe(false);
  expect(editor.draft.host.refresh_interval).toBe(1);
  editor.cancelNumeric('refresh_interval');
  expect(editor.draft.host.padding).toBe(4);
  expect(editor.acceptNumeric()).toBe(true);
});

test('empty selections remain explicit after save and cancel restores numeric buffers', () => {
  const editor = new Editor(description(), readResult());
  editor.toggle('main', 'model-with-effort');
  editor.toggle('subagent', 'status-elapsed');
  editor.toggle('subagent', 'name');
  expect(editor.draft.display.items).toEqual([]);
  expect(editor.draft.display.subagents.items).toEqual([]);
  editor.setBuffer('padding', '12');
  editor.setBuffer('refresh_interval', '3601');
  editor.cancelNumeric();
  expect(editor.buffers).toEqual({ padding: '0', refresh_interval: '1' });
  editor.setBuffer('refresh_interval', '3600');
  expect(editor.acceptNumeric()).toBe(true);
  editor.committed(readResult(editor.draft, '3'.repeat(64)));
  expect(editor.modified).toBe(false);
  expect(editor.draft.display.items).toEqual([]);
});
