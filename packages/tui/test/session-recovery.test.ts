import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { Session, type Backend } from '../src/session.js';
import { fixture } from './fixtures.js';

test('an external save conflict keeps the terminal and draft open until explicit cancellation', {timeout:5000}, async ()=>{
  const state=fixture(), before=JSON.stringify(state.editor.draft);
  const input=Object.assign(new PassThrough(),{isTTY:true,isRaw:false,setRawMode(value:boolean){this.isRaw=value;return this;}});
  const output=Object.assign(new PassThrough(),{isTTY:true,columns:80,rows:24});
  let attempts=0, sent=false, cancelled=false;
  const backend={request(operation:string){
    if(operation==='preview') return state.preview;
    if(operation==='apply') { attempts++;throw new Error('Concurrent configuration changed'); }
    throw new Error('Unexpected operation');
  }} as Backend;
  output.on('data',(data:Buffer)=>{
    const text=data.toString();
    if(!sent && text.includes('Configure Status Line')) {sent=true;setImmediate(()=>input.write('\x13'));}
    if(!cancelled && text.includes('Concurrent configuration changed')) {cancelled=true;setImmediate(()=>input.write('\x1b'));}
  });
  const result=await new Session(state,backend).run({input:input as never,output:output as never,term:'xterm-256color'});
  assert.equal(result.outcome,'cancelled',result.message);assert.equal(attempts,1);assert.equal(cancelled,true);
  assert.equal(JSON.stringify(state.editor.draft),before);assert.equal(input.isRaw,false);
});
