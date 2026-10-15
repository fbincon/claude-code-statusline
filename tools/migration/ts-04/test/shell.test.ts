import test from 'node:test';
import assert from 'node:assert/strict';
import { POWERSHELL_FLAGS, runShell } from '../shell.js';

test('shell acceptance closes stdin and records abnormal exits without hiding diagnostics', () => {
  assert.ok(POWERSHELL_FLAGS.includes('-NonInteractive'));
  const closed = runShell(process.execPath, ['-e', 'process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write("closed"))'], 'stdin', process.env);
  assert.equal(closed.result.stdout, 'closed');
  assert.equal(closed.receipt.status, 0);
  const failed = runShell(process.execPath, ['-e', 'process.stderr.write("diagnostic"); process.exit(7)'], 'failure', process.env);
  assert.equal(failed.receipt.status, 7);
  assert.equal(failed.receipt.stderr, 'diagnostic');
  const absent = runShell('statusline-nonexistent-shell', [], 'missing', process.env);
  assert.equal(absent.receipt.error?.code, 'ENOENT');
  assert.equal(absent.receipt.status, null);
});
