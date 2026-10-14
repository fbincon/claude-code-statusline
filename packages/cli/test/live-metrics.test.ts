import test, { type TestContext } from 'node:test';
import { setup, observation as o, plain, assert } from './runtime-support.js';
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
