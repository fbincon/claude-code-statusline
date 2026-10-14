import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { decode, encode, integer, safeInteger, canonical, pythonFloat, finiteNumber } from '../src/json.js';

test('numeric lexemes retain integer kind and values above JavaScript precision', () => {
  for (const raw of ['9007199254740993', '-9223372036854775808', '18446744073709551615', '100000000000000000000000000000000000001']) {
    assert.equal(integer(decode(raw)), BigInt(raw)); assert.equal(encode(decode(raw)), raw);
  }
  for (const raw of ['1.0', '1e0', 'true', 'null', '"1"']) assert.throws(() => integer(decode(raw)));
  assert.throws(() => safeInteger(decode('9007199254740993')));
  assert.equal(finiteNumber(decode('1.5')), 1.5);
  assert.throws(() => finiteNumber(decode('1e400')));
});

test('strict parsing rejects nested and escaped duplicates and nonfinite constants', () => {
  for (const raw of ['{"x":1,"x":2}', '{"a":{"x":1,"x":1}}', '{"a":1,"\\u0061":1}', 'NaN', 'Infinity', '{']) assert.throws(() => decode(raw));
  assert.equal(encode(decode('\ufeff{"n":null,"z":0}')), '{"n":null,"z":0}');
  const special = decode('{"__proto__":{"polluted":true},"constructor":1}') as object;
  assert.ok(Object.hasOwn(special, '__proto__'));
  assert.equal(Object.getPrototypeOf(special), Object.prototype);
});

test('untrusted objects cannot impersonate numbers or silently change serialized values', () => {
  const raw = '{"isLosslessNumber":true,"value":"9007199254740993","__proto__":0}';
  const value = decode(raw);
  assert.equal(encode(value), raw);
  assert.throws(() => integer(value));
  assert.match(canonical(value), /"isLosslessNumber":true/);
  for (const invalid of [NaN, Infinity, undefined, { value: undefined }, [undefined], new Array(1), new Date()]) assert.throws(() => encode(invalid));
});

test('canonical serialization retains float kind, negative zero, scalar sorting and UTF-8', () => {
  const raw = '{"𐀀":9007199254740993,"\ue000":null,"n":-0.0,"f":1.0,"e":1e-7,"label":"中文 é 👩🏽‍💻"}';
  const expected = execFileSync(process.env.TS03_PYTHON || 'python3', ['-c',
    'import json,sys; print(json.dumps(json.load(sys.stdin),ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False))'], { input: raw, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } }).trim();
  assert.equal(canonical(decode(raw)), expected);
  assert.notEqual(canonical(decode('1')), canonical(decode('1.0')));
  assert.throws(() => canonical(decode('1e400')));
  assert.throws(() => canonical('\ud800'));
  const circular: unknown[] = []; circular.push(circular); assert.throws(() => canonical(circular));
  assert.throws(() => canonical(new Date()));
});

test('Python float formatting agrees on deterministic IEEE-754 samples and boundary values', () => {
  const values = [-0, 0, 1, -1, 0.0001, 0.00001, 1e15, 1e16, 1e23, Number.MIN_VALUE, Number.MAX_VALUE];
  let state = 0x9e3779b97f4a7c15n;
  for (let i = 0; i < 4096; i++) {
    state = BigInt.asUintN(64, state ^ (state << 13n)); state ^= state >> 7n; state = BigInt.asUintN(64, state ^ (state << 17n));
    const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(state);
    const value = bytes.readDoubleBE(); if (Number.isFinite(value)) values.push(value);
  }
  const hex = values.map(value => { const bytes = Buffer.alloc(8); bytes.writeDoubleBE(value); return bytes.toString('hex'); });
  const expected: string[] = JSON.parse(execFileSync(process.env.TS03_PYTHON || 'python3', ['-c',
    'import json,sys,struct; print(json.dumps([repr(struct.unpack(">d",bytes.fromhex(h))[0]) for h in json.load(sys.stdin)]))'], { input: JSON.stringify(hex), encoding: 'utf8' }));
  values.forEach((value, i) => assert.equal(pythonFloat(value), expected[i], hex[i]));
});
