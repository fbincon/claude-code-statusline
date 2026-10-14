import test from 'node:test';
import { assert, fs, plain } from './runtime-support.js';
import { lifecycle, promptLine, assistantLine, durationLine } from './lifecycle-support.js';
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_multi_agent_duration_before_and_after_final_stop', t => {
    const f = lifecycle(t);
    f.task();
    f.duration(5);
    f.event('Stop', 9, 'p', { background_tasks: [] });
    assert.equal(f.render(f.state()), '✓ 0m 08s');
    f.duration(10);
    f.duration(11, 2000);
    assert.equal(f.state().duration_ns, 8e9);
    assert.equal(f.render(f.state()), '✓ 0m 08s');
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_main_resumption_does_not_enable_weak_completion', t => {
    const f = lifecycle(t);
    f.task();
    f.tasks.transcript('s', [{ kind: 'assistant', prompt_id: 'p', wall_ns: 5000000000n }]);
    assert.equal(f.state().phase, 'main');
    f.duration(6);
    f.tasks.idle('s', 'p', 7000000000n);
    f.tasks.withdraw('s', 'p', 8000000000n);
    assert.equal(f.state().status, 'running');
    assert.equal(f.state().ended_wall_ns, null);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_missing_agent_start_still_protects_duration', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.event('SubagentStop', 4, 'p', { agent_id: 'a' });
    f.duration(5);
    assert.equal(f.state().status, 'running');
    f.event('Stop', 9, 'p', { background_tasks: [] });
    f.duration(10);
    assert.equal(f.state().duration_ns, 8e9);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_interruption_and_failure_are_frozen_after_late_duration', t => {
    const f = lifecycle(t);
    for (const [ending, status] of [['SessionEnd', 'interrupted'], ['StopFailure', 'failed']]) {
        f.event('UserPromptSubmit', 1, ending);
        f.event(ending!, 9, ending, { reason: 'logout', error: 'boom' });
        const before = f.state(ending);
        f.duration(10, 1000, ending);
        assert.deepEqual(f.state(ending), before);
        assert.equal(before.status, status);
        assert.equal(before.duration_ns, 8e9);
    }
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_transcript_interrupt_outranks_duration_in_both_orders', t => {
    const f = lifecycle(t);
    for (const durationFirst of [true, false]) {
        const prompt = String(durationFirst);
        f.event('UserPromptSubmit', 1, prompt);
        if (durationFirst)
            f.duration(10, 1000, prompt);
        f.tasks.transcript('s', [{ kind: 'interrupt', prompt_id: prompt, wall_ns: 9000000000n }]);
        if (!durationFirst)
            f.duration(10, 1000, prompt);
        assert.equal(f.state(prompt).status, 'interrupted');
        assert.equal(f.state(prompt).duration_ns, 8e9);
    }
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_failure_after_inferred_completion_uses_task_elapsed', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.duration(5);
    f.event('StopFailure', 9, 'p', { error: 'boom' });
    assert.equal(f.state().duration_ns, 8e9);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_duplicate_terminal_hooks_and_native_calibration_are_idempotent', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.event('Stop', 9, 'p', { background_tasks: [] });
    f.duration(10, 1500);
    const before = f.state();
    f.event('Stop', 20, 'p', { background_tasks: [] });
    f.duration(21, 2500);
    assert.deepEqual(f.state(), before);
    assert.equal(before.duration_ns, 8e9);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_single_turn_native_length_does_not_replace_final_task_elapsed', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.duration(7, 1500);
    f.event('Stop', 9, 'p', { background_tasks: [] });
    assert.equal(f.state().duration_ns, 8e9);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_parallel_agents_and_local_command_keep_task_boundary', t => {
    const f = lifecycle(t);
    f.task();
    f.event('SubagentStart', 5, 'p', { agent_id: 'b' });
    f.event('SubagentStart', 6, 'p', { agent_id: 'b' });
    f.event('Stop', 7);
    f.tasks.transcript('s', [{ kind: 'local_command', prompt_id: 'local', wall_ns: 8000000000n }]);
    f.event('SubagentStop', 9, 'p', { agent_id: 'b' });
    f.event('SubagentStop', 10, 'p', { agent_id: 'b' });
    f.duration(11);
    assert.equal(f.state().status, 'running');
    f.event('Stop', 12, 'p', { background_tasks: [] });
    assert.equal(f.state().duration_ns, 11e9);
    assert.equal(f.state('local').status, 'ignored');
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_late_agent_start_reopens_only_inferred_completion', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.duration(3);
    f.event('SubagentStart', 4, 'p', { agent_id: 'a' });
    assert.equal(f.state().status, 'running');
    assert.equal(f.state().had_subagents, true);
    f.event('SubagentStop', 5, 'p', { agent_id: 'a' });
    f.event('Stop', 9, 'p', { background_tasks: [] });
    f.duration(10);
    assert.equal(f.state().duration_ns, 8e9);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_explicit_old_duration_does_not_finish_new_prompt', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'old');
    f.event('Stop', 3, 'old');
    f.event('UserPromptSubmit', 4, 'new');
    f.duration(5, 1000, 'old');
    assert.equal(f.state('new').status, 'running');
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'new');
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_incremental_transcript_context_survives_queued_hook', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'old');
    const entry = f.feed([promptLine('old', 1), assistantLine(2)]);
    f.event('Stop', 3, 'old');
    f.event('UserPromptSubmit', 4, 'new');
    f.feed([durationLine(3.5, 1500)], entry);
    assert.equal(f.state('new').status, 'running');
    assert.equal(f.state('old').duration_ns, 2e9);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_replayed_old_prompt_does_not_replace_new_current_prompt', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'old');
    f.event('Stop', 3, 'old');
    f.event('UserPromptSubmit', 4, 'new');
    f.tasks.transcript('s', [{ kind: 'prompt', prompt_id: 'old', wall_ns: 1000000000n }]);
    f.event('UserPromptSubmit', 10, 'old');
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'new');
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_unowned_duration_and_old_subagent_hook_do_not_attach_to_new_prompt', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1, 'old');
    f.event('SubagentStart', 2, 'old', { agent_id: 'old-agent' });
    f.event('UserPromptSubmit', 4, 'new');
    f.event('SubagentStop', 5, null, { agent_id: 'old-agent' });
    f.feed([durationLine(6, 1000)]);
    assert.equal(f.state('new').status, 'running');
    assert.equal(f.state('new').had_subagents, false);
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_frozen_native_clock_duration_survives_reboot', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    f.event('SubagentStart', 2, 'p', { agent_id: 'a' });
    f.event('SubagentStop', 3, 'p', { agent_id: 'a' });
    f.clock(101000000000n, 9000000000n);
    f.tasks.handle({ session_id: 's', prompt_id: 'p', hook_event_name: 'Stop', background_tasks: [] });
    f.tasks.confirm('s', 'p', 101000000000n);
    f.clock(200000000000n, 1n, 'new-boot');
    assert.equal(f.render(f.tasks.store.state('s', 'p')), '✓ 0m 08s');
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_invalid_duration_values_are_ignored_without_mutation', t => {
    const f = lifecycle(t);
    f.event('UserPromptSubmit', 1);
    const before = f.state();
    for (const value of [true, -1, NaN, Infinity, -Infinity, '1000']) {
        f.duration(5, value);
        assert.deepEqual(f.state(), before);
    }
});
test('tests.runtime.test_timer_regressions.TaskDurationRegressions.test_legacy_frozen_multi_agent_duration_is_preserved_as_recorded', t => {
    const f = lifecycle(t);
    f.task();
    f.event('Stop', 9, 'p', { background_tasks: [] });
    const state = plain(f.tasks.store.raw('s'));
    state.duration_ns = 1e9;
    for (const record of state.lifecycle.turns) {
        record.duration_ns = 1e9;
        delete record.duration_source;
    }
    f.tasks.store.write('s', state);
    assert.equal(f.state().duration_ns, 1e9);
});
