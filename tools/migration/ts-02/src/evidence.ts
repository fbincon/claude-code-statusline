import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha, reference, sourceHashes, packageRoot } from './context.js';

export function verify(path: string, compareSource = true): void {
  const evidence = JSON.parse(readFileSync(path, 'utf8'));
  if (evidence.format_version !== 1 || evidence.reference !== reference || evidence.status !== 'pass' || evidence.node !== 'v24.21.0') throw new Error('Invalid evidence identity/status');
  if (evidence.policy_sha256 !== sha(readFileSync(join(packageRoot, 'policy.json')))) throw new Error('Changed budget');
  if (compareSource && JSON.stringify(evidence.source_hashes) !== JSON.stringify(sourceHashes())) throw new Error('Source changed after probe');
  if (evidence.checks.tests.fail !== 0 || evidence.checks.tests.pass < 19 || !evidence.checks.installation.prebuilt_native_loaded) throw new Error('Incomplete evidence');
  if (!evidence.artifacts['tests.tap'] || !evidence.artifacts['install.log']) throw new Error('Missing required evidence artifacts');
  for (const [name, hash] of Object.entries(evidence.artifacts)) {
    if (basename(name) !== name || sha(readFileSync(join(dirname(path), name))) !== hash) throw new Error('Artifact mismatch');
  }
  const tap = readFileSync(join(dirname(path), 'tests.tap'), 'utf8');
  for (const key of ['tests', 'pass', 'fail', 'skipped']) {
    if (Number(tap.match(new RegExp(`# ${key} (\\d+)`))?.[1]) !== evidence.checks.tests[key]) throw new Error('Test count mismatch');
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verify(process.argv[2]!); process.stdout.write('Verified TS-02 evidence and source/budget hashes\n');
}
