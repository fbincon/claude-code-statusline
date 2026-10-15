import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkBaseline, fixtures, repoRoot, reference } from '../ts-03/common.js';

export interface Entry {
  id: string;
  origin: 'TS-01' | 'TS-03';
  kind: 'complete' | 'remaining';
  status: 'pending' | 'ported' | 'retired';
  tests: string[];
  reason: string | null;
  assertions?: string;
}
export interface Ledger { reference: string; tests: Entry[] }
export function validateLedger(ledger: Ledger, complete = false, read = (path: string) => readFileSync(join(repoRoot, path), 'utf8')) {
  const baseline = JSON.parse(read('tests/fixtures/migration/ts-01/baseline.json'));
  const handoff = JSON.parse(read('tools/migration/ts-03/ts04-handoff.json'));
  const expected = new Map<string, { origin: string; kind: string; assertions?: string }>();
  for (const row of baseline.test_methods) if (row.stage === 'TS-04') expected.set(row.id, { origin: 'TS-01', kind: 'complete' });
  for (const [key, kind] of [['deferred_tests', 'complete'], ['mixed_tests', 'remaining']]) {
    for (const row of handoff[key!]) expected.set(row.id, { origin: 'TS-03', kind: kind!, assertions: row.assertions });
  }
  if (ledger.reference !== reference || handoff.reference !== reference) throw new Error('TS-04 reference changed');
  const seen = new Set<string>(), counts = { total: 0, pending: 0, ported: 0, retired: 0 };
  for (const row of ledger.tests) {
    const source = expected.get(row.id);
    if (!source || seen.has(row.id) || source.kind !== row.kind || source.origin !== row.origin || source.assertions !== row.assertions) throw new Error('Invalid TS-04 responsibility: ' + row.id);
    seen.add(row.id); counts.total++;
    if (!['pending', 'ported', 'retired'].includes(row.status)) throw new Error('Invalid disposition: ' + row.id);
    counts[row.status]++;
    if (row.status !== 'pending' && !row.tests.length) throw new Error('Missing replacement evidence: ' + row.id);
    if (row.status === 'retired' && !row.reason?.trim()) throw new Error('Missing retirement rationale: ' + row.id);
    for (const path of row.tests) {
      if (!/^(packages\/|tools\/migration\/ts-04\/test\/|mods\/statusline-(?:native|runtime)\/tests\/)/u.test(path) || path.includes('..') || !path.endsWith('.test.ts')) throw new Error('Invalid test path: ' + path);
      if (!read(path).includes("test('" + row.id + "'")) throw new Error('Replacement does not name baseline assertion: ' + row.id);
    }
  }
  if (seen.size !== expected.size) throw new Error('Missing TS-04 responsibilities');
  if (complete && counts.pending) throw new Error(`${counts.pending} TS-04 assertions still pending`);
  return counts;
}
export function inventory(complete = false) {
  checkBaseline();
  return validateLedger(JSON.parse(readFileSync(join(repoRoot, 'tools/migration/ts-04/coverage.json'), 'utf8')), complete);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(inventory(process.argv.includes('--complete'))));
}
