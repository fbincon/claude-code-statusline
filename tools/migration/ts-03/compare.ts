import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, decode, isLosslessNumber } from '@fbincon/statusline-core/json';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { checkBaseline, fixtures, repoRoot } from './common.js';

export interface Difference { case: string; path: string; before_sha256: string; after_sha256: string; reason: string }
export function compare(expected: unknown, actual: unknown, differences: readonly Difference[] = []): string[] {
  const errors: string[] = [], used = new Set<Difference>();
  const permitted = new Map<string, string>([['cli-help', '/value/stdout'], ['cli-unknown-command', '/value/stderr'], ['cli-config-refused', '/value/stderr']]);
  for (const d of differences) {
    if (permitted.get(d.case) !== d.path || !d.reason || !/^[a-f0-9]{64}$/.test(d.before_sha256) || !/^[a-f0-9]{64}$/.test(d.after_sha256)) throw new Error('Unapproved comparison exemption');
    if (differences.filter(x => x.case === d.case && x.path === d.path).length !== 1) throw new Error('Duplicate comparison exemption');
  }
  function walk(a: unknown, b: unknown, path: string, id: string) {
    if (canonical(a) === canonical(b)) return;
    const allowed = differences.find(x => x.case === id && x.path === path);
    if (allowed && typeof a === 'string' && typeof b === 'string' && sha256(a) === allowed.before_sha256 && sha256(b) === allowed.after_sha256) { used.add(allowed); return; }
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      a.forEach((value, i) => walk(value, b[i], path + '/' + i, id)); return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b) && !isLosslessNumber(a) && !isLosslessNumber(b)) {
      const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) errors.push(`${id}${path}/${key}: missing or extra field`);
        else walk(left[key], right[key], path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'), id);
      }
      return;
    }
    errors.push(`${id}${path}: value or type differs`);
  }
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object' || Array.isArray(expected) || Array.isArray(actual)) throw new Error('Expected case maps');
  const left = expected as Record<string, unknown>, right = actual as Record<string, unknown>;
  for (const id of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!Object.hasOwn(left, id) || !Object.hasOwn(right, id)) errors.push(`${id}: missing or extra case`);
    else walk(left[id], right[id], '', id);
  }
  for (const d of differences) if (!used.has(d)) errors.push(`${d.case}${d.path}: stale comparison exemption`);
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkBaseline();
  if (process.argv.length !== 3) throw new Error('Usage: migration:compare CANDIDATE.json');
  const expected = decode(readFileSync(join(fixtures, 'expected.json'), 'utf8'));
  const actual = decode(readFileSync(process.argv[2]!, 'utf8'));
  const differences = JSON.parse(readFileSync(join(repoRoot, 'tools/migration/ts-03/differences.json'), 'utf8')) as Difference[];
  const errors = compare(expected, actual, differences);
  console.log(JSON.stringify({ status: errors.length ? 'fail' : 'pass', cases: Object.keys(expected as object).length, differences: differences.length, errors }));
  process.exitCode = errors.length ? 1 : 0;
}
