import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {parentPort,workerData} from 'node:worker_threads';
import {boundedUpload,boundedDownload,normalizedDigest,artifactName} from '../../../tools/checks/ci-transfer.ts';
import {bootstrap} from './bootstrap.mjs';
import {provider} from './provider.mjs';
import {inventory} from './files.mjs';
import {safeError} from './result.mjs';

async function run(c){
    const {root:sdk,key,cached}=bootstrap();parentPort.postMessage({bootstrap:{key,cached}});
    const io=provider({...c,sdk}),progress=p=>parentPort.postMessage({progress:p});
    const reset=()=>Object.assign(new Error('Injected temporary connection reset'),{code:'ECONNRESET'});
    try {
        if(c.operation==='upload'){
            const snapshot=join(c.stage,'source');fs.mkdirSync(snapshot);const {files,manifest}=await inventory(c.path,snapshot);
            let calls=0;
            const object=await boundedUpload({progress,wait,
                list:async()=>{
                    const list=await io.list(c.name);
                    if(c.fault==='ambiguous'&&calls&&list.length)return [...list,list.at(-1)];return list;
                },
                upload:async()=>{
                    calls++;
                    if(c.fault==='upload-reset'&&calls===1)throw reset();
                    const result=await io.upload({name:c.name,root:snapshot,files,retentionDays:c.retention,compressionLevel:c.compression});
                    if((c.fault==='upload-lost-ack'||c.fault==='ambiguous')&&calls===1)throw reset();
                    return result;
                },
                matches:async object=>{
                    if(!object.digest){const metadata=await io.metadata(object.id);assert.equal(metadata.name,object.name);object.digest=metadata.digest;}
                    object.digest=normalizedDigest(object.digest);
                    const original=join(c.stage,'reconciled');await io.original(object,original);
                    assert.deepEqual((await inventory(original)).manifest,manifest,'Artifact file manifest digest mismatch');
                }
            });return [object];
        }
        const result=join(c.stage,'result');fs.mkdirSync(result);
        const objects=new Array(c.ids.length), names=new Map(); let index=0,failed=false;
        async function lane(){
            while(!failed&&index<c.ids.length){
                const n=index++, id=c.ids[n];
                objects[n]=await boundedDownload(async attempt=>{
                    const work=fs.mkdtempSync(join(c.stage,'read-')),output=join(work,'payload');
                    try {
                        if(c.fault==='persistent-503')throw Object.assign(new Error('HTTP 503'),{status:503});
                        if(c.fault==='forbidden')throw Object.assign(new Error('HTTP 403'),{status:403});
                        const object=await io.metadata(id);
                        if(c.name)assert.equal(object.name,c.name,'Original artifact name differs');
                        if(c.expected)assert.equal(object.digest,c.expected,'Original artifact digest mismatch');
                        const key=object.name.toLowerCase();assert(!names.has(key)||names.get(key)===id,'Ambiguous download artifacts');names.set(key,id);
                        await io.download(c.fault==='digest-mismatch'?{...object,digest:'sha256:'+'0'.repeat(64)}:object,output);
                        if(c.fault==='download-reset'&&attempt===1){fs.writeFileSync(join(output,'discarded-partial.tmp'),'injected');throw reset();}
                        const direct=c.merge||Boolean(c.name);
                        fs.renameSync(output,direct?join(c.stage,'single'):join(result,artifactName(object.name)));
                        return {id,name:object.name,digest:object.digest};
                    }finally{fs.rmSync(work,{recursive:true,force:true,maxRetries:3});}
                },wait,progress).catch(error=>{failed=true;throw error;});
            }
        }
        const lanes=await Promise.allSettled(Array.from({length:Math.min(4,c.ids.length)},lane));
        for(const lane of lanes)if(lane.status==='rejected')throw lane.reason;
        return objects;
    }finally{io.close();}
}
try{parentPort.postMessage({objects:await run(workerData)});}
catch(e){parentPort.postMessage({error:safeError(e)});}
