// Diagnostic branch only. Does not modify product or release acceptance.
import fs from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {copyPackage} from '../../packages/platform/dist/src/package-copy.js';
import {resolvedPath} from '../../packages/platform/dist/src/commands.js';
import {removeTree} from '../../packages/platform/dist/src/remove-tree.js';
const output=join(process.env.DIAGNOSTIC_ROOT,'copy-diagnostic');
fs.mkdirSync(output,{recursive:true});
const record=value=>{fs.appendFileSync(join(output,'trace.jsonl'),JSON.stringify(value)+'\n');console.log(JSON.stringify(value));};
const describe=path=>{try{const s=fs.lstatSync(path);return {exists:true,directory:s.isDirectory(),mode:s.mode,ino:s.ino,dev:s.dev,children:s.isDirectory()?fs.readdirSync(path):null};}catch(error){return {exists:false,error:error.code};}};
let failed=false;
for(let round=0;round<1000;round++){
 const root=fs.mkdtempSync(join(tmpdir(),'package copy 中文 ')),source=join(root,'source'),target=join(root,'target');
 try{
  fs.mkdirSync(join(source,'nested'),{recursive:true});
  fs.writeFileSync(join(source,'nested','entry.js'),'#!/usr/bin/env node\n',{mode:0o755});
  fs.writeFileSync(join(source,'data'),Buffer.from([0,255,10]));
  for(const limits of [{entries:1,bytes:1024},{entries:16,bytes:1}]){
   const canonical=resolvedPath(target);let error;
   try{copyPackage(source,target,limits);}catch(e){error={message:e.message,code:e.code,stack:e.stack};}
   if(!error || !/exceeds its (entry|byte) limit/.test(error.message) || fs.existsSync(target)){
    record({kind:'failure',round,node:process.version,root,source,target,canonical,limits,error,raw:describe(target),resolved:describe(canonical),parent:describe(dirname(canonical))});
    for(const delay of [10,50,250]){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,delay);record({kind:'after-delay',delay,raw:describe(target),resolved:describe(canonical)});}
    failed=true;break;
   }
  }
 }finally{removeTree(root);}
 if(failed)break;
 if(round%100===0)record({kind:'progress',round,node:process.version});
}
const git=spawnSync('git',['lfs','version'],{encoding:'utf8',timeout:10000,windowsHide:true});
record({kind:'git-lfs-probe',status:git.status,signal:git.signal,error:git.error?{code:git.error.code,message:git.error.message}:null,stdout:git.stdout,stderr:git.stderr});
record({kind:'complete',failed,node:process.version});
process.exitCode=failed?1:0;
