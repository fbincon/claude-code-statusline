import { openReuse, reuseView } from '../src/editor/reuse-manager.js';
import { textInput } from '../src/editor/text-input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Editor, copyDraft } from '../src/editor/draft.js';
import { boundHistory, HISTORY_BYTES, snapshot } from '../src/editor/history.js';
import { repairStructure } from '../src/editor/structure.js';
import { reuseDraft } from '../src/editor/reuse.js';
import { compatibleSource } from '../src/editor/source-compatibility.js';
import { draftBindings } from '../src/editor/source-manager.js';
import { changesView, openChanges, performChanges, changesKey } from '../src/editor/change-review.js';
import { defaultDisplay, defaultItem } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import { ITEMS } from '../src/config/catalog.js';
import { text } from '../src/i18n/messages.js';
import type { DescribeResult, Draft, ReadResult, Operation, ResultFor, SourceDefinition } from '../src/contracts/ui.js';

const draft = (): Draft => ({ display:defaultDisplay(),host:{...DEFAULT_HOST} });
const read = (d=draft(), revision='0'.repeat(64)):ReadResult => ({draft:d,revision,installed:true,installation:{},backend_version:'test',capabilities:{} as ReadResult['capabilities']});
const editor = (d=draft()) => new Editor({catalog:[...ITEMS],options:{padding:{minimum:0,maximum:32},'refresh-interval':{minimum:1,maximum:3600}}} as unknown as DescribeResult,read(d));
function grouped():Draft {
  const d=draft();d.display.instances=['a','b','c','d'].map(id=>({id,type_id:'model',enabled:true,text:null,options:defaultItem()}));
  d.display.groups=[{id:'g1',member_ids:['a','b'],primary_id:'a',link_visibility:true,shared_powerline:true},{id:'g2',member_ids:['c','d'],primary_id:'c',link_visibility:false,shared_powerline:true}];
  d.display.layout={mode:'explicit',rows:[['a','b'],['c','d']],alignments:[{id:'columns',columns:[[{kind:'group',id:'g1'},{kind:'group',id:'g2'}]]}]};return d;
}
test('history groups edits, preserves immutable snapshots and bindings, forks redo and freezes unresolved saves',()=>{
  const e=editor(),initial=copyDraft(e.draft);initial.display.instances[0]!.source={binding:'history-binding',hint:'test'};
  // Use a valid external instance for a locally bound draft.
  initial.display.instances[0]!.type_id='external-value';e.replaceDraft(initial);e.history.undo=[];
  const next=copyDraft(e.draft);next.display.instances[0]!.source={binding:null,hint:'test'};e.commitDraft(next);
  assert(draftBindings(e).includes('history-binding'));next.display.theme='light';assert.notEqual(e.draft.display.theme,'light');
  assert(e.undo());assert.equal(e.draft.display.instances[0]!.source!.binding,'history-binding');assert(e.undo(true));
  const changed=copyDraft(e.draft);changed.display.theme='light';e.commitDraft(changed);assert.equal(e.history.redo.length,0);
  const before=copyDraft(e.draft),steps=e.history.undo.length;e.beginSave();assert.equal(e.undo(),false);assert.equal(e.commitDraft(initial),false);e.saveFailed('io_error');assert.equal(e.undo(),false);assert.equal(e.history.undo.length,steps);
  assert.equal(e.reconcileSave(read(before,'1'.repeat(64))),'saved');assert.equal(e.history.undo.length,0);
});
test('history bounds, no-op edits and numeric confirmation/cancellation retain logical action boundaries',()=>{
  const e=editor();for(let i=0;i<105;i++){const d=copyDraft(e.draft);d.host.padding=i%2;e.commitDraft(d);}
  assert.equal(e.history.undo.length,100);assert(e.history.trimmed);const count=e.history.undo.length;e.commitDraft(copyDraft(e.draft));assert.equal(e.history.undo.length,count);
  const entry=snapshot(e.draft,text('history.edit'));assert.equal(entry.bytes,new TextEncoder().encode(JSON.stringify(e.draft)).length);
  e.history={undo:[{...entry,bytes:HISTORY_BYTES+1}],redo:[],trimmed:false};boundHistory(e.history);assert.equal(e.history.undo.length,0);assert(e.history.trimmed);
  e.setBuffer('padding','12');assert(e.acceptNumeric('padding',true));assert.equal(e.draft.host.padding,12);e.cancelNumeric('padding');assert.equal(e.draft.host.padding,0);
  e.setBuffer('padding','1');e.acceptNumeric('padding',true);e.setBuffer('padding','14');e.acceptNumeric('padding',true);assert.equal(e.history.undo.length,0);e.acceptNumeric('padding');assert.equal(e.history.undo.length,1);e.undo();assert.equal(e.draft.host.padding,0);
});
test('structural proposals retain valid columns, reject stale acceptance and apply atomically as one action',()=>{
  const d=draft();d.display.instances=['a','b','c','d'].map(id=>({id,type_id:'text',text:id,enabled:true,options:defaultItem()}));
  d.display.layout={mode:'explicit',rows:[['a','b'],['c','d']],alignments:[{id:'table',columns:[[{kind:'instance',id:'a'},{kind:'instance',id:'c'}],[{kind:'instance',id:'b'},{kind:'instance',id:'d'}]]}]};
  const candidate=copyDraft(d);candidate.display.instances.splice(1,1);candidate.display.layout.rows[0]=['a'];
  const repair=repairStructure(d,candidate);assert.equal(repair.repairs.length,1);assert.equal(repair.draft.display.layout.alignments![0]!.columns.length,1);assert.equal(d.display.instances.length,4);
  const e=editor(d);assert(e.applyStructure(candidate));assert.deepEqual(e.draft,d);assert(e.changeReview);assert(e.acceptProposal());assert.equal(e.history.undo.length,1);assert(e.undo());assert.deepEqual(e.draft,d);
  e.applyStructure(candidate);const edit=copyDraft(e.draft);edit.display.theme='light';e.commitDraft(edit);assert.equal(e.acceptProposal(),false);assert.equal(e.draft.display.instances.length,4);
  assert.throws(()=>repairStructure(d,{...candidate,display:{...candidate.display,groups:[{id:'bad',member_ids:['missing','a'],primary_id:'a',link_visibility:true,shared_powerline:true}]}}));
});
test('style reuse changes only selected compatible visual fields, including inheritance and independent scope',()=>{
  const base=draft(),incoming=copyDraft(base),destination=base.display.instances[0]!,origin=incoming.display.instances[0]!;
  destination.options.priority=99;destination.options.max_width=12;destination.source={binding:'local',hint:'local'};
  origin.options.foreground='#123456';origin.options.foreground_gradient=['#123456','#abcdef'];origin.options.label='中文 👩‍💻';origin.options.formatting.model_name='short';
  let serial=0;const result=reuseDraft(base,incoming,{kind:'style',scope:'main',from_scope:'main',from_id:origin.id,to_ids:[destination.id],fields:['foreground','foreground_gradient','label','formatting.model_name']},()=>String(++serial),ITEMS);
  const expected=copyDraft(base);Object.assign(expected.display.instances[0]!.options,{foreground:origin.options.foreground,foreground_gradient:origin.options.foreground_gradient,label:origin.options.label,formatting:{...destination.options.formatting,model_name:'short'}});
  assert.deepEqual(result.draft,expected);assert.equal(base.display.instances[0]!.options.foreground,null);
  assert.throws(()=>reuseDraft(base,incoming,{kind:'style',scope:'main',from_scope:'main',from_id:origin.id,to_ids:[destination.id],fields:['priority']},()=>'',ITEMS));
});
test('group reuse resolves outside references explicitly, maps all identities and clears imported bindings',()=>{
  const incoming=grouped(),base=draft();incoming.display.instances[0]!.type_id='external-value';incoming.display.instances[0]!.source={binding:'foreign',hint:'queue'};
  const request={kind:'groups' as const,scope:'main' as const,group_ids:['g1'],references:'review' as 'review'|'expand'|'exclude',explicit:false};let serial=0;const next=()=>`new-${++serial}`;
  const blocked=reuseDraft(base,incoming,request,next,ITEMS);assert(blocked.dependencies.includes('group:g2'));assert(blocked.blocked.includes('reuse.references'));assert.deepEqual(blocked.draft,base);
  const needsRows=reuseDraft(base,incoming,{...request,references:'expand'},next,ITEMS);assert(needsRows.blocked.includes('reuse.explicit'));
  const expanded=reuseDraft(base,incoming,{...request,references:'expand',explicit:true},next,ITEMS);
  assert.deepEqual(expanded.blocked,[]);assert.equal(expanded.draft.display.groups.length,2);assert.equal(expanded.draft.display.layout.rows.length,3);assert.equal(expanded.draft.display.layout.alignments!.length,1);
  assert.deepEqual(expanded.draft.display.layout.rows[0],base.display.instances.map(n=>n.id));assert.equal(expanded.unresolved.length,1);assert.equal(expanded.draft.display.instances.find(n=>n.id===expanded.mappings.instances.a)!.source!.binding,null);
  const excluded=reuseDraft(base,incoming,{...request,references:'exclude'},next,ITEMS);assert.deepEqual(excluded.blocked,[]);assert.equal(excluded.draft.display.layout.mode,'auto');assert.equal(excluded.draft.display.groups.length,1);assert(!excluded.draft.display.layout.alignments?.length);
});
test('conflict review preserves draft, exports it and rejects changed targets or another concurrent revision',async()=>{
  const e=editor(),d=copyDraft(e.draft);d.display.theme='light';e.commitDraft(d);const current=read(draft(),'1'.repeat(64));current.draft.display.palette='ansi';
  let exported:Draft|undefined;const backend={request<O extends Operation>(operation:O,payload?:unknown):ResultFor<O>{if(operation==='read')return current as ResultFor<O>;if(operation==='export'){exported=(payload as {draft:Draft}).draft;return {path:'draft.json'} as ResultFor<O>;}throw new Error(operation);}};
  openChanges(e);e.changeReview!.effect='read';await performChanges(e,backend);assert.equal(e.baseline.revision,'0'.repeat(64));assert.deepEqual(e.draft,d);
  changesKey(e,{key:'e'},'en',80,18);e.changeReview!.effect='export';await performChanges(e,backend);assert.deepEqual(exported,d);
  changesKey(e,{key:'k'},'en',80,18);assert.equal(e.baseline.revision,current.revision);assert.deepEqual(e.draft,d);assert.equal(e.history.undo.length,1);
  openChanges(e);e.changeReview!.current={...current,installation:{main:{state:'foreign'}}};changesKey(e,{key:'k'},'en',80,18);assert(e.changeReview);assert.equal(e.baseline.revision,current.revision);
  changesKey(e,{key:'l'},'en',80,18);assert(e.changeReview!.confirm);changesKey(e,{key:'escape'},'en',80,18);assert.deepEqual(e.draft,d);
});
test('rebinding filters source type and scope without enabling sources',()=>{
  const node={id:'x',type_id:'github-ci',enabled:true,text:null,options:defaultItem()};const source={kind:'github',scope:{project:'/p',session:null,agent:null},enabled:false} as SourceDefinition;
  assert(compatibleSource(node,source,{project:'/p',session:null,agent:null,branch:null,head:null}));assert(!source.enabled);
  assert(!compatibleSource(node,source,{project:'/other',session:null,agent:null,branch:null,head:null}));assert(!compatibleSource({...node,type_id:'external-value'},source,null));
});

test('review presentation preserves long export/path input state and scroll snapshots',()=>{
  const e=editor();openChanges(e);e.changeReview!.input=textInput('/'+('界'.repeat(512))+'/draft.json');
  const before=JSON.stringify(e.changeReview);for(const width of [32,196])changesView(e,'en',width,12);assert.equal(JSON.stringify(e.changeReview),before);
  e.changeReview=null;openReuse(e,'style');e.reuse!.page='path';e.reuse!.input=textInput('/'+('界'.repeat(512))+'/source.json');
  const snapshot=JSON.stringify(e.reuse);for(const width of [32,196])reuseView(e,'en',width,12);assert.equal(JSON.stringify(e.reuse),snapshot);
});

test('history review undo and redo refresh the comparison and retain unresolved-save protection',()=>{
  const e=editor(),base=copyDraft(e.draft),changed=copyDraft(base);changed.host.padding=7;e.commitDraft(changed);openChanges(e);
  changesKey(e,{key:'u'},'en',32,12);assert.deepEqual(e.draft,base);assert(e.changeReview);assert.equal(e.changeReview.review.result.changes.length,0);
  changesKey(e,{key:'r'},'en',32,12);assert.deepEqual(e.draft,changed);assert(e.changeReview!.review.result.changes.length>0);
  e.beginSave();e.saveFailed('io_error');openChanges(e);const before=JSON.stringify(e.history);
  changesKey(e,{key:'u'},'en',32,12);assert.deepEqual(e.draft,changed);assert.equal(JSON.stringify(e.history),before);
});
