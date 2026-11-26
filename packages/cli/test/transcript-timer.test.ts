import test from 'node:test';
import { assert, fs, join, writeLines, plain, pythonJson, setup } from './runtime-support.js';
import { lifecycle, promptLine, assistantLine, durationLine } from './lifecycle-support.js';
import { collectTask } from '../src/runtime/tasks/collect.js';
import { registryStatus } from '../src/runtime/registry.js';
import { processToken } from '@fbincon/statusline-platform/processes';
import { runtimeIO } from '../src/runtime/io.js';
import { SubmissionIndex } from '../src/runtime/tasks/submissions.js';
import { UsageCollector } from '../src/runtime/usage.js';
import { BASE, type UsageEntry } from '@fbincon/statusline-core/runtime/usage';
import { taskElapsed } from '@fbincon/statusline-core/timing/timer';
function registry(f: ReturnType<typeof lifecycle>, session: string, at: number) {
    fs.mkdirSync(f.context.sessionsDir, { recursive: true });
    f.context.processToken = pid => pid === 123 ? 'start' : null;
    fs.writeFileSync(join(f.context.sessionsDir, '123.json'), pythonJson({ pid: 123, procStart: 'start', sessionId: session, status: 'idle', statusUpdatedAt: Math.trunc(at * 1000) }));
}
test('tests.runtime.test_submission_index.SubmissionIndexTests.test_indexed_lookup_reads_only_the_tail_and_invalidates_on_replacement', t => {
    const f = setup(t), path = join(f.root, 'transcript.jsonl'), base = runtimeIO(), offsets: bigint[] = [];
    const io = { ...base, lines(target: string, start: bigint, visit: (raw: Buffer) => void) { offsets.push(start); return base.lines(target, start, visit); } }, index = new SubmissionIndex(f.context, io);
    fs.writeFileSync(path, '{"type":"system"}\n'.repeat(1000) + pythonJson(promptLine('p', 1)) + '\n');
    const first = index.time(path, 'p')!, offset = BigInt(fs.statSync(path).size);
    assert.equal(index.time(path, 'p'), first);
    assert.equal(offsets.length, 1);
    fs.appendFileSync(path, pythonJson(promptLine('q', 2)));
    assert.equal(index.time(path, 'q'), null);
    fs.appendFileSync(path, '\n');
    assert.ok(index.time(path, 'q')! > first);
    assert.equal(offsets.at(-1), offset);
    const replacement = join(f.root, 'replacement');
    writeLines(replacement, [promptLine('p', 3)]);
    fs.renameSync(replacement, path);
    assert.ok(index.time(path, 'p')! > first);
    assert.equal(offsets.at(-1), 0n);
});
test('tests.runtime.test_statusline_timer.QueueAndCompletionTests.test_real_queue_interrupt_sequence_freezes_at_brewed_duration', t => {
    const f = lifecycle(t), start = 1788057372.402, next = 1788058007.310, interrupted = next - .028, duration = 1824621, ended = next + duration / 1000;
    f.event('UserPromptSubmit', start, 'A', {}, 'session');
    const entry = f.feed([promptLine('A', start), { type: 'user', timestamp: new Date(interrupted * 1000).toISOString(), promptId: 'B', interruptedMessageId: 'message-being-interrupted', message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] } }, promptLine('B', next), assistantLine(ended - .160)], {}, 'session');
    f.event('Stop', ended, 'B', {}, 'session');
    f.feed([durationLine(ended, duration)], entry, 'session');
    assert.equal(f.state('A', 'session').status, 'interrupted');
    assert.equal(f.state('B', 'session').status, 'completed');
    assert.ok(Math.abs(f.state('B', 'session').duration_ns - duration * 1e6) <= 1000);
    const result = collectTask(f.tasks, 'session', 'B', entry.last_pt, entry);
    assert.equal(f.render(result), '✓ 30m 25s');
    f.clock(BigInt(Math.trunc((ended + 600) * 1e9)), null, 'other-boot');
    assert.equal(f.render(collectTask(f.tasks, 'session', 'B', entry.last_pt, entry)), '✓ 30m 25s');
});
test('tests.runtime.test_statusline_timer.QueueAndCompletionTests.test_missing_stop_uses_verified_idle_after_assistant', t => {
    const f = lifecycle(t), entry = f.feed([promptLine('A', 1000), assistantLine(1060.5)], {}, 'missing-stop');
    registry(f, 'missing-stop', 1060.6);
    f.clock(1061000000000n);
    assert.equal(f.render(collectTask(f.tasks, 'missing-stop', 'A', entry.last_pt, entry)), '✓ 1m 01s');
    assert.equal(f.state('A', 'missing-stop').end_source, 'registry_idle');
});
test('tests.runtime.test_statusline_timer.QueueAndCompletionTests.test_idle_without_assistant_hides_withdrawn_prompt', t => {
    const f = lifecycle(t), entry = f.feed([promptLine('A', 1000)], {}, 'withdrawn');
    registry(f, 'withdrawn', 1002);
    f.clock(1003000000000n);
    assert.equal(f.render(collectTask(f.tasks, 'withdrawn', 'A', entry.last_pt, entry)), null);
    assert.equal(f.state('A', 'withdrawn').status, 'withdrawn');
});
test('verified idle after inline work can finish a task, but an idle timestamp preceding that work cannot', testContext => {
    const harness = lifecycle(testContext);
    harness.rawEvent('UserPromptSubmit', 1);
    harness.rawEvent('SubagentStart', 2, 'p', { agent_id: 'inline' });
    harness.rawEvent('SubagentStop', 3, 'p', { agent_id: 'inline' });
    const entry = harness.feed([promptLine('p', 1), assistantLine(4)]);
    registry(harness, 's', 2.5);
    harness.clock(6000000000n);
    assert.equal(collectTask(harness.tasks, 's', 'p', entry.last_pt, entry)?.status, 'running');
    registry(harness, 's', 7);
    assert.equal(collectTask(harness.tasks, 's', 'p', entry.last_pt, entry)?.status, 'running');
    registry(harness, 's', 5);
    const ended = collectTask(harness.tasks, 's', 'p', entry.last_pt, entry);
    assert.equal(ended?.end_source, 'registry_idle');
    assert.equal(harness.render(ended), '✓ 0m 04s');
});
test('a prompt-less Stop and unbound transcript ending cannot complete an unverified newer submission', testContext => {
    const harness = lifecycle(testContext);
    harness.rawEvent('UserPromptSubmit', 1, 'old');
    const entry = harness.feed([promptLine('old', 1), assistantLine(2)]);
    harness.rawEvent('UserPromptSubmit', 3, 'queued');
    harness.rawEvent('Stop', 4, null, { background_tasks: [] });
    harness.feed([durationLine(4.01, 3000)], entry);
    assert.equal(harness.state('queued').status, 'running');
    assert.equal(harness.state('queued').stop_candidate, null);
    assert.equal(harness.state('old').end_source, 'transcript_duration');
    harness.feed([promptLine('queued', 3), assistantLine(5)], entry);
    harness.rawEvent('Stop', 6, null);
    assert.equal(harness.state('queued').phase, 'stop_pending');
});
test('tests.runtime.test_statusline_timer.QueueAndCompletionTests.test_local_command_preserves_previous_completed_display', t => {
    const f = lifecycle(t), entry = f.feed([promptLine('A', 1000), assistantLine(1064.9), durationLine(1065, 65000), { type: 'user', timestamp: new Date(1066000).toISOString(), promptId: 'LOCAL', message: { role: 'user', content: '<command-name>/cost</command-name>' } }], {}, 'local');
    assert.equal(f.render(collectTask(f.tasks, 'local', 'LOCAL', entry.last_pt, entry)), '✓ 1m 05s');
    assert.equal(f.state('LOCAL', 'local').status, 'ignored');
});
test('tests.runtime.test_statusline_timer.RenderingAndFallbackTests.test_running_uses_floor_and_terminal_uses_nearest_second', t => {
    const f = lifecycle(t), running = { status: 'running', started_wall_ns: 1000000000n, started_boot_ns: null, ended_wall_ns: null, ended_boot_ns: null, duration_ns: null, boot_id: null };
    f.clock(2999999999n, null, 'boot');
    assert.equal(f.render(running), '⏱ 0m 01s');
    assert.equal(f.render({ ...running, status: 'completed', duration_ns: 1600000000n }), '✓ 0m 02s');
});
test('tests.runtime.test_statusline_timer.RenderingAndFallbackTests.test_boot_clock_used_when_valid_and_wall_clock_after_reboot', () => {
    const state = { status: 'running', started_wall_ns: 1000000000n, started_boot_ns: 10000000000n, ended_wall_ns: null, ended_boot_ns: null, duration_ns: null, boot_id: 'same' };
    assert.equal(taskElapsed(state, { wall_ns: 101000000000n, boot_ns: 12000000000n, boot_id: 'same' }), 2000000000n);
    assert.equal(taskElapsed(state, { wall_ns: 4000000000n, boot_ns: 12000000000n, boot_id: 'new' }), 3000000000n);
});
test('tests.runtime.test_statusline_timer.RenderingAndFallbackTests.test_unknown_state_is_frozen_and_marked_as_lower_bound', t => {
    const f = lifecycle(t), state = { status: 'unknown', started_wall_ns: 1000000000n, started_boot_ns: null, ended_wall_ns: 11400000000n, ended_boot_ns: null, duration_ns: null, boot_id: null };
    assert.equal(f.render(state), '? 0m 10s+');
    f.clock(999000000000n, null, null);
    assert.equal(f.render(state), '? 0m 10s+');
});
test('tests.runtime.test_statusline_timer.RenderingAndFallbackTests.test_missing_state_has_no_open_ended_time_fallback', t => {
    const f = lifecycle(t);
    f.tasks.transcript = () => null;
    assert.equal(collectTask(f.tasks, 's', 'A', 1000, { last_prompt_id: 'A', last_pt: 1000 }), null);
});
test('tests.runtime.test_statusline_timer.RenderingAndFallbackTests.test_registry_requires_live_pid_and_matching_process_start', t => {
    const f = setup(t), path = join(f.context.sessionsDir, `${process.pid}.json`);
    fs.mkdirSync(f.context.sessionsDir, { recursive: true });
    f.context.processToken = processToken;
    const value = { pid: process.pid, sessionId: 's', status: 'idle', statusUpdatedAt: 1234, procStart: 'wrong' };
    fs.writeFileSync(path, pythonJson(value));
    assert.equal(registryStatus(f.context, 's'), null);
    const token = processToken(process.pid);
    assert.ok(token);
    value.procStart = token;
    fs.writeFileSync(path, pythonJson(value));
    const accepted = plain(registryStatus(f.context, 's'));
    assert.equal(accepted.status, 'idle');
    assert.equal(accepted.status_updated_wall_ns, 1234000000);
});
test('tests.runtime.test_statusline_timer.RenderingAndFallbackTests.test_registry_filters_other_sessions_and_invalid_records_before_process_lookup', t => {
    const f = setup(t);
    fs.mkdirSync(f.context.sessionsDir, { recursive: true });
    let calls = 0;
    f.context.processToken = () => { calls++; return null; };
    for (const [pid, record] of Object.entries({ '42': { pid: 42, sessionId: 'other', statusUpdatedAt: 1234 }, '43': { pid: 43, sessionId: 's', statusUpdatedAt: true }, '44': ['invalid registry'] }))
        fs.writeFileSync(join(f.context.sessionsDir, pid + '.json'), pythonJson(record));
    assert.equal(registryStatus(f.context, 's'), null);
    assert.equal(calls, 0);
});
test('tests.runtime.test_statusline_timer.RenderingAndFallbackTests.test_unchanged_transcript_is_not_reparsed', t => {
    const f = setup(t), path = join(f.root, 'transcript.jsonl');
    writeLines(path, [promptLine('A', 1000)]);
    const collector = new UsageCollector(f.context), entry: UsageEntry = { files: {}, ids: {}, base: { ...BASE } };
    let calls = 0;
    const original = collector.tasks.transcript.bind(collector.tasks);
    collector.tasks.transcript = (...args) => { calls++; return original(...args); };
    assert.equal(collector.updateFile(entry, path, 's', true, true), true);
    assert.equal(collector.updateFile(entry, path, 's', true, true), false);
    assert.equal(calls, 1);
});

test('a legacy superseded timer selects the verified current task through completion and resume without rewriting history', t => {
    const f = lifecycle(t), entry = f.feed([promptLine('prompt-id', 1)]);
    f.tasks.transcript('s', [{ kind: 'prompt', prompt_id: 'message-uuid', wall_ns: 1156000000n }]);
    f.clock(6000000000n);
    const verify = (expected: string) => {
        const file = f.tasks.store.path('s'), before = fs.readFileSync(file);
        for (const prompt of ['prompt-id', 'message-uuid', null]) {
            const turn = collectTask(f.tasks, 's', prompt, entry.last_pt, entry);
            assert.equal(turn?.prompt_id, 'message-uuid');
            assert.equal(f.render(turn), expected);
        }
        assert.deepEqual(fs.readFileSync(file), before);
    };
    assert.equal(f.state('prompt-id').duration_ns, 156000000);
    verify('⏱ 0m 04s');
    f.tasks.confirm('s', 'message-uuid', 1520884000000n);
    verify('✓ 25m 20s');
    f.rawEvent('SessionStart', 1800, null, { source: 'resume' });
    verify('✓ 25m 20s');
    assert.equal(f.tasks.store.load('s')!.turns.length, 2);
});

test('the old transcript cursor backfills an explicit message pair without changing its confirmed duration', t => {
    const f = lifecycle(t), path = join(f.root, 'transcript.jsonl'), payload = { session_id: 's', transcript_path: path };
    const collector = new UsageCollector(f.context);
    f.feed([promptLine('prompt-id', 1), promptLine('message-uuid', 1.156)]);
    f.tasks.confirm('s', 'message-uuid', 1520884000000n);
    writeLines(path, [{ ...promptLine('prompt-id', 1), uuid: 'message-uuid' }]);
    const stat = fs.statSync(path, { bigint: true });
    fs.mkdirSync(join(f.root, 'statusline_usage_v2'), { recursive: true });
    fs.writeFileSync(collector.path(), pythonJson({ sessions: { s: { files: { [path]: { size: stat.size, mtime_ns: stat.mtimeNs, identity: [stat.dev, stat.ino] } },
        ids: {}, base: { ...BASE }, turn_scan_version: 7, last_pt: 1, last_prompt_id: 'prompt-id' } } }));
    collector.collectLifecycle(payload);
    const [record] = f.tasks.store.load('s')!.turns;
    assert.equal(f.tasks.store.load('s')!.turns.length, 1);
    assert.deepEqual(plain([record!.prompt_id, record!.prompt_aliases, record!.status, record!.duration_ns]), ['message-uuid', ['prompt-id'], 'completed', 1519728000000]);
    const bytes = fs.readFileSync(f.tasks.store.path('s'));
    collector.collectLifecycle(payload);
    assert.deepEqual(fs.readFileSync(f.tasks.store.path('s')), bytes);
});

test('the lifecycle cursor retries a failed task write without re-accounting tokens', t => {
    const f = lifecycle(t), path = join(f.root, 'transcript.jsonl'), input = { session_id: 's', transcript_path: path };
    const collector = new UsageCollector(f.context), transcript = collector.tasks.transcript.bind(collector.tasks);
    collector.tasks.transcript = () => { throw new Error('temporary failure'); };
    writeLines(path, [{ ...promptLine('p', 1), uuid: 'message' }, { ...assistantLine(2), message: { id: 'a', model: 'fixture', usage: { input_tokens: 12 } } }]);
    const first = collector.collect(input)!;
    assert.equal(first[4].turn_file, undefined);
    assert.equal(f.tasks.store.load('s'), null);
    collector.tasks.transcript = transcript;
    const recovered = collector.collect(input)!;
    assert.deepEqual(recovered.slice(0, 3), first.slice(0, 3));
    assert.equal(f.state('message').prompt_id, 'p');
});

test('only an unambiguous main human transcript pair adds a message alias', t => {
    const f = lifecycle(t);
    f.feed([
        { ...promptLine('original', 1), uuid: 'original-message' },
        { ...promptLine('second', 1.01), uuid: 'shared' },
        { ...promptLine('third', 1.02), uuid: 'shared' },
        { ...promptLine('side', 1.03), uuid: 'side-message', isSidechain: true },
        { ...promptLine('command', 1.04, '<command-name>/cost</command-name>'), uuid: 'command-message' },
    ]);
    assert.equal(f.state('original-message').prompt_id, 'original');
    for (const id of ['shared', 'side-message', 'command-message'])
        assert.equal(f.state(id), null);
    assert.equal(f.state('second').prompt_id, 'second');
    assert.equal(f.state('third').prompt_id, 'third');
});
