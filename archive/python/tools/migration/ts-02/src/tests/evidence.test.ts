import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verify } from '../evidence.js';
import { reference, sha, packageRoot } from '../context.js';

test('receipt rejects changed artifacts, false test counts, source identity and policy', () => {
  const root = mkdtempSync(join(tmpdir(), 'ts02-receipt-'));
  try {
    const tap = '# tests 25\n# pass 25\n# fail 0\n# skipped 0\n';
    writeFileSync(join(root, 'tests.tap'), tap); writeFileSync(join(root, 'install.log'), 'synthetic receipt test');
    const valid = { format_version: 1, reference, status: 'pass', node: 'v24.21.0',
      policy_sha256: sha(readFileSync(join(packageRoot, 'policy.json'))),
      checks: { tests: { tests: 25, pass: 25, fail: 0, skipped: 0 }, installation: { prebuilt_native_loaded: true } },
      artifacts: { 'tests.tap': sha(tap), 'install.log': sha('synthetic receipt test') } };
    const path = join(root, 'evidence.json'); writeFileSync(path, JSON.stringify(valid)); verify(path, false);
    for (const changed of [{ ...valid, reference: 'wrong' }, { ...valid, policy_sha256: 'wrong' }, { ...valid, artifacts: {} },
      { ...valid, checks: { ...valid.checks, tests: { ...valid.checks.tests, pass: 24 } } }]) {
      writeFileSync(path, JSON.stringify(changed)); assert.throws(() => verify(path, false));
    }
    writeFileSync(path, JSON.stringify(valid)); writeFileSync(join(root, 'tests.tap'), tap + 'tampered'); assert.throws(() => verify(path, false));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
