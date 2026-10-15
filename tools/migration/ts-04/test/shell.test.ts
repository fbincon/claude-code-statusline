import test from 'node:test';
import assert from 'node:assert/strict';
import { POWERSHELL_FLAGS, runShell, powershellEnvironment, powershellIsolation } from '../shell.js';

test('PowerShell bootstraps OS folders while child Node retains isolated literal paths', () => {
  const isolated = { HOME: "C:/isolated 中文 ' $` &", USERPROFILE: 'C:/isolated', PATH: 'C:/node-only', CLAUDE_CONFIG_DIR: 'C:/temporary-config' };
  const actual = powershellEnvironment({ ...isolated, PSModulePath: 'C:/PowerShell/7/Modules' }, { USERPROFILE: 'C:/Users/runner', LOCALAPPDATA: 'C:/Users/runner/AppData/Local', ProgramFiles: 'C:/Program Files' });
  assert.equal(actual.USERPROFILE, 'C:/Users/runner'); assert.equal(actual.HOME, undefined);
  assert.equal(actual.PATH, isolated.PATH); assert.equal(actual.CLAUDE_CONFIG_DIR, isolated.CLAUDE_CONFIG_DIR);
  assert.equal(actual.ProgramFiles, 'C:/Program Files'); assert.equal(actual.PSModulePath, undefined);
  const command = powershellIsolation(isolated);
  assert.ok(command.includes("$env:HOME = 'C:/isolated 中文 '' $` &';"));
  assert.ok(command.includes("$env:USERPROFILE = 'C:/isolated';"));
  assert.equal(command.includes('Remove-Item'), false);
  assert.equal(command.includes('LOCALAPPDATA'), false);
  assert.ok(powershellIsolation({}).includes('$env:HOME = $null;'));
});

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
