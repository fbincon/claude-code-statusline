import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readDiagnosticFile } from '../src/diagnostic-files.js';
test('explicit diagnostic inputs read regular files and reject directories', t => {
    const root = mkdtempSync(join(tmpdir(), 'diagnostic-file-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = join(root, 'input.json');
    writeFileSync(path, '{"value":0}');
    assert.equal(readDiagnosticFile(path)?.toString(), '{"value":0}');
    assert.throws(() => readDiagnosticFile(root), /not a regular file|EISDIR|EPERM|EACCES/);
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
