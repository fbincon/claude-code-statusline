import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,writeFileSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync,spawn } from 'node:child_process';
import { SourceService } from '../src/sources/service.js';
import { ConfigurationService } from '../src/config/service.js';
import { createStorage } from '../src/config/storage.js';
import { contextFor } from '../src/sources/context.js';

test('real shared workers survive one CLI signal and terminate only after the last consumer releases', {timeout:30000},async t=>{
  const root=mkdtempSync(join(tmpdir(),'source consumers 中文 ')),configDir=join(root,'config'),entry=join(root,'worker.mjs');
  const module=(path:string)=>new URL(path,import.meta.url).href;
  const configuration=new ConfigurationService({configDir,hostVersion:()=>null,launch:{executable:process.execPath,args:[entry]}},createStorage());
  const source=new SourceService(configuration),jobs:string[]=[];
  let cli:ReturnType<typeof spawn>|undefined;
  const wait=async(condition:()=>boolean)=>{const end=Date.now()+10000;while(!condition()&&Date.now()<end)await new Promise(r=>setTimeout(r,25));assert(condition(),'Expected process state was not reached');};
  t.after(async()=>{
    cli?.kill();for(const id of jobs)try{source.cancel(id);}catch{}
    await wait(()=>jobs.every(id=>existsSync(join(root,id+'.done'))));
    rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  });
  execFileSync('git',['init','--initial-branch=main',root],{stdio:'pipe'});
  execFileSync('git',['-C',root,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-m','fixture'],{stdio:'pipe'});
  writeFileSync(entry,`
import {writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {SourceService} from ${JSON.stringify(module('../src/sources/service.js'))};
import {ConfigurationService} from ${JSON.stringify(module('../src/config/service.js'))};
import {createStorage} from ${JSON.stringify(module('../src/config/storage.js'))};
import {runSourceProcess} from ${JSON.stringify(new URL('../../../platform/dist/src/source-process.js',import.meta.url).href)};
const id=process.argv.at(-1),root=${JSON.stringify(root)};
const cfg=new ConfigurationService({configDir:${JSON.stringify(configDir)},hostVersion:()=>null,launch:{executable:process.execPath,args:[]}},createStorage());
const service=new SourceService(cfg,Date.now,undefined,async(source,context,signal)=>{
  const script='const fs=require("node:fs");fs.writeFileSync(process.argv[1],"");const timer=setInterval(()=>{if(fs.existsSync(process.argv[2])){clearInterval(timer);process.stdout.write("42");}},25);';
  const result=await runSourceProcess({executable:process.execPath,args:['-e',script,join(root,id+'.started'),join(root,id+'.finish')],cwd:root,input:'',timeoutMs:15000,signal});
  return {version:1,source_id:source.id,source_revision:source.revision,context,observed_at:new Date().toISOString(),state:result.reason==='completed'?'valid':'error',reason:result.reason==='completed'?'valid':result.reason,value:result.reason==='completed'?42:null,unit:null};
});
try{await service.work(id);}finally{writeFileSync(join(root,id+'.done'),'');}
`);
  const change=(action:string,fields={})=>source.mutate({action,id:'shared',expected_revision:source.read().revision,...fields});
  change('add',{source:{name:'Shared',kind:'github',scope:{project:root,session:null,agent:null},ttl_seconds:300,settings:{repository:'example/project',branch:'main',account:'example'}}});
  change('enable',{review_revision:source.review('shared').review_revision});const binding=change('bind').binding!;
  const context=contextFor(root),first=source.start('shared',context,'editor-a');jobs.push(first.id);source.start('shared',context,'editor-b');
  await wait(()=>existsSync(join(root,first.id+'.started')));
  const cliEntry=fileURLToPath(new URL('../src/entry.js',import.meta.url));
  const args=['source','--config-dir',configDir,'refresh','shared','--project',root,'--json'];
  // Windows kill() force-terminates Node instead of delivering its signal event.
  // An IPC trigger exercises the same production handler there; POSIX uses SIGTERM.
  cli=process.platform==='win32'?spawn(process.execPath,['--input-type=module','-e',`process.on('message',()=>process.emit('SIGTERM'));try{await import(${JSON.stringify(new URL('../src/entry.js',import.meta.url).href)});}finally{process.disconnect();}`,'consumer-cli',...args],{stdio:['ignore','pipe','pipe','ipc']}):spawn(process.execPath,[cliEntry,...args],{stdio:'pipe'});
  const exited=new Promise<number|null>((resolve,reject)=>{cli!.once('exit',resolve);cli!.once('error',reject);});
  await wait(()=>source.job(first.id).consumers.length===3);if(process.platform==='win32')cli.send('interrupt');else cli.kill('SIGTERM');assert.equal(await exited,2);cli=undefined;
  assert.equal(source.job(first.id).state,'running');assert.deepEqual(source.job(first.id).consumers.map(c=>c.owner),['editor-a','editor-b']);
  source.release(first.id,'editor-a');assert.equal(source.job(first.id).state,'running');
  writeFileSync(join(root,first.id+'.finish'),'');await wait(()=>existsSync(join(root,first.id+'.done')));
  assert.equal(source.job(first.id).state,'completed');assert.equal(source.view(binding,context).value,42);
  const second=source.start('shared',context,'only-editor');jobs.push(second.id);await wait(()=>existsSync(join(root,second.id+'.started')));
  source.release(second.id,'only-editor');await wait(()=>existsSync(join(root,second.id+'.done')));
  assert.equal(source.job(second.id).state,'cancelled');assert.equal(source.job(second.id).reason,'no_consumers');
  assert.equal(source.view(binding,context).value,42,'a cancelled late worker cannot replace the prior result');
});
