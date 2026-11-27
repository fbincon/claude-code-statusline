import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { FileChangedError, lock, readWithExistingLock } from '../src/files.js';
import { removeTree } from '../src/remove-tree.js';

function directory(t: TestContext): string {
    const path = fs.mkdtempSync(join(tmpdir(), 'read lock '));
    t.after(() => { removeTree(path); assert.equal(fs.existsSync(path), false); });
    return path;
}

function child(path: string, check: string): void {
    const source = `import assert from 'node:assert/strict';
        import { lock, FileLockBusyError, readWithExistingLock } from ${JSON.stringify(new URL('../src/files.js', import.meta.url).href)};
        const path = process.argv[1]; ${check}`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source, path], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
}

test('shared read locks interoperate with the production writer across processes', t => {
    const path = join(directory(t), 'install.lock');
    const release = lock(path);
    try {
        child(path, "assert.throws(() => readWithExistingLock(path, () => assert.fail('unlocked')), FileLockBusyError)");
    } finally { release(); }
    readWithExistingLock(path, locked => {
        assert.equal(locked, true);
        child(path, "assert.equal(readWithExistingLock(path, locked => locked), true); assert.throws(() => lock(path, true), /flock failed|LockFileEx/)");
    });
    child(path, 'lock(path, true)()');
});

test('shared reads preserve missing directories, first-write races and file permissions', t => {
    const root = directory(t), path = join(root, 'runtime', 'install.lock');
    assert.equal(readWithExistingLock(path, locked => locked), false);
    assert.deepEqual(fs.readdirSync(root), []);
    const draws: boolean[] = [];
    assert.equal(readWithExistingLock(path, locked => {
        draws.push(locked);
        if (!locked) lock(path)();
        return locked;
    }), true);
    assert.deepEqual(draws, [false, true]);
    fs.writeFileSync(path, 'unchanged');
    if (process.platform !== 'win32') fs.chmodSync(path, 0o440);
    const mode = fs.statSync(path).mode, parentMode = fs.statSync(join(root, 'runtime')).mode;
    assert.equal(readWithExistingLock(path, locked => locked), true);
    assert.equal(fs.readFileSync(path, 'utf8'), 'unchanged');
    assert.equal(fs.statSync(path).mode, mode);
    assert.equal(fs.statSync(join(root, 'runtime')).mode, parentMode);
    assert.throws(() => readWithExistingLock(root, () => assert.fail('directory treated as a lock')), /Unsafe lock target/);
});

test('shared reads reject links and replacement of the held lock identity', { skip: process.platform === 'win32' }, t => {
    const root = directory(t), path = join(root, 'install.lock'), other = join(root, 'other');
    fs.writeFileSync(other, '');
    fs.symlinkSync(other, path);
    assert.throws(() => readWithExistingLock(path, () => assert.fail('followed a link')), /Unsafe lock target/);
    fs.unlinkSync(path);
    lock(path)();
    assert.throws(() => readWithExistingLock(path, () => fs.renameSync(other, path)), FileChangedError);
});
