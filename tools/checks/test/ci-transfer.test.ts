import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {boundedUpload,boundedDownload,normalizedDigest,type ScopedObject,type TransferProgress} from '../ci-transfer.ts';
import {isTransient,responseError,recoveryDelay,retryRead} from '../ci-transfer-policy.ts';

const err=(status:number)=>Object.assign(new Error('HTTP '+status),{status});
test('only explicit service and temporary transport failures permit bounded retries',async()=>{
    for(const status of [408,429,500,502,503,504])assert(isTransient(err(status)));
    for(const status of [400,401,403,404,409,410,413,422,451,501,505])assert(!isTransient(err(status)));
    for(const code of ['ECONNRESET','EAI_AGAIN','ETIMEDOUT','UND_ERR_SOCKET'])assert(isTransient({cause:{code}}));
    for(const code of ['ERR_ASSERTION','ENOSPC','EACCES','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ENOTFOUND'])assert(!isTransient({code}));
    assert(!isTransient({code:'CERT_HAS_EXPIRED',cause:{code:'ECONNRESET'}}));
    assert(!isTransient(new Error('Artifact download failed after 5 retries.')));
    assert(isTransient(new Error('Failed to FinalizeArtifact: Failed to make request after 5 attempts: Failed request: (503) Service Unavailable')));
    assert(!isTransient(new Error('Failed to FinalizeArtifact: Received non-retryable error: Failed request: (403) Forbidden')));
    assert(isTransient(responseError(new Response(null,{status:403,headers:{'x-ratelimit-remaining':'0'}}))));
    assert(!isTransient(responseError(new Response(null,{status:403}))));
    const slow=responseError(new Response(null,{status:429,headers:{'retry-after':'60'}}));
    assert.equal(recoveryDelay(slow,1,1000),null);
    let calls=0;await assert.rejects(retryRead(async()=>{calls++;throw slow;},{maxDelayMs:0}));assert.equal(calls,1);
    calls=0;assert.equal(await retryRead(async()=>{if(++calls===1)throw err(502);return 9;},{maxDelayMs:0}),9);assert.equal(calls,2);
    calls=0;await assert.rejects(retryRead(async()=>{calls++;throw err(503);},{maxDelayMs:0}));assert.equal(calls,3);
});
test('an uncertain upload reconciles exactly its new finalized actor and bytes before a second transfer',async()=>{
    const name='ci-example',digest=normalizedDigest('b'.repeat(64));
    const old={id:390,name,digest,own:false},fresh={id:101,name,digest,own:true},progress:TransferProgress[]=[];
    let objects:ScopedObject[]=[old],calls=0,matched=0;
    const io={list:async()=>objects,upload:async()=>{calls++;objects=[old,fresh];throw err(503);},matches:async(a:ScopedObject|{id:number})=>{assert.equal(a.id,fresh.id);matched++;},
        wait:async()=>{},progress:(p:TransferProgress)=>progress.push(p)};
    assert.deepEqual(await boundedUpload(io),{id:101,name,digest});assert.equal(calls,1);assert.equal(matched,1);
    assert.deepEqual(progress.at(-1),{attempts:1,recovery:'reconciled'});
    for(const after of [[old,{...fresh,own:false}],[old,fresh,{...fresh,id:5}]]){
        objects=[old];calls=0;await assert.rejects(boundedUpload({...io,upload:async()=>{calls++;objects=after;throw err(503);}}));assert.equal(calls,1);
    }
    objects=[old];calls=0;await assert.rejects(boundedUpload({...io,matches:async()=>{throw new Error('Artifact digest mismatch');}}),/digest/u);assert.equal(calls,1);
    objects=[fresh];calls=0;await assert.rejects(boundedUpload(io),/already owns/u);assert.equal(calls,0);
});
test('the SDK may be invoked at most twice; denial, integrity, expiry and unchanged old objects cannot turn into acceptance',async()=>{
    let calls=0,second=false;const obj={id:5,name:'ci-x',digest:'sha256:'+'0'.repeat(64)};
    const io={list:async()=>[{...obj,id:900,own:false},...(second&&calls===2?[{...obj,own:true}]:[])],upload:async()=>{calls++;if(!second||calls<2)throw err(503);return obj;},
        matches:async(value:{id:number})=>{assert.equal(value.id,obj.id);},wait:async()=>{},progress:()=>{}};
    await assert.rejects(boundedUpload(io));assert.equal(calls,2);
    second=true;calls=0;assert.deepEqual(await boundedUpload(io),obj);assert.equal(calls,2);
    for(const status of [403,404,409,410]){calls=0;await assert.rejects(boundedUpload({...io,upload:async()=>{calls++;throw err(status);}}));assert.equal(calls,1);}
    calls=0;await assert.rejects(boundedDownload(async()=>{calls++;throw err(503);},async()=>{},()=>{}));assert.equal(calls,2);
    calls=0;await assert.rejects(boundedDownload(async()=>{calls++;throw new Error('digest mismatch');},async()=>{},()=>{}));assert.equal(calls,1);
});
test('the upload snapshot keeps the same file layout and digests and excludes hidden or linked inputs',async t=>{
    const url=pathToFileURL(join(process.cwd(),'.github/actions/transfer-artifact/files.mjs')).href;
    const {inventory}=await import(url),root=fs.mkdtempSync(join(tmpdir(),'artifact-files-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:4}));
    const input=join(root,'source'),out=join(root,'private');fs.mkdirSync(join(input,'nested'),{recursive:true});fs.mkdirSync(out);
    fs.writeFileSync(join(input,'.private'),'never upload');fs.writeFileSync(join(input,'nested','receipt.json'),'original');
    const snap=await inventory(input,out);assert.deepEqual(Object.keys(snap.manifest),['nested/receipt.json']);
    fs.writeFileSync(join(input,'nested','receipt.json'),'changed');assert.deepEqual((await inventory(out)).manifest,snap.manifest);
    const single=join(root,'single');fs.mkdirSync(single);assert.deepEqual(Object.keys((await inventory(join(input,'nested','receipt.json'),single)).manifest),['receipt.json']);
    assert.throws(()=>normalizedDigest('not sha256'));
    if(process.platform!=='win32'){fs.symlinkSync(out,join(input,'link'));await assert.rejects(inventory(input),/regular/u);}
    const action=fs.readFileSync(join(process.cwd(),'.github/actions/transfer-artifact/action.yml'),'utf8');assert.match(action,/using: node24/u);
    assert.equal(execFileSync(process.execPath,['--check',join(process.cwd(),'.github/actions/transfer-artifact/provider.mjs')]).length,0);
});

test('a late first finalize cannot be hidden behind a successful supplemental upload',async()=>{
    const obj={id:10,name:'ci-retry',digest:normalizedDigest('a'.repeat(64))};
    let calls=0;
    await assert.rejects(boundedUpload({
        list:async()=>calls<2?[]:[{...obj,id:9,own:true},{...obj,own:true}],
        upload:async()=>{if(++calls===1)throw err(503);return obj;},
        matches:async()=>{throw Error('ambiguous objects must not be downloaded');},
        wait:async()=>{},progress:()=>{},
    }),/Ambiguous/u);
    assert.equal(calls,2);
});

test('read deadline cancels a stalled response without starting another read',async()=>{
    let calls=0,observed:AbortSignal|undefined;
    await assert.rejects(retryRead(async signal=>{calls++;observed=signal;return new Promise<void>(()=>{});},{timeoutMs:30,maxDelayMs:0}),/deadline/u);
    assert.equal(calls,1);assert(observed?.aborted);
});

test('ZIP extraction rejects traversal, links, duplicates and corrupt bytes before acceptance',async t=>{
    const {Readable}=await import('node:stream'),{crc32}=await import('node:zlib');
    const {extract}=await import(pathToFileURL(join(process.cwd(),'.github/actions/transfer-artifact/files.mjs')).href);
    const temp=fs.mkdtempSync(join(tmpdir(),'bounded-zip-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true,maxRetries:3}));
    const body=Buffer.from('original'),entry={fileName:'nested/receipt.json',externalFileAttributes:0,generalPurposeBitFlag:0,compressionMethod:8,
        uncompressedSize:body.length,crc32:crc32(body)};
    const zip=(entries:typeof entry[])=>({open:(_path:unknown,_options:unknown,done:Function)=>done(null,{entryCount:entries.length,close(){},
        async *eachEntry(){yield*entries;},openReadStream:(_entry:unknown,next:Function)=>next(null,Readable.from(body))})});
    await extract(zip([entry]),'',join(temp,'pass'));assert(fs.readFileSync(join(temp,'pass/nested/receipt.json')).equals(body));
    let index=0;for(const list of [[{...entry,fileName:'../escaped'}],[{...entry,externalFileAttributes:0o120000*65536}],[entry,{...entry,fileName:'Nested/Receipt.JSON'}],[{...entry,crc32:1}]]){
        await assert.rejects(extract(zip(list),'',join(temp,'fail'+index++)));
    }
    assert(!fs.existsSync(join(temp,'escaped')));
});

test('a late server confirmation during backoff reuses its original ID; a second acknowledgment without a visible object fails',async()=>{
    const object={id:17,name:'ci-late',digest:normalizedDigest('c'.repeat(64))};
    let calls=0,reads=0,seen=0;
    const io={list:async()=>++reads>=3?[{...object,own:true}]:[],upload:async()=>{calls++;throw err(504);},
        matches:async()=>{seen++;},wait:async()=>{},progress:()=>{}};
    assert.deepEqual(await boundedUpload(io),object);assert.equal(calls,1);assert.equal(seen,1);
    calls=0;
    await assert.rejects(boundedUpload({...io,list:async()=>[],upload:async()=>{if(++calls===1)throw err(504);return object;}}),/Missing confirmed/u);
    assert.equal(calls,2);
});
