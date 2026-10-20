import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { PROFILES_FILENAME } from '@fbincon/statusline-core/config/profiles';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { setup, jsonBytes } from './final-support.js';
import { allFiles } from './runtime-support.js';
import { ProfileService } from '../src/config/profiles.js';
import { ConfigurationService } from '../src/config/service.js';
import { resolvedDisplay } from '../src/rendering/configuration.js';
import { render } from '../src/rendering/main.js';
import { main } from '../src/main.js';
import { observeTransactions, pending } from '../src/recovery/journal.js';

test('scheme round trip preserves display identity and excludes preferences; default activation is a snapshot', t => {
    const f=setup(t,true), profiles=new ProfileService(f.service,()=> 'stable-profile');
    const display=defaultDisplay(); display.statusline_language='zh-TW';
    const initial=profiles.read();
    assert.equal(existsSync(join(f.root,PROFILES_FILENAME)),false);
    const saved=profiles.mutate({action:'save',name:' 中文 é 👩‍💻 ',display,expected_revision:initial.revision});
    assert.equal(saved.profiles[0]!.name,'中文 é 👩‍💻');
    assert.deepEqual(saved.profiles[0]!.display,display);
    assert.throws(()=>profiles.mutate({action:'save',name:saved.profiles[0]!.name,display,expected_revision:saved.revision}),/profiles.error.duplicate/u);
    const activated=profiles.mutate({action:'activate',id:'stable-profile',expected_revision:saved.revision});
    const current=profiles.readTarget({kind:'profile',id:'stable-profile'});
    current.display.statusline_language='ja';
    profiles.applyTarget({display:current.display,host:current.host},current.revision,{kind:'profile',id:'stable-profile'});
    assert.equal(f.display().statusline_language,'zh-TW');
    assert.equal(profiles.read().profiles[0]!.display.statusline_language,'ja');
    assert.throws(()=>profiles.mutate({action:'rename',id:'stable-profile',name:'renamed',expected_revision:activated.revision}),/profiles.error.conflict/u);
    const out=join(f.root,'分享.json'), savedDisplay=profiles.read().profiles[0]!.display;
    profiles.export(out,'分享',savedDisplay);
    assert.deepEqual(profiles.import(out),{name:'分享',display:savedDisplay});
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(out,'utf8'))).sort(),['display','format','name','version']);
    assert.throws(()=>profiles.export(join(f.root,PROFILES_FILENAME),'bad',display,true));
    assert.throws(()=>profiles.export(out,'分享',display));
    const before=allFiles(f.root); profiles.read(); profiles.readTarget({kind:'user'}); profiles.import(out);
    assert.deepEqual(allFiles(f.root),before);
});

test('nested roots, native path aliases, rename references and missing schemes resolve without prefix leakage', t => {
    const f=setup(t), p=new ProfileService(f.service);
    const save=(name:string,language:'ja'|'ko')=>{const display=defaultDisplay();display.statusline_language=language;return p.mutate({action:'save',name,display,expected_revision:p.read().revision}).profiles.find(r=>r.name===name)!.id;};
    const first=save('outer','ja'), second=save('inner','ko');
    const outer=join(f.root,'project'),inner=join(outer,'nested'),outside=join(f.root,'project-suffix'),alias=join(f.root,'alias');
    mkdirSync(inner,{recursive:true});mkdirSync(outside);symlinkSync(outer,alias,process.platform==='win32'?'junction':'dir');
    const bind=(path:string,id:string)=>p.mutate({action:'bind',path,id,expected_revision:p.read().revision});
    bind(outer,first);bind(inner,second);
    assert.equal(p.readTarget({kind:'project',path:join(alias,'nested')}).display.statusline_language,'ko');
    assert.equal(p.readTarget({kind:'project',path:outside}).configuration.reason,'unbound');
    p.mutate({action:'rename',id:second,name:'renamed',expected_revision:p.read().revision});
    assert.equal(p.readTarget({kind:'project',path:inner}).configuration.profile_name,'renamed');
    assert.throws(()=>p.mutate({action:'delete',id:second,expected_revision:p.read().revision}),/profiles.error.referenced/u);
    assert.throws(()=>bind(inner,first),/profiles.error.bound/u);
    const raw=JSON.parse(readFileSync(join(f.root,PROFILES_FILENAME),'utf8'));
    raw.profiles=raw.profiles.filter((v:{id:string})=>v.id!==second);
    writeFileSync(join(f.root,PROFILES_FILENAME),jsonBytes(raw));
    const selected=resolvedDisplay(f.root,f.io,defaultDisplay(),{kind:'project',path:inner});
    assert.equal(selected.configuration.reason,'missing_profile');
    assert.equal(selected.display.statusline_language,'en');
    writeFileSync(join(f.root,PROFILES_FILENAME),'{broken');
    assert.equal(resolvedDisplay(f.root,f.io,defaultDisplay(),{kind:'project',path:inner}).configuration.reason,'invalid_collection');
    assert.throws(()=>p.read());
});

test('project edits protect against concurrent rebindings and save-as plus binding is one commit', t => {
    const f=setup(t), p=new ProfileService(f.service);
    const a=p.mutate({action:'save',name:'shared',display:defaultDisplay(),bind_path:f.root,expected_revision:p.read().revision}).profiles[0]!;
    const current=p.readTarget({kind:'project',path:f.root});
    assert.equal(current.configuration.profile_id,a.id);
    const before=p.read();
    assert.throws(()=>p.mutate({action:'save',name:'private',display:defaultDisplay(),bind_path:f.root,expected_revision:before.revision}),/profiles.error.bound/u);
    assert.deepEqual(p.read(),before);
    p.mutate({action:'save',name:'private',display:defaultDisplay(),bind_path:f.root,overwrite:true,expected_revision:before.revision});
    current.display.statusline_language='ko';
    assert.throws(()=>p.applyTarget({display:current.display,host:current.host},current.revision,{kind:'project',path:f.root}),/profiles.error.conflict/u);
    assert.equal(p.read().profiles.find(v=>v.id===a.id)!.display.statusline_language,'en');
});

test('independent worktree roots, directory moves and native case rules preserve explicit binding identity', t => {
    const f=setup(t),p=new ProfileService(f.service);
    const primary=join(f.root,'Primary'),worktree=join(f.root,'Worktree'),moved=join(f.root,'Moved');
    mkdirSync(primary);mkdirSync(worktree);
    writeFileSync(join(worktree,'.git'),'gitdir: ../Primary/.git/worktrees/feature\n');
    const save=(name:string,path:string,language:'ja'|'ko')=>{
        const display=defaultDisplay();display.statusline_language=language;
        return p.mutate({action:'save',name,display,bind_path:path,expected_revision:p.read().revision}).profiles.find(v=>v.name===name)!.id;
    };
    const first=save('primary',primary,'ja'),second=save('worktree',worktree,'ko');
    assert.equal(p.readTarget({kind:'project',path:primary}).configuration.profile_id,first);
    assert.equal(p.readTarget({kind:'project',path:worktree}).configuration.profile_id,second);
    const oldRoot=p.readTarget({kind:'project',path:worktree}).configuration.project_root;
    const alias=join(f.root,'WORKTREE');
    if(existsSync(alias)) {
        assert.equal(p.readTarget({kind:'project',path:alias}).configuration.profile_id,second);
        assert.throws(()=>p.mutate({action:'bind',id:first,path:alias,expected_revision:p.read().revision}),/profiles.error.bound/u);
    } else {
        mkdirSync(alias);
        p.mutate({action:'bind',id:first,path:alias,expected_revision:p.read().revision});
        assert.equal(p.readTarget({kind:'project',path:alias}).configuration.profile_id,first);
        assert.equal(p.readTarget({kind:'project',path:worktree}).configuration.profile_id,second);
    }
    renameSync(worktree,moved);
    const before=allFiles(f.root);
    assert.equal(p.readTarget({kind:'project',path:worktree}).configuration.reason,'path_unavailable');
    assert.equal(p.readTarget({kind:'project',path:moved}).configuration.reason,'unbound');
    assert.deepEqual(allFiles(f.root),before);
    p.mutate({action:'bind',id:second,path:moved,expected_revision:p.read().revision});
    assert.equal(p.readTarget({kind:'project',path:moved}).display.statusline_language,'ko');
    assert(p.read().bindings.some(b=>b.root===oldRoot),'Read-only resolution must not prune the old root');
});

test('scoped saves preserve installation ownership and malformed imports have a stable error', t => {
    const f=setup(t,true), p=new ProfileService(f.service);
    const id=p.mutate({action:'save',name:'owned',display:defaultDisplay(),expected_revision:p.read().revision}).profiles[0]!.id;
    for(const key of ['statusLine','subagentStatusLine']) {
        const original=readFileSync(f.settingsPath),settings=JSON.parse(original.toString('utf8'));
        settings[key]={type:'command',command:'foreign-renderer'};
        writeFileSync(f.settingsPath,jsonBytes(settings));
        const target={kind:'profile',id},current=p.readTarget(target),before=allFiles(f.root);
        assert.throws(()=>p.applyTarget({display:current.display,host:current.host},current.revision,target),
            (error:unknown)=>!!error && typeof error==='object' && 'code' in error && error.code==='ownership_mismatch');
        assert.deepEqual(allFiles(f.root),before);
        writeFileSync(f.settingsPath,original);
    }
    const path=join(f.root,'invalid.json');writeFileSync(path,'{"format":');
    assert.throws(()=>p.import(path),(error:unknown)=>!!error && typeof error==='object' && 'code' in error && error.code==='profile_format');
});

test('bound subagent rows install only an owned display callback and disabled custom rows preserve host defaults', async t => {
    const f=setup(t,true), p=new ProfileService(f.service);
    const display=defaultDisplay();display.subagents.enabled=false;
    writeFileSync(f.displayPath,jsonBytes(display));
    const settings=JSON.parse(readFileSync(f.settingsPath,'utf8'));delete settings.subagentStatusLine;writeFileSync(f.settingsPath,jsonBytes(settings));
    const project=join(f.root,'project');mkdirSync(project);
    const result=p.mutate({action:'save',name:'agents',display:defaultDisplay(),bind_path:project,expected_revision:p.read().revision});
    assert.equal(JSON.parse(readFileSync(f.settingsPath,'utf8')).subagentStatusLine.type,'command');
    const outside=join(f.root,'outside');mkdirSync(outside);
    const tasks=[{id:'agent',type:'local_agent',name:'Agent',status:'running'}];
    assert.equal(await render(()=>JSON.stringify({cwd:outside,tasks}),{configDir:f.root},true),'');
    assert.equal(JSON.parse(await render(()=>JSON.stringify({cwd:project,tasks}),{configDir:f.root},true)).id,'agent');
    p.mutate({action:'unbind',path:project,expected_revision:result.revision});
    assert.equal(JSON.parse(readFileSync(f.settingsPath,'utf8')).subagentStatusLine,undefined);
    const foreign=JSON.parse(readFileSync(f.settingsPath,'utf8'));foreign.subagentStatusLine={type:'command',command:'other-renderer'};
    writeFileSync(f.settingsPath,jsonBytes(foreign));
    const before=allFiles(f.root);
    assert.throws(()=>p.mutate({action:'bind',id:result.profiles[0]!.id,path:f.root,expected_revision:p.read().revision}));
    assert.deepEqual(allFiles(f.root),before);
});

test('a failed save-and-bind publication rolls back the collection and owned callback together', t => {
    const f=setup(t,true),p=new ProfileService(f.service);
    const display=defaultDisplay();display.subagents.enabled=false;writeFileSync(f.displayPath,jsonBytes(display));
    const settings=JSON.parse(readFileSync(f.settingsPath,'utf8'));delete settings.subagentStatusLine;writeFileSync(f.settingsPath,jsonBytes(settings));
    const before=readFileSync(f.settingsPath),revision=p.read().revision;
    let failed=false;
    const restore=observeTransactions(stage=>{if(stage==='applied:0'&&!failed){failed=true;throw new Error('publication interrupted');}});
    try {assert.throws(()=>p.mutate({action:'save',name:'agents',display:defaultDisplay(),bind_path:f.root,expected_revision:revision}),/publication interrupted/u);}
    finally {restore();}
    assert.equal(failed,true);assert.equal(existsSync(join(f.root,PROFILES_FILENAME)),false);
    assert.deepEqual(readFileSync(f.settingsPath),before);assert.deepEqual(pending(f.root),[]);
});

test('profile protocol and CLI use the same saved collection and all inspection commands remain read-only', async t => {
    const f=setup(t), p=new ProfileService(f.service);
    const reply=f.protocol.handle(JSON.stringify({protocol_version:PROTOCOL_VERSION,operation:'profiles_apply',payload:{action:'save',name:'CLI',display:defaultDisplay(),expected_revision:p.read().revision}}));
    assert.equal(reply.status,0);
    let output='';
    const call=async(args:string[])=>{output='';return main(args,{configDir:f.root,hostVersion:()=>[2,1,294],stdout:s=>{output+=s;},stderr:s=>assert.fail(s)});};
    const before=allFiles(f.root);
    for(const args of [['config','profile','list','--json'],['config','profile','preview','CLI','--json'],['config','project','resolve',f.root,'--json']]){
        assert.equal(await call(args),0);assert.doesNotThrow(()=>JSON.parse(output));
    }
    assert.deepEqual(allFiles(f.root),before);
    const missing=join(f.root,'absent'), fail=()=>assert.fail('Read attempted a write or lock');
    const service=new ConfigurationService({...f.context,configDir:missing},{...f.io,write:fail,remove:fail,backup:fail,lock:fail});
    new ProfileService(service).readTarget({kind:'project',path:f.root});
    assert.equal(existsSync(missing),false);
});
