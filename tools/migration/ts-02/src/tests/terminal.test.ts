import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { library } from '../native.js';
import { cli } from '../context.js';

const sizes = [[64, 18, false], [64, 20, false], [80, 24, false], [120, 30, false], [80, 48, false], [32, 12, false], [80, 24, true]] as const;
for (const [columns, rows, logFailure] of sizes) test(`native PTY keys/resize/restore ${columns}x${rows}${logFailure ? ' with log failure' : ''}`, { skip: process.platform === 'win32' ? 'Requires a Windows console/ConPTY harness; D04 remains OPEN' : false, timeout: 10000 }, async () => {
  const temp = fs.mkdtempSync(join(tmpdir(), 'ts02-pty-'));
  const log = logFailure ? join(temp, 'missing/events.jsonl') : join(temp, 'events.jsonl');
  const lib = library(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6');
  const pty = process.platform === 'darwin' ? lib : library('libutil.so.1');
  const size = Buffer.alloc(8); size.writeUInt16LE(rows!, 0); size.writeUInt16LE(columns!, 2);
  const master = [0], slave = [0];
  assert.equal(pty.func('int openpty(_Out_ int *master, _Out_ int *slave, void *name, void *termios, void *size)')(master, slave, null, null, size), 0);
  const m = master[0]!, s = slave[0]!;
  const attrs = lib.func('int tcgetattr(int fd, _Out_ void *termios)');
  const before = Buffer.alloc(256), after = Buffer.alloc(256); assert.equal(attrs(s, before), 0);
  // Darwin arm64 passes variadic arguments on the stack, unlike fixed args.
  const fcntl = lib.func('int fcntl(int fd, int cmd, ...)');
  const nonblock = process.platform === 'darwin' ? 4 : 2048;
  assert.equal(fcntl(m, 4, 'int', nonblock), 0);
  assert.ok(fcntl(m, 3) & nonblock, 'PTY reads must never block the test runner');
  const child = spawn(process.execPath, [cli, 'terminal', log], { stdio: [s, s, s], detached: true, env: { ...process.env, TERM: 'xterm-256color' } });
  let closed = false; const closedPromise = new Promise<void>(resolve => child.once('exit', () => { closed = true; resolve(); }));
  const waitEvent = async (event: string) => {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      // Drain output so a blocked terminal cannot fabricate successful input.
      try { while (fs.readSync(m, Buffer.alloc(8192), 0, 8192, null)) { /* drain */ } } catch { /* EAGAIN/EIO */ }
      if (fs.existsSync(log) && fs.readFileSync(log, 'utf8').includes(`"event":"${event}"`)) return;
      if (closed) break;
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error(`Missing terminal event ${event}`);
  };
  try {
    if (logFailure) {
      await closedPromise; assert.equal(child.exitCode, 1);
      assert.equal(attrs(s, after), 0); assert.deepEqual(after, before); return;
    }
    await waitEvent('ready');
    fs.writeSync(m, '\x1b[A中文 é 👩🏽‍💻'); await waitEvent('key');
    size.writeUInt16LE(24, 0); size.writeUInt16LE(90, 2);
    assert.equal(lib.func('int ioctl(int fd, unsigned long request, ...)')(m, process.platform === 'darwin' ? 0x80087467 : 0x5414, 'void *', size), 0);
    child.kill('SIGWINCH'); await new Promise(r => setTimeout(r, 100));
    if (columns === 120) child.kill('SIGTERM');
    else if (columns === 32) fs.writeSync(m, '\x03');
    else fs.writeSync(m, '\x13');
    await waitEvent('restored'); await closedPromise;
    const events = fs.readFileSync(log, 'utf8').trim().split('\n').map(s => JSON.parse(s));
    assert.ok(events.some(e => e.event === 'resize' && e.data[0] === 90));
    assert.ok(events.some(e => e.event === 'key' && e.data.includes('中文')));
    assert.equal(attrs(s, after), 0); assert.deepEqual(after, before, 'terminal attributes must be restored');
    assert.equal(child.exitCode, columns === 120 ? 143 : columns === 32 ? 130 : 0);
  } finally {
    if (!closed) { child.kill('SIGKILL'); await closedPromise; }
    fs.closeSync(m); fs.closeSync(s); fs.rmSync(temp, { recursive: true, force: true });
  }
});
