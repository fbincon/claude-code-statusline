import { component } from '../fixtures.ts';
import { expect, test } from 'claude-code/testing';
import { Editor } from '../../lib/editor/draft.ts';
import { description, readResult } from '../fixtures.ts';

test('adding and copying keeps type definitions separate from stable instances', () => {
  const editor = new Editor(description(),readResult());
  editor.selected.main='';
  expect(editor.instanceAction('main','add','model')).toBe(true);
  const first=editor.selected.main;
  expect(editor.instanceAction('main','copy')).toBe(true);
  const second=editor.selected.main;
  expect(first===second).toBe(false);
  editor.instance('main',second)!.options.label='Second';
  expect(editor.instance('main',first)!.options.label).toBe(null);
  expect(editor.draft.display.instances.map(i=>i.type_id)).toEqual(['model-with-effort','model','model']);
  expect(editor.baseline.draft.display.instances.map(i=>i.id)).toEqual(['model-with-effort']);
  editor.filter('main','model');
  expect(editor.move('main',-1)).toBe(false);
  editor.filter('main','');
  expect(editor.move('main',-1)).toBe(true);
  expect(editor.items('main')).toEqual(['model-with-effort',second,first]);
  expect(editor.toggle('main',second)).toBe(true);
  expect(editor.instance('main',second)!.enabled).toBe(false);
  expect(editor.instanceAction('main','remove')).toBe(true);
  expect(editor.instance('main',second)).toBe(undefined);
});

test('cross-type exclusions refuse additions without losing the current draft', () => {
  const editor=new Editor(description(),readResult());
  expect(editor.instanceAction('subagent','add','status')).toBe(false);
  expect(editor.items('subagent')).toEqual(['status-elapsed','name']);
  editor.toggle('subagent','status-elapsed');
  expect(editor.instanceAction('subagent','add','status')).toBe(true);
  expect(editor.toggle('subagent','status-elapsed')).toBe(false);
  expect(editor.instance('subagent','status-elapsed')!.enabled).toBe(false);
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

test('disabled configured rows retain identity and order across moves', () => {
  const current=readResult();current.draft.display.instances.push({...component('git'),enabled:false});
  const editor=new Editor(description(),current);editor.selected.main='git';
  const before=[...editor.items('main')];
  expect(editor.move('main',-1)).toBe(true);expect(editor.items('main')).toEqual(before);
  editor.toggle('main','git');expect(editor.items('main')).toEqual(['git','model-with-effort']);
  editor.filter('main','no matches');expect(editor.selected.main).toBe('');expect(editor.toggle('main','')).toBe(false);
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
  expect(editor.draft.display.instances.filter(i=>i.enabled).map(i=>i.id)).toEqual([]);
  expect(editor.draft.display.subagents.instances.filter(i=>i.enabled).map(i=>i.id)).toEqual([]);
  editor.setBuffer('padding', '12');
  editor.setBuffer('refresh_interval', '3601');
  editor.cancelNumeric();
  expect(editor.buffers).toEqual({ padding: '0', refresh_interval: '1' });
  editor.setBuffer('refresh_interval', '3600');
  expect(editor.acceptNumeric()).toBe(true);
  editor.committed(readResult(editor.draft, '3'.repeat(64)));
  expect(editor.modified).toBe(false);
  expect(editor.draft.display.instances.filter(i=>i.enabled).map(i=>i.id)).toEqual([]);
});
