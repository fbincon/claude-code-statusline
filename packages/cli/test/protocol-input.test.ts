import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { setup, observation, allFiles, assert, pythonJson } from './runtime-support.js';

for (const command of ['runtime', 'ui'] as const) test(`${command} waits for real pipe input without initializing terminal streams`, { timeout: 30000 }, async t => {
    const f = setup(t);f.preferences(true, false);
    f.apply(observation(), observation('prompt', 1, 1010, {prompt:'p'}));
    const before = allFiles(f.root), main = new URL('../src/main.js', import.meta.url).href;
    // Notify the parent immediately before the real synchronous stdin read.
    // The producer then sends later: an accidentally initialized nonblocking
    // pipe would fail with EAGAIN instead of waiting for these actual bytes.
    const program = `import fs from 'node:fs';import{syncBuiltinESMExports}from'node:module';let notified=false;const note=fd=>{if(fd===0&&!notified){notified=true;process.send('input-read');}};for(const name of ['readSync','readFileSync']){const original=fs[name];fs[name]=function(fd,...args){note(fd);return original.call(this,fd,...args);};}syncBuiltinESMExports();const{main}=await import(${JSON.stringify(main)});process.exitCode=await main(${JSON.stringify([command,'--config-dir',f.root])});process.disconnect();`;
    const child = spawn(process.execPath, ['--input-type=module','-e',program], { env:{...process.env,CLAUDE_STATUSLINE_RUNTIME_DIR:f.context.runtimeRoot}, stdio:['pipe','pipe','pipe','ipc'] });
    const input=child.stdin,output=child.stdout,errors=child.stderr;assert(input&&output&&errors);
    let stdout='',stderr='',requested=false,timer:NodeJS.Timeout|undefined;
    output.setEncoding('utf8');errors.setEncoding('utf8');
    output.on('data', value=>{stdout+=value;});errors.on('data',value=>{stderr+=value;});
    input.on('error',()=>{});
    t.after(()=>{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
    child.on('message', message=>{
        if(message!=='input-read'||requested)return;requested=true;
        const payload=command==='runtime'?{protocol_version:2,operation:'observe',payload:{observations:[observation('agent_start',2,1020,{prompt:'p',agent:'delayed'})]}}:{protocol_version:PROTOCOL_VERSION,operation:'describe',payload:{}};
        timer=setTimeout(()=>input.end(pythonJson(payload)),50);
    });
    const [code]=await once(child,'close');
    assert(requested,'The public command never reached its actual input reader');
    assert.equal(code,0,stdout+stderr);assert.equal(stderr,'');
    const response=JSON.parse(stdout);assert.equal(response.protocol_version,command==='runtime'?2:PROTOCOL_VERSION);assert(response.result);
    if(command==='runtime'){
        assert.equal(response.result.accepted,1);assert.equal(response.result.ignored,0);assert(f.store.load('s')!.agents.delayed);
    }else assert.deepEqual(allFiles(f.root),before,'The describe request changed configuration or runtime state');
});
