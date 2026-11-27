import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync } from 'node:fs';
import { main } from '../src/main.js';
import { setup } from './final-support.js';

test('unbound, malformed and stale Mod requests leave the host row and configuration alone', async t => {
    const { root } = setup(t);
    const sample = { protocol: 1, session_id: 'session', installation_id: 'old-installation', host_version: '2.1.332', backend_version: '3.16.5', cwd: root };
    const examples = [
        { operation: '--agent-row-loaded', input: JSON.stringify(sample) },
        { operation: '--agent-row-batch', input: JSON.stringify({ ...sample, cwd: root, columns: 80, tasks: [] }) },
        { operation: '--agent-row-ready', input: JSON.stringify({ ...sample, confirmation: 'stale' }) },
        { operation: '--agent-row-batch', input: '{"protocol":1,"protocol":1}' },
        { operation: '--agent-row-ready', input: JSON.stringify({ ...sample, protocol: 2 }) },
        { operation: '--agent-row-batch', input: ' '.repeat(8 * 1024 * 1024 + 1) },
    ];
    for (const { operation, input } of examples) {
        let output = '';
        const code = await main(['render-subagents', operation, '--config-dir', root], {
            stdin: () => input, stdout: value => { output += value; }, stderr: message => assert.fail(message),
        });
        assert.equal(code, 0);
        assert.deepEqual(JSON.parse(output), { protocol: 1, mode: 'pass', rows: [] });
    }
    assert.deepEqual(readdirSync(root), []);
});
