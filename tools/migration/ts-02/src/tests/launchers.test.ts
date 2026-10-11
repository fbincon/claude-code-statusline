import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepare, helper, launcherArgv, windowsConsole } from '../launchers.js';
import { nodeBinding } from '../launch.js';
import { cli } from '../context.js';

test('launch handshake rejects wrong nonce, expired request and reused parent identity', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ts02 launch 中文 '));
  try {
    const { path, request } = prepare(directory, nodeBinding(cli));
    assert.throws(() => helper(path, 'wrong'));
    for (const change of [{ expires: 0 }, { token: 'reused' }]) {
      writeFileSync(path, JSON.stringify({ ...request, ...change })); assert.throws(() => helper(path, request.nonce));
    }
    writeFileSync(path, JSON.stringify(request)); helper(path, request.nonce);
    assert.equal(JSON.parse(readFileSync(request.result, 'utf8')).nonce, request.nonce);
    assert.throws(() => helper(path, request.nonce), /EEXIST/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('tmux starts the real Node helper in a terminal and returns matching handshake', { skip: process.platform === 'win32', timeout: 10000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ts02 tmux 中文 $` & '));
  const socket = 'ts02-' + process.pid;
  try {
    const { request, command } = prepare(directory, nodeBinding(cli));
    const argv = launcherArgv('tmux', command, directory, socket);
    const launched = spawnSync(argv[0]!, argv.slice(1), { encoding: 'utf8' });
    assert.equal(launched.status, 0, launched.error?.message || launched.stderr);
    const deadline = Date.now() + 5000;
    while (!existsSync(request.result) && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    const result = JSON.parse(readFileSync(request.result, 'utf8'));
    assert.deepEqual(result, { nonce: request.nonce, input_tty: true, output_tty: true });
  } finally {
    spawnSync('tmux', ['-L', socket, 'kill-server'], { stdio: 'ignore' });
    rmSync(directory, { recursive: true, force: true });
  }
});

test('GNOME argv and macOS command file preserve Unicode/special paths and exact entry', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ts02 GUI plan '));
  try {
    const command = ['/node 中文', '/entry $` &.js', "a'b"];
    assert.deepEqual(launcherArgv('gnome', command, directory).slice(-3), command);
    const mac = launcherArgv('macos', command, directory);
    assert.deepEqual(mac.slice(0, 3), ['/usr/bin/open', '-a', 'Terminal']);
    assert.ok(readFileSync(mac[3]!, 'utf8').includes("'a'\\''b'"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Windows CREATE_NEW_CONSOLE opens genuine TTY handles and restores raw mode', { skip: process.platform !== 'win32' }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'ts02 console 中文 '));
  try {
    const output = join(directory, 'result.json');
    windowsConsole([process.execPath, cli, 'console-probe', output]);
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), { input: true, output: true, raw: true, restored: true });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
