import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SourceService } from '../src/sources/service.js';
import { AutomaticRefresh } from '../src/sources/automatic.js';
import { activeLease, readAutomatic, automaticJobActive, LEASE_MS } from '../src/sources/automatic-state.js';
import { ConfigurationService } from '../src/config/service.js';
import { createStorage } from '../src/config/storage.js';
import { contextFor } from '../src/sources/context.js';
import { SOURCE_FILENAME } from '@fbincon/statusline-core/extensions/model';
import { RuntimeProtocol } from '../src/runtime/live/protocol.js';
import { runtimeContext } from '../src/runtime/context.js';
import type { SourceJob } from '@fbincon/statusline-core/contracts/ui';
import { emptyObservation } from '@fbincon/statusline-core/extensions/model';
import { Editor } from '@fbincon/statusline-core/editor/draft';
import { openSources, closeSources, sourcesKey, sourcesView, performSourceAction, type SourceBackend } from '@fbincon/statusline-core/editor/source-manager';
import { isSourceResult } from '@fbincon/statusline-core/editor/source-validation';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { ConfigurationProtocol } from '../src/ui/protocol.js';

function fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'automatic refresh ')), directory = join(root, 'config');
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const git = (args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
    git(['init', '--initial-branch=main']); git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'fixture']);
    let now = Date.parse('2026-10-24T00:00:00Z');
    const launched: SourceJob[] = [];
    const configuration = new ConfigurationService({ configDir: directory, hostVersion: () => [2, 1, 294], launch: { executable: process.execPath, args: [] } }, createStorage());
    const service = new SourceService(configuration, () => now, job => launched.push(job)), scheduler = new AutomaticRefresh(service);
    const spec = { name: 'GitHub', kind: 'github', scope: { project: root, session: null, agent: null }, ttl_seconds: 5, settings: { host: 'github.com', repository: 'owner/repo', branch: 'main', account: 'owner', pr: 12 } };
    const change = (action: string, fields: object = {}) => service.mutate({ action, id: 'github', expected_revision: service.read().revision, ...fields });
    change('add', { source: spec });
    const context = () => contextFor(root);
    const sequence: Record<string, number> = {};
    const tick = (session = 'one', event: 'tick' | 'end' = 'tick', host_version = '2.1.294') => scheduler.lifecycle({ session_id: session, epoch: 'epoch', seq: sequence[session] = (sequence[session] ?? -1) + 1, project: root, host_version, event });
    const enable = () => { change('enable', { review_revision: service.review('github').review_revision }); change('auto-on', { review_revision: service.review('github').review_revision }); };
    const finish = (state: 'completed' | 'failed', reason: string) => {
        const job = service.job(launched.at(-1)!.id);
        writeFileSync(join(service.root, 'jobs', job.id + '.json'), JSON.stringify({ ...job, state, reason }));
    };
    return { root, directory, configuration, service, scheduler, launched, spec, change, enable, context, tick, finish, git, advance: (ms: number) => now += ms, now: () => now };
}
test('automatic review is separate, persistent, bounded, and revoked by source edits', t => {
    const f = fixture(t);
    f.tick(); assert.equal(f.launched.length, 0);
    assert.throws(() => f.change('auto-on', { review_revision: f.service.review('github').review_revision }));
    f.change('enable', { review_revision: f.service.review('github').review_revision });
    f.tick(); assert.equal(f.launched.length, 0, 'enabling a source does not opt into recurring execution');
    assert.throws(() => f.change('auto-on', { review_revision: 'stale' }));
    for (const interval_seconds of [0, 59, 86401, 1.5]) assert.throws(() => f.change('auto-on', { review_revision: f.service.review('github').review_revision, interval_seconds }));
    f.enable(); assert.equal(f.service.read().automatic[0]!.interval_seconds, 60);
    assert.equal(new SourceService(f.configuration).read().automatic[0]!.enabled, true);
    f.tick(); assert.equal(f.launched.length, 1);
    f.change('edit', { source: { ...f.spec, settings: { ...f.spec.settings, account: 'changed' } } });
    assert.equal(f.service.read().automatic.length, 0); assert.equal(f.service.job(f.launched[0]!.id).state, 'cancelled');
    f.tick(); assert.equal(f.launched.length, 1);
});
test('sessions deduplicate, lease expiry stops automatic work, and manual refresh joins without changing origin', t => {
    const f = fixture(t); f.enable(); f.tick(); f.tick('two');
    assert.equal(f.launched.length, 1);
    const job = f.launched[0]!;
    f.tick('one', 'end'); assert.equal(f.service.job(job.id).state, 'running');
    assert(activeLease(readAutomatic(f.directory), job.identity, f.now()));
    const manual = f.service.start('github', f.context(), 'manual-user');
    assert.equal(manual.id, job.id); assert.equal(manual.trigger, 'automatic'); assert.equal(manual.owner, job.owner); assert.deepEqual(manual.consumers.map(c=>c.owner),['manual-user']);
    f.tick('two', 'end'); assert.equal(f.service.job(job.id).state, 'running');
    f.change('auto-off'); assert.equal(f.service.job(job.id).state, 'running');
    f.service.cancel(job.id);
    f.enable(); f.tick('three'); assert.equal(f.launched.length, 2);
    const auto = f.launched[1]!;
    f.advance(LEASE_MS + 1); assert.equal(automaticJobActive(f.directory, auto, f.now()), false);
    f.service.cancelInactiveAutomatic(); assert.equal(f.service.job(auto.id).state, 'cancelled');
});
test('two editors release their own consumers and retain an applicable automatic lease',async t=>{
    const f=fixture(t);f.enable();
    const protocol=new ConfigurationProtocol(f.configuration),backend={request:(operation:string,payload:unknown={})=>operation==='source_release'?f.service.release((payload as {id:string}).id,(payload as {owner:string}).owner):protocol.dispatch({protocol_version:PROTOCOL_VERSION,operation,payload})} as SourceBackend;
    const editors=['a','b'].map(owner=>{const e=new Editor(protocol.dispatch({protocol_version:PROTOCOL_VERSION,operation:'describe',payload:{}}) as never,protocol.dispatch({protocol_version:PROTOCOL_VERSION,operation:'read',payload:{}}) as never);openSources(e);e.sources!.owner=owner;return e;});
    const first=f.service.start('github',f.context(),'a'),joined=f.service.start('github',f.context(),'b');
    assert.equal(joined.id,first.id);assert.equal(joined.owner,'a');assert.equal(joined.trigger,'manual');
    assert.equal(f.service.start('github',f.context(),'b').consumers.length,2,'joining twice is idempotent');
    editors[0]!.sources!.jobs=[first];editors[1]!.sources!.jobs=[joined];
    await closeSources(editors[0]!,backend);assert.equal(f.service.job(first.id).state,'running');
    assert.deepEqual(f.service.job(first.id).consumers.map(c=>c.owner),['b']);
    f.tick();await closeSources(editors[1]!,backend);
    assert.equal(f.service.job(first.id).state,'running','an active automatic lease preserves a manually created execution');
    f.tick('one','end');assert.equal(f.service.job(first.id).state,'cancelled');
    const next=f.service.start('github',f.context(),'only');
    assert.equal(f.service.release(next.id,'foreign').state,'running');
    assert.equal(f.service.release(next.id,'only').reason,'no_consumers');
    assert.deepEqual(f.service.release(next.id,'only'),f.service.job(next.id));
});

test('closing or replacing a source manager releases late refresh consumers without cancelling other owners',async t=>{
    const f=fixture(t);f.enable();
    const protocol=new ConfigurationProtocol(f.configuration);
    const read=(operation:string)=>protocol.dispatch({protocol_version:PROTOCOL_VERSION,operation,payload:{}});
    for(const stage of ['context','response','shared-response','replaced-response']) {
        const editor=new Editor(read('describe') as never,read('read') as never);openSources(editor);
        const manager=editor.sources!;manager.library=f.service.read();manager.context=f.context();manager.selected='github';manager.effect='refresh';
        const other=stage==='shared-response'?f.service.start('github',f.context(),'other-editor'):null;
        let resume!:()=>void,entered!:()=>void;
        const waiting=new Promise<void>(resolve=>{resume=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
        let refreshes=0;
        const backend={request:async(operation:string,payload:any)=>{
            if(operation==='source_context') {if(stage==='context'){entered();await waiting;}return f.context();}
            if(operation==='source_refresh') {refreshes++;const job=f.service.start(payload.id,payload.context,payload.owner);entered();await waiting;return job;}
            if(operation==='source_release')return f.service.release(payload.id,payload.owner);
            throw new Error('Unexpected operation '+operation);
        }} as SourceBackend;
        const action=performSourceAction(editor,backend);await started;
        if(stage==='replaced-response')openSources(editor);else await closeSources(editor,backend);
        const replacement=editor.sources;resume();await action;
        assert.equal(editor.sources,replacement,'a late reply must not reopen or replace the manager');
        assert.equal(refreshes,stage==='context'?0:1);
        for(const job of f.service.jobs())assert(!job.consumers.some(c=>c.owner===manager.owner),'closed consumer was released');
        if(other){assert.equal(f.service.job(other.id).state,'running');assert.deepEqual(f.service.job(other.id).consumers.map(c=>c.owner),['other-editor']);f.service.release(other.id,'other-editor');}
        else assert(f.service.jobs().every(job=>job.state!=='running'));
    }
});

test('legacy jobs remain read-only and cannot be joined by a new worker generation',t=>{
    const f=fixture(t);f.enable();
    for(const version of [1,2]) {
        const started=f.service.start('github',f.context(),'legacy'),{consumers,...raw}=started;
        const old:Record<string,unknown>={...raw,version};if(version===1){delete old.trigger;delete old.identity;}
        const path=join(f.service.root,'jobs',started.id+'.json'),bytes=JSON.stringify(old);writeFileSync(path,bytes);
        const result=f.service.job(started.id);assert.equal(result.version,3);assert.equal(result.consumers[0]!.owner,'legacy');
        assert.equal(readFileSync(path,'utf8'),bytes);
        assert.throws(()=>f.service.start('github',f.context(),'new'),/running|busy/i);
        assert.equal(readFileSync(path,'utf8'),bytes);
        f.service.cancel(started.id);
    }
});
test('failed refreshes back off, identity failures pause, and successful manual retry resumes scheduling', t => {
    const f = fixture(t); f.enable(); f.tick(); f.finish('failed', 'network'); f.tick();
    assert.equal(f.service.diagnose('github', f.context()).automatic.state, 'backoff');
    f.advance(60000); f.tick(); assert.equal(f.launched.length, 1);
    f.advance(60000); f.tick(); assert.equal(f.launched.length, 2);
    f.finish('failed', 'authentication'); f.tick();
    assert.equal(f.service.diagnose('github', f.context()).automatic.state, 'paused');
    f.advance(3600000); f.tick(); assert.equal(f.launched.length, 2);
    f.service.start('github', f.context(), 'manual'); f.finish('completed', 'no_pr'); f.tick();
    assert.equal(f.service.diagnose('github', f.context()).automatic.state, 'waiting');
    f.advance(60000); f.tick(); assert.equal(f.launched.length, 4);
});
test('unsupported hosts, stale epochs, changed HEAD and local-only readers cannot dispatch stale identities', t => {
    const f = fixture(t); f.enable();
    f.tick('old', 'tick', '2.1.288'); assert.equal(f.launched.length, 0);
    f.tick(); const first = f.launched[0]!;
    const binding = f.change('bind').binding!;
    f.service.view(binding, f.context()); f.service.review('github'); f.service.diagnose('github', f.context());
    assert.equal(f.launched.length, 1);
    f.git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'second']);
    f.tick(); assert.equal(f.launched.length, 2); assert.notEqual(first.identity, f.launched[1]!.identity);
    assert.equal(f.service.job(first.id).state, 'cancelled');
    f.tick('one', 'end');
    f.scheduler.lifecycle({ session_id: 'one', epoch: 'epoch', seq: 0, project: f.root, host_version: '2.1.294', event: 'tick' });
    assert.equal(f.launched.length, 2);
    f.git(['checkout', '--detach']); f.tick('detached'); assert.equal(f.launched.length, 2);
});
test('registry v1 migrates read-only and runtime lifecycle v3 is independent of both metric opt-ins', async t => {
    const f = fixture(t), path = join(f.directory, SOURCE_FILENAME), value = f.service.read();
    const legacy = JSON.stringify({ version: 1, sources: value.sources, bindings: value.bindings }); writeFileSync(path, legacy);
    assert.deepEqual(f.service.read().automatic, []); assert.equal(readFileSync(path, 'utf8'), legacy);
    const protocol = new RuntimeProtocol({ ...runtimeContext(f.directory), nowMs: f.now });
    const payload = { session_id: 'off', epoch: 'epoch', seq: 0, project: f.root, host_version: '2.1.294', event: 'tick' };
    const result = await protocol.handle(JSON.stringify({ protocol_version: 3, operation: 'source_lifecycle', payload }));
    assert.equal(result.status, 0); assert.equal((result.response.result as {enabled:boolean}).enabled, false);
    const old = await protocol.handle(JSON.stringify({ protocol_version: 2, operation: 'source_lifecycle', payload })); assert.equal(old.status, 2);
    assert(!existsSync(join(f.directory, 'claude-statusline-runtime.json')));
    assert.equal(f.launched.length, 0);
});

test('the worker refuses late automatic observations after shutdown and preserves manual access', async t => {
    const f = fixture(t); f.enable(); f.tick();
    let release: () => void = () => assert.fail('provider did not start');
    const worker = new SourceService(f.configuration, f.now, undefined, async (source, context) => {
        await new Promise<void>(resolve => { release = resolve; });
        return { ...emptyObservation(source, context, 'valid', 'valid'), value: 42, observed_at: new Date(f.now()).toISOString() };
    });
    const pending = worker.work(f.launched[0]!.id);
    f.change('auto-off'); release(); await pending;
    assert.equal(f.service.job(f.launched[0]!.id).state, 'cancelled');
    assert.equal(f.service.diagnose('github', f.context()).view.value, null);
    const manual = f.service.start('github', f.context(), 'manual');
    const completion = worker.work(manual.id); release(); await completion;
    assert.equal(f.service.diagnose('github', f.context()).view.value, 42);
    assert.equal(f.service.job(manual.id).state, 'completed');
});

test('shared editors review and cancel automatic choices independently of display save in all languages', async t => {
    const f = fixture(t); f.change('enable', { review_revision: f.service.review('github').review_revision });
    const protocol = new ConfigurationProtocol(f.configuration);
    const request = (operation: string, payload: unknown = {}) => protocol.dispatch({ protocol_version: PROTOCOL_VERSION, operation, payload });
    const backend = { request } as SourceBackend;
    for (const language of LANGUAGES) {
        f.change('auto-off');
        const editor = new Editor(request('describe') as never, request('read') as never);
        const draft = JSON.stringify(editor.draft);
        openSources(editor); await performSourceAction(editor, backend);
        assert(isSourceResult('sources_read', editor.sources!.library));
        sourcesKey(editor, { key: 'enter' }); editor.sources!.cursor = 10;
        sourcesKey(editor, { key: 'enter' }); await performSourceAction(editor, backend);
        assert.equal(editor.sources!.page, 'auto-review');
        sourcesKey(editor, { key: 'right' });
        assert(!sourcesView(editor, language, 64, 12).some(r => r.text.includes('sources.automatic')));
        sourcesKey(editor, { key: 'escape' });
        assert(!f.service.read().automatic.some(p => p.enabled));
        sourcesKey(editor, { key: 'enter' }); editor.sources!.cursor = 10;
        sourcesKey(editor, { key: 'enter' }); await performSourceAction(editor, backend);
        sourcesKey(editor, { key: 'enter' }); await performSourceAction(editor, backend);
        assert.equal(f.service.read().automatic[0]!.enabled, true);
        assert.equal(JSON.stringify(editor.draft), draft);
        assert.equal(f.launched.length, 0);
        assert(!existsSync(join(f.directory, 'settings.json')), 'saving local policy cannot apply host integration');
    }
});

test('command scheduling uses separate approval, a 300s default, serial fair contexts and no Git/auth requirement', async t => {
    const f=fixture(t);
    f.change('edit',{source:{name:'Command',kind:'command',scope:{project:null,session:null,agent:null},ttl_seconds:1,settings:{executable:process.execPath,args:['-e','process.stdout.write("42")'],cwd:f.root,input:{session:'session'},output:'text',timeout_ms:5000}}});
    f.change('enable',{review_revision:f.service.review('github').review_revision});
    f.tick();assert.equal(f.launched.length,0);
    f.change('auto-on',{review_revision:f.service.review('github').review_revision});
    assert.equal(f.service.read().version,3);assert.equal(f.service.read().automatic[0]!.interval_seconds,300);
    f.tick('one');f.tick('two');assert.equal(f.launched.length,1,'one source never overlaps across contexts');
    const first=f.launched[0]!,manual=f.service.start('github',first.context,'manual');assert.equal(manual.id,first.id);
    await f.service.work(first.id);
    const done=f.service.job(first.id);assert.equal(done.state,'completed');assert.equal(done.result?.exit_code,0);assert.equal(done.result?.summary,'42');
    f.advance(300001);f.tick('one');f.tick('two');
    assert.equal(f.launched.length,2);assert.notEqual(f.launched[1]!.context.session,first.context.session,'the other due context gets its turn');
    f.change('auto-off');assert.equal(f.service.job(f.launched[1]!.id).state,'cancelled');
    f.change('edit',{source:{name:'Edited',kind:'command',scope:{project:null,session:null,agent:null},ttl_seconds:2,settings:{executable:process.execPath,args:['-e',''],cwd:f.root,input:{},output:'text'}}});
    assert.equal(f.service.read().automatic.length,0);assert.equal(f.service.source('github').enabled,false);
});
test('local agent contexts expire with their session and identical command inputs coalesce', t=>{
    const f=fixture(t);
    f.change('edit',{source:{name:'Agent command',kind:'command',scope:{project:null,session:'one',agent:'agent-one'},ttl_seconds:300,settings:{executable:process.execPath,args:['-p','42'],cwd:f.root,input:{agent:'agent'},output:'text'}}});f.enable();
    const send=(seq:number,agents:{id:string;project:string}[])=>f.scheduler.lifecycle({session_id:'one',epoch:'epoch',seq,project:f.root,host_version:'2.1.294',event:'tick',agents});
    send(0,[]);assert.equal(f.launched.length,0);
    send(1,[{id:'agent-one',project:f.root}]);assert.equal(f.launched.length,1);assert.equal(f.launched[0]!.context.agent,'agent-one');
    send(2,[]);assert.equal(f.service.job(f.launched[0]!.id).state,'cancelled');
});
test('command failures retain successful observations and back off or pause by the actual result',async t=>{
    const f=fixture(t);
    const spec={name:'Command',kind:'command',scope:{project:null,session:null,agent:null},ttl_seconds:1,settings:{executable:process.execPath,args:['-e','process.stdout.write("good")'],cwd:f.root,input:{},output:'text',timeout_ms:5000}};
    f.change('edit',{source:spec});f.enable();f.tick();await f.service.work(f.launched[0]!.id);f.tick();
    assert(f.service.inspect('github',f.context()).last_success);
    f.advance(300001);f.tick();f.finish('failed','exit');f.tick();
    assert.equal(f.service.diagnose('github',f.context()).automatic.state,'backoff');
    f.advance(600001);f.tick();f.finish('failed','missing_program');f.tick();
    assert.equal(f.service.diagnose('github',f.context()).automatic.state,'paused');
    const attempts=f.launched.length;f.advance(3*86400000);f.tick();assert.equal(f.launched.length,attempts);assert.equal(f.service.diagnose('github',f.context()).automatic.state,'paused');
    const job=f.service.start('github',f.context(),'retry');await f.service.work(job.id);f.tick();
    assert.notEqual(f.service.diagnose('github',f.context()).automatic.state,'paused');
});

test('saved GitHub checks paginate locally and retain their observed identity after a failed refresh',async t=>{
    const f=fixture(t);f.change('enable',{review_revision:f.service.review('github').review_revision});let calls=0;
    const worker=new SourceService(f.configuration,f.now,undefined,async(source,context)=>{
        calls++;return calls===1?{version:1,source_id:source.id,source_revision:source.revision,context,observed_at:new Date(f.now()).toISOString(),state:'valid',reason:'valid',value:12,unit:null,fields:{ci:'pending'},checks:Array.from({length:35},(_,i)=>({name:'Check '+i,state:'pending',bucket:'pending',url:i===0?'file:///private':'https://github.com/owner/repo/actions/runs/'+i}))}:{version:1,source_id:source.id,source_revision:source.revision,context,observed_at:null,state:'error',reason:'network',value:null,unit:null};
    });
    let job=f.service.start('github',f.context(),'one');await worker.work(job.id);
    const first=f.service.inspect('github',f.context());assert.equal(first.total,35);assert.equal(first.checks.length,16);assert.equal(first.checks[0]!.url,null);
    assert.equal(f.service.inspect('github',f.context(),16).checks[0]!.name,'Check 16');assert.equal(calls,1,'reading pages never invokes the provider');
    f.advance(1);job=f.service.start('github',f.context(),'two');await worker.work(job.id);
    const failed=f.service.inspect('github',f.context(),32);assert.equal(failed.view.reason,'network');assert.equal(failed.view.state,'error');assert.equal(failed.view.freshness,'current');f.advance(301000);assert.equal(f.service.inspect('github',f.context()).view.freshness,'stale');assert.equal(failed.checks.length,3);assert.equal(failed.checks_observed_at,first.checks_observed_at);assert.equal(failed.last_success,first.last_success);
});
