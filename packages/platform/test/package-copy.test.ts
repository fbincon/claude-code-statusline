import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyPackage } from '../src/package-copy.js';

function fixture(t: TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'package copy 中文 '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = join(root, 'source'), target = join(root, 'target');
    fs.mkdirSync(join(source, 'nested'), { recursive: true });
    fs.writeFileSync(join(source, 'nested', 'entry.js'), '#!/usr/bin/env node\n', { mode: 0o755 });
    fs.writeFileSync(join(source, 'data'), Buffer.from([0, 255, 10]));
    return { source, target };
}
test('package copying preserves bytes and executable permission without overwriting or recursive destination', t => {
    const { source, target } = fixture(t);
    copyPackage(source, target);
    assert.deepEqual(fs.readFileSync(join(target, 'data')), fs.readFileSync(join(source, 'data')));
    assert.equal(fs.readFileSync(join(target, 'nested', 'entry.js'), 'utf8'), '#!/usr/bin/env node\n');
    if (process.platform !== 'win32') {
        assert.equal(fs.statSync(join(target, 'nested', 'entry.js')).mode & 0o777, 0o700);
        assert.equal(fs.statSync(join(target, 'data')).mode & 0o777, 0o600);
    }
    assert.throws(() => copyPackage(source, target));
    assert.throws(() => copyPackage(source, join(source, 'inside'), { entries: 1, bytes: 64 }), /outside the source/);
    assert(!fs.existsSync(join(source, 'inside')));
    assert(fs.existsSync(join(target, 'data')));
});
test('package copying rejects links and bounds entries and bytes, removing incomplete destinations', t => {
    const { source, target } = fixture(t);
    for (const limits of [{ entries: 1, bytes: 1024 }, { entries: 16, bytes: 1 }]) {
        assert.throws(() => copyPackage(source, target, limits));
        assert(!fs.existsSync(target));
    }
    fs.symlinkSync(join(source, 'nested'), join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => copyPackage(source, target), /link or special/);
    assert(!fs.existsSync(target));
    assert.throws(() => copyPackage(join(source, 'linked'), target), /regular directory/);
});
test('package copying resolves destination ancestor aliases before rejecting a recursive target', t => {
    const { source } = fixture(t), alias = join(dirname(source), 'source alias');
    fs.symlinkSync(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => copyPackage(source, join(alias, 'inside', 'copy'), { entries: 1, bytes: 64 }), /outside the source/);
    assert(!fs.existsSync(join(source, 'inside')));
    assert.equal(fs.readFileSync(join(source, 'data')).length, 3);
});
