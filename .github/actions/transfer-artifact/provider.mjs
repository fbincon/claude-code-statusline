import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {Worker} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {normalizedDigest,artifactName} from '../../../tools/checks/ci-transfer.ts';
import {responseError} from '../../../tools/checks/ci-transfer-policy.ts';
import {MAX_ZIP,extract} from './files.mjs';

function https(url){const u=new URL(url);assert(u.protocol==='https:'&&!u.username&&!u.password,'Invalid signed URL');return u.href;}
function uploadWorker(data) {
    return new Promise((resolve,reject)=>{
        const worker=new Worker(new URL('./sdk-upload.mjs',import.meta.url),{workerData:data,stdout:true,stderr:true});
        worker.stdout.resume();worker.stderr.resume();let received=false;
        const stop=(done)=>{if(received)return;received=true;clearTimeout(timer);worker.terminate().then(done,reject);};
        const timer=setTimeout(()=>stop(()=>reject(Object.assign(new Error('SDK upload timeout'),{code:'ETIMEDOUT'}))),150_000);
        worker.once('message',message=>stop(()=>message.error?reject(Object.assign(new Error(message.error.message),message.error)):resolve(message.result)));
        worker.once('error',error=>stop(()=>reject(error)));worker.once('exit',()=>{if(!received)stop(()=>reject(new Error('Upload worker exited without confirmation')));});
    });
}
export function provider({sdk,token,runId,stage}) {
    const require=createRequire(join(sdk,'package.json'));
    const {HttpClient}=require('@actions/http-client');
    const {internalArtifactTwirpClient}=require('@actions/artifact/lib/internal/shared/artifact-twirp-client.js');
    const {getBackendIdsFromToken}=require('@actions/artifact/lib/internal/shared/util.js');
    const yauzl=require('yauzl'),repo=process.env.GITHUB_REPOSITORY;
    assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repo)); assert(token);
    // Separate clients: the signed storage request never carries the API or runtime token.
    const makeClient=()=>new HttpClient('statusline-ci-transfer',[],{allowRetries:true,maxRetries:2,allowRedirects:false,socketTimeout:30_000});
    const api=makeClient(),storage=makeClient(),headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json'};
    const apiUrl=id=>'https://api.github.com/repos/'+repo+'/actions/artifacts/'+id;
    async function check(response,status){
        if(response.message.statusCode===status)return response.message;
        response.message.resume(); throw responseError({status:response.message.statusCode,headers:new Headers(response.message.headers)});
    }
    async function get(client,url,auth) {
        try{return await client.get(url,auth);}
        catch(error){if(!error.code&&/^Request timeout:/u.test(error.message))error.code='ETIMEDOUT';throw error;}
    }
    async function metadata(id) {
        const response=await get(api,apiUrl(id),headers);await check(response,200);
        let size=0;const chunks=[];
        for await(const chunk of response.message){size+=chunk.length;assert(size<=1024*1024,'Artifact metadata limit exceeded');chunks.push(chunk);}
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.equal(body.id,id);assert.equal(body.workflow_run?.id,runId,'Artifact belongs to another run');
        assert.equal(body.expired,false);assert(Date.parse(body.expires_at)>Date.now(),'Artifact expired');
        assert(Number.isSafeInteger(body.size_in_bytes)&&body.size_in_bytes>0&&body.size_in_bytes<=MAX_ZIP,'Invalid artifact archive size');
        return {id,name:artifactName(body.name),digest:normalizedDigest(body.digest),size:body.size_in_bytes};
    }
    async function blob(object,url,output) {
        const response=await get(storage,https(url));const stream=await check(response,200);
        const zip=join(stage,'archive-'+object.id+'-'+Math.random().toString(36).slice(2)+'.zip');
        const hash=createHash('sha256');let size=0;
        const tap=new Transform({transform(bytes,enc,done){size+=bytes.length;if(size>object.size||size>MAX_ZIP)return done(new Error('Artifact size mismatch'));hash.update(bytes);done(null,bytes);}});
        try {
            await pipeline(stream,tap,fs.createWriteStream(zip,{flags:'wx',mode:0o600}));
            assert.equal(size,object.size,'Artifact byte count mismatch');assert.equal(normalizedDigest(hash.digest('hex')),object.digest,'Artifact digest mismatch');
            await extract(yauzl,zip,output);
        } finally {fs.rmSync(zip,{force:true});}
    }
    return {
        metadata,
        async download(object,output) {
            const response=await get(api,apiUrl(object.id)+'/zip',headers);const msg=await check(response,302);msg.resume();
            await blob(object,msg.headers.location,output);
        },
        async list(name) {
            const ids=getBackendIdsFromToken(), client=internalArtifactTwirpClient();
            const result=await client.ListArtifacts({...ids,nameFilter:{value:name}});
            return result.artifacts.map(a=>{
                assert.equal(a.name,name);const id=Number(a.databaseId);assert(Number.isSafeInteger(id)&&id>0);
                // Only newly finalized candidates need a digest; old other-attempt artifacts are never reused.
                return {id,name,digest:a.digest?.value??'',own:a.workflowRunBackendId===ids.workflowRunBackendId && a.workflowJobRunBackendId===ids.workflowJobRunBackendId};
            });
        },
        async upload(params) {
            const r=await uploadWorker({...params,sdk});assert(Number.isSafeInteger(r.id)&&r.id>0);
            return {id:r.id,name:params.name,digest:normalizedDigest(r.digest)};
        },
        async original(object,output) {
            const ids=getBackendIdsFromToken(), client=internalArtifactTwirpClient();
            const res=await client.ListArtifacts({...ids,idFilter:{value:String(object.id)}});
            assert.equal(res.artifacts.length,1,'Ambiguous original artifact');
            const a=res.artifacts[0];assert.equal(a.workflowRunBackendId,ids.workflowRunBackendId);assert.equal(a.workflowJobRunBackendId,ids.workflowJobRunBackendId);
            assert.equal(a.name,object.name);assert.equal(Number(a.databaseId),object.id);
            const digest=normalizedDigest(a.digest?.value??object.digest);assert.equal(digest,normalizedDigest(object.digest));const size=Number(a.size);
            assert(Number.isSafeInteger(size)&&size>0&&size<=MAX_ZIP);
            const signed=await client.GetSignedArtifactURL({...ids,name:object.name});
            await blob({...object,digest,size},signed.signedUrl,output);
        },
        close(){api.dispose();storage.dispose();}
    };
}
