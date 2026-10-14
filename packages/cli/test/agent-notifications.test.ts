import test, { type TestContext } from 'node:test';
import { assert, join, writeLines } from './runtime-support.js';
import { lifecycle, promptLine } from './lifecycle-support.js';
const notification = (agent: string) => `<task-notification>\n<task-id>${agent}</task-id>\n<status>completed</status>\n</task-notification>`;
function fixture(t: TestContext) {
    const f = lifecycle(t);
    const event = (name: string, second: number, prompt: string | null = 'original', extra = {}) => f.event(name, second, prompt, extra);
    return { ...f, event, state: (prompt = 'original') => f.state(prompt), notify: (agent: string, second: number, host: string) => event('UserPromptSubmit', second, host, { prompt: notification(agent) }),
        start() { event('UserPromptSubmit', 1, 'original', { prompt: 'user task' }); event('SubagentStart', 2, 'original', { agent_id: 'a' }); event('SubagentStart', 3, 'original', { agent_id: 'b' }); event('Stop', 4, 'original', { background_tasks: [{ id: 'a', type: 'subagent' }, { id: 'b', type: 'subagent' }] }); } };
}
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_notification_prompt_ids_keep_full_task_and_pending_reports', t => {
    const f = fixture(t);
    f.start();
    f.event('SubagentStop', 5, 'original', { agent_id: 'a' });
    f.notify('a', 6, 'notice-a');
    f.event('SubagentStop', 7, 'notice-a', { agent_id: 'b' });
    f.event('Stop', 8, 'notice-a', { background_tasks: [] });
    assert.equal(f.state().status, 'running');
    assert.equal(f.state().phase, 'resuming_main');
    f.notify('b', 9, 'notice-b');
    f.event('Stop', 10, 'notice-b', { background_tasks: [] });
    assert.equal(f.state().status, 'completed');
    assert.equal(f.state().duration_ns, 9e9);
    assert.equal(f.state('notice-b').prompt_id, 'original');
    assert.equal(f.tasks.store.load('s')!.turns.length, 1);
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'original');
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_duplicate_notifications_after_final_stop_do_not_reopen', t => {
    const f = fixture(t);
    f.start();
    f.event('SubagentStop', 5, 'original', { agent_id: 'a' });
    f.notify('a', 6, 'notice-a');
    f.event('SubagentStop', 7, 'notice-a', { agent_id: 'b' });
    f.notify('b', 8, 'notice-b');
    f.event('Stop', 9, 'notice-b', { background_tasks: [] });
    const before = f.state();
    f.notify('b', 10, 'notice-b');
    f.event('Stop', 11, 'notice-b', { background_tasks: [] });
    assert.deepEqual(f.state(), before);
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_old_notification_and_stop_do_not_attach_to_new_human_task', t => {
    const f = fixture(t);
    f.start();
    f.event('UserPromptSubmit', 5, 'new');
    f.notify('a', 6, 'notice-a');
    f.event('SubagentStop', 7, 'new', { agent_id: 'b' });
    f.event('Stop', 8, 'notice-a', { background_tasks: [] });
    assert.equal(f.state('new').status, 'running');
    assert.equal(f.state('new').had_subagents, false);
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'new');
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_notification_transcript_restores_alias_without_submit_hook', t => {
    const f = fixture(t);
    f.start();
    f.event('SubagentStop', 5, 'original', { agent_id: 'a' });
    f.feed([{ ...promptLine('notice-a', 6, notification('a')), promptSource: 'system', origin: { kind: 'task-notification', producer: 'session-task' } }]);
    assert.equal(f.state('notice-a').prompt_id, 'original');
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_unknown_notification_and_its_stop_are_not_timed_prompts', t => {
    const f = fixture(t);
    f.event('UserPromptSubmit', 1);
    f.notify('shell', 2, 'shell-notice');
    f.event('Stop', 3, 'shell-notice', { background_tasks: [] });
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'original');
    assert.equal(f.state('shell-notice').status, 'ignored');
    assert.equal(f.state().status, 'running');
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_new_report_continues_an_apparent_stop_without_reopening_failure', t => {
    const f = fixture(t);
    f.start();
    f.event('SubagentStop', 5, 'original', { agent_id: 'a' });
    f.event('SubagentStop', 6, 'original', { agent_id: 'b' });
    f.event('Stop', 7, 'original', { background_tasks: [] });
    f.notify('a', 8, 'notice-a');
    assert.equal(f.state().status, 'running');
    f.event('Stop', 9, 'notice-a', { background_tasks: [] });
    assert.equal(f.state().status, 'running');
    f.notify('b', 10, 'notice-b');
    f.event('Stop', 11, 'notice-b', { background_tasks: [] });
    assert.equal(f.state().duration_ns, 10e9);
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_agent_notifications_preserve_failure_and_interruption', t => {
    const f = fixture(t);
    for (const [event, status] of [['StopFailure', 'failed'], ['SessionEnd', 'interrupted']] as const) {
        f.event('UserPromptSubmit', 1, event);
        f.event('SubagentStart', 2, event, { agent_id: event });
        f.event(event, 4, event, { reason: 'logout', error: 'boom' });
        f.notify(event, 5, 'notice-' + event);
        f.event('Stop', 6, 'notice-' + event, { background_tasks: [] });
        assert.equal(f.state(event).status, status);
        assert.equal(f.state(event).duration_ns, 3e9);
    }
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_unseen_old_stop_never_replaces_the_current_human_prompt', t => {
    const f = fixture(t);
    f.event('UserPromptSubmit', 1);
    f.event('UserPromptSubmit', 5, 'new');
    f.event('Stop', 6, 'unseen-old', { background_tasks: [] });
    assert.equal(f.tasks.store.load('s')!.current_prompt_id, 'new');
    assert.equal(f.state('new').status, 'running');
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_final_stop_collects_submission_evidence_before_freezing', t => {
    const f = fixture(t), path = join(f.root, 'transcript.jsonl');
    writeLines(path, [promptLine('original', .9)]);
    f.event('UserPromptSubmit', 1);
    f.event('SubagentStart', 2, 'original', { agent_id: 'a' });
    f.event('SubagentStop', 3, 'original', { agent_id: 'a' });
    f.event('Stop', 9, 'original', { background_tasks: [], transcript_path: path });
    const before = f.state();
    assert.equal(before.started_wall_ns, 900000000);
    assert.equal(before.duration_ns, 8100000000);
    f.feed([promptLine('original', .9)]);
    assert.deepEqual(f.state(), before);
});
test('tests.runtime.test_agent_notifications.AgentNotificationTests.test_later_transcript_cannot_revise_a_strong_frozen_start', t => {
    const f = fixture(t);
    f.event('UserPromptSubmit', 1);
    f.event('Stop', 9, 'original', { background_tasks: [] });
    const before = f.state();
    f.feed([promptLine('original', .9)]);
    assert.deepEqual(f.state(), before);
});
