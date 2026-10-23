import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigurationService } from '../src/config/service.js';
import { createStorage } from '../src/config/storage.js';
import { SourceService } from '../src/sources/service.js';
import { contextFor } from '../src/sources/context.js';
import { checkSummary, refreshGithub, refreshCommand } from '../src/sources/providers.js';
import { definition } from '@fbincon/statusline-core/extensions/model';
import { fileURLToPath } from 'node:url';
test('manual workers publish observations, reject concurrent refreshes and cancel late commands',async t=>{
    const root=mkdtempSync(join(tmpdir(),'source worker '));t.after(()=>rmSync(root,{recursive:true,force:true}));
    const configuration=new ConfigurationService({configDir:join(root,'config'),launch:{executable:process.execPath,args:[fileURLToPath(new URL('../src/entry.js',import.meta.url))]},hostVersion:()=>null},createStorage());
    const service=new SourceService(configuration), context=contextFor(root);
    const change=(action:string,fields={})=>service.mutate({action,id:'cmd',expected_revision:service.read().revision,...fields});
    const spec=(script:string)=>({name:'Command',kind:'command',scope:{project:root,session:null,agent:null},ttl_seconds:300,settings:{executable:process.execPath,args:['-e',script],cwd:root,input:{project:'project'},output:'text',timeout_ms:15000}});
    change('add',{source:spec('process.stdout.write("zero: 0")')});change('enable',{review_revision:service.review('cmd').review_revision});
    const binding=change('bind').binding!;
    assert.equal(service.view(binding,context).reason,'not_refreshed');
    let job=service.start('cmd',context,'test');assert.throws(()=>service.start('cmd',context,'another'));
    const end=Date.now()+20000;
    while(job.state==='running'&&Date.now()<end){await new Promise(r=>setTimeout(r,100));job=service.job(job.id);}
    assert.equal(job.state,'completed');assert.equal(service.view(binding,context).value,'zero: 0');
    assert.equal(service.view(binding,{...context,session:'another-session',agent:'child'}).value,'zero: 0');
    assert.equal(service.view(binding,{...context,project:join(root,'elsewhere')}).state,'mismatch');
    change('edit',{source:spec('setTimeout(()=>process.stdout.write("late"),10000)')});change('enable',{review_revision:service.review('cmd').review_revision});
    job=service.start('cmd',context,'test');await new Promise(r=>setTimeout(r,200));service.cancel(job.id);await new Promise(r=>setTimeout(r,800));
    assert.equal(service.job(job.id).state,'cancelled');assert.notEqual(service.view(binding,context).value,'late');
    job=service.start('cmd',context,'test');change('disable');
    assert.equal(service.job(job.id).state,'cancelled');
    assert.equal(service.view(binding,context).state,'disabled');
    change('enable',{review_revision:service.review('cmd').review_revision});
    job=service.start('cmd',context,'test');change('remove');
    await new Promise(r=>setTimeout(r,200));
    assert.equal(service.job(job.id).state,'cancelled');
    assert.equal(service.view(binding,context).state,'unbound');
});
test('local registration, review, binding, failure retention and disabling form one isolated journey',t=>{
    const root=mkdtempSync(join(tmpdir(),'source 中文 '));t.after(()=>rmSync(root,{recursive:true,force:true}));
    const config=new ConfigurationService({configDir:join(root,'config'),launch:{executable:process.execPath,args:[fileURLToPath(new URL('../src/entry.js',import.meta.url))]},hostVersion:()=>null},createStorage());
    const service=new SourceService(config), path=join(root,'data.json');writeFileSync(path,JSON.stringify({value:0,observed_at:new Date().toISOString()}));
    const change=(action:string,fields={})=>service.mutate({action,id:'local',expected_revision:service.read().revision,...fields});
    change('add',{source:{name:'Local',kind:'json',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{path}}});
    assert.throws(()=>change('enable',{review_revision:'old'}));
    const binding=change('bind').binding!, context=contextFor(root);
    assert.equal(service.view(binding,context).state,'disabled');
    change('enable',{review_revision:service.review('local').review_revision});
    assert.equal(service.view(binding,context).value,0);
    writeFileSync(path,'{"value":');const broken=service.view(binding,context);assert.equal(broken.value,0);assert.equal(broken.state,'error');
    change('disable');assert.equal(service.view(binding,context).value,null);
    change('edit',{source:{name:'Changed',kind:'json',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{path}}});
    assert.equal(service.source('local').enabled,false);
    assert.throws(()=>service.mutate({action:'remove',id:'local',expected_revision:'old'}));
    change('remove');assert.equal(service.view(binding,context).state,'unbound');
});
test('check summaries never turn absence, cancellation or unknown states into passing',()=>{
    for(const [input,expected]of [[[],'no_checks'],[[{bucket:'skipping'}],'skipped'],[[{bucket:'pass'},{bucket:'cancel'}],'cancelled'],[[{bucket:'pending'},{bucket:'fail'}],'failure'],[[{bucket:'pass'},{bucket:'mystery'}],'unknown']] as const)assert.equal(checkSummary(input),expected);
});
test('GitHub provider binds every query to repository, branch, account and HEAD',async()=>{
    const context={project:process.cwd(),session:null,agent:null,branch:'main',head:'a'.repeat(40)};
    const source=definition({id:'forge',name:'Forge',kind:'github',scope:{project:process.cwd(),session:null,agent:null},ttl_seconds:300,settings:{repository:'owner/repo',branch:'main',account:'owner'},enabled:true,revision:'r1'});
    const calls:string[][]=[];const replies=[{login:'owner'},[{number:2,url:'https://github.com/owner/repo/pull/2',headRefName:'main',headRefOid:context.head,reviewDecision:'APPROVED'}],[{bucket:'pending'}],{headRefOid:context.head}];
    const observation=await refreshGithub(source,context,new AbortController().signal,async options=>{calls.push([...options.args]);return {code:calls.length===3?8:0,stdout:JSON.stringify(replies.shift()),reason:calls.length===3?'exit':'completed'};});
    assert.equal(observation.state,'valid');assert.equal(observation.fields?.ci,'pending');assert(calls.slice(1).every(args=>args.includes('github.com/owner/repo')));
    const wrong=await refreshGithub(source,context,new AbortController().signal,async()=>({code:0,stdout:'{"login":"other"}',reason:'completed'}));assert.equal(wrong.reason,'account');assert.equal(wrong.value,null);
});

test('real Git discovery distinguishes branch names, object IDs and detached HEAD',async t=>{
    const {execFileSync}=await import('node:child_process');
    const root=mkdtempSync(join(tmpdir(),'source git 中文 '));t.after(()=>rmSync(root,{recursive:true,force:true}));
    const git=(args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git(['init','--initial-branch=main']);
    git(['-c','user.name=Source Test','-c','user.email=source@example.invalid','commit','--allow-empty','-m','fixture']);
    const context=contextFor(root,'session');
    assert.equal(context.branch,'main');assert.equal(context.head,git(['rev-parse','HEAD']));
    git(['checkout','--detach']);
    assert.equal(contextFor(root).branch,null);assert.equal(contextFor(root).head,context.head);
});

test('GitHub no-checks exit is distinct from authentication, permissions and transport failure',async()=>{
    const context={project:process.cwd(),session:null,agent:null,branch:'main',head:'a'.repeat(40)};
    const source=definition({id:'forge',name:'Forge',kind:'github',scope:{project:process.cwd(),session:null,agent:null},ttl_seconds:300,settings:{repository:'owner/repo',branch:'main',account:'owner'},enabled:true,revision:'r1'});
    const result=await refreshGithub(source,context,new AbortController().signal,async options=>{
        const args=options.args;
        if(args[0]==='api')return {code:0,reason:'completed',stdout:'{"login":"owner"}'};
        if(args[1]==='checks')return {code:1,reason:'exit',stdout:'',errorKind:'no_checks'};
        return {code:0,reason:'completed',stdout:JSON.stringify(args[1]==='list'?[{number:2,url:'https://github.com/owner/repo/pull/2',headRefName:'main',headRefOid:context.head}]:{headRefOid:context.head})};
    });
    assert.equal(result.state,'valid');assert.equal(result.fields?.ci,'no_checks');
    for(const errorKind of ['authentication','permission','network'] as const){
        const failed=await refreshGithub(source,context,new AbortController().signal,async()=>({code:1,reason:'exit',stdout:'',errorKind}));
        assert.equal(failed.reason,errorKind);assert.equal(failed.value,null);
    }
});
