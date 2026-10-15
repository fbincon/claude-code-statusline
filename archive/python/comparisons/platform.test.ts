import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, windowsBootId } from '@fbincon/statusline-platform/clocks';
import { processToken, processMatches } from '@fbincon/statusline-platform/processes';
import { delta, trusted } from '@fbincon/statusline-core/timing/sample';
import { decode, integer } from '@fbincon/statusline-core/json';
import { atomicWrite, lock, withLock, durableUnlink, isLinkOrReparse, retryWindows } from '@fbincon/statusline-platform/files';
import { run, binding, nodeBinding } from '@fbincon/statusline-platform/launch';
import { library, nativeApi } from '@fbincon/statusline-platform/native';
import { architecture } from '@fbincon/statusline-platform/architecture';
import { exportReference, python, repoRoot } from '../common.js';

const cli = fileURLToPath(new URL('./child.js', import.meta.url));
const temporary = fs.mkdtempSync(join(tmpdir(), 'ts03-中文 space-'));
let oracleRoot: string;
let env: NodeJS.ProcessEnv;
const oracleScript = join(repoRoot, 'tools/migration/ts-02/scripts/oracle.py');
before(() => {
  oracleRoot = exportReference();
  env = Object.fromEntries(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TMP', 'TEMP', 'TMPDIR', 'LD_LIBRARY_PATH']
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  Object.assign(env, { TS02_REFERENCE_ROOT: oracleRoot, PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1',
    CLAUDE_CONFIG_DIR: join(temporary, 'config'), CLAUDE_STATUSLINE_RUNTIME_DIR: join(temporary, 'runtime'),
    HOME: join(temporary, 'home'), USERPROFILE: join(temporary, 'home') });
});
after(() => { fs.rmSync(temporary, { recursive: true, force: true }); if (oracleRoot) fs.rmSync(oracleRoot, { recursive: true, force: true }); });
function oracle(args: string[], input = '') { return execFileSync(python, [oracleScript, ...args], { input, env, encoding: 'utf8' }); }
test('architecture evidence distinguishes native machine from process ABI', () => {
  const result = architecture(); assert.equal(result.process_arch, process.arch);
  if (process.env.TS03_EXPECT_PROCESS_ARCH) assert.equal(result.process_arch, process.env.TS03_EXPECT_PROCESS_ARCH);
  assert.ok(['x64', 'arm64'].includes(result.host_arch));
  if (process.platform === 'win32') assert.equal(result.architecture_source, 'IsWow64Process2');
  if (process.env.TS03_EXPECT_HOST_ARCH) assert.equal(result.host_arch, process.env.TS03_EXPECT_HOST_ARCH);
});
test('native clock matches frozen Python except the explicit Windows boot-domain fix', () => {
  const a = sample();
  const expected = decode(oracle(['clock', String(process.pid)])) as Record<string, unknown>;
  const b = sample();
  assert.ok(a.boot_id); assert.ok(a.boot_ns !== null);
  assert.equal(b.boot_id, a.boot_id);
  if (process.platform === 'win32') {
    // Retain the frozen GUID-only result as evidence of the intentional change.
    assert.match(String(expected.boot_id), /^windows:[0-9a-f-]{36}$/);
    assert.ok(a.boot_id!.startsWith('windows:v2:' + String(expected.boot_id).slice(8) + ':'));
    const fixed = decode(execFileSync(python, [join(repoRoot, 'tools/migration/ts-02/scripts/current-clock.py'), String(process.pid)], { env, encoding: 'utf8' })) as Record<string, unknown>;
    assert.equal(a.boot_id, fixed.boot_id);
    assert.equal(fixed.token, expected.token);
    const independent = decode(execFileSync(process.execPath, [cli, 'clock'], { env, encoding: 'utf8' })) as Record<string, unknown>;
    assert.equal(a.boot_id, independent.boot_id);
  } else assert.equal(expected.boot_id, a.boot_id);
  assert.ok(integer(expected.boot_ns) >= a.boot_ns! && integer(expected.boot_ns) <= b.boot_ns!);
  assert.ok(integer(expected.wall_ns) >= a.wall_ns && integer(expected.wall_ns) <= b.wall_ns);
  assert.equal(processToken(process.pid), expected.token);
  assert.equal(processToken(-1), null); assert.equal(processToken(1.2), null);
});
test('Windows boot sequence distinguishes a repeated GUID and rejects unavailable identity', () => {
  const environment = Buffer.alloc(32, 1), sequence = Buffer.alloc(4);
  sequence.writeUInt32LE(41); const first = windowsBootId(environment, sequence);
  sequence.writeUInt32LE(42); const second = windowsBootId(environment, sequence);
  assert.notEqual(first, second);
  const start = { wall_ns: 1000n, boot_ns: 100n, boot_id: first };
  assert.equal(delta(start, { wall_ns: 2000n, boot_ns: 5n, boot_id: second }), 1000n);
  assert.equal(trusted(start, { wall_ns: 2000n, boot_ns: 500n, boot_id: second }), false);
  assert.equal(delta(start, { wall_ns: 1n, boot_ns: 120n, boot_id: first }), 20n);
  for (const [envBytes, seqBytes] of [[Buffer.alloc(32), sequence], [environment, Buffer.alloc(4)], [environment.subarray(1), sequence], [environment, sequence.subarray(1)]]) {
    assert.throws(() => windowsBootId(envBytes!, seqBytes!), /unavailable/);
  }
});
test('captured reboot with legacy Windows GUID falls back without claiming a trusted boot', () => {
  const fixture = decode(fs.readFileSync(join(repoRoot, 'tools/migration/ts-02/fixtures/windows-reboot.json'), 'utf8')) as { before: Record<string, unknown>; after: Record<string, unknown> };
  const convert = (s: Record<string, unknown>) => ({ wall_ns: integer(s.wall_ns), boot_ns: integer(s.boot_ns), boot_id: String(s.boot_id) });
  const start = convert(fixture.before), end = convert(fixture.after);
  assert.equal(start.boot_id, end.boot_id); assert.ok(end.boot_ns < start.boot_ns);
  assert.equal(delta(start, end), end.wall_ns - start.wall_ns);
  assert.equal(trusted(start, end), false);
  assert.equal(trusted(start, { ...end, boot_ns: start.boot_ns + 1n }), false);
  assert.equal(delta(start, { ...end, wall_ns: start.wall_ns - 1n }), null);
});
test('unavailable clocks, wall adjustment, reboot and frozen integer semantics', () => {
  const a = { wall_ns: 2000000000000000001n, boot_ns: 10n, boot_id: 'one' };
  const b = { wall_ns: 1n, boot_ns: 100n, boot_id: 'one' };
  assert.equal(delta(a, b), 90n); assert.ok(trusted(a, b));
  assert.equal(delta(a, { ...b, boot_id: 'two' }), null); assert.equal(trusted(a, { ...b, boot_id: 'two' }), false);
  assert.equal(sample(() => { throw new Error('unavailable'); }).boot_id, null);
  assert.equal(integer((decode('{"frozen_ns":9007199254740993}') as Record<string, unknown>).frozen_ns), 9007199254740993n);
});
test('exited process is not live even when Windows retains its creation identity', async () => {
  const child = spawn(process.execPath, [cli, 'wait']);
  const close = once(child, 'close');
  const token = processToken(child.pid!); assert.ok(token); child.kill('SIGKILL'); await close;
  assert.equal(processMatches(child.pid!, token), false);
  const retained = processToken(child.pid!); assert.ok(retained === null || retained === token);
});
test('TS and Python independent writers serialize updates using the same lock file', async () => {
  const path = join(temporary, 'counter'); fs.writeFileSync(path, '0');
  const jobs = Array.from({ length: 16 }, (_, i) => i % 2
    ? run({ executable: python, args: [oracleScript] }, ['lock', path + '.lock', 'increment', path], '', 15000, env)
    : run(nodeBinding(cli), ['lock', path + '.lock', 'increment', path], '', 15000));
  for (const result of await Promise.all(jobs)) assert.equal(result.code, 0, result.stderr);
  assert.equal(fs.readFileSync(path, 'utf8'), '16');
});
for (const pythonFirst of [true, false]) test(`mixed lock blocks until holder death: Python first=${pythonFirst}`, async () => {
  const path = join(temporary, `death-${pythonFirst}.lock`);
  const holder = spawn(pythonFirst ? python : process.execPath, [...(pythonFirst ? [oracleScript] : [cli]), 'lock', path, 'hold'], { env });
  const closed = once(holder, 'close');
  await Promise.race([once(holder.stdout, 'data'), new Promise((_, reject) => setTimeout(() => reject(new Error('holder did not lock')), 10000).unref())]);
  const waiter = run(pythonFirst ? nodeBinding(cli) : { executable: python, args: [oracleScript] }, ['lock', path, 'once'], '', 10000, env);
  let ended = false; void waiter.then(() => { ended = true; });
  await new Promise(r => setTimeout(r, 250)); assert.equal(ended, false);
  holder.kill('SIGKILL'); await closed;
  const result = await waiter; assert.equal(result.code, 0, result.stderr); assert.equal(result.stdout.trim(), 'locked');
});
test('atomic replacement failure preserves old bytes and cleans private temporary files', () => {
  const path = join(temporary, 'atomic'); fs.writeFileSync(path, 'old');
  for (const point of ['written', 'synced', 'before-replace']) {
    assert.throws(() => atomicWrite(path, 'new', stage => { if (stage === point) throw new Error('fault'); }));
    assert.equal(fs.readFileSync(path, 'utf8'), 'old');
    assert.equal(fs.readdirSync(temporary).filter(x => x.startsWith('.atomic.')).length, 0);
  }
  atomicWrite(path, 'complete'); assert.equal(fs.readFileSync(path, 'utf8'), 'complete');
  if (process.platform !== 'win32') assert.equal(fs.statSync(path).mode & 0o777, 0o600);
});
for (const stage of ['synced', 'replaced']) test(`killed writer leaves only complete old/new data at ${stage}`, async () => {
  const path = join(temporary, `crash-${stage}`); fs.writeFileSync(path, 'old');
  const child = spawn(process.execPath, [cli, 'crash-write', path, stage]); const closed = once(child, 'close');
  await once(child.stdout, 'data'); child.kill('SIGKILL'); await closed;
  assert.equal(fs.readFileSync(path, 'utf8'), stage === 'synced' ? 'old' : 'new-complete-value');
  // Abrupt death cannot execute finally: orphan cleanup is confined to this run.
  for (const name of fs.readdirSync(temporary).filter(x => x.startsWith(`.crash-${stage}.statusline-`))) fs.unlinkSync(join(temporary, name));
});
test('Windows transient retry is bounded and permanent errors are not retried', () => {
  let count = 0; const delays: number[] = [];
  retryWindows(() => { if (++count < 4) throw Object.assign(new Error('sharing'), { winerror: 32 }); }, true, ms => { delays.push(ms); return 'ok'; });
  assert.deepEqual(delays, [10, 20, 40]);
  assert.throws(() => retryWindows(() => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); }, true));
});
test('real Windows sharing denial preserves old bytes then replacement recovers', { skip: process.platform !== 'win32' }, () => {
  const path = join(temporary, 'sharing'); fs.writeFileSync(path, 'old');
  const k = library('kernel32.dll');
  const h = k.func('void *CreateFileW(const char16_t *path, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *template)')(path, 0x80000000, 1, null, 3, 0x80, null);
  assert.ok(h && nativeApi().address(h) !== 0xffffffffffffffffn);
  try { assert.throws(() => atomicWrite(path, 'new')); }
  finally { k.func('bool CloseHandle(void *handle)')(h); }
  assert.equal(fs.readFileSync(path, 'utf8'), 'old');
  atomicWrite(path, 'new'); assert.equal(fs.readFileSync(path, 'utf8'), 'new');
});
test('symlink/reparse publication and locks cannot overwrite another file', () => {
  const target = join(temporary, 'target'); const link = join(temporary, 'link'); fs.writeFileSync(target, 'safe');
  fs.symlinkSync(target, link); assert.ok(isLinkOrReparse(link));
  assert.throws(() => lock(link)); assert.throws(() => atomicWrite(link, 'bad'));
  assert.equal(fs.readFileSync(target, 'utf8'), 'safe');
});
test('binding preserves legacy executable and environment override replaces the full binding', () => {
  assert.deepEqual(binding({ backendExecutable: 'old.exe' }), { executable: 'old.exe', args: [] });
  assert.deepEqual(binding({ backendExecutable: 'node', backendArgs: ['entry.js'] }, 'other.exe'), { executable: 'other.exe', args: [] });
  assert.throws(() => binding({ backendExecutable: 'bad\ncommand' }));
});
test('argv and input bytes survive spaces, Unicode and shell metacharacters without a shell', async () => {
  const args = ['中文 path', 'a&b', '$(false)', '`false`', '"quote"', ''];
  const result = await run(nodeBinding(cli), ['echo', ...args], '中文\n9007199254740993');
  assert.equal(result.code, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), { args, stdin: '中文\n9007199254740993' });
  const timeout = await run(nodeBinding(cli), ['wait'], '', 200); assert.ok(timeout.timedOut);
});

test('synchronous lock ownership releases on throws and rejects recursive acquisition', () => {
  const path = join(temporary, 'recursive.lock');
  assert.throws(() => withLock(path, () => withLock(path, () => 1)), /Recursive/);
  assert.equal(withLock(path, () => 42), 42);
  assert.throws(() => withLock(path, () => Promise.resolve(1)), /synchronous/);
  assert.equal(withLock(path, () => 43), 43);
  const release = lock(path); release(); release();
});
test('durable deletion does not follow links and tolerates absence', () => {
  const path = join(temporary, 'unlink'); atomicWrite(path, 'one'); durableUnlink(path);
  assert.equal(fs.existsSync(path), false); durableUnlink(path);
});
