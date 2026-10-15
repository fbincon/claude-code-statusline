import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { openPty } from '../../migration/ts-04/test/pty.js';
test('manual observer records real PTY keys and restores terminal on save, cancel and log failure', { skip: process.platform === 'win32' }, async (t) => {
    const root = fs.mkdtempSync(join(tmpdir(), 'terminal-observer-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const [name, key, code] of [['save', '\x13', 0], ['cancel', '\x03', 130], ['failure', '', 1]] as const) {
        const log = join(root, name === 'failure' ? 'missing/events.jsonl' : name + '.jsonl'), p = openPty(root, 80, 24, {}, 'en', { executable: process.execPath, args: [fileURLToPath(new URL('../terminal.js', import.meta.url)), 'observe', '--output', log] });
        try {
            if (key) {
                await p.wait(out => out.includes('TS-05'));
                p.send('中文 é 👩🏽‍💻\x1b[A\x1b[B\x1b[C\x1b[D' + key);
            }
            await p.exited();
            assert.equal(p.child.exitCode, code);
            assert.deepEqual(p.attributes(), p.before);
            if (key)
                assert.ok(fs.readFileSync(log, 'utf8').includes('restored'));
        }
        finally {
            await p.close();
        }
    }
});
