import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { applyPreset, COMPLETE_SCHEMES } from '@fbincon/statusline-core/config/presets';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { samplePreviewData, SampleRenderState, SAMPLE_NOW } from '@fbincon/statusline-core/rendering/preview';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { renderPayload } from '@fbincon/statusline-core/rendering/subagents';
import { displayWidth, strip } from '@fbincon/statusline-core/rendering/layout';
import { baseEnvironment, presentation } from '../src/rendering/environment.js';
import { installContext } from '../src/integration/install.js';
import { inspectSetup, applySetup } from '../src/integration/setup-service.js';
import { createStorage, jsonBytes } from '../src/config/storage.js';
import { recover } from '../src/recovery/service.js';
import { observeTransactions } from '../src/recovery/journal.js';
import { main } from '../src/main.js';

function fixture(t: TestContext, existing = true) {
    const root = fs.mkdtempSync(join(tmpdir(), 'statusline-setup-')), config = join(root, '配置 with spaces');
    t.after(() => fs.rmSync(root, {recursive:true,force:true}));
    const context = installContext(config, { executable: process.execPath, args: [fileURLToPath(new URL('../src/entry.js', import.meta.url))] }, [2,1,258], createStorage(), () => ({
        run() { assert.fail('disabled plugin called'); }, listing() { assert.fail('disabled plugin listed'); },
    }));
    if (existing) {
        fs.mkdirSync(config);
        fs.writeFileSync(join(config,'claude-statusline-native.json'),jsonBytes({schema_version:1,native_editor:false}));
        fs.writeFileSync(join(config,'claude-statusline-features.json'),jsonBytes({schema_version:1,experimental_slash_tui:false}));
    }
    return {root,config,context};
}
test('setup dry-run and non-TTY mode leave an absent configuration tree absent', async t => {
    const f=fixture(t,false); let output='';
    const environment={configDir:f.config,launch:f.context.launch,hostVersion:()=>[2,1,258],stdout:(v:string)=>output+=v,stderr:(v:string)=>output+=v};
    assert.equal(await main(['setup','--config-dir',f.config,'--dry-run'],environment),0);
    assert.match(output,/Read-only/); assert(!fs.existsSync(f.config));
    assert.equal(await main(['setup','--config-dir',f.config],environment),2);
    assert(!fs.existsSync(f.config));
    for(const version of [null,[2,1,1]]) {
        const inspected=inspectSetup({...f.context,version}); assert(inspected.canSave);assert(!inspected.canIntegrate);assert(!fs.existsSync(f.config));
    }
});
test('setup saves before integration, verifies resources, and can be repeated without resetting opt-outs', t => {
    const f=fixture(t), inspected=inspectSetup(f.context);assert(inspected.canIntegrate,JSON.stringify(inspected));
    const candidate={...inspected.draft!,display:applyPreset(inspected.draft!.display,'daily-development',()=> 'new')};
    const first=applySetup(f.context,inspected,candidate,true);
    assert.equal(first.error,null,JSON.stringify(first));assert.equal(first.stage,'verified');
    const settings=fs.readFileSync(join(f.config,'settings.json'));
    const next=inspectSetup(f.context), repeat=applySetup(f.context,next,next.draft!,true);
    assert.equal(repeat.error,null);assert.equal(repeat.saved!.changed,false);assert.deepEqual(fs.readFileSync(join(f.config,'settings.json')),settings);
    assert.equal(JSON.parse(fs.readFileSync(join(f.config,'claude-statusline-native.json'),'utf8')).native_editor,false);
    assert(!fs.existsSync(join(f.config,'claude-statusline-runtime.json')));
});
test('foreign integration allows display-only save and protects profile bindings and original host bytes', t => {
    const f=fixture(t), settings=Buffer.from('{"statusLine":{"type":"command","command":"other-renderer"},"theme":"light"}\n');
    fs.writeFileSync(join(f.config,'settings.json'),settings);
    const profiles=jsonBytes({version:1,profiles:[{id:'shared',name:'Shared',display:defaultDisplay()}],bindings:[{root:f.root,profile_id:'shared'}]});
    fs.writeFileSync(join(f.config,'claude-statusline-profiles.json'),profiles);
    const inspected=inspectSetup(f.context,f.root); assert(inspected.canSave);assert(!inspected.canIntegrate);
    assert.equal(applySetup(f.context,inspected,inspected.draft!,true).stage,'review');
    const saved=applySetup(f.context,inspected,{...inspected.draft!,display:applyPreset(inspected.draft!.display,'quota-watch',()=> 'new')},false);
    assert.equal(saved.error,null);assert.equal(saved.stage,'display');
    assert.deepEqual(fs.readFileSync(join(f.config,'settings.json')),settings);
    assert.deepEqual(fs.readFileSync(join(f.config,'claude-statusline-profiles.json')),profiles);
});
test('setup checks do not migrate schema 8; explicit save backs up original bytes and detects stale reviews', t => {
    const f=fixture(t), {powerline:_,groups,subagents,...display}=defaultDisplay();
    const {groups:agentGroups,...oldAgents}=subagents, raw=jsonBytes({...display,subagents:oldAgents,schema_version:8});
    fs.writeFileSync(join(f.config,'claude-statusline.json'),raw);
    const inspected=inspectSetup(f.context);assert.deepEqual(fs.readFileSync(join(f.config,'claude-statusline.json')),raw);
    fs.writeFileSync(join(f.config,'settings.json'),'{}');
    assert.equal(applySetup(f.context,inspected,inspected.draft!,false).stage,'review');
    assert.deepEqual(fs.readFileSync(join(f.config,'claude-statusline.json')),raw);
    const next=inspectSetup(f.context),saved=applySetup(f.context,next,next.draft!,false);
    assert.equal(saved.error,null);assert.deepEqual(fs.readFileSync(join(saved.saved!.backup_dir!,'claude-statusline.json.before')),raw);
    assert.equal(JSON.parse(fs.readFileSync(join(f.config,'claude-statusline.json'),'utf8')).schema_version,15);
});
test('foreign linked integration resources permit saving display without following or modifying the link', t => {
    const f = fixture(t), foreign = join(f.root, 'foreign');
    fs.mkdirSync(foreign);
    fs.writeFileSync(join(foreign, 'preserve.txt'), 'foreign bytes');
    fs.symlinkSync(foreign, join(f.config, 'statusline-native'), process.platform === 'win32' ? 'junction' : 'dir');
    const inspected = inspectSetup(f.context);
    assert(inspected.canSave); assert(!inspected.canIntegrate);
    const saved = applySetup(f.context, inspected, inspected.draft!, false);
    assert.equal(saved.error, null); assert.equal(saved.stage, 'display');
    assert.deepEqual(fs.readdirSync(foreign), ['preserve.txt']);
    assert.equal(fs.readFileSync(join(foreign, 'preserve.txt'), 'utf8'), 'foreign bytes');
    assert(fs.lstatSync(join(f.config, 'statusline-native')).isSymbolicLink());
});
test('official plugin failure retains the saved display and reports the committed integration stage', t => {
    const f = fixture(t), calls: string[][] = [];
    fs.writeFileSync(join(f.config, 'claude-statusline-native.json'), jsonBytes({schema_version:1,native_editor:true}));
    const context = { ...f.context, version: [2, 1, 294], host: () => ({
        listing: (): [Record<string, unknown>[], Record<string, unknown>[]] => [[], []],
        run: (args: readonly string[]) => { calls.push([...args]); throw new Error('injected official validation failure'); },
    }) };
    const inspected = inspectSetup(context);
    assert(inspected.canIntegrate, JSON.stringify(inspected)); assert.equal(calls.length, 0);
    assert(inspected.notes.some(note => note.key === 'setup.plugins' && (note.params.native as {key:string}).key === 'setup.value.requested'), JSON.stringify(inspected.notes));
    const result = applySetup(context, inspected, inspected.draft!, true);
    assert.equal(result.stage, 'integration', JSON.stringify({result,calls})); assert(result.error); assert(result.installed!.failed);
    assert(calls.some(args => args[0] === 'validate'));
    assert(fs.existsSync(join(f.config, 'claude-statusline.json')));
    assert(fs.existsSync(join(f.config, 'settings.json')));
    assert(result.installed!.messages.length);
});
test('setup protects damaged configurations and rejects unowned local Mod resources before integration', t => {
    const f=fixture(t);
    fs.mkdirSync(join(f.config,'statusline-native'));
    const foreign=inspectSetup(f.context);assert(foreign.canSave);assert(!foreign.canIntegrate);
    assert.equal(applySetup(f.context,foreign,foreign.draft!,true).stage,'review');
    assert(!fs.existsSync(join(f.config,'claude-statusline.json')));
    fs.writeFileSync(join(f.config,'claude-statusline.json'),'{broken');
    const damaged=inspectSetup(f.context);assert(!damaged.canSave);
    assert.equal(fs.readFileSync(join(f.config,'claude-statusline.json'),'utf8'),'{broken');
    assert(!fs.existsSync(join(f.config,'statusline_runtime')));
});
test('setup reports partial installation failures and preserves display for a safe retry', t => {
    const f=fixture(t);let failed=false;
    f.context.io={...f.context.io,write(path,bytes){if(path===join(f.config,'settings.json')&&!failed){failed=true;throw new Error('injected installation write failure');} createStorage().write(path,bytes);}};
    const inspected=inspectSetup(f.context), result=applySetup(f.context,inspected,inspected.draft!,true);
    assert(result.error);assert.equal(result.stage,'display');assert(fs.existsSync(join(f.config,'claude-statusline.json')));
    recover(f.context);
    const next=inspectSetup(f.context);assert.equal(applySetup(f.context,next,next.draft!,true).stage,'verified');
});
test('a pending transaction blocks setup without recovery writes; explicit recovery permits retry', t => {
    const f=fixture(t),inspected=inspectSetup(f.context);
    const restore=observeTransactions(stage=>{if(stage==='prepared') throw new Error('interrupt after durable preparation');});
    try { assert(applySetup(f.context,inspected,inspected.draft!,false).error); } finally {restore();}
    assert(!inspectSetup(f.context).canSave);
    recover(f.context);
    const next=inspectSetup(f.context);assert(next.canSave);assert.equal(applySetup(f.context,next,next.draft!,false).error,null);
});
test('all schemes render at 40/80/120 columns in six languages; unavailable quota and failed agents remain truthful', async () => {
    for(const language of LANGUAGES) {
        const env=baseEnvironment(await presentation(language),{now:()=>SAMPLE_NOW,home:'/sample'});
        for(const name of COMPLETE_SCHEMES) for(const width of [40,80,120]) {
            const scheme=applyPreset(defaultDisplay(),name,()=> 'new');scheme.statusline_language=language;
            const data=samplePreviewData('/sample');
            for(const separator of ['compact','powerline'] as const) {
                scheme.separator_style=separator;
                for(const line of configuredRows(data,scheme,width,env,(...args)=>new SampleRenderState(...args))) assert(displayWidth(line)<=width);
            }
            if(name==='quota-watch') {
                data.rate_limits={};const lines=configuredRows(data,scheme,width,env,(...args)=>new SampleRenderState(...args));
                data.rate_limits={five_hour:{used_percentage:0,resets_at:SAMPLE_NOW-1},seven_day:{used_percentage:0,resets_at:SAMPLE_NOW-1}};
                assert.deepEqual(configuredRows(data,scheme,width,env,(...args)=>new SampleRenderState(...args)),lines);
            }
            if(name==='agent-focus') {
                const tasks=['running','completed','failed'].map((status,i)=>({id:status,status,name:status,startTime:0,_frozen_duration_ms:1000,model:'claude-sonnet',tokenCount:20,contextWindowSize:100,label:'Task '+i}));
                const output=renderPayload({columns:width,tasks},scheme,env,SAMPLE_NOW*1000);
                assert(output.find(row=>row.id==='failed')!.content); assert.equal(output.find(row=>row.id==='completed')!.content,'');
                assert.notEqual(strip(output[0]!.content),strip(output[2]!.content));
            }
        }
    }
});
