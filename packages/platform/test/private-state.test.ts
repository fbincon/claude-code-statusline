import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPrivateState } from '../src/private-state.js';
import { FileChangedError } from '../src/files.js';

for (const swaps of [1, 3]) test(`private progress retries complete atomic replacements, bounded at three attempts: ${swaps}`, t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'private state ')), path = join(root, 'state.json');
    fs.writeFileSync(path, 'old', { mode: 0o600 });
    const replacements = Array.from({ length: swaps }, (_, i) => { const p = join(root, String(i)); fs.writeFileSync(p, 'new-' + i, { mode: 0o600 }); return p; });
    const open = fs.openSync; let attempts = 0;
    t.mock.method(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
        if (String(args[0]) === path) { const next = replacements[attempts++]; if (next) fs.renameSync(next, path); }
        return open(...args);
    });
    syncBuiltinESMExports();
    try {
        if (swaps === 1) { assert.equal(readPrivateState(path).toString(), 'new-0'); assert.equal(attempts, 2); }
        else { assert.throws(() => readPrivateState(path), FileChangedError); assert.equal(attempts, 3); }
    } finally { t.mock.restoreAll(); syncBuiltinESMExports(); fs.rmSync(root, { recursive: true, force: true }); }
});
test('private progress retains permission, type, size and no-follow checks across replacement', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'private checks ')), path = join(root, 'state.json'), replacement = join(root, 'next');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path, 'safe', { mode: 0o600 });
    assert.equal(readPrivateState(path, 4).toString(), 'safe'); assert.throws(() => readPrivateState(path, 3)); assert.throws(() => readPrivateState(root));
    if (process.platform === 'win32') return;
    fs.writeFileSync(replacement, 'public', { mode: 0o644 });
    const open = fs.openSync; let replaced = false;
    t.mock.method(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
        if (String(args[0]) === path && !replaced) { replaced = true; fs.renameSync(replacement, path); }
        return open(...args);
    });
    syncBuiltinESMExports();
    try { assert.throws(() => readPrivateState(path), /Unsafe/); assert.equal(fs.readFileSync(path, 'utf8'), 'public'); }
    finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
    fs.unlinkSync(path); fs.writeFileSync(replacement, 'private', { mode: 0o600 }); fs.symlinkSync(replacement, path);
    assert.throws(() => readPrivateState(path)); assert.equal(fs.readFileSync(replacement, 'utf8'), 'private');
});
