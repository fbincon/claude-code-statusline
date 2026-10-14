import test from 'node:test';
import { assert, fs, join, plain, pythonJson, writeLines } from './runtime-support.js';
import { lifecycle } from './lifecycle-support.js';
import { run } from '@fbincon/statusline-platform/launch';
import { fileURLToPath } from 'node:url';
async function writers(root: string, mode: string, count: number) {
    const results = await Promise.all(Array.from({ length: count }, (_, index) => run({ executable: process.execPath, args: [fileURLToPath(new URL('./runtime-writer.js', import.meta.url))] }, [mode, root, String(index)])));
    for (const result of results)
        assert.equal(result.code, 0, result.stderr);
}
test('tests.runtime.test_turn_state.LifecycleTransitionTests.test_normal_prompt_duplicate_submit_and_stop', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'A');
    f.event('UserPromptSubmit', 2, 'A');
    assert.equal(f.state('A').started_wall_ns, 1e9);
    assert.equal(f.state('A').status, 'running');
    f.event('Stop', 11, 'A');
    assert.equal(f.state('A').status, 'completed');
    assert.equal(f.state('A').end_source, 'native_turn_end');
    assert.equal(f.state('A').ended_wall_ns, 11e9);
});
test('tests.runtime.test_turn_state.LifecycleTransitionTests.test_stop_without_submit_isolated_from_newer_current_turn', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'A');
    f.event('Stop', 10, 'B');
    assert.equal(f.state('B').status, 'completed');
    assert.equal(f.state('B').started_wall_ns, null);
    f.tasks.transcript('s', [{ kind: 'prompt', prompt_id: 'C', wall_ns: 20000000000n }]);
    f.event('Stop', 30, 'A');
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'C');
    assert.equal(f.state('C').status, 'running');
});
test('tests.runtime.test_turn_state.LifecycleTransitionTests.test_queue_interrupt_then_new_prompt_targets_by_chronology', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'A');
    f.tasks.transcript('s', [{ kind: 'prompt', prompt_id: 'A', wall_ns: 1000000000n }, { kind: 'interrupt', prompt_id: 'B', wall_ns: 9972000000n }, { kind: 'prompt', prompt_id: 'B', wall_ns: 10000000000n }]);
    assert.equal(f.state('A').status, 'interrupted');
    assert.equal(f.state('A').ended_wall_ns, 9972000000);
    assert.equal(f.state('B').status, 'running');
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'B');
});
test('tests.runtime.test_turn_state.LifecycleTransitionTests.test_stop_failure_outranks_lower_priority_transcript_completion', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'A');
    f.event('StopFailure', 5, 'A', { error: 'rate_limit' });
    f.tasks.transcript('s', [{ kind: 'turn_duration', wall_ns: 6000000000n, duration_ms: 5000 }]);
    assert.equal(f.state('A').status, 'failed');
    assert.equal(f.state('A').end_source, 'hook_stop_failure');
    assert.equal(f.state('A').error, 'rate_limit');
});
test('tests.runtime.test_turn_state.LifecycleTransitionTests.test_idle_fallback_completes_after_assistant_and_withdraws_without_one', t => {
    const f = lifecycle(t);
    f.tasks.transcript('complete', [{ kind: 'prompt', prompt_id: 'A', wall_ns: 1000000000n }, { kind: 'assistant', wall_ns: 4000000000n }]);
    f.tasks.idle('complete', 'A', 5000000000n);
    assert.equal(f.state('A', 'complete').status, 'completed');
    assert.equal(f.state('A', 'complete').end_source, 'registry_idle');
    f.tasks.transcript('withdraw', [{ kind: 'prompt', prompt_id: 'B', wall_ns: 10000000000n }]);
    f.tasks.idle('withdraw', 'B', 11000000000n);
    assert.equal(f.state('B', 'withdraw').status, 'withdrawn');
});
test('tests.runtime.test_turn_state.LifecycleTransitionTests.test_local_command_does_not_end_the_real_running_turn', t => {
    const f = lifecycle(t);
    f.tasks.transcript('s', [{ kind: 'prompt', prompt_id: 'A', wall_ns: 1000000000n }, { kind: 'local_command', prompt_id: 'L', wall_ns: 2000000000n }]);
    assert.equal(f.state('A').status, 'running');
    assert.equal(f.state('L').status, 'ignored');
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'A');
});
test('tests.runtime.test_turn_state.LifecycleTransitionTests.test_resume_marks_only_current_running_turn_unknown', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'A');
    f.event('SessionStart', 5, 'A', { source: 'resume', transcript_path: join(f.root, 'absent') });
    assert.equal(f.state('A').status, 'unknown');
    assert.equal(f.state('A').end_source, 'session_start');
});
test('tests.runtime.test_turn_state.MigrationAndStorageTests.test_schema_one_state_and_previous_running_migrate_losslessly', t => {
    const f = lifecycle(t);
    f.tasks.store.write('s', { schema: 1, session_id: 's', prompt_id: 'L', status: 'ignored', started_wall_ns: 2e9, started_boot_ns: null, ended_wall_ns: 3e9, ended_boot_ns: null, boot_id: null, end_reason: 'local_command', error: null, updated_wall_ns: 3e9,
        previous_running: { prompt_id: 'A', status: 'running', started_wall_ns: 1e9, started_boot_ns: null, ended_wall_ns: null, ended_boot_ns: null, boot_id: null, end_reason: null, error: null, updated_wall_ns: 1e9 } });
    assert.deepEqual(f.tasks.store.load('s')!.turns.map(row => row.prompt_id).sort(), ['A', 'L']);
    f.event('Stop', 4, 'A');
    const state = plain(f.tasks.store.raw('s'));
    assert.equal(state.schema, 1);
    assert.equal(state.lifecycle.schema, 4);
    assert.equal(state.prompt_id, 'A');
    assert.equal(state.status, 'completed');
});
test('tests.runtime.test_turn_state.MigrationAndStorageTests.test_corrupt_file_repairs_on_next_event', t => {
    const f = lifecycle(t);
    fs.mkdirSync(f.tasks.store.directory(), { recursive: true });
    fs.writeFileSync(f.tasks.store.path('s'), 'not json');
    f.event('UserPromptSubmit', 1, 'A');
    assert.equal(f.state('A').status, 'running');
});
test('tests.runtime.test_turn_state.MigrationAndStorageTests.test_newer_schema_one_mirror_is_merged_after_code_rollback', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'A');
    f.event('Stop', 2, 'A');
    const state = plain(f.tasks.store.raw('s'));
    Object.assign(state, { prompt_id: 'B', status: 'running', started_wall_ns: 3e9, started_boot_ns: null, ended_wall_ns: null, ended_boot_ns: null, boot_id: null, end_reason: null, error: null, updated_wall_ns: 3e9 });
    f.tasks.store.write('s', state);
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'B');
    assert.equal(f.state('B').status, 'running');
    assert.equal(f.state('A').status, 'completed');
});
test('tests.runtime.test_turn_state.MigrationAndStorageTests.test_ledger_is_bounded_and_concurrent_updates_publish_valid_json', async (t) => {
    const f = lifecycle(t);
    await writers(f.root, 'ledger', 4);
    assert.ok(f.tasks.store.load('shared')!.turns.length <= 32);
    assert.ok(JSON.parse(fs.readFileSync(f.tasks.store.path('shared'), 'utf8')));
    f.event('UserPromptSubmit', 1, 'X', {}, 'other');
    assert.equal(f.state('X', 'other').status, 'running');
    assert.equal(f.state('0-19', 'other'), null);
});
test('tests.runtime.test_subagent_lifecycle.AgentLedgerTests.test_duplicate_parallel_and_out_of_order_agent_hooks', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.event('SubagentStart', 2, 'p', { agent_id: 'a', agent_type: 'Explore' });
    f.event('SubagentStart', 9, 'p', { agent_id: 'a', agent_type: 'Changed' });
    f.event('SubagentStart', 3, 'p', { agent_id: 'b', agent_type: 'Reviewer' });
    assert.equal(f.state().active_agents.a.started_wall_ns, 2e9);
    assert.equal(f.state().active_agents.a.agent_type, 'Explore');
    assert.equal(f.state().had_subagents, true);
    f.event('Stop', 4);
    assert.equal(f.state().phase, 'waiting_subagents');
    assert.deepEqual(Object.keys(f.state().active_agents).sort(), ['a', 'b']);
    f.event('SubagentStop', 5, 'p', { agent_id: 'missing' });
    f.event('SubagentStop', 6, 'p', { agent_id: 'b' });
    f.event('SubagentStop', 7, 'p', { agent_id: 'a' });
    assert.equal(f.state().phase, 'resuming_main');
    assert.deepEqual(f.state().active_agents, {});
});
test('tests.runtime.test_subagent_lifecycle.AgentLedgerTests.test_missing_start_and_agent_internal_events_do_not_create_or_finish', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.event('SubagentStop', 2, 'p', { agent_id: 'unknown' });
    f.event('Stop', 3, 'p', { agent_id: 'child' });
    assert.equal(f.state().status, 'running');
    assert.equal(f.state().had_subagents, true);
    assert.equal(f.state('missing'), null);
    f.event('SubagentStart', 4, 'missing', { agent_id: 'orphan' });
    assert.equal(f.state('missing'), null);
});
test('tests.runtime.test_subagent_lifecycle.AgentLedgerTests.test_prompt_id_falls_back_to_current_for_agent_hooks', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.clock(2000000000n);
    f.tasks.handle({ session_id: 's', hook_event_name: 'SubagentStart', agent_id: 'a', agent_type: 'Explore' });
    assert.ok(f.state().active_agents.a);
});
test('tests.runtime.test_subagent_lifecycle.MainStopTests.test_authoritative_snapshot_filters_non_agents_and_can_reopen', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.tasks.transcript('s', [{ kind: 'assistant', prompt_id: 'p', wall_ns: 2000000000n }, { kind: 'turn_duration', wall_ns: 3000000000n, duration_ms: 2 }]);
    assert.equal(f.state().status, 'completed');
    f.event('Stop', 4, 'p', { background_tasks: [{ id: 'agent', type: 'subagent', name: 'Explore' }, ...['shell', 'server', 'monitor', 'workflow'].map(type => ({ id: type, type }))] });
    assert.equal(f.state().status, 'running');
    assert.equal(f.state().phase, 'waiting_subagents');
    assert.deepEqual(Object.keys(f.state().active_agents), ['agent']);
    assert.equal(f.state().duration_ns, null);
    f.event('Stop', 11, 'p', { background_tasks: [] });
    assert.equal(f.state().status, 'completed');
    assert.equal(f.state().ended_wall_ns, 11e9);
    assert.deepEqual(f.state().active_agents, {});
});
test('tests.runtime.test_subagent_lifecycle.MainStopTests.test_missing_snapshot_uses_hook_ledger_and_empty_snapshot_finishes', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.event('SubagentStart', 2, 'p', { agent_id: 'a' });
    f.event('Stop', 3);
    assert.deepEqual(Object.keys(f.state().active_agents), ['a']);
    f.event('Stop', 4, 'p', { background_tasks: [] });
    assert.equal(f.state().status, 'completed');
});
test('tests.runtime.test_subagent_lifecycle.MainStopTests.test_resuming_waits_for_main_stop_and_suppresses_inference', t => {
    const f = lifecycle(t);
    f.task();
    assert.equal(f.state().phase, 'resuming_main');
    f.tasks.idle('s', 'p', 5000000000n);
    assert.equal(f.state().status, 'running');
    assert.equal(f.state().phase, 'resuming_main');
    f.duration(6, 100, null);
    assert.equal(f.state().status, 'running');
    assert.equal(f.state().phase, 'resuming_main');
    assert.equal(f.state().duration_ns, null);
    f.event('Stop', 9, 'p', { background_tasks: [] });
    assert.equal(f.state().status, 'completed');
    assert.equal(f.state().duration_ns, 8e9);
});
test('tests.runtime.test_subagent_lifecycle.MainStopTests.test_strong_terminal_states_cannot_be_reopened', t => {
    const f = lifecycle(t);
    for (const [event, expected] of [['StopFailure', 'failed'], ['SessionEnd', 'interrupted']] as const) {
        f.event('UserPromptSubmit', 1, event);
        f.event(event, 2, event, { error: 'boom', reason: 'logout' });
        f.event('Stop', 3, event, { background_tasks: [{ id: 'a', type: 'subagent' }] });
        assert.equal(f.state(event).status, expected);
        assert.deepEqual(f.state(event).active_agents, {});
    }
});
test('tests.runtime.test_subagent_lifecycle.MainStopTests.test_new_prompt_marks_old_unknown_and_clears_agents', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'old');
    f.event('SubagentStart', 2, 'old', { agent_id: 'a' });
    f.event('UserPromptSubmit', 3, 'new');
    assert.equal(f.state('old').status, 'unknown');
    assert.deepEqual(f.state('old').active_agents, {});
    assert.equal(f.state('new').phase, 'main');
    assert.equal(f.state('new').had_subagents, false);
});
test('tests.runtime.test_subagent_lifecycle.MigrationConcurrencyAndRenderingTests.test_lifecycle_schema_two_migrates_to_three', t => {
    const f = lifecycle(t);
    f.tasks.store.write('s', { schema: 1, session_id: 's', prompt_id: 'p', status: 'running', started_wall_ns: 1e9, updated_wall_ns: 1e9, lifecycle: { schema: 2, session_id: 's', current_prompt_id: 'p', updated_wall_ns: 1e9, turns: [{ prompt_id: 'p', status: 'running', started_wall_ns: 1e9, updated_wall_ns: 1e9 }] } });
    f.event('SubagentStart', 2, 'p', { agent_id: 'a' });
    const state = plain(f.tasks.store.raw('s'));
    assert.equal(state.schema, 1);
    assert.equal(state.lifecycle.schema, 4);
    assert.equal(state.had_subagents, true);
});
test('tests.runtime.test_subagent_lifecycle.MigrationConcurrencyAndRenderingTests.test_concurrent_agent_starts_publish_valid_complete_ledger', async (t) => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    await writers(f.root, 'agents', 8);
    assert.equal(Object.keys(f.state().active_agents).length, 8);
    assert.ok(JSON.parse(fs.readFileSync(f.tasks.store.path('s'), 'utf8')));
});
test('tests.runtime.test_subagent_lifecycle.MigrationConcurrencyAndRenderingTests.test_timer_phase_text_and_singular_plural', t => {
    const f = lifecycle(t);
    f.clock(5000000000n, 5000000000n, 'boot');
    const base = { status: 'running', started_wall_ns: 1000000000n, started_boot_ns: 1000000000n, boot_id: 'boot' };
    assert.equal(f.render({ ...base, phase: 'waiting_subagents', active_agents: { a: {} } }), '⏳ 1 agent · 0m 04s');
    assert.equal(f.render({ ...base, phase: 'waiting_subagents', active_agents: { a: {}, b: {} } }), '⏳ 2 agents · 0m 04s');
    assert.equal(f.render({ ...base, phase: 'resuming_main', active_agents: {} }), '⏳ main wrap-up · 0m 04s');
});
test('tests.runtime.test_statusline_state.TokenStateConcurrencyTests.test_parallel_sessions_publish_without_lost_updates', async (t) => {
    const f = lifecycle(t);
    for (let i = 0; i < 6; i++)
        writeLines(join(f.root, `session-${i}.jsonl`), [{ type: 'assistant', message: { id: 'message-' + i, usage: { input_tokens: i + 1, output_tokens: i + 2, cache_creation_input_tokens: i + 3, cache_read_input_tokens: i + 4 } } }]);
    await writers(f.root, 'usage', 6);
    const state = JSON.parse(fs.readFileSync(join(f.root, 'statusline_state.json'), 'utf8'));
    assert.deepEqual(Object.keys(state.sessions).sort(), Array.from({ length: 6 }, (_, i) => 'session-' + i));
    assert.deepEqual(fs.readdirSync(f.root).filter(name => name.endsWith('.tmp')), []);
});
