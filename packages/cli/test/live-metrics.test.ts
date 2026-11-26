import test, { type TestContext } from 'node:test';
import { setup, observation as o, plain, assert, fs, join, writeLines } from './runtime-support.js';
import { main } from '../src/main.js';
import { collectMetrics } from '../src/runtime/live/collect.js';
import { promptLine, assistantLine } from './lifecycle-support.js';
import { UsageCollector } from '../src/runtime/usage.js';
import { sessionTokenCounts } from '@fbincon/statusline-core/runtime/usage';
import { CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { lock } from '@fbincon/statusline-platform/files';
import { config } from './render-support.js';
function metrics(t: TestContext) { const f = setup(t); f.apply(o(), o('prompt', 1, 1010, { prompt: 'p' }), o('turn_start', 2, 1020, { turn_id: 't' })); return f; }
test('tests.runtime.live.test_metrics.LiveMetricsTests.test_queued_prompt_does_not_steal_tools_or_nested_agents', t => {
    const f = metrics(t);
    f.apply(o('prompt', 3, 1030, { prompt: 'queued' }), o('agent_start', 4, 1040, { agent: 'a', turn_id: 't' }), o('agent_start', 5, 1050, { agent: 'nested', parent_agent_id: 'a' }), o('tool_start', 6, 1060, { request_id: 'tool', turn_id: 't', payload: { name: 'Read' } }), o('agents', 7, 1070, { payload: { agents: [{ id: 'a', parent_id: null, status: 'running', local: true }, { id: 'nested', parent_id: 'a', status: 'waiting', local: true }, { id: 'remote', parent_id: null, status: 'running', local: false }] } }));
    const p = f.points();
    assert.equal(p['active-agents'].value, 2);
    assert.equal(p['active-agents'].partial, true);
    assert.equal(p['last-tool'].value.name, 'Read');
    assert.equal(f.points('queued')['last-tool'].value, null);
    assert.equal(f.points('queued')['run-state'].value, 'queued');
    assert.equal(f.store.load('s')!.agents.nested!.prompt_id, 'p');
});
test('tests.runtime.live.test_metrics.LiveMetricsTests.test_out_of_order_tool_end_does_not_replace_latest_started_tool', t => {
    const f = metrics(t);
    f.apply(o('tool_end', 4, 1100, { turn_id: 't', request_id: 'old', payload: { name: 'Read', status: 'denied' } }), o('tool_start', 3, 1030, { turn_id: 't', request_id: 'old', payload: { name: 'Read' } }), o('tool_start', 5, 1110, { turn_id: 't', request_id: 'new', payload: { name: 'Bash' } }), o('tool_end', 6, 1200, { turn_id: 't', request_id: 'old', payload: { name: 'Read', status: 'success' } }));
    assert.deepEqual(f.points()['last-tool'].value, { name: 'Bash', status: 'started' });
    assert.equal(f.store.load('s')!.tools['e:old']!.status, 'denied');
});
test('tests.runtime.live.test_metrics.LiveMetricsTests.test_checklist_snapshots_zero_and_updates_are_prompt_scoped', t => {
    const f = metrics(t);
    f.apply(o('task_update', 3, 1030, { turn_id: 't', payload: { provider: 'tasks', id: '1', status: 'completed' } }));
    assert.equal(f.points()['task-progress'].partial, true);
    f.apply(o('task_snapshot', 4, 1040, { turn_id: 't', payload: { provider: 'tasks', tasks: [] } }));
    assert.deepEqual(f.points()['task-progress'].value, { completed: 0, total: 0 });
    assert.equal(f.points()['task-progress'].partial, false);
    f.apply(o('task_snapshot', 5, 1050, { turn_id: 't', payload: { provider: 'tasks', tasks: [{ id: '1', status: 'pending' }] } }), o('task_update', 6, 1060, { turn_id: 't', payload: { provider: 'tasks', id: '1', status: 'completed' } }), o('task_snapshot', 7, 1049, { turn_id: 't', payload: { provider: 'tasks', tasks: [] } }), o('prompt', 8, 1080, { prompt: 'next' }));
    assert.deepEqual(f.points()['task-progress'].value, { completed: 1, total: 1 });
    assert.equal(f.points('next')['task-progress'].value, null);
});
test('tests.runtime.live.test_metrics.LiveMetricsTests.test_stale_live_sources_preserve_terminal_history', t => {
    const f = metrics(t);
    f.apply(o('permission', 3, 1030), o('tool_end', 4, 1040, { turn_id: 't', request_id: 'r', payload: { name: 'Read', status: 'success' } }), o('turn_end', 5, 1050, { turn_id: 't', payload: { status: 'completed' } }));
    assert.equal(f.points()['permission-mode'].partial, true);
    const p = f.points('p', 20000);
    assert.equal(p['permission-mode'].value, null);
    assert.equal(p['active-agents'].value, null);
    assert.equal(p['run-state'].value, 'completed');
    assert.deepEqual(p['last-tool'].value, { name: 'Read', status: 'success' });
});
test('tests.runtime.live.test_metrics.LiveMetricsTests.test_reload_and_unknown_turn_cannot_bind_old_prompt', t => {
    const f = metrics(t);
    f.apply(o('heartbeat', 0, 2000, { epoch: 'new', payload: { host_version: '2.1.289', loaded_at_ms: 2000 } }), o('tool_start', 1, 2010, { epoch: 'new', prompt: 'p', request_id: 'r', payload: { name: 'Read' } }));
    assert.equal(f.points('p', 2100)['last-tool'].value, null);
    assert.equal(f.points('p', 2100)['run-state'].value, null);
});
test('tests.runtime.live.test_metrics.LiveMetricsTests.test_duplicate_snapshot_id_and_malformed_status_rejected_before_writes', t => {
    const f = metrics(t), row = { id: 'a', parent_id: null, status: 'running', local: true }, before = plain(f.store.load('s'));
    assert.throws(() => f.apply(o('agents', 3, 1030, { payload: { agents: [row, row] } })), /duplicate/);
    assert.throws(() => f.apply(o('agents', 3, 1030, { payload: { agents: [{ ...row, status: 'invalid' }] } })), /invalid/);
    assert.deepEqual(plain(f.store.load('s')), before);
});

async function command(f: ReturnType<typeof setup>, name: string, input: unknown) {
    let stdout = '', stderr = '';
    const code = await main([name], { configDir: f.root, runtime: f.context, now: () => new Date(f.context.nowMs()),
        stdin: () => JSON.stringify(input), stdout: text => { stdout += text; }, stderr: text => { stderr += text; } });
    assert.equal(code, 0);
    assert.equal(stderr, '');
    return stdout;
}

test('the live-only footer follows the current task while a fresh heartbeat still points to old terminal data', async t => {
    const f = setup(t), path = join(f.root, 'transcript.jsonl');
    const input = { session_id: 's', transcript_path: path };
    f.preferences(true, false);
    fs.writeFileSync(join(f.root, CONFIG_FILENAME), JSON.stringify(config(['run-state', 'last-tool'], { statusline_language: 'en' })));
    f.apply(o(), o('prompt', 1, 1010, { prompt: 'old-uuid' }), o('turn_start', 2, 1020, { turn_id: 'old-turn' }),
        o('tool_end', 3, 1030, { turn_id: 'old-turn', request_id: 'old-tool', payload: { name: 'Bash', status: 'success' } }),
        o('turn_end', 4, 1090, { turn_id: 'old-turn', payload: { status: 'completed' } }));
    writeLines(path, [{ ...promptLine('old', 1.01), uuid: 'old-uuid' }, { ...assistantLine(1.08), message: { id: 'a', usage: { input_tokens: 5 } } }]);
    f.clock(1500000000n);
    assert.match(await command(f, 'render', input), /completed.*Bash success/u);
    writeLines(path, [{ ...promptLine('new', 2), uuid: 'new-uuid' }, assistantLine(2.1)], true);
    f.apply(o('heartbeat', 5, 2200));
    f.clock(2300000000n);
    for (const prompt of [null, 'new', 'old']) {
        const rendered = await command(f, 'render', { ...input, prompt_id: prompt });
        assert.match(rendered, /State.*main/u);
        assert.match(rendered, /Tool.*—/u);
        assert.doesNotMatch(rendered, /completed|Bash/u);
    }
    const usage = new UsageCollector(f.context), entry = usage.load().state.sessions.s!;
    assert.deepEqual(Object.keys(entry.files), []);
    assert.equal(entry.usage_index, undefined);
    assert.equal(sessionTokenCounts(entry), null);
    assert.equal(f.tasks.store.state('s', 'new-uuid')!.prompt_id, 'new');
    f.apply(o('prompt', 6, 2010, { prompt: 'new-uuid' }), o('turn_start', 7, 2020, { turn_id: 'new-turn' }),
        o('tool_start', 8, 2060, { turn_id: 'new-turn', request_id: 'new-tool', payload: { name: 'Read' } }));
    assert.match(await command(f, 'render', { ...input, prompt_id: 'new' }), /main.*Read started/u);
    f.clock(20000000000n);
    const stale = await command(f, 'render', { ...input, prompt_id: 'new' });
    assert.match(stale, /main.*Tool.*—/u);
    assert.doesNotMatch(stale, /Bash|Read/u);
});

test('a queued prompt leaves the active tool with its executing owner and unknown owners contribute no metrics', t => {
    const f = metrics(t);
    f.preferences(true, false);
    f.tasks.transcript('s', [{ kind: 'prompt', prompt_id: 'p', wall_ns: 1010000000n },
        { kind: 'prompt', prompt_id: 'queued', wall_ns: 1030000000n }]);
    f.apply(o('prompt', 3, 1030, { prompt: 'queued' }),
        o('tool_start', 4, 1060, { request_id: 'tool', turn_id: 't', payload: { name: 'Read' } }),
        o('turn_start', 5, 1070, { turn_id: 'unowned', prompt: 'missing' }),
        o('tool_start', 6, 1080, { request_id: 'unbound-tool', turn_id: 'unowned', payload: { name: 'Bash' } }));
    const active = collectMetrics(f.store, 's', 'p', 1200);
    assert.deepEqual(active['last-tool']!.value, { name: 'Read', status: 'started' });
    const queued = collectMetrics(f.store, 's', 'queued', 1200);
    assert.equal(queued['run-state']!.value, 'queued');
    assert.equal(queued['last-tool']!.value, null);
    for (const id of ['run-state', 'last-tool'])
        assert.equal(collectMetrics(f.store, 's', 'missing', 1200)[id]!.value, null);
});

test('a native turn waits for both pending identities to resolve to the same human message', async t => {
    const f = setup(t), path = join(f.root, 'transcript.jsonl'), input = { session_id: 's', transcript_path: path, prompt_id: 'p' };
    f.preferences(true, true);
    fs.writeFileSync(join(f.root, CONFIG_FILENAME), JSON.stringify(config(['run-state', 'last-tool', 'task-timer'], { statusline_language: 'en' })));
    f.apply(o(), o('prompt', 1, 1100, { prompt: 'p', source: 'classic_hook' }), o('prompt', 2, 1120, { prompt: 'uuid' }),
        o('turn_start', 3, 1130, { turn_id: 't' }), o('tool_start', 4, 1300, { turn_id: 't', request_id: 'r', payload: { name: 'Read' } }));
    assert.equal(f.store.load('s')!.turns['e:main:t']!.prompt_id, null);
    assert.equal(collectMetrics(f.store, 's', 'p', 1500)['last-tool']!.value, null);
    writeLines(path, [{ ...promptLine('p', 1.1), uuid: 'uuid' }, assistantLine(1.4)]);
    f.clock(5000000000n);
    const rendered = await command(f, 'render', input);
    assert.match(rendered, /main.*Read started.*0m 03s/u);
    assert.equal(f.tasks.store.load('s')!.turns.length, 1);
    const oldLive = fs.readFileSync(f.store.path('s'));
    const read = await command(f, 'runtime', { protocol_version: 3, operation: 'read', payload: { session_id: 's', prompt_id: 'uuid' } });
    assert.equal(JSON.parse(read).result.metrics['last-tool'].value.name, 'Read');
    assert.deepEqual(fs.readFileSync(f.store.path('s')), oldLive);
});
const submit = { hook_event_name: 'UserPromptSubmit', session_id: 's', prompt_id: 'p', permission_mode: 'plan' };

test('settings UserPromptSubmit provides a recent permission snapshot without a Mod classic hook', async t => {
    const f = setup(t);
    f.preferences(true, false);
    f.apply(o());
    const before = plain(f.store.load('s'));
    fs.writeFileSync(join(f.root, CONFIG_FILENAME), JSON.stringify(config(['permission-mode'], { statusline_language: 'en' })));
    f.clock(1100000000n);
    assert.equal(await command(f, 'hook', { ...submit, prompt: 'A real task' }), '');
    const permission = { mode: 'plan', live: false, observed_at_ms: 1100, source: 'classic_hook' };
    assert.deepEqual(plain(f.store.load('s')), { ...before, permission });
    assert.equal(f.tasks.store.state('s', 'p')?.status, 'running');

    const input = { session_id: 's', prompt_id: 'p' };
    const read = async () => JSON.parse(await command(f, 'runtime', { protocol_version: 3, operation: 'read', payload: input })).result.metrics['permission-mode'];
    const observed = await read();
    assert.deepEqual([observed.value, observed.partial, observed.reason, observed.source, observed.observed_at_ms], ['plan', true, 'observed_only', 'classic_hook', 1100]);
    assert.equal(await command(f, 'render', input), 'Mode plan*\n');

    f.apply(o('heartbeat', 1, 15500));
    f.clock(16099000000n);
    assert.equal(await command(f, 'render', input), 'Mode plan*\n');
    f.clock(16100000000n);
    assert.equal((await read()).value, 'plan');
    f.clock(16101000000n);
    assert.equal((await read()).value, null);
    assert.equal(await command(f, 'render', input), 'Mode —\n');
});

test('settings permission snapshots respect collection, session ownership, and native reload', async t => {
    const f = setup(t);
    const run = (input: unknown) => command(f, 'hook', input);
    f.apply(o());
    const path = f.store.path('s'), before = fs.readFileSync(path);
    f.clock(1100000000n);
    f.preferences(false, true);
    assert.equal(await run(submit), '');
    f.preferences(true, false);
    for (const input of [
        { ...submit, hook_event_name: 'Stop' }, { ...submit, agent_id: 'worker' }, { ...submit, session_id: '' },
        { ...submit, session_id: 'another' },
        ...[undefined, '', ' ', 3, 'x'.repeat(65), 'plan\u001b[31m'].map(permission_mode => ({ ...submit, permission_mode })),
    ]) assert.equal(await run(input), '');
    assert.deepEqual(fs.readFileSync(path), before);
    assert.equal(fs.existsSync(f.store.path('another')), false);
    assert.equal(fs.readdirSync(f.store.directory()).length, 2);

    const release = lock(path.slice(0, -5) + '.lock');
    try { assert.equal(await run(submit), ''); }
    finally { release(); }
    assert.deepEqual(fs.readFileSync(path), before);

    f.apply(o('invalidate', 1, 1150));
    f.clock(1200000000n);
    assert.equal(await run(submit), '');
    assert.equal(f.store.load('s')!.permission, null);
    f.apply(o('heartbeat', 0, 1250, { epoch: 'new', payload: { host_version: '2.1.319', loaded_at_ms: 1250 } }));
    assert.equal(await run(submit), '');
    assert.equal(f.store.load('s')!.permission, null);
    f.clock(1300000000n);
    assert.equal(await run(submit), '');
    assert.equal(f.points(null, 1300)['permission-mode'].value, 'plan');
});

test('settings and Mod permission snapshots preserve the latest evidence and a verified feed', async t => {
    const f = setup(t);
    f.preferences(true, false);
    f.apply(o());
    f.clock(1200000000n);
    assert.equal(await command(f, 'hook', submit), '');
    f.apply(o('permission', 1, 1100, { source: 'classic_hook', payload: { mode: 'default', live: false } }),
        o('permission', 2, 1200, { source: 'classic_hook', payload: { mode: 'default', live: false } }));
    assert.equal(f.points(null, 1250)['permission-mode'].value, 'plan');

    f.apply(o('permission', 3, 1260, { source: 'classic_hook', payload: { mode: 'acceptEdits', live: false } }));
    const path = f.store.path('s'), before = fs.statSync(path, { bigint: true });
    assert.equal(await command(f, 'hook', submit), '');
    assert.equal(fs.statSync(path, { bigint: true }).ino, before.ino);
    assert.equal(f.points(null, 1300)['permission-mode'].value, 'acceptEdits');

    f.apply(o('permission', 4, 1260, { source: 'otel', payload: { mode: 'default', live: true } }));
    f.clock(1320000000n);
    assert.equal(await command(f, 'hook', submit), '');
    f.apply(o('permission', 5, 1310, { source: 'classic_hook' }));
    const point = f.points(null, 1400)['permission-mode'];
    assert.deepEqual([point.value, point.partial, point.source], ['default', false, 'otel']);
});
