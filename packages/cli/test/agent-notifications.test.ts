import test, { type TestContext } from 'node:test';
import { assert, fs, join, observation, pythonJson, writeLines } from './runtime-support.js';
import { assistantLine, durationLine, lifecycle, promptLine } from './lifecycle-support.js';
import { collectTask } from '../src/runtime/tasks/collect.js';
import { UsageCollector } from '../src/runtime/usage.js';
const notification = (agent: string) => `<task-notification>\n<task-id>${agent}</task-id>\n<status>completed</status>\n</task-notification>`;
const confirmed = (second: number) => ({ type: 'system', subtype: 'stop_hook_summary', timestamp: new Date(second * 1000).toISOString(),
    preventedContinuation: false, hookErrors: [], hookAdditionalContext: [] });
const queued = (second: number, ...agents: string[]) => ({ type: 'attachment', timestamp: new Date(second * 1000).toISOString(),
    attachment: { type: 'queued_command', prompt: agents.map(notification).join('\n') } });
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
    assert.equal(f.state('shell-notice'), null);
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

test('a correlated delivery 31 ms after transcript completion continues the same clock, never on enqueue or replay', testContext => {
    const harness = fixture(testContext);
    harness.event('UserPromptSubmit', 1);
    harness.event('SubagentStart', 1.5, 'original', { agent_id: 'background' });
    harness.event('SubagentStop', 2, 'original', { agent_id: 'background' });
    const entry = harness.feed([promptLine('original', 1), assistantLine(3), confirmed(4)]);
    assert.equal(harness.state().end_source, 'transcript_stop');
    harness.feed([queued(4.020, 'background')], entry);
    assert.equal(harness.state().status, 'completed');
    harness.notify('background', 4.031, 'delivery');
    assert.equal(harness.state().status, 'running');
    assert.equal(harness.state().phase, 'resuming_main');
    assert.equal(harness.state().started_wall_ns, 1e9);
    harness.feed([confirmed(4), durationLine(4.010, 3000)], entry);
    harness.tasks.idle('s', 'original', 4500000000n);
    assert.equal(harness.state().status, 'running');
    const followUp = { ...promptLine('delivery', 4.032, notification('background')), origin: { kind: 'task-notification' } };
    harness.feed([followUp], entry);
    harness.feed([assistantLine(6), confirmed(7)], entry);
    const snapshot = harness.state();
    harness.notify('background', 8, 'replayed-delivery');
    harness.rawEvent('Stop', 9, 'original', { background_tasks: [{ id: 'background', type: 'subagent' }] });
    assert.equal(harness.state().status, 'completed');
    assert.equal(harness.state().duration_ns, 6e9);
    assert.equal(harness.state().ended_wall_ns, snapshot.ended_wall_ns);
    harness.clock(11000000000n);
    assert.equal(harness.render(collectTask(harness.tasks, 's', 'replayed-delivery', entry.last_pt, entry)), '✓ 0m 06s');
});

test('a real background report blocks every success source; later inline agents do not inherit that requirement', testContext => {
    const harness = fixture(testContext);
    harness.event('UserPromptSubmit', 1);
    harness.event('SubagentStart', 2, 'original', { agent_id: 'background' });
    harness.rawEvent('Stop', 3, 'original', { background_tasks: [{ id: 'background', type: 'subagent', status: 'running' }] });
    harness.event('SubagentStop', 4, 'original', { agent_id: 'background' });
    const entry = harness.feed([promptLine('original', 1), assistantLine(4.5), confirmed(5), durationLine(5.1, 4100)]);
    harness.tasks.confirm('s', 'original', 5200000000n);
    harness.tasks.idle('s', 'original', 5300000000n);
    assert.deepEqual(harness.state().pending_agent_reports, ['background']);
    assert.deepEqual(harness.state().report_aliases, []);
    assert.equal(harness.state().status, 'running');
    harness.notify('background', 6, 'same-task');
    harness.event('SubagentStart', 7, 'same-task', { agent_id: 'sync' });
    harness.event('SubagentStop', 8, 'same-task', { agent_id: 'sync' });
    harness.rawEvent('Stop', 9, 'same-task', { background_tasks: [] });
    assert.deepEqual(harness.state().pending_agent_reports, []);
    assert.equal(harness.state().phase, 'stop_pending');
    harness.feed([{ ...durationLine(9.2, 3200), promptId: 'same-task' }], entry);
    assert.equal(harness.state().status, 'completed');
    assert.equal(harness.state().duration_ns, 8.2e9);
});

test('queued transcript blocks settle concurrent reports, not API blobs, and an empty snapshot removes only stale snapshot work', testContext => {
    const harness = fixture(testContext);
    harness.start();
    harness.event('SubagentStop', 5, 'original', { agent_id: 'a' });
    harness.event('SubagentStop', 6, 'original', { agent_id: 'b' });
    const entry = harness.feed([promptLine('original', 1), { type: 'api-request-blob', timestamp: new Date(6500).toISOString(), prompt: notification('b') }]);
    assert.deepEqual(harness.state().pending_agent_reports, ['a', 'b']);
    harness.rawEvent('Stop', 7, 'original', { background_tasks: [{ id: 'snapshot-only', type: 'subagent' }] });
    harness.feed([queued(7.5, 'a', 'b')], entry);
    assert.deepEqual(harness.state().pending_agent_reports, []);
    assert.deepEqual(Object.keys(harness.state().active_agents), ['snapshot-only']);
    harness.rawEvent('Stop', 8, 'original', { background_tasks: [{ type: 'subagent' }] });
    harness.rawEvent('Stop', 6.5, 'original', { background_tasks: [] });
    assert.deepEqual(Object.keys(harness.state().active_agents), ['snapshot-only']);
    harness.feed([assistantLine(8.5)], entry);
    harness.rawEvent('Stop', 9, 'original', { background_tasks: [] });
    harness.feed([confirmed(9.1), durationLine(9.2, 1500)], entry);
    assert.equal(harness.state().end_source, 'transcript_stop');
    assert.deepEqual(harness.state().active_agents, {});
    assert.equal(harness.state().duration_ns, 8.1e9);
});

test('batched classic notifications may reuse either the human ID or a delivery alias', testContext => {
    const harness = fixture(testContext);
    harness.start();
    harness.event('SubagentStop', 5, 'original', { agent_id: 'a' });
    harness.event('SubagentStop', 6, 'original', { agent_id: 'b' });
    harness.notify('not-an-agent', 6.5, 'original');
    assert.equal(harness.state().status, 'running');
    harness.event('UserPromptSubmit', 7, 'delivery', { prompt: [notification('a'), notification('b')].join('\n') });
    assert.deepEqual(harness.state().pending_agent_reports, []);
    assert.deepEqual(harness.state().report_aliases, ['delivery']);
    assert.equal(harness.state('delivery').prompt_id, 'original');
    assert.equal(harness.tasks.store.load('s')!.turns.length, 1);
});

test('a duplicate owner leaves a notice unresolved until a native parent proves attribution', testContext => {
    const harness = fixture(testContext);
    harness.event('UserPromptSubmit', 1, 'previous');
    harness.event('SubagentStart', 1.5, 'previous', { agent_id: 'shared' });
    harness.event('SubagentStop', 2, 'previous', { agent_id: 'shared' });
    harness.event('UserPromptSubmit', 3);
    harness.tasks.store.mutate('s', history => {
        const record = history.turns.find(row => row.prompt_id === 'original')!;
        record.agent_ids.push('shared');
        record.agent_evidence.shared = { ...history.turns.find(row => row.prompt_id === 'previous')!.agent_evidence.shared!,
            started_wall_ns: 4000000000n, stopped_wall_ns: 4500000000n };
        return record.prompt_id;
    });
    const entry = harness.feed([promptLine('original', 3), assistantLine(5), confirmed(6)]);
    harness.notify('shared', 6.1, 'report');
    assert.equal(harness.state('report'), null);
    assert.equal(harness.tasks.store.load('s')!.unresolved_notifications?.length, 1);
    assert.equal(harness.state().status, 'completed');
    harness.store.observe([
        observation('heartbeat', 0, 3000, { payload: { host_version: '2.1.322', loaded_at_ms: 3000 } }),
        observation('prompt', 1, 3000, { prompt: 'original' }),
        observation('turn_start', 2, 3500, { prompt: 'original', turn_id: 'owner' }),
        observation('agent_start', 3, 4000, { agent: 'shared', turn_id: 'owner' }),
        observation('turn_end', 4, 6000, { turn_id: 'owner', payload: { status: 'completed' } }),
    ], { timing: true });
    assert.equal(harness.state().status, 'running');
    assert.equal(harness.state().started_wall_ns, 3e9);
    assert.equal(harness.state('report').prompt_id, 'original');
    assert.equal(harness.state('previous').end_source, 'next_prompt');
    assert.equal(harness.tasks.store.load('s')!.unresolved_notifications, undefined);
    harness.feed([{ ...assistantLine(7), promptId: 'report' }, { ...confirmed(8), promptId: 'report' }], entry);
    assert.equal(harness.state().status, 'completed');
    assert.equal(harness.state().duration_ns, 5e9);
});

test('only fresh bound main activity can continue a finished task without a report', testContext => {
    const harness = fixture(testContext);
    harness.event('UserPromptSubmit', 1);
    const entry = harness.feed([promptLine('original', 1), assistantLine(2), confirmed(3)]);
    harness.clock(4000000000n);
    harness.store.observe([
        observation('heartbeat', 0, 1000),
        observation('prompt', 1, 1000, { prompt: 'original' }),
        observation('turn_start', 2, 2000, { prompt: 'original', turn_id: 'stale' }),
        observation('turn_end', 3, 3000, { turn_id: 'stale', payload: { status: 'completed' } }),
    ], { timing: true });
    assert.equal(harness.state().status, 'completed');
    harness.store.observe([observation('turn_start', 4, 4000, { prompt: 'original', turn_id: 'continued' })], { timing: true });
    assert.equal(harness.state().status, 'running');
    assert.equal(harness.state().started_wall_ns, 1e9);
    harness.feed([confirmed(3.5), durationLine(3.55, 2600)], entry);
    assert.equal(harness.state().status, 'running');
    harness.store.observe([observation('turn_end', 5, 6000, { turn_id: 'continued', payload: { status: 'completed' } })], { timing: true });
    assert.equal(harness.state().duration_ns, 5e9);
});

test('the transcript cache upgrade repairs an unfinished ledger without recalibrating frozen history', testContext => {
    const harness = fixture(testContext), source = new UsageCollector(harness.context), transcript = join(harness.root, 'transcript.jsonl');
    const input = { session_id: 's', transcript_path: transcript };
    const assistant = { ...assistantLine(2), message: { id: 'answer', model: 'test', usage: { input_tokens: 11, output_tokens: 7 } } };
    writeLines(transcript, [promptLine('previous', 1), assistant, durationLine(3, 2000)]);
    const counts = source.collect(input)!.slice(0, 3);
    const frozen = harness.state('previous');
    assert.equal(frozen.end_source, 'transcript_duration');
    const cache = JSON.parse(fs.readFileSync(source.path(), 'utf8'));
    cache.sessions.s.turn_scan_version = 6;
    fs.writeFileSync(source.path(), pythonJson(cache));
    harness.rawEvent('UserPromptSubmit', 4, 'original');
    harness.rawEvent('SubagentStart', 5, 'original', { agent_id: 'background' });
    harness.rawEvent('Stop', 6, 'original', { background_tasks: [{ id: 'background', type: 'subagent' }] });
    harness.rawEvent('SubagentStop', 7, 'original', { agent_id: 'background' });
    assert.deepEqual(harness.state().pending_agent_reports, ['background']);
    writeLines(transcript, [confirmed(3.1), promptLine('original', 4), queued(7.3, 'background'), assistantLine(8), confirmed(9)], true);
    assert.deepEqual(source.collect(input)!.slice(0, 3), counts);
    assert.deepEqual(harness.state('previous'), frozen);
    assert.equal(harness.state().end_source, 'transcript_stop');
    assert.equal(harness.state().duration_ns, 5e9);
    assert.deepEqual(harness.state().pending_agent_reports, []);
});
