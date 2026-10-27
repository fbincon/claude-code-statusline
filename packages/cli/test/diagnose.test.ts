import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup } from './final-support.js';
import { setup as runtimeSetup, observation, allFiles, pythonJson } from './runtime-support.js';
import { config, agentConfig, rendered, task } from './render-support.js';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { DEFAULT_ITEM } from '@fbincon/statusline-core/config/defaults';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { PROTOCOL_VERSION, type Draft } from '@fbincon/statusline-core/contracts/ui';
import { parseResponse } from '@fbincon/statusline-core/editor/backend';
import { cacheMissEvidence } from '@fbincon/statusline-core/rendering/host-fields';
import { snapshotMetrics } from '@fbincon/statusline-core/runtime/live/snapshot';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { ConfigurationService } from '../src/config/service.js';
import { ConfigurationProtocol } from '../src/ui/protocol.js';
import { diagnosisAdapter } from '../src/diagnostics/service.js';
import { diagnosticText } from '../src/diagnostics/command.js';
import { main } from '../src/main.js';
import { SourceService } from '../src/sources/service.js';
import { newInstance } from '@fbincon/statusline-core/editor/instances';

const draft = (items: string[]): Draft => ({ display: config(items), host: { ...DEFAULT_HOST, padding: 0 } });
const output = (r: ReturnType<Awaited<ReturnType<typeof diagnosisAdapter>>>) => r.output.map(row => row.spans.map(s => s.text).join('')).join('\n');
const fail = () => assert.fail('Diagnosis attempted a side effect or host process');

test('extension diagnosis uses input time and preserves evidence for each instance and agent without writes', async t => {
    const f=setup(t),path=join(f.root,'extension.json'),sources=new SourceService(f.service);
    const change=(action:string,fields={})=>sources.mutate({action,id:'local',expected_revision:sources.read().revision,...fields});
    change('add',{source:{name:'Local',kind:'json',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{path}}});
    change('enable',{review_revision:sources.review('local').review_revision});
    const binding=change('bind').binding!,display=agentConfig([]);
    const first=newInstance('external-value',[]);first.source=binding;
    const second={...newInstance('external-value',[first]),source:binding};display.subagents.instances=[first,second];
    const adapter=await diagnosisAdapter(f.service,{now:()=>Date.parse('2026-10-28T12:00:00Z')});
    for(const [observed_at,status,freshness] of [['2026-10-28T10:59:00Z','observed','current'],['2026-10-28T11:00:00Z','observed','current'],['2026-10-28T10:54:59Z','stale','stale'],['2026-10-28T12:00:00Z','newer_than_input','newer_than_input'],[null,'association_unavailable','unknown']] as const) {
        writeFileSync(path,JSON.stringify({value:0,observed_at}));
        const before=allFiles(f.root);
        const result=adapter({draft:{display,host:DEFAULT_HOST},scope:'subagent',width:120,input:{session_id:'session',tasks:[task({id:'a'}),task({id:'b'})]},observed_at:'2026-10-28T11:00:00Z'});
        assert.equal(result.observed_at,'2026-10-28T11:00:00.000Z');assert.equal(result.diagnosed_at,'2026-10-28T12:00:00.000Z');
        for(const node of result.instances) {
            assert.deepEqual(node.evidence.map(e=>e.scope),['subagent:a','subagent:b']);
            assert(node.evidence.every(e=>e.status===status && e.freshness===freshness));
        }
        if(status==='newer_than_input'||status==='association_unavailable')assert(!output(result).includes('Local: 0'));
        else assert(output(result).includes('Local: 0'));
        assert.deepEqual(allFiles(f.root),before);
        const isolated=adapter({draft:{display,host:DEFAULT_HOST},scope:'subagent',width:120,input:{tasks:[task({id:'a'}),task({id:'b'})]},include_local:false});
        assert(isolated.instances.every(node=>node.evidence.every(e=>e.status==='input_only')));
        assert.deepEqual(allFiles(f.root),before);
    }
});

test('official-source synthetic payload fixtures retain their provenance and reproduce both added fields', async t => {
    const f=setup(t), adapter=await diagnosisAdapter(f.service);
    const fixture=JSON.parse(readFileSync(join(process.cwd(),'tests/fixtures/diagnostics/host-input.json'),'utf8'));
    assert.equal(fixture.source,'https://code.claude.com/docs/en/statusline');
    for(const sample of fixture.cases) {
        const r=adapter({draft:draft(['worktree','cache-miss-reason']),scope:'main',width:120,input:sample.input,include_local:false});
        if(sample.id==='linked-worktree') assert.equal(r.host_fields.worktree.selected_source,'workspace.git_worktree');
        if(sample.id==='both-worktrees') assert.equal(r.host_fields.worktree.selected_source,'worktree.name');
        if(sample.id==='cache-tools') assert.equal(r.host_fields.cache_miss.tools_added,2);
        if(sample.id==='older-host') assert.equal(output(r),'');
    }
});

test('supplied diagnosis shares real fitting, instance identity and sample isolation at 40/80/120 columns', async t => {
    const f = setup(t), adapter = await diagnosisAdapter(f.service, { now: () => 1000, files: { read: fail } });
    const current = draft(['model', 'worktree', 'cache-miss-reason', 'cache-misses']);
    current.display.instances.push({ id: 'copy', type_id: 'model', enabled: true, text: null, options: { ...DEFAULT_ITEM, formatting: {}, max_width: 5 } });
    const input = { model: { id: '中文é👩‍💻'.repeat(12) }, workspace: { git_worktree: 'linked' }, prompt_cache: { misses: 0, last_miss_cause: null } };
    for (const width of [40, 80, 120]) for (const separator_style of ['classic', 'powerline'] as const) {
        current.display.separator_style = separator_style;
        const r = adapter({ draft: current, scope: 'main', width, input, include_local: false });
        assert.equal(output(r), rendered(input, current.display, {}, width));
        assert.deepEqual(r.instances.map(i => i.id), current.display.instances.map(i => i.id));
        assert.equal(r.sample, false);
        assert.ok(r.instances.find(i => i.id === 'copy')!.rows[0]!.truncated);
        assert.ok(!JSON.stringify(r.instances).includes('sample_'));
        assert.equal(r.instances.find(i => i.type_id === 'cache-misses')!.evidence[0]!.status, 'observed');
    }
});

test('worktree fallback preserves Claude session precedence and identifies both fields', async t => {
    const f = setup(t), adapter = await diagnosisAdapter(f.service, { now: () => 1000 });
    for (const [input, expected, source] of [
        [{}, '', null], [{ workspace: { git_worktree: 'linked' } }, 'Git worktree linked', 'workspace.git_worktree'],
        [{ worktree: { name: 'claude' } }, 'Worktree claude', 'worktree.name'],
        [{ worktree: { name: 'claude' }, workspace: { git_worktree: 'linked' } }, 'Worktree claude', 'worktree.name'],
        [{ worktree: { name: 3 }, workspace: { git_worktree: 'linked' } }, 'Git worktree linked', 'workspace.git_worktree'],
    ] as const) {
        const r = adapter({ draft: draft(['worktree']), scope: 'main', width: 80, input, include_local: false });
        assert.equal(output(r), expected); assert.equal(r.host_fields.worktree.selected_source, source);
    }
});

test('cache reason handles zero, absence, null, unknown codes, invalid fields and detailed deltas', async t => {
    const f = setup(t), adapter = await diagnosisAdapter(f.service);
    assert.equal(cacheMissEvidence({}).status, 'not_observed');
    assert.equal(cacheMissEvidence({ misses: 0, last_miss_cause: null }).status, 'no_misses');
    assert.equal(cacheMissEvidence({ misses: 2, last_miss_cause: null }).status, 'unidentified');
    for (const bad of [true, [], 3, { causes: [] }, { causes: [7] }]) assert.equal(cacheMissEvidence({ last_miss_cause: bad }).status, 'invalid_field');
    const prompt_cache = { misses: 2, hit_ratio: 0.91, cache_write_tokens: 352000, last_miss_at: 100,
        last_miss_cause: { causes: ['tools_changed', 'system_prompt_changed', 'future_reason\u001b[31m'], tools_added: 0, tools_removed: 2, system_char_delta: -12 } };
    for (const language of LANGUAGES) {
        const current = draft(['cache-miss-reason', 'prompt-cache']); current.display.statusline_language = language;
        const r = adapter({ draft: current, scope: 'main', width: 500, input: { prompt_cache }, include_local: false });
        assert.ok(!output(r).includes('statusline.'));
        assert.ok(output(r).includes('future_reason')); assert.ok(!output(r).includes('\u001b'));
        assert.equal(r.host_fields.cache_miss.tools_added, 0); assert.equal(r.host_fields.cache_miss.system_char_delta, -12);
        const text = diagnosticText(r, language); assert.ok(!text.includes('diagnose.')); assert.ok(text.includes('-12'));
    }
    assert.equal(rendered({ prompt_cache }, config(['prompt-cache'])), 'cache 91% · 352K w');
});

test('diagnosis distinguishes disabled, condition-hidden, clipped and row-hidden instances', async t => {
    const f = setup(t), adapter = await diagnosisAdapter(f.service, { now: () => 1000 });
    const current = draft(['context-used', 'model']);
    current.display.instances[0]!.options = { ...DEFAULT_ITEM, formatting: {}, visibility: 'used-at-least', visibility_threshold: 90 };
    current.display.instances[1]!.enabled = false;
    const r = adapter({ draft: current, scope: 'main', width: 40, input: { context_window: { used_percentage: 10 } }, include_local: false });
    assert.equal(r.instances[0]!.rows[0]!.outcome, 'condition_hidden');
    assert.deepEqual(r.instances[1]!.rows, []); assert.ok(r.instances[1]!.reasons.some(r => r.code === 'configured_off'));
    const agent = { display: agentConfig(['status', 'name'], { hide_completed: true }), host: { ...DEFAULT_HOST } };
    const agents = adapter({ draft: agent, scope: 'subagent', width: 40, input: { tasks: [task({ status: 'completed' })] }, include_local: false });
    assert.equal(agents.instances[0]!.rows[0]!.outcome, 'row_hidden');
    assert.ok(agents.instances[0]!.evidence.some(e => e.source === 'supplied_input'));
});

test('input version governs capability, invalid fields are distinct, timestamps are not inferred', async t => {
    const f = setup(t), adapter = await diagnosisAdapter(f.service, { now: () => 5000 });
    const r = adapter({ draft: draft(['cache-miss-reason', 'cache-misses']), scope: 'main', width: 80, input: { version: '2.1.200', prompt_cache: { misses: 'bad' } } });
    assert.ok(r.instances[0]!.reasons.some(r => r.code === 'unsupported_host'));
    assert.equal(r.instances[1]!.evidence[0]!.status, 'invalid_field');
    assert.equal(r.observed_at, null); assert.equal(r.instances[1]!.evidence[0]!.freshness, 'unknown');
    assert.equal(r.diagnosed_at, '1970-01-01T00:00:05.000Z');
});

test('CLI stdin/file and backend transport are read-only, localized and strict', async t => {
    const f = setup(t), root = join(f.root, 'absent'); let stdout = '', stderr = '';
    const call = async (args: string[], input = '{}') => {
        stdout = ''; stderr = '';
        return main(args, { configDir: root, hostVersion: fail, stdin: () => input, stdout: s => { stdout += s; }, stderr: s => { stderr += s; } });
    };
    assert.equal(await call(['diagnose', '--input', '-', '--json', '--input-only']), 0);
    assert.equal(JSON.parse(stdout).sample, false); assert.equal(stderr, ''); assert.ok(!existsSync(root));
    for (const input of ['{', '[]', 'null', '{"a":1,"a":2}', '{"a":NaN}']) {
        assert.equal(await call(['diagnose', '--input', '-', '--json'], input), 2); assert.ok(JSON.parse(stdout).error);
    }
    for (const flags of [[], ['--width', '0'], ['--scope', 'all'], ['--observed-at', 'yesterday'], ['--observed-at', '2026-02-30T00:00:00Z'], ['--width', '40', '--width', '80']]) {
        const args = flags.length ? ['diagnose', '--input', '-', '--json', ...flags] : ['diagnose', '--json'];
        assert.equal(await call(args), 2); assert.ok(JSON.parse(stdout).error);
    }
    const path = join(f.root, '输入 file.json'); writeFileSync(path, '\uFEFF{"model":{"id":"example"}}');
    for (const language of LANGUAGES) {
        assert.equal(await call(['--language', language, 'diagnose', '--input', path, '--input-only']), 0);
        assert.ok(!stdout.includes('diagnose.')); assert.ok(stdout.includes('example'));
    }
    assert.ok(!existsSync(root));
    const service = new ConfigurationService({ ...f.context, configDir: root, hostVersion: fail }, { ...f.io, lock: fail, write: fail, remove: fail, backup: fail });
    const protocol = new ConfigurationProtocol(service, undefined, undefined, await diagnosisAdapter(service, { files: { read: fail } }));
    const request = { protocol_version: PROTOCOL_VERSION, operation: 'diagnose', payload: { draft: draft(['model']), scope: 'main', width: 80, input: { model: { id: 'example' } }, include_local: false } };
    const reply = protocol.handle(JSON.stringify(request), fail);
    assert.equal(reply.status, 0);
    const r = parseResponse('diagnose', { exitCode: 0, stdout: JSON.stringify(reply.response), stderr: '' }); assert.equal(output(r), 'example');
    assert.throws(() => parseResponse('diagnose', { exitCode: 0, stdout: JSON.stringify({ protocol_version: PROTOCOL_VERSION, result: { ...r, sample: true } }), stderr: '' }));
    assert.ok(!existsSync(root));
});

test('matching runtime evidence preserves zero, rejects other prompts, stale snapshots and future evidence without writes', async t => {
    const f = runtimeSetup(t); f.preferences(true); f.clock(2000000000n);
    f.apply(observation(), observation('prompt', 1, 1100, { prompt: 'p' }), observation('agents', 2, 1200, { payload: { agents: [] } }));
    const service = new ConfigurationService({ configDir: f.root, launch: { executable: process.execPath, args: [] }, hostVersion: fail });
    const adapter = await diagnosisAdapter(service, { runtime: f.context });
    const payload = { draft: draft(['active-agents', 'permission-mode', 'run-state']), scope: 'main', width: 80, input: { session_id: 's', prompt_id: 'p' } };
    const before = allFiles(f.root);
    const r = adapter(payload); assert.equal(r.instances[0]!.evidence[0]!.status, 'observed'); assert.ok(output(r).includes('0'));
    const other = adapter({ ...payload, input: { session_id: 's', prompt_id: 'other' } }); assert.equal(other.instances[0]!.evidence[0]!.status, 'prompt_mismatch');
    const absent = adapter({ ...payload, input: { session_id: 's' } }); assert.equal(absent.instances[0]!.evidence[0]!.status, 'association_unavailable');
    const future = adapter({ ...payload, observed_at: '1970-01-01T00:00:00.500Z' }); assert.equal(future.instances[0]!.evidence[0]!.status, 'newer_than_input');
    f.clock(30000000000n); const stale = adapter(payload); assert.equal(stale.instances[0]!.evidence[0]!.status, 'stale');
    assert.deepEqual(allFiles(f.root), before);
    const state = f.store.load('s')!, original = pythonJson(state); snapshotMetrics(state, null, 'p', 2000); assert.equal(pythonJson(state), original);
});

test('strict session identity, cache-only usage and missing stores never trigger collection', async t => {
    const f = setup(t), reads: string[] = [];
    const adapter = await diagnosisAdapter(f.service, { now: () => 2000, files: { read(path) {
        reads.push(path);
        if (path.includes('statusline_usage_v2')) return Buffer.from(JSON.stringify({ sessions: { s: { files: { '/example/transcript.jsonl': {} }, ids: {}, base: { i: 0, o: 0, cc: 0, cr: 0 }, token_observed: { input: true, output: true } } } }));
        if (path.includes('live')) return Buffer.from(JSON.stringify({ session_id: 'wrong' }));
        return null;
    } } });
    const payload = { draft: draft(['input-tokens', 'output-tokens']), scope: 'main', width: 80, input: { session_id: 's', transcript_path: '/example/transcript.jsonl' } };
    const r = adapter(payload); assert.ok(r.instances.filter(i => i.enabled).every(i => i.evidence[0]!.status === 'observed')); assert.ok(output(r).includes('0'));
    assert.ok(r.instances.filter(i => i.enabled).every(i => i.evidence[0]!.freshness === 'unknown'));
    assert.ok(reads.every(path => !path.endsWith('.jsonl')));
    const other = adapter({ ...payload, input: { session_id: 's', transcript_path: '/other' } }); assert.equal(other.instances[0]!.evidence[0]!.status, 'session_mismatch');
    const old = adapter({ ...payload, observed_at: '1970-01-01T00:00:01.000Z' }); assert.equal(old.instances[0]!.evidence[0]!.status, 'association_unavailable');
    assert.deepEqual(readdirSync(f.root), []);
});

test('historical run state excludes a later task snapshot and reports each source time', async t => {
    const f = runtimeSetup(t); f.preferences(true); f.clock(4000000000n);
    f.apply(observation(), observation('prompt', 1, 1100, { prompt: 'p' }));
    const directory = join(f.context.runtimeRoot, 'turns'); mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, sha256('s') + '.json'), JSON.stringify({
        schema: 1, session_id: 's', prompt_id: 'p', status: 'completed',
        started_wall_ns: 1000000000, ended_wall_ns: 3000000000,
        duration_ns: 2000000000, updated_wall_ns: 3000000000,
    }));
    const service = new ConfigurationService({ configDir: f.root, launch: { executable: process.execPath, args: [] }, hostVersion: fail });
    const adapter = await diagnosisAdapter(service, { runtime: f.context });
    const payload = { draft: draft(['run-state', 'task-timer']), scope: 'main', width: 120, input: { session_id: 's', prompt_id: 'p' } };
    const before = allFiles(f.root), historical = adapter({ ...payload, observed_at: '1970-01-01T00:00:02Z' });
    assert.ok(!output(historical).includes('completed'), output(historical));
    assert.ok(output(historical).includes('queued'), output(historical));
    assert.equal(historical.instances[1]!.evidence[0]!.status, 'newer_than_input');
    const source = historical.instances[0]!.evidence.find(e => e.source === 'task_store')!;
    assert.equal(source.status, 'newer_than_input');
    assert.equal(source.observed_at, '1970-01-01T00:00:03.000Z');
    assert.ok(output(adapter(payload)).includes('completed'));
    assert.deepEqual(allFiles(f.root), before);
});

test('task snapshot is attributable without transcript scanning, and no prompt means no latest-task fallback', async t => {
    const f = runtimeSetup(t); f.event('UserPromptSubmit', 1); f.event('Stop', 3); f.clock(4000000000n);
    const service = new ConfigurationService({ configDir: f.root, launch: { executable: process.execPath, args: [] }, hostVersion: fail });
    const adapter = await diagnosisAdapter(service, { runtime: f.context });
    const payload = { draft: draft(['task-timer']), scope: 'main', width: 80, input: { session_id: 's', prompt_id: 'p' } };
    const before = allFiles(f.root), r = adapter(payload);
    assert.ok(output(r)); assert.equal(r.instances[0]!.evidence[0]!.source, 'task_store');
    const missing = adapter({ ...payload, input: { session_id: 's' } }); assert.equal(output(missing), ''); assert.equal(missing.instances[0]!.evidence[0]!.status, 'association_unavailable');
    assert.deepEqual(allFiles(f.root), before);
});

test('same-session Git cache is read-only, age-checked and never refreshed', async t => {
    const f = setup(t), folder = join(f.root, 'git_cache'); mkdirSync(folder);
    const value = { kind: 'ok', branch: 'topic', upstream: null, upstream_gone: false, ahead: 0, behind: 0, staged: 0, unstaged: 0, conflicts: 0, untracked: 0 };
    writeFileSync(join(folder, sha256('s') + '.json'), JSON.stringify({ version: 3, cwd: f.root, checked_ns: 1900000000, value }));
    const adapter = await diagnosisAdapter(f.service, { now: () => 2000 });
    const before = allFiles(f.root), payload = { draft: draft(['git-branch']), scope: 'main', width: 80, input: { session_id: 's', cwd: f.root } };
    assert.ok(output(adapter(payload)).includes('topic'));
    const stale = await diagnosisAdapter(f.service, { now: () => 3000 }); assert.equal(stale(payload).instances[0]!.evidence[0]!.status, 'stale');
    assert.deepEqual(allFiles(f.root), before);
});
test('Git policy failures remain unavailable with a specific cached reason', async t => {
    const f = setup(t), folder = join(f.root, 'git_cache'); mkdirSync(folder);
    writeFileSync(join(folder, sha256('s') + '.json'), JSON.stringify({version:3,cwd:f.root,checked_ns:1900000000,value:{kind:'error',reason:'filter_blocked'}}));
    const adapter = await diagnosisAdapter(f.service, {now:()=>2000});
    const before = allFiles(f.root), r = adapter({draft:draft(['git-changes']),scope:'main',width:80,input:{session_id:'s',cwd:f.root}});
    assert(output(r).includes('Git!')); assert(!output(r).includes('clean'));
    assert.equal(r.instances[0]!.evidence[0]!.status,'source_unavailable');
    assert.deepEqual(r.instances[0]!.evidence[0]!.fields,[{path:'git_policy.filter_blocked',status:'not_observed'}]);
    assert.deepEqual(allFiles(f.root),before);
});

test('partial and corrupt usage snapshots never turn unobserved output into zero', async t => {
    const f=setup(t);
    const entry={files:{'/example':{}},ids:{},base:{i:0,o:0,cc:0,cr:0},token_observed:{input:true,output:false}};
    const adapter=await diagnosisAdapter(f.service,{files:{read:path=>path.includes('statusline_usage_v2')?Buffer.from(JSON.stringify({sessions:{s:entry}})):null}});
    const payload={draft:draft(['tokens','input-tokens','output-tokens']),scope:'main',width:80,input:{session_id:'s',transcript_path:'/example'}};
    let r=adapter(payload);
    assert.equal(r.instances.find(i=>i.type_id==='output-tokens')!.evidence[0]!.status,'not_observed');
    assert.equal(r.instances.find(i=>i.type_id==='tokens')!.evidence[0]!.status,'partial');
    assert.ok(!output(r).includes('out 0'));
    entry.base.i=-1;r=adapter(payload);
    assert.equal(r.instances.find(i=>i.type_id==='input-tokens')!.evidence[0]!.status,'invalid_field');
    assert.equal(output(r),'');
});

test('diagnosis refuses foreign stored session identity and isolates ended-agent evidence by prompt', async t => {
    const f=setup(t);writeFileSync(join(f.root,'claude-statusline-runtime.json'),JSON.stringify({schema_version:2,native_timing:true,live_metrics:true}));
    const adapter=await diagnosisAdapter(f.service,{files:{read:path=>Buffer.from(JSON.stringify(path.includes('agent-durations')?
      {session_id:'s',agents:{'task-1':{prompt_id:'other',started_at_ms:1000,ended_at_ms:2000}}}:{session_id:'foreign'}))}});
    const r=adapter({draft:draft(['run-state']),scope:'main',width:80,input:{session_id:'s',prompt_id:'p'}});
    assert.equal(r.instances[0]!.evidence[0]!.status,'session_mismatch');
    const sub=adapter({draft:{display:agentConfig(['status-elapsed']),host:DEFAULT_HOST},scope:'subagent',width:80,
      input:{session_id:'s',prompt_id:'p',tasks:[task({status:'completed',startTime:1000})]}});
    assert.ok(sub.instances[0]!.evidence.some(e=>e.status==='prompt_mismatch'));
    assert.ok(!output(sub).includes('1s'));
});
