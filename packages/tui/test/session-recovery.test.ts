import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { Session, type Backend } from '../src/session.js';
import { fixture } from './fixtures.js';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { copyDraft } from '@fbincon/statusline-core/editor/draft';
import { formRows, setFormValue } from '@fbincon/statusline-core/editor/forms';
import { newInstance } from '@fbincon/statusline-core/editor/instances';
import { openSources, sourcesKey, performSourceAction, type SourceBackend } from '@fbincon/statusline-core/editor/source-manager';
import type { SourceMutationResult } from '@fbincon/statusline-core/contracts/ui';

test('an external save conflict keeps the terminal and draft open until explicit cancellation', {timeout:5000}, async ()=>{
  const state=fixture(), before=JSON.stringify(state.editor.draft);
  const input=Object.assign(new PassThrough(),{isTTY:true,isRaw:false,setRawMode(value:boolean){this.isRaw=value;return this;}});
  const output=Object.assign(new PassThrough(),{isTTY:true,columns:80,rows:24});
  let attempts=0, sent=false, cancelled=false;
  const backend={request(operation:string){
    if(operation==='preview') return state.preview;
    if(operation==='apply') { attempts++;throw new BackendError('configuration_conflict','Concurrent configuration changed'); }
    throw new Error('Unexpected operation');
  }} as Backend;
  output.on('data',(data:Buffer)=>{
    const text=data.toString();
    if(!sent && text.includes('Configure Status Line')) {sent=true;setImmediate(()=>input.write('\x13'));}
    if(!cancelled && text.includes('Concurrent configuration changed')) {cancelled=true;setImmediate(()=>input.write('\x1b'));}
  });
  const result=await new Session(state,backend).run({input:input as never,output:output as never,term:'xterm-256color'});
  assert.equal(result.outcome,'cancelled',result.message);assert.equal(attempts,1);assert.equal(cancelled,true);
  assert.equal(JSON.stringify(state.editor.draft),before);assert.equal(input.isRaw,false);
});

test('external uncertain saves freeze mutations and reconcile four outcomes without another apply in six languages', async () => {
  for(const language of LANGUAGES)for(const outcome of ['saved','not_committed','conflict','unknown'] as const) {
    const state=fixture(language),e=state.editor,baseline=e.baseline;
    e.toggle('main',e.selected.main);const submitted=copyDraft(e.draft);let attempts=0;
    const backend={request(operation:string){
      if(operation==='apply'){attempts++;throw new BackendError('io_error','Reply lost');}
      if(operation==='read'){
        if(outcome==='unknown')throw new Error('Read unavailable');
        return outcome==='saved'?{...baseline,draft:submitted,revision:'1'.repeat(64)}:outcome==='conflict'?{...baseline,revision:'2'.repeat(64)}:baseline;
      }
      if(operation==='preview')return state.preview;
      throw new Error('Unexpected operation '+operation);
    }} as Backend;
    const session=new Session(state,backend);await assert.rejects(session.save());
    assert.equal(e.saveState,'unknown');
    assert.equal(e.toggle('main',e.selected.main),false);assert.equal(e.instanceAction('main','copy'),false);assert.equal(e.move('main',1),false);
    e.replaceDraft(baseline.draft);e.page='settings';
    const form=formRows(state).find(row=>row.key==='field:theme')!;assert.equal(setFormValue(state,form,'dark'),false);
    e.setBuffer('padding','12');assert.equal(e.acceptNumeric(),false);
    assert.equal(await session.key({key:'escape'}),null);
    assert.deepEqual(e.draft,submitted);assert.equal(attempts,1);
    await session.key({key:'k',ctrl:true});
    assert.equal(e.saveState,outcome==='unknown'?'unknown':'idle');assert.equal(attempts,1);assert.deepEqual(e.draft,submitted);
    if(outcome!=='unknown')assert(e.toggle('main',e.selected.main));
  }
});

test('open source managers block bind side effects and unbind while a save is unresolved, including late replies',{timeout:5000},async()=>{
  const state=fixture(),e=state.editor,node=newInstance('external-value',e.draft.display.instances);
  node.source={binding:'old',hint:'Local'};e.draft.display.instances.push(node);openSources(e);
  const m=e.sources!;
  const library:SourceMutationResult={version:2,revision:'0'.repeat(64),automatic:[],bindings:[{id:'old',source_id:'local'}],backup_dir:null,sources:[{id:'local',name:'Local',kind:'json',enabled:true,revision:'r1',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{path:'/value.json',pointer:'/value',observed_at_pointer:'/observed_at',unit:''}}]};
  m.library=library;m.selected='local';m.page='unbind';m.effect=null;
  const submitted=copyDraft(e.draft);e.beginSave();e.saveFailed('io_error');
  sourcesKey(e,{key:'enter'});assert.deepEqual(e.draft,submitted);
  let calls=0;const backend={request(){calls++;throw new Error('Blocked bind reached backend');}} as SourceBackend;
  m.effect='bind';m.target={scope:'main',id:node.id};await performSourceAction(e,backend);assert.equal(calls,0);
  e.reconcileSave(e.baseline);
  let release:(value:SourceMutationResult)=>void=()=>assert.fail('Bind did not begin');
  m.effect='bind';const delayed={request:(operation:string)=>operation==='source_draft'?Promise.resolve({revision:'pins'}):new Promise<SourceMutationResult>(resolve=>{release=resolve;})};const pending=performSourceAction(e,delayed as unknown as SourceBackend);await new Promise(resolve=>setImmediate(resolve));
  e.beginSave();e.saveFailed('io_error');e.reconcileSave(e.baseline);
  release({...library,binding:{binding:'late',hint:'Local'}});await pending;
  assert.deepEqual(e.draft,submitted);assert.equal(node.source.binding,'old');
});
