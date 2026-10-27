import {expect,test} from 'claude-code/testing';
import {setup,START,RUN,PANE,reply,keys,output} from '../fixtures.ts';
import type {SourcesResult,SourceJob} from '../../lib/generated-contracts.ts';

test('unknown native save keeps source inspection available while blocking unbind and bind',async($,on)=>{
  const f=setup(on),binding={binding:'binding',hint:'Local'};
  f.store.draft.display.instances.push({...JSON.parse(JSON.stringify(f.store.draft.display.instances[0]!)),id:'external',type_id:'external-value',source:binding});
  const library:SourcesResult={version:2,automatic:[],revision:'1'.repeat(64),bindings:[{id:'binding',source_id:'local'}],sources:[{id:'local',name:'Local',kind:'json',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{path:'/value.json',pointer:'/value',observed_at_pointer:'/observed_at',unit:''},enabled:true,revision:'r1'}]};
  f.behavior.process=(request,next)=>{
    if(request.operation==='sources_read')return {value:reply(library)};
    if(request.operation==='source_context')return {value:reply({project:null,session:null,agent:null,branch:null,head:null})};
    const result=next();
    if(request.operation==='apply')return {value:output('{')};
    return result;
  };
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,'3',' ','s',{key:'y',ctrl:true},'return');
  for(let i=0;i<9;i++)await keys(ui,'down');
  await keys(ui,'return','return');
  expect(f.calls.filter(c=>c.operation==='sources_apply').length).toBe(0);
  await keys(ui,{key:'g',ctrl:true},'return','down','down','down','return','return');
  expect(f.calls.filter(c=>c.operation==='sources_apply').length).toBe(0);
  await keys(ui,{key:'g',ctrl:true},{key:'g',ctrl:true},'k');
  expect(f.calls.filter(c=>c.operation==='apply').length).toBe(1);
  expect(f.store.draft.display.instances.find(node=>node.id==='external')!.source).toEqual(binding);
  await ui.unmount();
});

test('native source management refreshes only explicitly and cancels owned jobs on close',async($,on)=>{
  const f=setup(on),before=JSON.stringify(f.store.draft);
  const context={project:null,session:null,agent:null,branch:null,head:null};
  const library:SourcesResult={version:2,automatic:[],revision:'1'.repeat(64),bindings:[],sources:[{id:'command',name:'Command',kind:'command',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{executable:'/node',args:['-p','42'],cwd:'/project',input:{},output:'text',timeout_ms:5000},enabled:true,revision:'r1'}]};
  const job:SourceJob={version:2,trigger:'manual',identity:'a'.repeat(64),id:'job',source_id:'command',source_revision:'r1',owner:'editor',context,started_at:'2026-10-23T00:00:00Z',deadline_at:'2026-10-23T00:00:05Z',state:'running',reason:'running'};
  f.behavior.process=(request,next)=>{
    if(request.operation==='sources_read')return {value:reply(library)};
    if(request.operation==='source_context')return {value:reply(context)};
    if(request.operation==='source_refresh'){job.owner=String((request.payload as {owner:string}).owner);return {value:reply(job)};}
    if(request.operation==='source_cancel')return {value:reply({...job,state:'cancelled',reason:'cancelled'})};
    return next();
  };
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,{key:'y',ctrl:true});
  expect(f.calls.some(call=>call.operation==='source_refresh')).toBe(false);
  await keys(ui,'return','down','down','down','down','return');
  expect(f.calls.filter(call=>call.operation==='source_refresh').length).toBe(1);
  await keys(ui,{key:'g',ctrl:true},{key:'g',ctrl:true});
  expect(f.calls.filter(call=>call.operation==='source_cancel').length).toBe(1);
  expect(JSON.stringify(f.store.draft)).toBe(before);
  await ui.unmount();
});
