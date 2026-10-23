import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { sameFileIdentity, fileIdentity, FileChangedError } from '@fbincon/statusline-platform/files';
import { readRegular } from '../src/recovery/journal.js';
import { setup, writeFileSync, join } from './final-support.js';

test('Windows volume serial width differences preserve exact file identity', () => {
  const path = { dev: 0x12345678deadbeefn, ino: 9007199254740993n };
  const descriptor = { dev: 0xdeadbeefn, ino: path.ino };
  assert(sameFileIdentity(path, descriptor, true));
  assert(!sameFileIdentity(path, descriptor, false));
  assert(!sameFileIdentity(path, { ...descriptor, ino: path.ino - 1n }, true));
  assert(!sameFileIdentity(path, { ...descriptor, dev: 0xdeadbeeen }, true));
  assert(sameFileIdentity(path, path, false));
});

test('recovery readers accept private regular files across supported Node versions', t => {
  const f = setup(t), path = join(f.root, 'regular 中文.json');
  const raw = Buffer.from('{"value":"中文"}\n'); writeFileSync(path, raw, { mode: 0o600 });
  assert.deepEqual(readRegular(path), raw);
  assert.throws(() => readRegular(path, raw.length - 1), /oversized/);
});

test('Windows native path identity supplies a real volume and rejects replacement', { skip: process.platform !== 'win32' }, t => {
  const f = setup(t), path = join(f.root, 'identity 中文.json');
  writeFileSync(path, '{}', { mode: 0o600 });
  const stat = fs.lstatSync(path, { bigint: true }), identity = fileIdentity(path, { ...stat, dev: 0n });
  const fd = fs.openSync(path, 'r');
  try { assert(sameFileIdentity(identity, fs.fstatSync(fd, { bigint: true }))); }
  finally { fs.closeSync(fd); }
  fs.renameSync(path, path + '.before');
  writeFileSync(path, '{}', { mode: 0o600 });
  assert.throws(() => fileIdentity(path, stat), error => error instanceof FileChangedError && /File changed/.test(error.message));
});
