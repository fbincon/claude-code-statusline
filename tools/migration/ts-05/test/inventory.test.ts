import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLedger, inventory, type Ledger, type Snapshot } from '../inventory.js';

test('TS-05 inventory accounts for every current Python test and tool', () => {
  const counts = inventory();
  assert.equal(counts.tests!.total, 856);
  assert.equal(counts.tools!.total, 62);
});
test('responsibility validation rejects omitted, duplicate, unproven and pending work', () => {
  const snapshot: Snapshot = { commit: 'fixed', tests: [{ id: 'test', path: 'tests/test.py', stage: 'TS-05' }], tools: ['tools/tool.py'], sources: {} };
  const ledger: Ledger = { format_version: 1, snapshot_commit: 'fixed', tests: [{ id: 'test', status: 'ported', tests: ['tools/test.ts'], reason: null }], tools: [{ id: 'tools/tool.py', status: 'ported', replacement: 'tools/tool.ts', tests: ['tools/test.ts'], reason: null }] };
  const read = () => 'evidence';
  assert.equal(validateLedger(ledger, snapshot, true, read).tests!.ported, 1);
  const changed = () => structuredClone(ledger);
  let broken = changed(); broken.tests = []; assert.throws(() => validateLedger(broken, snapshot, true, read), /Missing/u);
  broken = changed(); broken.tests.push(broken.tests[0]!); assert.throws(() => validateLedger(broken, snapshot, true, read), /duplicate/u);
  broken = changed(); broken.tools[0]!.replacement = null; assert.throws(() => validateLedger(broken, snapshot, true, read), /replacement/u);
  broken = changed(); broken.tests[0]!.status = 'retired'; assert.throws(() => validateLedger(broken, snapshot, true, read), /rationale/u);
  broken = changed(); broken.tests[0]!.status = 'pending'; assert.throws(() => validateLedger(broken, snapshot, true, read), /pending/u);
});
