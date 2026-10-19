import test from 'node:test';
import { setup, assert, join, existsSync } from './final-support.js';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { applyPreset, ROWS } from '@fbincon/statusline-core/config/presets';
import { DEFAULT_ITEM } from '@fbincon/statusline-core/config/defaults';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { ConfigurationProtocol } from '@fbincon/statusline-cli/ui/protocol';
import { previewAdapter } from '@fbincon/statusline-cli/rendering/preview';
import { parseResponse } from '@fbincon/statusline-core/editor/backend';
import { PROTOCOL_VERSION, type ExplainResult } from '@fbincon/statusline-core/contracts/ui';

test('explain and preview agree across all presets, scopes and width modes', async t=>{
  const f=setup(t), adapter=await previewAdapter('/test/home');
  for(const preset of Object.keys(ROWS)) for(const width of [40,80,120]) for(const separator of ['classic','powerline'] as const) {
    const display=applyPreset(defaultDisplay(),preset,()=> 'copy');display.separator_style=separator;
    const draft={display,host:{...DEFAULT_HOST,padding:2}};
    for(const scope of ['main','subagent'] as const) {
      const response=f.call('explain',{draft,scope,width});assert.equal(response.status,0);
      const result=parseResponse('explain',{exitCode:0,stdout:JSON.stringify(response.response),stderr:''});
      assert.deepEqual(result.preview,adapter(draft,width));assert.equal(result.actual_availability,'not_observed');
      assert.deepEqual(result.instances.map(i=>i.id),(scope==='main'?display.instances:display.subagents.instances).map(i=>i.id));
    }
  }
});
test('instance reasons distinguish conditions, configuration, clipping and priority omission', t=>{
  const f=setup(t);const display=defaultDisplay();
  const node=(id:string,type_id:string,extra={})=>({id,type_id,enabled:true,text:null,options:{...DEFAULT_ITEM,formatting:{},...extra}});
  display.instances=[node('off','pr'),node('hidden','context-used',{visibility:'used-at-least',visibility_threshold:90}),
    {...node('literal','text',{priority:100}),text:'中文标签'.repeat(50)},node('copy','model',{priority:1}),node('short','model',{priority:100,max_width:3})];
  display.instances[0]!.enabled=false;display.layout={mode:'explicit',rows:[['off','hidden','literal','copy'],['short']]};
  const result=f.call('explain',{draft:{display,host:{...DEFAULT_HOST}},scope:'main',width:40}).response.result as ExplainResult;
  const find=(id:string)=>result.instances.find(i=>i.id===id)!;
  assert.ok(find('off').reasons.some(r=>r.code==='configured_off'));assert.equal(find('off').samples.length,0);
  assert.equal(find('hidden').samples[0]!.outcome,'sample_condition_hidden');
  assert.equal(find('copy').samples[0]!.outcome,'sample_priority_omitted');
  assert.equal(find('literal').samples[0]!.truncated,true);assert.equal(find('short').samples[0]!.truncated,true);
});
test('explain is read-only and distinguishes disabled collectors, unsupported and unknown host evidence', async t=>{
  const f=setup(t), directory=join(f.root,'absent'), reads:string[]=[];
  const fail=()=>assert.fail('Explanation attempted a write, lock, or repair');
  const service=new ConfigurationService({...f.context,configDir:directory,hostVersion:()=>[2,1,200]},
    {...f.io,read:path=>{reads.push(path);return null;},lock:fail,write:fail,remove:fail,backup:fail});
  const protocol=new ConfigurationProtocol(service,await previewAdapter('/example'));
  const display=defaultDisplay();display.instances=[{id:'agents',type_id:'active-agents',enabled:true,text:null,options:{...DEFAULT_ITEM,formatting:{}}}];
  const request={draft:{display,host:{...DEFAULT_HOST}},scope:'main',width:80};
  const result=f.call('explain',request,protocol).response.result as ExplainResult;
  assert.ok(result.instances[0]!.reasons.some(r=>r.code==='live_metrics_off'));
  assert.equal(result.instances[0]!.samples[0]!.outcome,'sample_visible');
  assert.ok(reads.every(p=>p.endsWith('settings.json')||p.endsWith('claude-statusline-runtime.json')));
  assert.equal(reads.length,2);assert.equal(existsSync(directory),false);
  const agents=f.call('explain',{...request,scope:'subagent'},protocol).response.result as ExplainResult;
  assert.ok(agents.instances[0]!.reasons.some(r=>r.code==='unsupported_host'));
  service.context.hostVersion=()=>null;service.io.read=()=>{throw new Error('unreadable');};
  const unknown=f.call('explain',request,protocol).response.result as ExplainResult;
  assert.ok(unknown.instances[0]!.reasons.some(r=>r.code==='collector_unknown'));
  assert.ok(unknown.instances[0]!.reasons.some(r=>r.code==='unknown_host_version'));
  assert.ok(unknown.instances[0]!.reasons.some(r=>r.code==='installation_unknown'));
  assert.equal(existsSync(directory),false);
});
test('subagent explanations identify sample rows, status hiding, scope disablement and malformed envelopes', t=>{
  const f=setup(t), draft={display:defaultDisplay(),host:{...DEFAULT_HOST}};
  draft.display.subagents.hide_completed=true;
  let result=f.call('explain',{draft,scope:'subagent',width:40}).response.result as ExplainResult;
  assert.ok(result.instances.every(i=>i.samples.some(row=>row.row_id==='preview-completed'&&row.outcome==='sample_row_hidden')));
  draft.display.subagents.enabled=false;
  result=f.call('explain',{draft,scope:'subagent',width:40}).response.result;
  assert.ok(result.instances.every(i=>!i.samples.length&&i.reasons.some(r=>r.code==='scope_disabled')));
  for(const scope of ['all',null,1]) assert.equal(f.call('explain',{draft,scope,width:80}).status,2);
  assert.equal(f.call('explain',{draft,scope:'main',width:1}).status,2);
  assert.throws(()=>parseResponse('explain',{exitCode:0,stdout:JSON.stringify({protocol_version:PROTOCOL_VERSION,result:{...result,actual_availability:'missing'}}),stderr:''}));
});
