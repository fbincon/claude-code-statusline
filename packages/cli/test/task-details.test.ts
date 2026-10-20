import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { newRecord, mirrorState, type TaskStore } from '@fbincon/statusline-core/runtime/tasks/model';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { parseResponse } from '@fbincon/statusline-core/editor/backend';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/messages';
import { taskDetailLines } from '@fbincon/statusline-core/editor/task-detail';
import { setup, allFiles, pythonJson, observation } from './runtime-support.js';
import { detailService } from '../src/tasks/service.js';
import { main } from '../src/main.js';

test('read-only details retain frozen totals, count completed checklist tasks and show attributable nested agents', async t => {
    const f=setup(t);f.preferences(true);f.clock(5_000_000_000n);
    f.apply(observation('heartbeat'),observation('prompt',1,1100,{prompt:'p'}),
        observation('turn_start',2,1200,{prompt:'p',turn_id:'turn',payload:{}}),
        observation('agent_start',3,1300,{prompt:'p',agent:'parent',turn_id:'turn'}),
        observation('agent_start',4,1400,{prompt:'p',agent:'child',parent_agent_id:'parent'}),
        observation('task_snapshot',5,1500,{prompt:'p',payload:{provider:'tasks',tasks:[{id:'one',status:'completed'},{id:'two',status:'in_progress'}]}}));
    const record=newRecord('p',{wall_ns:1_000_000_000n,boot_ns:1_000_000_000n,boot_id:'test'});
    Object.assign(record,{status:'completed',duration_ns:2_000_000_000n,updated_wall_ns:3_000_000_000n,agent_ids:['parent','child']});
    const history:TaskStore={schema:4,session_id:'s',current_prompt_id:'p',turns:[record],updated_wall_ns:3_000_000_000n};
    mkdirSync(join(f.context.runtimeRoot,'turns'),{recursive:true});
    writeFileSync(join(f.context.runtimeRoot,'turns',sha256('s')+'.json'),pythonJson(mirrorState('s',history)));
    const before=allFiles(f.root), result=detailService({session_id:'s'},f.context);
    assert.equal(result.elapsed_seconds,2);assert.equal(result.active_seconds,null);
    assert.deepEqual(result.progress,{completed:1,total:2});
    assert.deepEqual(result.agents.map(a=>a.id),['parent','child']);
    assert.equal(result.agents[1]!.parent_id,'parent');
    for(const language of LANGUAGES) {
        const lines=taskDetailLines(result,language);
        assert(!lines.join('\n').includes('task.limit.'));assert(!lines.join('\n').includes('task.value.'));
    }
    parseResponse('task_details',{exitCode:0,stderr:'',stdout:JSON.stringify({protocol_version:PROTOCOL_VERSION,result})});
    let stdout='';
    assert.equal(await main(['task','show','--session-id','s','--json'],{configDir:f.root,runtime:f.context,hostVersion:()=>assert.fail('Task inspection detected a host process'),stdout:s=>{stdout+=s;},stderr:s=>assert.fail(s)}),0);
    assert.equal(JSON.parse(stdout).prompt_id,'p');
    assert.deepEqual(allFiles(f.root),before);
});

test('details never pick an unrelated last task, read another session or create missing stores', t => {
    const f=setup(t), missing=join(f.root,'absent'), context={...f.context,configDir:missing,runtimeRoot:join(missing,'runtime')};
    assert.equal(detailService({session_id:'s'},context).prompt_id,null);
    assert.equal(existsSync(missing),false);
    const row=newRecord('other',f.context.sample()); row.updated_wall_ns=1_000_000_000n;
    const history:TaskStore={schema:4,session_id:'s',current_prompt_id:null,turns:[row],updated_wall_ns:1_000_000_000n};
    mkdirSync(join(f.context.runtimeRoot,'turns'),{recursive:true});
    const path=join(f.context.runtimeRoot,'turns',sha256('s')+'.json');
    writeFileSync(path,pythonJson({schema:1,session_id:'s',lifecycle:history}));
    assert.equal(detailService({session_id:'s'},f.context).prompt_id,null);
    assert.equal(detailService({session_id:'s',prompt_id:'missing'},f.context).elapsed_seconds,null);
    writeFileSync(path,pythonJson({schema:1,session_id:'another',lifecycle:history}));
    assert.equal(detailService({session_id:'s'},f.context).evidence[0]!.status,'session_mismatch');
    assert.throws(()=>detailService({session_id:''},f.context));
});

test('future records, stale live state, missing start events and corrupt inputs preserve uncertainty', t => {
    const f=setup(t);f.preferences(true);f.clock(10_000_000_000n);
    const turn=newRecord('p',{wall_ns:1_000_000_000n,boot_ns:null,boot_id:null});
    turn.updated_wall_ns=11_000_000_000n;
    const history:TaskStore={schema:4,session_id:'s',current_prompt_id:'p',turns:[turn],updated_wall_ns:11_000_000_000n};
    mkdirSync(join(f.context.runtimeRoot,'turns'),{recursive:true});
    const path=join(f.context.runtimeRoot,'turns',sha256('s')+'.json');
    writeFileSync(path,pythonJson(mirrorState('s',history)));
    let r=detailService({session_id:'s'},f.context);
    assert.equal(r.elapsed_seconds,null);assert.equal(r.evidence[0]!.status,'newer_than_input');
    turn.updated_wall_ns=9_000_000_000n;turn.started_wall_ns=null;
    writeFileSync(path,pythonJson(mirrorState('s',history)));
    r=detailService({session_id:'s'},f.context);
    assert.equal(r.elapsed_seconds,null);assert.equal(r.active_seconds,null);
    f.clock(500_000_000_000n);
    r=detailService({session_id:'s'},f.context);
    assert.equal(r.evidence[0]!.freshness,'stale');
    writeFileSync(path,'{broken');
    assert.equal(detailService({session_id:'s'},f.context).evidence[0]!.status,'source_unavailable');
});

test('conflicting current pointers and duplicate supplied agent identities cannot imply attribution', t => {
    const f=setup(t);f.preferences(true);f.clock(5_000_000_000n);
    f.apply(observation('heartbeat'),observation('prompt',1,1100,{prompt:'live-task'}));
    const live=f.store.load('s')!;live.active_prompt_id=null;
    writeFileSync(join(f.context.runtimeRoot,'live',sha256('s')+'.json'),pythonJson(live));
    const turn=newRecord('lifecycle-task',f.context.sample()),history:TaskStore={schema:4,session_id:'s',current_prompt_id:turn.prompt_id,turns:[turn],updated_wall_ns:5_000_000_000n};
    mkdirSync(join(f.context.runtimeRoot,'turns'),{recursive:true});
    writeFileSync(join(f.context.runtimeRoot,'turns',sha256('s')+'.json'),pythonJson(mirrorState('s',history)));
    const before=allFiles(f.root),result=detailService({session_id:'s'},f.context);
    assert.equal(result.prompt_id,null);assert.equal(result.elapsed_seconds,null);
    assert(result.limitations.includes('ambiguous_current_task'));
    assert.equal(detailService({session_id:'s',prompt_id:turn.prompt_id},f.context).prompt_id,turn.prompt_id);
    assert.throws(()=>detailService({session_id:'s',host_agents:{observed_at:1000,agents:[{id:'a',name:'One'},{id:'a',name:'Two'}]}},f.context));
    assert.deepEqual(allFiles(f.root),before);
});

test('a fresh heartbeat for another task cannot refresh an old unfinished task or advance its elapsed time', t => {
    const f=setup(t);f.preferences(true);f.clock(500_000_000_000n);
    f.apply(observation('heartbeat',0,499000),observation('prompt',1,499001,{prompt:'old'}),
        observation('prompt',2,499002,{prompt:'new'}));
    const old=newRecord('old',{wall_ns:1_000_000_000n,boot_ns:1_000_000_000n,boot_id:'test'});
    const current=newRecord('new',{wall_ns:499_000_000_000n,boot_ns:499_000_000_000n,boot_id:'test'});
    const history:TaskStore={schema:4,session_id:'s',current_prompt_id:'new',turns:[old,current],updated_wall_ns:499_000_000_000n};
    mkdirSync(join(f.context.runtimeRoot,'turns'),{recursive:true});
    writeFileSync(join(f.context.runtimeRoot,'turns',sha256('s')+'.json'),pythonJson(mirrorState('s',history)));
    const before=allFiles(f.root),result=detailService({session_id:'s',prompt_id:'old'},f.context);
    assert.equal(result.prompt_id,'old');assert.equal(result.elapsed_seconds,null);assert.equal(result.active_seconds,null);
    assert.equal(result.evidence[0]!.freshness,'stale');
    assert.equal(result.evidence[1]!.scope,'session');
    assert.equal(result.evidence[1]!.freshness,'current');
    assert.equal(detailService({session_id:'s'},f.context).elapsed_seconds,1);
    assert.deepEqual(allFiles(f.root),before);
    Object.assign(old,{status:'completed',duration_ns:2_000_000_000n});
    writeFileSync(join(f.context.runtimeRoot,'turns',sha256('s')+'.json'),pythonJson(mirrorState('s',history)));
    const frozen=allFiles(f.root);
    assert.equal(detailService({session_id:'s',prompt_id:'old'},f.context).elapsed_seconds,2);
    assert.deepEqual(allFiles(f.root),frozen);
    history.turns=[current];
    writeFileSync(join(f.context.runtimeRoot,'turns',sha256('s')+'.json'),pythonJson(mirrorState('s',history)));
    const missing=allFiles(f.root),unobserved=detailService({session_id:'s',prompt_id:'old'},f.context);
    assert.equal(unobserved.status,null,'A noncurrent prompt without lifecycle evidence must not be inferred queued or running');
    assert(unobserved.limitations.includes('stale'));
    assert.deepEqual(allFiles(f.root),missing);
});

test('an older agent-list snapshot cannot overwrite a later terminal event or borrow heartbeat freshness', t => {
    const f=setup(t);f.preferences(true);f.clock(500_000_000_000n);
    f.apply(observation('heartbeat'),observation('prompt',1,1100,{prompt:'p'}),
        observation('turn_start',2,1200,{prompt:'p',turn_id:'turn',payload:{}}),
        observation('agent_start',3,1300,{prompt:'p',agent:'a',turn_id:'turn'}),
        observation('agents',4,1400,{payload:{agents:[{id:'a',parent_id:null,status:'running',local:true}]}}),
        observation('agent_end',5,1500,{prompt:'p',agent:'a'}),
        observation('heartbeat',6,499000));
    const before=allFiles(f.root),result=detailService({session_id:'s'},f.context),agent=result.agents.find(a=>a.id==='a')!;
    assert.equal(agent.status,'completed');
    assert.equal(agent.evidence[0]!.freshness,'stale');
    assert.equal(agent.evidence[0]!.observed_at,'1970-01-01T00:00:01.500Z');
    assert.deepEqual(allFiles(f.root),before);
    f.apply(observation('agents',7,499500,{payload:{agents:[{id:'a',parent_id:null,status:'running',local:true}]}}));
    const late=allFiles(f.root);
    assert.equal(detailService({session_id:'s'},f.context).agents.find(a=>a.id==='a')!.status,'completed');
    assert.deepEqual(allFiles(f.root),late);
    f.apply(observation('agent_end',8,499600,{prompt:'p',agent:'a',payload:{ended_at_ms:499600,status:'failed'}}),
        observation('agents',9,499700,{payload:{agents:[{id:'a',parent_id:null,status:'completed',local:true}]}}));
    const failed=allFiles(f.root);
    assert.equal(detailService({session_id:'s'},f.context).agents.find(a=>a.id==='a')!.status,'failed');
    assert.deepEqual(allFiles(f.root),failed);
    f.apply(observation('agent_start',10,499800,{prompt:'p',agent:'b',turn_id:'new-turn'}),
        observation('agents',11,499900,{payload:{agents:[{id:'a',parent_id:null,status:'completed',local:true},{id:'b',parent_id:null,status:'running',local:true}]}}));
    const active=allFiles(f.root),updated=detailService({session_id:'s'},f.context);
    assert.equal(updated.agents.find(a=>a.id==='a')!.status,'failed');
    assert.equal(updated.agents.find(a=>a.id==='b')!.status,'running');
    assert.deepEqual(allFiles(f.root),active);
});

test('checklist evidence keeps its own timestamp and excludes future counts despite a fresh session heartbeat', t => {
    const f=setup(t);f.preferences(true);f.clock(500_000_000_000n);
    f.apply(observation('heartbeat'),observation('prompt',1,1100,{prompt:'p'}),
        observation('task_snapshot',2,1200,{prompt:'p',payload:{provider:'tasks',tasks:[{id:'one',status:'completed'}]}}),
        observation('heartbeat',3,499000));
    const live=f.store.load('s')!,list=Object.values(live.checklists)[0]!;
    const path=join(f.context.runtimeRoot,'live',sha256('s')+'.json');
    list.updated_at_ms=501000;writeFileSync(path,pythonJson(live));
    let before=allFiles(f.root),result=detailService({session_id:'s'},f.context);
    assert.equal(result.progress,null);
    assert.equal(result.evidence.find(e=>e.source==='native.checklist')!.freshness,'newer_than_input');
    assert.deepEqual(allFiles(f.root),before);
    list.updated_at_ms=1200;writeFileSync(path,pythonJson(live));
    before=allFiles(f.root);result=detailService({session_id:'s'},f.context);
    assert.deepEqual(result.progress,{completed:1,total:1});
    const evidence=result.evidence.find(e=>e.source==='native.checklist')!;
    assert.equal(evidence.observed_at,'1970-01-01T00:00:01.200Z');assert.equal(evidence.freshness,'stale');
    assert.deepEqual(allFiles(f.root),before);
});

test('future native prompt or turn observations cannot supply current status, while independent frozen history remains usable', t => {
    const f=setup(t);f.preferences(true);f.clock(5_000_000_000n);
    f.apply(observation('heartbeat'),observation('prompt',1,1100,{prompt:'p'}));
    const path=join(f.context.runtimeRoot,'live',sha256('s')+'.json'),live=f.store.load('s')!;
    live.prompts.p!.updated_at_ms=6000;writeFileSync(path,pythonJson(live));
    let before=allFiles(f.root),result=detailService({session_id:'s'},f.context);
    assert.equal(result.status,null);
    assert.equal(result.evidence.find(e=>e.source==='native.prompt')!.freshness,'newer_than_input');
    assert.deepEqual(allFiles(f.root),before);
    live.prompts.p!.updated_at_ms=1100;writeFileSync(path,pythonJson(live));
    f.apply(observation('turn_start',2,1200,{prompt:'p',turn_id:'turn',payload:{}}),
        observation('turn_end',3,6000,{prompt:'p',turn_id:'turn',payload:{status:'completed'}}));
    before=allFiles(f.root);result=detailService({session_id:'s'},f.context);
    assert.equal(result.status,null);
    assert.equal(result.evidence.find(e=>e.source==='native.turn')!.observed_at,'1970-01-01T00:00:06.000Z');
    assert.deepEqual(allFiles(f.root),before);
    const record=newRecord('p',{wall_ns:1_000_000_000n,boot_ns:1_000_000_000n,boot_id:'test'});
    Object.assign(record,{status:'completed',duration_ns:2_000_000_000n,updated_wall_ns:3_000_000_000n});
    const history:TaskStore={schema:4,session_id:'s',current_prompt_id:'p',turns:[record],updated_wall_ns:3_000_000_000n};
    mkdirSync(join(f.context.runtimeRoot,'turns'),{recursive:true});
    writeFileSync(join(f.context.runtimeRoot,'turns',sha256('s')+'.json'),pythonJson(mirrorState('s',history)));
    before=allFiles(f.root);result=detailService({session_id:'s'},f.context);
    assert.equal(result.status,'completed');assert.equal(result.elapsed_seconds,2);
    assert.equal(result.evidence.find(e=>e.source==='native.turn')!.freshness,'newer_than_input');
    assert.deepEqual(allFiles(f.root),before);
});
