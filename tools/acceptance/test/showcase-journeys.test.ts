import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { assertPublicFrame, encodeKeyframes, requireActualTask, stopRecordedGroup } from '../showcase-journeys.js';

test('private paths and provider material prevent publication even in an otherwise valid frame', () => {
    for (const privateText of ['/home/person/.config', '/tmp/private/capture', 'ANTHROPIC_AUTH_TOKEN', 'API key', 'sk-ant-example'])
        assert.throws(() => assertPublicFrame('Task completed\n' + privateText));
    assert.doesNotThrow(() => assertPublicFrame('Task total time: 13.6s\nLive metrics are disabled\n任务：已完成'));
});

test('animation inputs cannot escape the owned frame directory or inject concat instructions', () => {
    for (const frames of [[], ['frame-001.png'], ['frame-001.png', '../secret.png'], ['frame-001.png', 'frame-002.png\nfile secret']])
        assert.throws(() => encodeKeyframes('/nonexistent', frames, '/nonexistent.gif'));
});

test('a readable task screen cannot pass without the actual completed task and both matching agents', () => {
    const valid = { session_id: 'actual', status: 'completed', elapsed_seconds: 13.6,
        agents: [{ id: 'a', status: 'completed' }, { id: 'b', status: 'completed' }], evidence: [{ source: 'task_store', status: 'observed' }] };
    assert.doesNotThrow(() => requireActualTask(valid, 'actual', ['a', 'b']));
    for (const bad of [{ ...valid, session_id: 'other' }, { ...valid, status: 'running' }, { ...valid, agents: [] },
        { ...valid, agents: [valid.agents[0], valid.agents[0]] }, { ...valid, evidence: [] }])
        assert.throws(() => requireActualTask(bad, 'actual', ['a', 'b']));
});

test('recording cleanup escalates an ignored TERM and confirms the owned group is gone', { skip: process.platform !== 'linux' }, async () => {
    const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});process.stdout.write("ready");setInterval(()=>{},1000)'], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    try {
        await once(child.stdout!, 'data');
        let closed = false; await stopRecordedGroup(child.pid, async () => { closed = true; });
        assert(closed); assert.throws(() => process.kill(-child.pid!, 0), (error: NodeJS.ErrnoException) => error.code === 'ESRCH');
    } finally { try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* Confirmed removed. */ } }
});
