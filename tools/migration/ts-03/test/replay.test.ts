import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { decode } from '@fbincon/statusline-core/json';
import { compare, type Difference } from '../compare.js';
import { lifecycleReplayDifference } from '../task-lifecycle-compatibility.js';
import { fixtures, repoRoot } from '../common.js';

test('implemented frozen cases replay independently with three approved CLI wording differences and bounded release identity changes', { skip: process.platform !== 'linux' }, t => {
  const root = mkdtempSync(join(tmpdir(), 'ts03-replay-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, 'capture');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../capture.js', import.meta.url)), output], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(readFileSync(join(output, 'receipt.json'), 'utf8'));
  assert.equal(receipt.completed, 161);
  assert.equal(receipt.pending.length, 0);
  const expected = decode(readFileSync(join(fixtures, 'expected.json'), 'utf8')) as Record<string, unknown>;
  const actual = decode(readFileSync(join(output, 'results.json'), 'utf8')) as Record<string, unknown>;
  const differences = JSON.parse(readFileSync(join(repoRoot, 'tools/migration/ts-03/differences.json'), 'utf8')) as Difference[];
  assert.equal(differences.length, 3);
  assert.deepEqual(compare(Object.fromEntries(Object.keys(actual).map(id => [id, expected[id]])), actual, differences), []);
});

test('lifecycle compatibility admits the specific inline report change, not other field or scope differences', () => {
  const before = { prompt_id: 'p', status: 'running', pending_agent_reports: ['a'] };
  const after = { ...before, pending_agent_reports: [], agent_evidence: { a: { started_wall_ns: 2000000000n } } };
  const path = '/value/1/state';
  assert.equal(lifecycleReplayDifference('lifecycle-interrupted', path, before, after), true);
  assert.equal(lifecycleReplayDifference('lifecycle-interrupted', path, before, { ...after, status: 'completed' }), false);
  assert.equal(lifecycleReplayDifference('lifecycle-interrupted', path, before, { ...after, unknown_evidence: true }), false);
  assert.equal(lifecycleReplayDifference('lifecycle-interrupted', '/value/0/state', before, after), false);
  assert.equal(lifecycleReplayDifference('unrelated-case', path, before, after), false);
});
