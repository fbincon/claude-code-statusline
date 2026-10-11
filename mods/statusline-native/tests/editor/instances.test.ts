import { expect, test } from 'claude-code/testing';
import { Editor, copyDraft } from '../../lib/editor/draft.ts';
import { isDraft, parseResponse } from '../../lib/backend.ts';
import { description, readResult, component, reply } from '../fixtures.ts';
import { handleKey } from '../../lib/client/keys.ts';
import type { View } from '../../lib/session.ts';

function editor(){ return new Editor(description(), readResult()); }

test('copies preserve independent options and stable identity through wire roundtrips',()=>{
  const e=editor();
  e.instance('main','model-with-effort')!.options.formatting={model_name:'short'};
  expect(e.instanceAction('main','copy')).toBe(true);
  const id=e.selected.main;
  e.instance('main',id)!.options.formatting.model_name='original';
  expect(e.instance('main','model-with-effort')!.options.formatting.model_name).toBe('short');
  expect(parseResponse('read',reply(readResult(e.draft))).draft).toEqual(e.draft);
  e.replaceDraft(copyDraft(e.draft));expect(e.instance('main',id)!.id).toBe(id);
});

test('insertions grow their own row while disabled nodes keep their placement',()=>{
  const current=readResult();
  current.draft.display.instances=[component('model'),component('context-used')];
  current.draft.display.layout={mode:'explicit',rows:[['model'],['context-used']]};
  const e=new Editor(description(),current);
  expect(e.instanceAction('main','add','spacer')).toBe(true);
  const spacer=e.selected.main;
  expect(e.draft.display.layout.rows).toEqual([['model',spacer],['context-used']]);
  const before=copyDraft(e.draft);
  expect(e.instanceAction('main','copy')).toBe(false);expect(e.draft).toEqual(before);
  e.toggle('main',spacer);expect(e.draft.display.layout.rows).toEqual(before.display.layout.rows);
  e.instanceAction('main','remove');expect(e.draft.display.layout.rows).toEqual([['model'],['context-used']]);
});

test('literal components preserve user text and refuse unsafe or metric-only options',()=>{
  const e=editor();expect(e.instanceAction('main','add','text')).toBe(true);
  const node=e.instance('main',e.selected.main)!;
  node.text='$HOME ${model} 中文 👩🏽‍💻';expect(isDraft(e.draft)).toBe(true);
  for(const invalid of ['bad\ntext','\x1b[31m','x'.repeat(257)]){node.text=invalid;expect(isDraft(e.draft)).toBe(false);}
  node.text='literal';node.options.visibility='nonzero';expect(isDraft(e.draft)).toBe(false);
  node.options.visibility='always';node.options.formatting={number_format:'full'};expect(isDraft(e.draft)).toBe(false);
});

test('scope identity, repeated IDs and explicit row references are validated',()=>{
  const e=editor();e.draft.display.instances.push(component('name'));
  expect(isDraft(e.draft)).toBe(false);
  e.draft.display.instances.pop();e.draft.display.instances.push(component('model-with-effort'));
  expect(isDraft(e.draft)).toBe(false);
  e.draft.display.instances.pop();e.draft.display.layout={mode:'explicit',rows:[['missing']]};expect(isDraft(e.draft)).toBe(false);
  e.draft.display.layout={mode:'auto',rows:[]};expect(e.instanceAction('main','add','spacer')).toBe(false);
});

test('picker cancellation and instance shortcuts retain the unsaved draft',()=>{
  const e=editor();e.search.main='model';e.filter('main','model');
  const v={editor:e,input:null,preferences:[],busy:'',uncertain:false,message:'',error:'',preview:null} as unknown as View;
  handleKey(v,{key:'a',ctrl:true},80,24);expect(e.adding).toBe(true);
  handleKey(v,{key:'g',ctrl:true},80,24);expect(e.adding).toBe(false);expect(e.search.main).toBe('model');expect(e.modified).toBe(false);
  e.filter('main','');handleKey(v,{key:'d',ctrl:true},80,24);
  expect(e.draft.display.instances.length).toBe(2);const duplicate=e.selected.main;
  handleKey(v,{key:'x',ctrl:true},80,24);expect(e.instance('main',duplicate)).toBe(undefined);
  expect(e.baseline.draft.display.instances.length).toBe(1);
});


test('a rejected move preserves both the configured order and the row boundaries', () => {
  const current = readResult();
  const first = component('spacer'), second = component('spacer');
  first.id = 's1'; second.id = 's2';
  current.draft.display.instances = [component('model'), first, component('git'), second];
  current.draft.display.layout = {mode:'explicit', rows:[['model','s1'],['git','s2']]};
  const e = new Editor(description(), current), before = copyDraft(e.draft);
  const order = [...e.order.main]; e.selected.main = 's1';
  expect(e.move('main', 1)).toBe(false);
  expect(e.draft).toEqual(before); expect(e.order.main).toEqual(order);
});
