import test from 'node:test';
import { setup, observation as o, plain, assert, fs, pythonJson, allFiles } from './runtime-support.js';
import { numeric } from '@fbincon/statusline-core/runtime/values';
import type { Observation } from '@fbincon/statusline-core/runtime/live/model';
import { newRecord, elapsedNs, storeFromState } from '@fbincon/statusline-core/runtime/tasks/model';
import { linkTask } from '@fbincon/statusline-core/runtime/tasks/native';
import { renderTaskTimer } from '@fbincon/statusline-core/rendering/timer';
import { loadRuntime } from '../src/config/backend-preferences.js';
import { join } from 'node:path';
function observations(unknown = false, gap = false): Observation[] {
    const rows = [o('heartbeat', 0, 0, { payload: { host_version: '2.1.289', loaded_at_ms: 0 } }), o('prompt', 1, 1000, { prompt: 'p' }), o('turn_start', 2, 2000, { prompt: 'p', turn_id: 't' })];
    if (unknown)
        rows.push(o('wait_unknown', 3, 3000, { turn_id: 't', payload: { reason: 'permission_wait_unobserved' } }));
    else
        rows.push(o('wait_start', 3, 3000, { turn_id: 't', request_id: 'question' }), o('wait_end', 4, 4000, { turn_id: 't', request_id: 'question' }));
    rows.push(o('turn_end', rows.length + Number(gap), 6000, { turn_id: 't', payload: { status: 'completed', duration_ms: 1000, wait_coverage: !unknown } }));
    return rows;
}
function ingest(f: ReturnType<typeof setup>, rows: Observation[]): void {
    for (const row of rows) {
        f.clock(BigInt(numeric(row.observed_at_ms)! * 1e6));
        f.store.observe([row], { timing: true });
    }
}
test('tests.runtime.test_task_timing.NativeTimingTests.test_native_task_and_pause_clock_are_separate_and_replays_are_idempotent', t => {
    const f = setup(t), rows = observations();
    ingest(f, rows);
    const record = plain(f.tasks.store.state('s', 'p'));
    assert.equal(record.status, 'completed');
    assert.equal(record.duration_ns, 5e9);
    assert.equal(record.native_duration_ms, 1000);
    assert.equal(plain(f.protocol.activePoint('s', 'p')).value, 3);
    f.store.observe(rows, { timing: true });
    assert.deepEqual(plain(f.tasks.store.state('s', 'p')), record);
});
test('tests.runtime.test_task_timing.NativeTimingTests.test_unknown_wait_and_missing_events_hide_execution_time', t => {
    const f = setup(t);
    for (const [unknown, gap] of [[true, false], [false, true]]) {
        fs.rmSync(f.store.path('s'), { force: true });
        fs.rmSync(f.tasks.store.path('s'), { force: true });
        ingest(f, observations(unknown, gap));
        const point = plain(f.protocol.activePoint('s', 'p'));
        assert.equal(point.value, null);
        assert.ok(['wait_coverage_missing', 'incomplete'].includes(point.reason));
    }
});
test('tests.runtime.test_task_timing.NativeTimingTests.test_unclosed_wait_hides_execution_time_even_with_a_coverage_claim', t => {
    const f = setup(t), rows = observations();
    rows.splice(4, 1);
    rows.forEach((row, i) => row.seq = i);
    ingest(f, rows);
    const p = plain(f.protocol.activePoint('s', 'p'));
    assert.equal(p.value, null);
    assert.equal(p.reason, 'incomplete');
});
test('tests.runtime.test_task_timing.NativeTimingTests.test_wait_end_without_a_start_cannot_claim_complete_execution_time', t => {
    const f = setup(t), rows = observations();
    rows.splice(3, 1);
    rows.forEach((row, i) => row.seq = i);
    ingest(f, rows);
    assert.equal(f.protocol.activePoint('s', 'p').reason, 'incomplete');
    assert.equal(f.protocol.activePoint('s', 'p').value, null);
    f.tasks.store.mutate('s', history => { history.turns[0]!.active_coverage = 'complete'; return 'p'; });
    f.store.observe(rows, { timing: true });
    assert.equal(f.protocol.activePoint('s', 'p').reason, 'incomplete');
});
test('tests.runtime.test_task_timing.NativeTimingTests.test_duplicate_paired_wait_end_keeps_the_same_execution_clock', t => {
    const f = setup(t), rows = observations();
    rows.splice(5, 0, { ...rows[4]!, observed_at_ms: 4500 });
    rows.forEach((row, i) => row.seq = i);
    ingest(f, rows);
    assert.equal(plain(f.protocol.activePoint('s', 'p')).value, 3);
});
test('tests.runtime.test_task_timing.NativeTimingTests.test_native_ending_before_session_exit_corrects_delayed_exit_inference', t => {
    const f = setup(t), rows = observations();
    f.event('UserPromptSubmit', 1);
    ingest(f, rows.slice(0, 3));
    f.event('Stop', 5);
    f.event('SessionEnd', 7);
    assert.equal(f.tasks.store.state('s', 'p')!.status, 'unknown');
    f.store.observe(rows.slice(3), { timing: true });
    const record = plain(f.tasks.store.state('s', 'p'));
    assert.equal(record.status, 'completed');
    assert.equal(record.duration_ns, 5e9);
});
test('tests.runtime.test_task_timing.NativeTimingTests.test_unbound_native_turn_does_not_attach_to_the_latest_queued_task', t => {
    const f = setup(t), rows = observations();
    rows[1]!.source = 'classic_hook';
    rows.splice(2, 0, { ...rows[1]!, seq: 2, observed_at_ms: 1500, prompt_id: 'queued' });
    rows.forEach((row, i) => row.seq = i);
    rows[3]!.prompt_id = null;
    f.store.observe(rows, { timing: true });
    const record = plain(f.tasks.store.state('s', 'queued'));
    assert.equal(record.status, 'running');
    assert.deepEqual(record.native_turns, {});
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_blocked_stop_and_verified_continuation_finish_at_eight_seconds', t => {
    const f = setup(t);
    f.event('UserPromptSubmit', 1);
    f.event('Stop', 3);
    const state = f.tasks.store.state('s', 'p')!;
    assert.equal(state.phase, 'stop_pending');
    assert.equal(state.status, 'running');
    assert.match(renderTaskTimer(state, f.context.sample(), key => key)!, /\? 0m 02s\+/);
    f.tasks.transcript('s', [{ kind: 'assistant', prompt_id: 'p', wall_ns: 4000000000n }]);
    assert.equal(f.tasks.store.state('s', 'p')!.stop_candidate, null);
    f.event('Stop', 9);
    f.tasks.confirm('s', 'p', 9000000000n);
    const result = plain(f.tasks.store.state('s', 'p'));
    assert.equal(result.duration_ns, 8e9);
    assert.equal(result.status, 'completed');
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_native_duration_is_stored_separately_and_cannot_shorten_task', t => {
    const f = setup(t);
    f.event('UserPromptSubmit', 1);
    f.event('Stop', 9);
    f.tasks.confirm('s', 'p', 9000000000n);
    f.tasks.transcript('s', [{ kind: 'turn_duration', prompt_id: 'p', wall_ns: 10000000000n, duration_ms: 1500 }]);
    const state = plain(f.tasks.store.state('s', 'p'));
    assert.equal(state.duration_ns, 8e9);
    assert.equal(state.native_duration_ms, 1500);
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_duration_does_not_complete_an_unexecuted_queued_prompt', t => {
    const f = setup(t);
    f.event('UserPromptSubmit', 1);
    f.tasks.transcript('s', [{ kind: 'turn_duration', prompt_id: 'p', wall_ns: 3000000000n, duration_ms: 1000 }]);
    assert.equal(f.tasks.store.state('s', 'p')!.status, 'running');
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_old_frozen_native_duration_is_preserved_without_a_read_migration', t => {
    const f = setup(t);
    f.event('UserPromptSubmit', 1);
    const path = f.tasks.store.path('s'), value = JSON.parse(fs.readFileSync(path, 'utf8')), old = value.lifecycle.turns[0];
    Object.assign(old, { status: 'completed', ended_wall_ns: 9e9, duration_ns: 1500e6, duration_source: 'native', end_source: 'hook_stop' });
    value.lifecycle.schema = 3;
    Object.assign(value, old);
    fs.writeFileSync(path, pythonJson(value));
    const before = allFiles(f.root);
    assert.equal(plain(f.tasks.store.state('s', 'p')).duration_ns, 1500e6);
    assert.deepEqual(allFiles(f.root), before);
    f.tasks.confirm('s', 'p', 10000000000n);
    assert.equal(plain(f.tasks.store.state('s', 'p')).duration_ns, 1500e6);
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_windows_wall_adjustment_does_not_change_the_boot_domain', () => {
    const id = 'windows:v2:a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53:41', record = newRecord('p', { wall_ns: 1800000000000000000n, boot_ns: 100000000000n, boot_id: id });
    assert.equal(elapsedNs(record, 1800000310000000000n, 110000000000n, id), 10000000000n);
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_explicit_native_message_link_preserves_earlier_queued_submission', () => {
    const history = storeFromState({}, 's'), message = newRecord('message', { wall_ns: 1000000000n, boot_ns: null, boot_id: null }, 'native_submit'), hook = newRecord('hook', { wall_ns: 3000000000n, boot_ns: 3000000000n, boot_id: 'boot' });
    history.turns = [message, hook];
    history.current_prompt_id = 'hook';
    linkTask(history, 'hook', 'message');
    assert.equal(history.turns.length, 1);
    assert.equal(hook.started_wall_ns, 1000000000n);
    assert.equal(hook.started_boot_ns, 1000000000n);
    assert.equal(elapsedNs(hook, 9000000000n, 9000000000n, 'boot'), 8000000000n);
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_message_link_does_not_rewrite_a_confirmed_frozen_task', () => {
    const history = storeFromState({}, 's'), message = newRecord('message', { wall_ns: 1000000000n, boot_ns: null, boot_id: null }, 'native_submit'), hook = newRecord('hook', { wall_ns: 3000000000n, boot_ns: 3000000000n, boot_id: 'boot' });
    Object.assign(hook, { status: 'completed', duration_ns: 6000000000n, ended_wall_ns: 9000000000n });
    history.turns = [message, hook];
    history.current_prompt_id = 'hook';
    linkTask(history, 'hook', 'message');
    assert.equal(hook.started_wall_ns, 3000000000n);
    assert.equal(hook.duration_ns, 6000000000n);
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_runtime_default_and_old_explicit_opt_out', t => {
    const f = setup(t);
    assert.deepEqual(loadRuntime(f.root), { schema_version: 2, native_timing: true, live_metrics: false });
    const path = join(f.root, 'claude-statusline-runtime.json'), raw = '{"schema_version":1,"live_metrics":false}';
    fs.writeFileSync(path, raw);
    assert.deepEqual(loadRuntime(f.root), { schema_version: 2, native_timing: false, live_metrics: false });
    assert.equal(fs.readFileSync(path, 'utf8'), raw);
    assert.deepEqual(loadRuntime(f.root, undefined, false, true), { schema_version: 2, native_timing: true, live_metrics: false });
    f.preferences(true);
    assert.equal(JSON.parse(fs.readFileSync(path, 'utf8')).schema_version, 2);
});
