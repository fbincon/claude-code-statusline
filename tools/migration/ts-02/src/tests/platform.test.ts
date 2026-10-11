import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sample, processToken, processMatches, delta, trusted } from '../clocks.js';
import { decode, encode, integer, revision } from '../json.js';
import { atomicWrite, lock, isLinkOrReparse, retryWindows } from '../files.js';
import { run, binding, nodeBinding, rebindFixture } from '../launch.js';
import { frame } from '../terminal.js';
import { render } from '../render.js';
import { displayWidth, clip } from '../generated/unicode.js';
import { library, koffi } from '../native.js';
import { exportReference, python, packageRoot, cli } from '../context.js';

const temporary = fs.mkdtempSync(join(tmpdir(), 'ts02-中文 space-'));
let oracleRoot: string;
let env: NodeJS.ProcessEnv;
const oracleScript = join(packageRoot, 'scripts/oracle.py');
before(() => { oracleRoot = exportReference(); env = { ...process.env, TS02_REFERENCE_ROOT: oracleRoot, PYTHONDONTWRITEBYTECODE: '1' }; });
after(() => { fs.rmSync(temporary, { recursive: true, force: true }); if (oracleRoot) fs.rmSync(oracleRoot, { recursive: true, force: true }); });
function oracle(args: string[], input = '') {
  return execFileSync(python, [oracleScript, ...args], { input, env, encoding: 'utf8' });
}
test('integer lexemes survive above 2^53, signed/unsigned 64-bit, and arbitrary Python integers', () => {
  for (const raw of ['9007199254740993', '-9223372036854775808', '18446744073709551615', '100000000000000000000000000000000000001']) {
    assert.equal(integer(decode(raw)), BigInt(raw)); assert.equal(encode(decode(raw)), raw);
  }
  for (const raw of ['1.0', '1e0', 'true', 'null', '"1"']) assert.throws(() => integer(decode(raw)));
});
test('strict JSON rejects duplicates and nonfinite inputs without collapsing null/zero/missing', () => {
  for (const raw of ['{"x":1,"x":2}', '{"a":{"x":1,"x":1}}', 'NaN', 'Infinity', '{']) assert.throws(() => decode(raw));
  assert.equal(encode(decode('{"n":null,"z":0}')), '{"n":null,"z":0}');
  assert.throws(() => decode('{"a":1,"\\u0061":1}'));
  const special = decode('{"__proto__":{"polluted":true},"constructor":1}') as object;
  assert.ok(Object.hasOwn(special, '__proto__')); assert.equal(Object.getPrototypeOf(special), Object.prototype);
});
test('canonical hash matches Python Unicode codepoint sorting and exact integers', () => {
  const raw = '{"revision_version":1,"𐀀":9007199254740993,"\ue000":null,"label":"中文 é 👩🏽‍💻","b":false,"a":[0,1]}';
  assert.equal(revision(decode(raw)), oracle(['revision'], raw).trim());
  assert.throws(() => revision(decode('{"a":1.0}')), /Float canonicalization/);
});
test('native boot clock and process identity match frozen Python on this platform', () => {
  const a = sample();
  const expected = decode(oracle(['clock', String(process.pid)])) as Record<string, unknown>;
  const b = sample();
  assert.ok(a.boot_id); assert.ok(a.boot_ns !== null);
  assert.equal(b.boot_id, a.boot_id); assert.equal(expected.boot_id, a.boot_id);
  assert.ok(integer(expected.boot_ns) >= a.boot_ns! && integer(expected.boot_ns) <= b.boot_ns!);
  assert.ok(integer(expected.wall_ns) >= a.wall_ns && integer(expected.wall_ns) <= b.wall_ns);
  assert.equal(processToken(process.pid), expected.token);
  assert.equal(processToken(-1), null); assert.equal(processToken(1.2), null);
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
  for (const name of fs.readdirSync(temporary).filter(x => x.startsWith(`.crash-${stage}.ts02-`))) fs.unlinkSync(join(temporary, name));
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
  assert.ok(h && koffi.address(h) !== 0xffffffffffffffffn);
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
test('upgrade fixture retains opt-outs/unrelated settings and restores byte-identical backup on interruption', () => {
  const previous = { executable: 'old-python.exe', args: [] }, next = nodeBinding(cli);
  for (const fail of [false, true]) {
    const path = join(temporary, `settings-${fail}.json`);
    const before = JSON.stringify({ owner: 'ts02-fixture', binding: previous, disabled: true, unrelated: { x: 1 } }, null, 2);
    fs.writeFileSync(path, before);
    if (fail) { assert.throws(() => rebindFixture(path, previous, next, true)); assert.equal(fs.readFileSync(path, 'utf8'), before); }
    else { rebindFixture(path, previous, next); const value = JSON.parse(fs.readFileSync(path, 'utf8')); assert.equal(value.disabled, true); assert.deepEqual(value.unrelated, { x: 1 }); }
    assert.equal(fs.readFileSync(path + '.backup', 'utf8'), before);
    assert.throws(() => rebindFixture(path, previous, next));
  }
});
test('minimal installed-style render matches TS-01 bytes and Python oracle with real config/input', () => {
  const fixture = JSON.parse(fs.readFileSync(join(packageRoot, 'fixtures/render.json'), 'utf8'));
  const path = join(packageRoot, 'fixtures/model.json'); const raw = fixture.source_case.input.stdin;
  assert.equal(render(raw, path, 80), fixture.expected.stdout);
  assert.equal(render(raw, path, 80), oracle(['render', path, '80'], raw));
  assert.equal(render('{', path, 80), ''); assert.equal(render('[]', path, 80), '');
  assert.notEqual(render('{"model":{"id":"changed"}}', path, 80), fixture.expected.stdout);
});
test('fixed Unicode cells, viewport bounds and UTF-8 byte cursors', () => {
  const text = '中文 é 👩🏽‍💻'; assert.equal(displayWidth(text), 9);
  assert.notEqual(Buffer.byteLength(text), text.length); assert.equal(clip(text, 5), '中文…');
  for (const [w, h] of [[64, 18], [64, 20], [80, 24], [120, 30], [80, 48], [32, 12]]) {
    assert.ok(displayWidth(frame(w!, h!).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')) < w!);
  }
  const data = Buffer.from(text + '\nnext\n'); const end = data.indexOf(10) + 1;
  assert.equal(data.subarray(end).toString(), 'next\n');
});
