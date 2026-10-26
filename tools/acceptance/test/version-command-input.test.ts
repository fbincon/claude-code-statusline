import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import { writeVersionInput } from '../version-management.js';

for (const exitCode of [0, 23]) test(`closed command stdin retains exit status ${exitCode} without crashing the sequence`, { timeout: 10000 }, async t => {
    const child = spawn(process.execPath, ['-e', `require('node:fs').closeSync(0); process.on('message', () => process.exit(${exitCode})); process.send('ready');`], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    t.after(() => { child.kill('SIGKILL'); });
    const closed = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    await new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('message', () => resolve()); });
    const failures: Error[] = [], streamErrors: string[] = [];
    const broken = new Promise<void>(resolve => child.stdin!.once('error', () => resolve()));
    child.stdin!.on('error', error => streamErrors.push((error as NodeJS.ErrnoException).code ?? 'unknown'));
    writeVersionInput(child.stdin!, 'x'.repeat(1024 * 1024), error => failures.push(error));
    await broken; child.send('finish');
    assert.equal(await closed, exitCode);
    assert.deepEqual(streamErrors, ['EPIPE']);
    assert.deepEqual(failures, []);
});

test('version command input preserves literal Unicode bytes and EOF', { timeout: 10000 }, async t => {
    const child = spawn(process.execPath, ['-e', "process.stdin.pipe(process.stdout);"], { stdio: ['pipe', 'pipe', 'pipe'] });
    t.after(() => { child.kill('SIGKILL'); });
    let output = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', value => output += value);
    const closed = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    const input = JSON.stringify({ text: 'literal 中文 $` & 🧪' });
    const failures: Error[] = []; writeVersionInput(child.stdin, input, error => failures.push(error));
    assert.equal(await closed, 0); assert.equal(output, input); assert.deepEqual(failures, []);
});

test('version command input surfaces non-pipe stream failures', async () => {
    const error = Object.assign(new Error('input failed'), { code: 'EIO' });
    const stream = new Writable({ write(_chunk, _encoding, callback) { callback(error); } });
    const actual = await new Promise<Error>(resolve => writeVersionInput(stream, 'input', resolve));
    assert.equal(actual, error);
});
