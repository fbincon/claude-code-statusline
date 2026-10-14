import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkBaseline, fixtures, repoRoot, reference } from './common.js';

export interface Coverage { id: string; status: 'pending' | 'ported' | 'deferred'; tests: string[]; reason: string | null; stage: 'TS-03' | 'TS-04' }
export function inventory(complete = false) {
  checkBaseline();
  const baseline = JSON.parse(readFileSync(join(fixtures, 'baseline.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'tools/migration/ts-03/coverage.json'), 'utf8')) as { reference: string; tests: Coverage[] };
  if (manifest.reference !== reference) throw new Error('Coverage reference changed');
  const ids = new Set<string>(baseline.test_methods.filter((x: { stage: string }) => x.stage === 'TS-03').map((x: { id: string }) => x.id));
  const seen = new Set<string>();
  const counts = { total: 0, pending: 0, ported: 0, deferred: 0 };
  for (const row of manifest.tests) {
    if (!ids.has(row.id) || seen.has(row.id)) throw new Error(`Unknown or duplicate test: ${row.id}`);
    seen.add(row.id); counts.total++;
    if (!['pending', 'ported', 'deferred'].includes(row.status)) throw new Error(`Unknown disposition: ${row.id}`);
    counts[row.status]++;
    if (row.status === 'ported' && (!row.tests.length || row.stage !== 'TS-03')) throw new Error(`Missing TS test: ${row.id}`);
    if (row.status === 'deferred' && (!row.reason || row.stage !== 'TS-04')) throw new Error(`Unjustified deferral: ${row.id}`);
    for (const test of row.tests) {
      if ((!test.startsWith('packages/') && !test.startsWith('tools/generation/test/') && !test.startsWith('tools/migration/ts-03/test/')) || test.includes('..') || !test.endsWith('.test.ts')) throw new Error(`Invalid test path: ${test}`);
      const source = readFileSync(join(repoRoot, test), 'utf8');
      if (row.status === 'ported' && !source.includes("test('" + row.id + "'")) throw new Error(`Replacement does not name the baseline assertion: ${row.id}`);
    }
  }
  if (seen.size !== ids.size) throw new Error('Missing baseline test mappings');
  if (complete && counts.pending) throw new Error(`${counts.pending} baseline tests still pending`);
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(inventory(process.argv.includes('--complete'))));
}
