import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ObservationProcess } from '../src/observation-process.js';
import { processAlive, processToken } from '../src/processes.js';
import { removeTree } from '../src/remove-tree.js';

test('session IPC reuses a reader, reaps blocked reads and never consumes replies from a previous child', { timeout: 20_000 }, async t => {
    const root = mkdtempSync(join(tmpdir(), 'reader IPC spaces-')), entry = join(root, 'reader.mjs');
    const started = join(root, 'started'), busy = join(root, 'busy');
    writeFileSync(entry, [
        "import {writeFileSync} from 'node:fs';",
        'writeFileSync(' + JSON.stringify(started) + ',String(process.pid));',
        'let count=0;',
        'process.on("message", message => {',
        '  if (message.wait) { writeFileSync(' + JSON.stringify(busy) + ',"busy"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30000); }',
        '  if (message.crash) process.exit(1);',
        '  process.send({pid:process.pid,count:++count});',
        '});',
    ].join('\n'));
    const reader = new ObservationProcess(pathToFileURL(entry));
    t.after(async () => { await reader.close(); removeTree(root); });
    const signal = new AbortController().signal;
    const ping = () => reader.request({}, signal) as Promise<{ pid: number; count: number }>;
    assert.equal(existsSync(started), false);
    const [first, second] = await Promise.all([ping(), ping()]);
    assert.equal(second.pid, first.pid);
    assert.deepEqual([first.count, second.count], [1, 2]);
    const token = processToken(first.pid);
    assert.ok(token);
    const stop = new AbortController();
    const pending = assert.rejects(reader.request({ wait: true }, stop.signal), { name: 'AbortError' });
    const next = ping();
    const deadline = Date.now() + 5000;
    while (!existsSync(busy) && Date.now() < deadline) await delay(10);
    assert.equal(existsSync(busy), true);
    stop.abort();
    await pending;
    const replacement = await next;
    assert.equal(processAlive(first.pid, token), false);
    assert.equal(replacement.count, 1);
    await assert.rejects(reader.request({ crash: true }, signal), /exited before replying/u);
    assert.equal((await ping()).count, 1);
    await reader.close();
    await assert.rejects(ping(), /closed/u);
});
