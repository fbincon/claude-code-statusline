import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../ts-03/common.js';
import { inventory, validateLedger, type Ledger } from '../inventory.js';
const ledger = (): Ledger => JSON.parse(readFileSync(join(repoRoot, 'tools/migration/ts-04/coverage.json'), 'utf8'));

test('TS-04 inventory covers original assignments plus complete and mixed handoff assertions', () => {
  const result = inventory();
  assert.equal(result.total, 265);
  assert.equal(result.pending + result.ported + result.retired, 265);
  const rows = ledger().tests;
  assert.equal(rows.filter(row => row.origin === 'TS-01').length, 212);
  assert.equal(rows.filter(row => row.origin === 'TS-03' && row.kind === 'complete').length, 45);
  assert.equal(rows.filter(row => row.kind === 'remaining').length, 8);
  if (result.pending) assert.throws(() => inventory(true), /still pending/);
});

test('TS-04 completion rejects missing, duplicate, unnamed and unjustified replacement evidence', () => {
  const missing = ledger(); missing.tests.pop(); assert.throws(() => validateLedger(missing), /Missing/);
  const duplicate = ledger(); duplicate.tests.push(duplicate.tests[0]!); assert.throws(() => validateLedger(duplicate), /responsibility/);
  const empty = ledger(); empty.tests[0]!.status = 'ported'; empty.tests[0]!.tests = []; assert.throws(() => validateLedger(empty), /Missing replacement/);
  const retirement = ledger(); retirement.tests[0]!.status = 'retired'; retirement.tests[0]!.tests = ['packages/core/test/binding.test.ts']; retirement.tests[0]!.reason = null; assert.throws(() => validateLedger(retirement), /rationale/);
  retirement.tests[0]!.reason = 'Test rationale'; assert.throws(() => validateLedger(retirement), /does not name/);
});
