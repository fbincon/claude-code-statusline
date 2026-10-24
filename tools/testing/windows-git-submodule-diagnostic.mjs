// Diagnostic branch only. Retain product deadlines and inspect synthetic repos.
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {GitCollector} from '../../packages/cli/dist/src/runtime/git.js';
import {runtimeContext} from '../../packages/cli/dist/src/runtime/context.js';
import {runCommand} from '../../packages/platform/dist/src/command.js';
import {removeTree} from '../../packages/platform/dist/src/remove-tree.js';
const output=join(process.env.DIAGNOSTIC_ROOT,'git-diagnostic');fs.mkdirSync(output,{recursive:true});
const trace=(row)=>fs.appendFileSync(join(output,'commands.jsonl'),JSON.stringify({at:new Date().toISOString(),node:process.version,...row})+'\n');
const git=(cwd,...args)=>{const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',timeout:10000,windowsHide:true});assert.equal(r.status,0,JSON.stringify({args,status:r.status,error:r.error?.message,stderr:r.stderr}));};
for(let round=0;round<20;round++){
 const root=fs.mkdtempSync(join(tmpdir(),'git-submodule-probe-')),repo=join(root,'repo'),source=join(root,'source');
 try{
  for(const directory of [repo,source]){
   fs.mkdirSync(directory);git(directory,'init','-q','-b','main');
   for(const [name,value] of [['user.name','Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.autocrlf','false'],['core.hooksPath',join(root,'no-hooks')]])git(directory,'config',name,value);
   fs.writeFileSync(join(directory,'seed.txt'),'initial\n');git(directory,'add','.');git(directory,'commit','-q','-m','seed');
  }
  git(repo,'-c','protocol.file.allow=always','submodule','add','-q',source,'vendor/lib');git(repo,'add','--all');git(repo,'commit','-q','-m','module');
  fs.writeFileSync(join(repo,'vendor/lib/seed.txt'),'changed\n');
  for(let observation=0;observation<5;observation++){
   const calls=[];const start=performance.now();
   const collector=new GitCollector(runtimeContext(root),undefined,(spec,options)=>{
    const began=performance.now();
    try{const result=runCommand(spec,options);calls.push({args:spec.args,timeout:options.timeoutMs,elapsed_ms:performance.now()-began,code:result.code,stderr:result.stderr.toString('utf8').slice(-2000)});return result;}
    catch(error){calls.push({args:spec.args,timeout:options.timeoutMs,elapsed_ms:performance.now()-began,error:error.constructor.name,message:error.message});throw error;}
   });
   const result=collector.uncached(repo),pass=result.kind==='ok'&&String(result.unstaged)==='1';
   trace({round,observation,status:pass?'pass':'fail',elapsed_ms:performance.now()-start,result:{kind:result.kind,reason:result.reason,unstaged:String(result.unstaged)},calls});
   assert(pass,JSON.stringify({round,observation,result:{kind:result.kind,reason:result.reason},calls}));
  }
 }finally{removeTree(root);}
}
console.log(JSON.stringify({status:'pass',fresh_repositories:20,observations:100,product_deadline_ms:2000}));
