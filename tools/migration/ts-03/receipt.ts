import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { architecture } from '@fbincon/statusline-platform/architecture';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { inventory } from './inventory.js';
import { repoRoot, reference, sourceHashes, fixtures } from './common.js';

if (process.argv.length !== 3) throw new Error('Usage: migration:receipt NEW_OUTPUT.json');
const result = {
  format_version: 1, reference,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()),
  node: process.version, node_sha256: sha256(readFileSync(process.execPath)),
  platform: process.platform, ...architecture(),
  coverage: inventory(), source_hashes: sourceHashes(),
  baseline_lock_sha256: sha256(readFileSync(join(fixtures, 'lock.json'))),
  limitation: 'Source/provenance receipt; CI/test results and functional parity are separate evidence.',
};
writeFileSync(process.argv[2]!, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ commit: result.commit, dirty: result.dirty, platform: result.platform, source_files: Object.keys(result.source_hashes).length }));
