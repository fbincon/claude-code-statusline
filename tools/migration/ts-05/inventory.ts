import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { repoRoot, checkBaseline } from '../ts-03/common.js';

export interface Responsibility {
  id: string;
  status: 'pending' | 'ported' | 'retired' | 'historical';
  tests: string[];
  reason: string | null;
  replacement?: string | null;
  owner?: string;
}
export interface Ledger { format_version: number; snapshot_commit: string; tests: Responsibility[]; tools: Responsibility[] }
export interface Snapshot { commit: string; tests: { id: string; path: string; stage: string }[]; tools: string[]; sources: Record<string, string> }
export function validateLedger(ledger: Ledger, snapshot: Snapshot, complete = false, read = (name: string) => readFileSync(join(repoRoot, name), 'utf8')) {
  if (ledger.format_version !== 1 || ledger.snapshot_commit !== snapshot.commit) throw new Error('Wrong TS-05 responsibility snapshot');
  const totals: Record<string, Record<string, number>> = {};
  for (const family of ['tests', 'tools'] as const) {
    const expected = new Set(family === 'tests' ? snapshot.tests.map(row => row.id) : snapshot.tools);
    const seen = new Set<string>(), counts = { total: 0, pending: 0, ported: 0, retired: 0, historical: 0 };
    for (const row of ledger[family]) {
      if (!expected.has(row.id) || seen.has(row.id)) throw new Error('Unknown or duplicate responsibility: ' + row.id);
      seen.add(row.id); counts.total++;
      if (!['pending', 'ported', 'retired', 'historical'].includes(row.status)) throw new Error('Invalid disposition: ' + row.id);
      counts[row.status]++;
      if (row.status === 'pending') continue;
      if (!row.tests.length || (row.status !== 'ported' && !row.reason?.trim())) throw new Error('Missing evidence/rationale: ' + row.id);
      if (family === 'tools' && row.status === 'ported' && !row.replacement) throw new Error('Missing replacement: ' + row.id);
      for (const name of [...row.tests, ...(row.replacement ? [row.replacement] : [])]) {
        if (!/^(?:packages|tools|mods|archive)\//u.test(name) || name.includes('..') || !read(name).length) throw new Error('Invalid evidence path: ' + name);
      }
    }
    if (seen.size !== expected.size) throw new Error('Missing ' + family + ' responsibilities');
    if (complete && counts.pending) throw new Error(`${counts.pending} ${family} still pending`);
    totals[family] = counts;
  }
  return totals;
}
export function inventory(complete = false) {
  checkBaseline();
  const read = (name: string) => readFileSync(join(repoRoot, 'tools/migration/ts-05', name), 'utf8');
  const snapshot = read('snapshot.json');
  const expected = read('snapshot.sha256').trim();
  if (createHash('sha256').update(snapshot).digest('hex') !== expected) throw new Error('TS-05 snapshot changed');
  return validateLedger(JSON.parse(read('coverage.json')), JSON.parse(snapshot), complete);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(inventory(process.argv.includes('--complete'))));
