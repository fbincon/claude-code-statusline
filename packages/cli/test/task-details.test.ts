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
    assert.equal(detailService({session_id:'s'},f.context).elapsed_seconds,1);
    assert.deepEqual(allFiles(f.root),before);
    Object.assign(old,{status:'completed',duration_ns:2_000_000_000n});
    writeFileSync(join(f.context.runtimeRoot,'turns',sha256('s')+'.json'),pythonJson(mirrorState('s',history)));
    const frozen=allFiles(f.root);
    assert.equal(detailService({session_id:'s',prompt_id:'old'},f.context).elapsed_seconds,2);
    assert.deepEqual(allFiles(f.root),frozen);
});
