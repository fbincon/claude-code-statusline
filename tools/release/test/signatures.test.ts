import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedProvenance, verifiedInventory } from '../signatures.js';
import { sha256 } from '../../build/files.js';
const expected={version:'3.14.0',commit:'a'.repeat(40)}, integrity='sha512-'+Buffer.alloc(64).toString('base64');
const subject=[{name:'pkg:npm/%40fbincon/claude-code-statusline@3.14.0',digest:{sha512:Buffer.alloc(64).toString('hex')}}];
function statement(){return {predicateType:'https://slsa.dev/provenance/v1',subject,predicate:{buildDefinition:{externalParameters:{workflow:{repository:'https://github.com/fbincon/claude-code-statusline',ref:'refs/tags/v3.14.0',path:'.github/workflows/npm-publish.yml'}},resolvedDependencies:[{uri:'git+https://github.com/fbincon/claude-code-statusline@refs/tags/v3.14.0',digest:{gitCommit:expected.commit}}]},runDetails:{builder:{id:'https://github.com/actions/runner/github-hosted'},metadata:{invocationId:'https://github.com/fbincon/claude-code-statusline/actions/runs/123/attempts/1'}}}};}
const bundle=(s:unknown)=>({bundle:{dsseEnvelope:{payloadType:'application/vnd.in-toto+json',payload:Buffer.from(JSON.stringify(s)).toString('base64')}}});
test('verified npm provenance remains bound to exact subject, repository, tag, commit and publisher',()=>{
 assert.equal(verifiedProvenance([bundle(statement())],expected,integrity).commit,expected.commit);
 assert.throws(()=>verifiedProvenance([],expected,integrity));
 for(const field of ['repository','ref','path'] as const){const s=statement();s.predicate.buildDefinition.externalParameters.workflow[field]='wrong';assert.throws(()=>verifiedProvenance([bundle(s)],expected,integrity));}
 const s=statement();s.predicate.buildDefinition.resolvedDependencies[0]!.digest.gitCommit='b'.repeat(40);assert.throws(()=>verifiedProvenance([bundle(s)],expected,integrity));
 assert.throws(()=>verifiedProvenance([bundle(statement())],expected,'sha512-'+Buffer.alloc(64,1).toString('base64')));
});
test('a signed outer package requires complete internal and public inventories',()=>{
 const entries=new Map<string,Buffer>(),deps:Record<string,string>={};
 for(const short of ['core','platform','cli','tui']){const name='@fbincon/statusline-'+short;deps[name]='0.0.0';entries.set('node_modules/'+name+'/package.json',Buffer.from(JSON.stringify({name,version:'0.0.0',private:true})));}
 entries.set('package.json',Buffer.from(JSON.stringify({name:'@fbincon/claude-code-statusline',version:expected.version,dependencies:deps,bundleDependencies:Object.keys(deps)})));
 const source={schema_version:1,application_version:expected.version,commit:expected.commit,dirty:false,dependencies:{},files:Object.fromEntries([...entries].map(([name,raw])=>[name,sha256(raw)]))};
 entries.set('candidate.json',Buffer.from(JSON.stringify(source)));assert.equal(verifiedInventory(entries,expected).internal.length,4);
 entries.set('extra.js',Buffer.from('injected'));assert.throws(()=>verifiedInventory(entries,expected));entries.delete('extra.js');
 entries.set('package.json',Buffer.from('changed'));assert.throws(()=>verifiedInventory(entries,expected));
});
