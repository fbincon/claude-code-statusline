import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import {artifactName,normalizedDigest} from '../../../tools/checks/ci-transfer.ts';
import {safeError} from './result.mjs';
const input=k=>(process.env['INPUT_'+k.toUpperCase()]??'').trim();
const emit=(k,v)=>fs.appendFileSync(process.env.GITHUB_OUTPUT,k+'='+v+'\n');
const present=p=>{try{fs.lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const limit=510_000,start=performance.now(),temp=process.env.RUNNER_TEMP;
const operation=input('operation'),receipt={schema_version:1,operation,status:'fail',recovery:'none',attempts:0,elapsed_ms:0,artifacts:[],
    run_id:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT),job:process.env.GITHUB_JOB};
let stage;
try{
    assert(temp&&process.env.GITHUB_OUTPUT&&process.env.GITHUB_ACTIONS==='true');assert(['upload','download'].includes(operation));
    const source=input('path');assert(source&&!/[\r\n]/u.test(source));const path=resolve(source);
    const runId=Number(input('run-id')||process.env.GITHUB_RUN_ID),name=input('name');if(name)artifactName(name);
    const expected=input('expected-digest')?normalizedDigest(input('expected-digest')):null;
    const ids=input('artifact-ids')?input('artifact-ids').split(',').map(v=>{assert(/^[1-9]\d*$/u.test(v.trim()));return Number(v.trim());}):[];
    const merge=input('merge-multiple')==='true';assert(['','true','false'].includes(input('merge-multiple')));
    const retention=Number(input('retention-days')||30),compression=Number(input('compression-level')||6);
    assert(Number.isSafeInteger(runId)&&runId>0);assert(Number.isInteger(retention)&&retention>=1&&retention<=30);assert(Number.isInteger(compression)&&compression>=0&&compression<=9);
    if(operation==='download'){
        assert(ids.length&&ids.length<=128&&new Set(ids).size===ids.length&&ids.every(v=>Number.isSafeInteger(v)&&v>0));
        assert(ids.length===1||(!merge&&!name&&!expected),'Multiple IDs require separate artifact directories');
        assert(!present(path),'Download destination already exists');fs.mkdirSync(dirname(path),{recursive:true});
    }else{assert(name&&!ids.length&&!expected&&!merge&&runId===receipt.run_id);}
    const fault=input('diagnostic-fault');
    if(fault) {
        assert(process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&process.env.GITHUB_REF_TYPE==='branch'&&['artifact-transfer-probe','artifact-transfer-readback'].includes(process.env.GITHUB_JOB));
        assert.equal(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).inputs.validation,'artifact-transfer-probe');
        assert((operation==='upload'?['upload-reset','upload-lost-ack','ambiguous']:['download-reset','persistent-503','digest-mismatch','forbidden']).includes(fault));
    }
    stage=fs.mkdtempSync(join(operation==='download'?dirname(path):temp,'.statusline-transfer-'));
    const config={stage,path,runId,name,expected,ids,retention,compression,merge,fault,operation,token:input('github-token')};
    const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:config,stdout:true,stderr:true});
    worker.stdout.resume();worker.stderr.resume();
    try{
        receipt.artifacts=await new Promise((done,fail)=>{
            const timer=setTimeout(()=>fail(new Error('Transfer deadline exceeded')),Math.max(1,limit-(performance.now()-start)));
            worker.once('error',e=>{clearTimeout(timer);fail(e);});
            worker.once('exit',code=>{clearTimeout(timer);fail(new Error('Transfer worker terminated: '+code));});
            worker.on('message',m=>{
                if(m.bootstrap)receipt.sdk=m.bootstrap;
                if(m.progress&&m.progress.attempts>=receipt.attempts){receipt.attempts=m.progress.attempts;receipt.recovery=m.progress.recovery;}
                if(m.error){clearTimeout(timer);fail(Object.assign(new Error(m.error),{sanitized:true}));}
                if(m.objects){clearTimeout(timer);done(m.objects);}
            });
        });
    }finally{await worker.terminate();}
    if(operation==='download'){assert(!present(path),'Download destination exists');fs.renameSync(join(stage,merge||name?'single':'result'),path);}
    if(receipt.artifacts.length===1){const o=receipt.artifacts[0];emit('artifact-id',o.id);emit('artifact-digest',normalizedDigest(o.digest).slice(7));}
    receipt.status='pass';
}catch(e){receipt.error=e.sanitized?e.message:safeError(e);process.exitCode=1;}
finally{
    try{if(stage)fs.rmSync(stage,{recursive:true,force:true,maxRetries:3,retryDelay:75});}
    catch{receipt.status='fail';receipt.error='Transfer cleanup failed';process.exitCode=1;}
    receipt.elapsed_ms=Math.round(performance.now()-start);
    const path=join(temp,'statusline-transfer-receipt-'+randomUUID()+'.json');fs.writeFileSync(path,JSON.stringify(receipt)+'\n',{mode:0o600,flag:'wx'});
    emit('receipt',path);emit('recovery',receipt.recovery);
    console.log(JSON.stringify(receipt));
}
