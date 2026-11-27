import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, plain } from './fixtures.js';

test('typing Ctrl+C during shortcut capture preserves the staged binding and display draft', () => {
  const state = fixture(), editor = state.editor;
  const press = (key: string, ctrl = false) => state.key({ key, ctrl });
  press('return');
  assert.equal(state.modified, true);
  const draft = structuredClone(editor.draft), history = structuredClone(editor.history);
  editor.shortcuts.open();
  press('return'); press('z');
  press('down'); press('down'); press('return');
  const panel = editor.shortcuts.panel!;
  assert.equal(panel.selected, 'close');
  assert.equal(press('c', true), null);
  assert.equal(panel.capture, true);
  assert.equal(panel.message?.key, 'shortcuts.interrupt-key');
  assert.deepEqual(panel.draft, { save: 'Z' });
  assert.deepEqual(editor.shortcuts.snapshot.bindings, {});
  assert.deepEqual(editor.draft, draft);
  assert.deepEqual(editor.history, history);
  press('g', true);
  assert.equal(panel.capture, false);
  assert.equal(press('c', true), 'interrupt');
});

test('external text inputs edit the middle, cancel and reopen without losing suffixes', () => {
  const state = fixture(), e = state.editor;
  state.key({key:'e',ctrl:true}); state.key({key:'return'}); state.key({key:'u',ctrl:true});
  state.key({key:'中文👩🏽‍💻后缀',paste:true});
  state.key({key:'home'}); state.key({key:'right'}); state.key({key:'delete'});
  state.key({key:'标记',paste:true});
  assert.ok(plain(state).join('\n').includes('中标记▏👩🏽‍💻后缀'));
  state.key({key:'return'});
  assert.equal(e.instance('main',e.selected.main)!.options.label,'中标记👩🏽‍💻后缀');
  state.key({key:'return'}); state.key({key:'home'}); state.key({key:'delete'});
  state.key({key:'escape'});
  assert.equal(e.instance('main',e.selected.main)!.options.label,'中标记👩🏽‍💻后缀');
});

test('Enter adjusts each original boolean or choice setting and records one undo step', () => {
  for (const setting of ['colors', 'palette', 'directory-style', 'separator-style', 'scope-labels', 'vim-indicator', 'custom-subagent-rows']) {
    const state = fixture(), e = state.editor;
    e.page = 'settings';
    e.setting = setting;
    const original = structuredClone(e.draft);
    assert.equal(state.key({ key: 'return' }), null, setting);
    assert.equal(state.input, null, setting);
    const adjusted = structuredClone(e.draft);
    assert.notDeepEqual(adjusted, original, setting);
    assert.equal(e.history.undo.length, 1, setting);
    state.key({ key: 'z', ctrl: true });
    assert.deepEqual(e.draft, original, setting);
    state.key({ key: ' ' });
    assert.deepEqual(e.draft, adjusted, setting);
  }
});

test('Enter opens prefilled numeric Settings, with draft-only acceptance and cancel', () => {
  const state = fixture(), e = state.editor;
  const key = (key: string, ctrl = false) => state.key({ key, ctrl });
  e.page = 'settings';
  e.setting = 'padding';
  const original = structuredClone(e.draft), generation = e.mutationGeneration;
  assert.equal(key('return'), null);
  assert.equal(state.inputDisplay(32), '0▏');
  assert.equal(state.modified, false);
  assert.deepEqual(e.draft, original);
  assert.equal(e.mutationGeneration, generation);
  assert.equal(e.history.undo.length, 0);
  assert.equal(key('s', true), null);
  key('u', true);
  key('1');
  key('2');
  assert.equal(e.draft.host.padding, 12);
  assert.equal(e.history.undo.length, 0);
  assert.equal(key('return'), null);
  assert.equal(state.input, null);
  assert.equal(e.history.undo.length, 1);
  assert.deepEqual(e.baseline.draft, original);

  for (const [cancel, ctrl] of [['g', true], ['escape', false]] as const) {
    key('return');
    assert.equal(state.inputDisplay(32), '12▏');
    key('backspace');
    assert.equal(e.draft.host.padding, 1);
    key(cancel, ctrl);
    assert.equal(state.input, null);
    assert.equal(e.draft.host.padding, 12);
    assert.equal(e.history.undo.length, 1);
  }
  key('return');
  key('return');
  assert.equal(e.history.undo.length, 1);
  key('z', true);
  assert.equal(e.draft.host.padding, 0);
  key('r', true);
  assert.equal(e.draft.host.padding, 12);
  assert.equal(key('s', true), 'save');
});

test('refresh numeric editing accepts seconds and event, while event and save remaps act outside input', () => {
  const state = fixture(), e = state.editor;
  const key = (key: string, ctrl = false) => state.key({ key, ctrl });
  e.page = 'settings';
  e.setting = 'refresh_interval';
  key('e');
  assert.equal(e.draft.host.refresh_interval, 'event');
  assert.equal(e.history.undo.length, 1);
  key('return');
  assert.equal(state.inputDisplay(32), 'event▏');
  key('u', true);
  state.key({ key: '3601', paste: true });
  assert.equal(key('return'), null);
  assert.equal(state.inputDisplay(32), '3601▏');
  assert.equal(e.draft.host.refresh_interval, 'event');
  assert.equal(e.history.undo.length, 1);
  key('g', true);

  key('4');
  key('5');
  assert.equal(state.inputDisplay(32), '45▏');
  assert.equal(key('return'), null);
  assert.equal(e.draft.host.refresh_interval, 45);
  assert.equal(e.history.undo.length, 2);

  e.shortcuts.snapshot.bindings = { save: 'Ctrl+Q', 'event-refresh': 'J' };
  key('return');
  assert.equal(state.inputDisplay(32), '45▏');
  assert.equal(key('q', true), null);
  key('u', true);
  state.key({ key: 'event', paste: true });
  assert.equal(key('return'), null);
  assert.equal(state.input, null);
  assert.equal(e.draft.host.refresh_interval, 'event');
  assert.equal(e.history.undo.length, 3);
  key('left');
  assert.equal(e.draft.host.refresh_interval, 3600);
  key('e');
  assert.equal(e.draft.host.refresh_interval, 3600);
  key('j');
  assert.equal(e.draft.host.refresh_interval, 'event');
  assert.equal(e.baseline.draft.host.refresh_interval, 1);
  assert.equal(key('q', true), 'save');
});

test('paste cannot save, navigate, accept import or cancel; over-limit text is explained', () => {
  const state=fixture();
  for(const key of ['s','1','return','escape','a']) assert.equal(state.key({key,paste:true}),null);
  state.key({key:'/'}); state.key({key:'escape',paste:true});
  assert.equal(state.editor.search.main,'escape');
  state.key({key:'界'.repeat(256),paste:true});
  assert.equal(state.editor.search.main,'escape');
  assert.equal(state.localized.message?.key,'input.limit');
  state.key({key:'A\nS',paste:true});
  assert.equal(state.localized.message?.key,'input.invalid');
});

test('dirty quit defaults to the draft, including after resize; only a real choice discards', () => {
  const state=fixture(),e=state.editor;
  assert.equal(state.key({key:'escape'}),'cancel');
  state.key({key:' '}); const draft=structuredClone(e.draft), history=structuredClone(e.history);
  for (const size of [[80,24],[32,12],[12,2]] as const) {
    const key=(value: string, modifiers = {})=>state.key({key:value,...modifiers},size[0],size[1]);
    assert.equal(key('escape'),null); assert.equal(state.exitChoice,'keep');
    assert(plain(state,size[0],size[1]).some(line=>line.includes('› Continue')));
    for (const type of ['text','paste','meta']) for(const value of ['down','return','escape','d']) key(value,{[type]:true});
    assert.equal(state.exitChoice,'keep'); key('return'); assert.equal(state.exitChoice,null);
    key('escape'); key('down'); assert.equal(state.exitChoice,'discard'); key('escape'); assert.equal(state.exitChoice,null);
    assert.deepEqual(e.draft,draft); assert.deepEqual(e.history,history);
    key('escape'); key('down'); assert.equal(key('return'),'cancel');
  }
});
