import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { colorCapability } from '@fbincon/statusline-platform/terminal/capabilities';
import { Canvas, ansiFrame } from '@fbincon/statusline-tui/drawing/canvas';
import { Capture } from '../../migration/ts-04/capture.js';
import { assertPublicFrame, encodeKeyframes, requireActualTask, stopRecordedGroup, isolatedRecordingEnvironment, requireColoredCapture, previewBody, KEYFRAME_ENCODING } from '../showcase-journeys.js';

test('an inherited NO_COLOR including zero is removed for the isolated terminal without mutating its parent', () => {
    for (const value of ['1', '0', '']) {
        const parent = { NO_COLOR: value, TERM: 'dumb', COLORTERM: '', KEEP: 'same' };
        const before = { ...parent }, environment = isolatedRecordingEnvironment(parent);
        assert.deepEqual(parent, before); assert.equal(Object.hasOwn(environment, 'NO_COLOR'), false);
        assert.deepEqual(colorCapability({ environment: parent, platform: 'linux', tty: true, windowsVT: false }), { colors: 0, reason: 'no_color' });
        assert.deepEqual(colorCapability({ environment, platform: 'linux', tty: true, windowsVT: false }), { colors: 256, reason: 'explicit_extended' });
        assert.equal(environment.COLORTERM, 'truecolor'); assert.equal(environment.KEEP, 'same');
    }
});

test('actual product terminal encoding must preserve chromatic preview cells, not just a cyan heading', () => {
    const canvas = new Canvas(40, 5);
    canvas.put(0, 0, [{ text: 'Editor heading', foreground: { kind: 'ansi', value: 6 }, background: null, bold: true }]);
    canvas.put(2, 0, [{ text: 'Model ', foreground: { kind: 'rgb', value: '#5fd7ff' }, background: null, bold: false },
        { text: 'Context', foreground: { kind: 'rgb', value: '#ffd75f' }, background: null, bold: false }]);
    const environment = isolatedRecordingEnvironment({ NO_COLOR: '0' });
    const depth = colorCapability({ environment, platform: 'linux', tty: true, windowsVT: false }).colors;
    const ansi = ansiFrame(canvas.frame(), depth), terminal = new Capture(40, 5); terminal.feed(ansi);
    const proof = requireColoredCapture(ansi, terminal.buffer, [0, 2, 40, 1]);
    assert(proof.chromatic_cells >= 10); assert(proof.matching_foreground_colors.length >= 2); assert(proof.sgr_indexed_sequences >= 2);
    assert.throws(() => requireColoredCapture(ansi, terminal.buffer, [0, 0, 40, 1]), 'Chrome color alone must not pass');
    const monochrome = ansiFrame(canvas.frame(), 0), plain = new Capture(40, 5); plain.feed(monochrome);
    assert.throws(() => requireColoredCapture(monochrome, plain.buffer, [0, 2, 40, 1]));
    assert.equal(KEYFRAME_ENCODING.max_colors, 256); assert.equal(KEYFRAME_ENCODING.realtime, false);
});

test('preview color proof is bounded by the actual frame interior instead of adjacent controls', () => {
    for (const [top, bottom] of [['┌─ Preview ─────┐', '└──────────────┘'], ['╭─ 预览 ───────╮', '╰──────────────╯']]) {
        const capture = new Capture(24, 6); capture.feed(top + '\r\n│Model Context │\r\n' + bottom);
        const bounds = previewBody(capture.buffer, top!.includes('Preview') ? 'Preview' : '预览');
        assert.equal(bounds[0], 1); assert.equal(bounds[1], 1); assert.equal(bounds[3], 1);
    }
    assert.throws(() => previewBody(new Capture(24, 6).buffer, 'Preview'), /not visible/u);
});

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
