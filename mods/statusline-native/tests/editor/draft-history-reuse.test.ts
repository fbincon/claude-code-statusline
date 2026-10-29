import { expect, test } from 'claude-code/testing';
import { Editor, copyDraft } from '../../lib/editor/draft.ts';
import { reuseDraft } from '../../lib/editor/reuse.ts';
import { openChanges, changesKey, performChanges } from '../../lib/editor/change-review.ts';
import { description, readResult, component } from '../fixtures.ts';
import { LANGUAGES } from '../../lib/i18n/index.ts';
import type { Operation, ResultFor } from '../../lib/generated-contracts.ts';

test('native shared history preserves complete structural actions and pending-save boundaries',()=>{
  const e=new Editor(description(),readResult()),base=copyDraft(e.draft);
  e.instanceAction('main','copy');const copied=e.selected.main;expect(e.history.undo.length).toBe(1);
  expect(e.undo()).toBe(true);expect(e.draft).toEqual(base);expect(e.undo(true)).toBe(true);expect(e.instance('main',copied)).toBeDefined();
  e.beginSave();expect(e.undo()).toBe(false);e.saveFailed('io_error');expect(e.undo()).toBe(false);
  expect(e.reconcileSave(readResult(e.draft,'1'.repeat(64)))).toBe('saved');expect(e.history.undo.length).toBe(0);
  const d=copyDraft(e.draft);d.display.instances=['a','b','c','d'].map(id=>({...component('model'),id}));d.display.layout={mode:'explicit',rows:[['a','b'],['c','d']],alignments:[{id:'table',columns:[[{kind:'instance',id:'a'},{kind:'instance',id:'c'}],[{kind:'instance',id:'b'},{kind:'instance',id:'d'}]]}]};
  e.replaceDraft(d);const before=copyDraft(e.draft);e.selected.main='b';expect(e.instanceAction('main','remove')).toBe(true);expect(e.draft).toEqual(before);expect(e.structureProposal!.repairs[0]!.id).toBe('table');
  expect(e.acceptProposal()).toBe(true);expect(e.draft.display.layout.alignments![0]!.columns.length).toBe(1);expect(e.undo()).toBe(true);expect(e.draft).toEqual(before);
});
test('native style paste and conflict comparison retain local identity in every language',async()=>{
  for(const language of LANGUAGES){
    const e=new Editor(description(),readResult()),base=copyDraft(e.draft),incoming=copyDraft(base);incoming.display.instances[0]!.options.foreground='#abcdef';
    const result=reuseDraft(base,incoming,{kind:'style',scope:'main',from_scope:'main',from_id:base.display.instances[0]!.id,to_ids:[base.display.instances[0]!.id],fields:['foreground']},()=>'',description().catalog);
    expect(e.commitDraft(result.draft)).toBe(true);openChanges(e);const current=readResult(base,'2'.repeat(64));
    const backend={request<O extends Operation>(operation:O):ResultFor<O>{if(operation==='read')return current as ResultFor<O>;throw new Error(operation);}};
    changesKey(e,{key:'c'},language,70,16);await performChanges(e,backend);expect(e.draft).toEqual(result.draft);expect(e.baseline.revision).toBe('0'.repeat(64));
    changesKey(e,{key:'k'},language,70,16);expect(e.baseline.revision).toBe(current.revision);expect(e.history.undo.length).toBe(1);e.undo();expect(e.draft).toEqual(base);
  }
});
