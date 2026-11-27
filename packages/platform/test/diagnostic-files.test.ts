import test from 'node:test';
import assert from 'node:assert/strict';
import fs, {
    appendFileSync, closeSync, fstatSync, mkdtempSync, openSync, rmSync, symlinkSync, truncateSync, writeFileSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { MAX_DIAGNOSTIC_BYTES, readDiagnosticFile } from '../src/diagnostic-files.js';
import { readLimitedInput } from '../src/input.js';
import { removeTree } from '../src/remove-tree.js';
test('explicit diagnostic inputs read regular files and reject directories', t => {
    const root = mkdtempSync(join(tmpdir(), 'diagnostic-file-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = join(root, 'input.json');
    writeFileSync(path, '{"value":0}');
    assert.equal(readDiagnosticFile(path)?.toString(), '{"value":0}');
    assert.throws(() => readDiagnosticFile(root), /not a regular file|EISDIR|EPERM|EACCES/);
    if (process.platform !== 'win32') {
        const link = join(root, 'selected.json');
        symlinkSync(path, link);
        assert.throws(() => readDiagnosticFile(link), /Symbolic diagnostic store/);
        assert.equal(readDiagnosticFile(link, true)?.toString(), '{"value":0}');
    }
});

test('small task files allocate buffers proportional to their contents', t => {
    const root = mkdtempSync(join(tmpdir(), 'task-read-size-'));
    t.after(() => removeTree(root));
    // Sizes observed in the task detail fixture's turns, live and runtime preference files.
    const files = [1601, 576, 66].map(size => {
        const path = join(root, String(size)), content = Buffer.alloc(size, 'a');
        writeFileSync(path, content);
        return { path, content };
    });
    const allocate = t.mock.method(Buffer, 'alloc');
    const results = files.map(({ path }) => readDiagnosticFile(path));
    const requested = allocate.mock.calls.reduce((sum, call) => sum + call.arguments[0], 0);
    allocate.mock.restore();
    assert.deepEqual(results, files.map(({ content }) => content));
    assert.ok(requested < 64 * 1024, 'buffer allocation for 2,243 input bytes: ' + requested);
});

test('diagnostic reads allow exactly 32 MiB and reject the overflow byte', t => {
    const root = mkdtempSync(join(tmpdir(), 'diagnostic-limit-'));
    t.after(() => removeTree(root));
    const path = join(root, 'boundary');
    writeFileSync(path, '');
    truncateSync(path, MAX_DIAGNOSTIC_BYTES);
    assert.equal(readDiagnosticFile(path)?.length, MAX_DIAGNOSTIC_BYTES);
    appendFileSync(path, 'x');
    assert.throws(() => readDiagnosticFile(path), /exceeds 32 MiB/);
});

test('an open file can grow, shrink or report size zero while the read stays bounded', t => {
    const root = mkdtempSync(join(tmpdir(), 'growing-diagnostic-'));
    t.after(() => removeTree(root));
    const path = join(root, 'input'), limit = 8192;
    function readAfterResize(initial: number, content: Buffer): Buffer {
        writeFileSync(path, Buffer.alloc(initial));
        const fd = openSync(path, 'r');
        try {
            const before = fstatSync(fd);
            writeFileSync(path, content);
            return readLimitedInput(limit, fd, before.size);
        } finally { closeSync(fd); }
    }
    const payload = Buffer.alloc(limit + 2, 'x');
    assert.deepEqual(readAfterResize(0, payload.subarray(0, limit)), payload.subarray(0, limit));
    assert.deepEqual(readAfterResize(limit, Buffer.from('short')), Buffer.from('short'));

    writeFileSync(path, 'a');
    const fd = openSync(path, 'r');
    const firstSize = fstatSync(fd).size;
    const original = fs.readSync;
    let appended = false;
    const read = t.mock.method(fs, 'readSync', (descriptor: number, buffer: Buffer, offset: number, size: number, position: number | null) => {
        const count = original(descriptor, buffer, offset, size, position);
        if (descriptor === fd && !appended) {
            appended = true;
            appendFileSync(path, payload);
        }
        return count;
    });
    syncBuiltinESMExports();
    try {
        const expected = Buffer.concat([Buffer.from('a'), payload.subarray(0, limit)]);
        assert.deepEqual(readLimitedInput(limit, fd, firstSize), expected);
        assert(appended);
    } finally {
        read.mock.restore();
        syncBuiltinESMExports();
        closeSync(fd);
    }
});
test('a diagnostic named pipe is refused before a blocking read', { skip: process.platform === 'win32' ? 'POSIX named pipe; regular-file refusal is tested on every platform' : false }, t => {
    const root = mkdtempSync(join(tmpdir(), 'diagnostic-fifo-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = join(root, 'input');
    const fifo = spawnSync('mkfifo', [path], { encoding: 'utf8', timeout: 5000 });
    assert.equal(fifo.status, 0, fifo.stderr);
    const source = 'const {readDiagnosticFile}=await import(process.argv[1]);try{readDiagnosticFile(process.argv[2]);process.exitCode=1}catch(e){if(!String(e).includes("not a regular file"))throw e}';
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', source, new URL('../src/diagnostic-files.js', import.meta.url).href, path], { encoding: 'utf8', timeout: 5000 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
});
