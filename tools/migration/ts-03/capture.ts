import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { decode, encode } from '@fbincon/statusline-core/json';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { checkBaseline, fixtures, repoRoot, reference, sourceHashes } from './common.js';
import { handlers, type Case } from './scenarios.js';

checkBaseline();
if (process.argv.length !== 3) throw new Error('Usage: migration:capture NEW_OUTPUT_DIRECTORY');
const directory = resolve(process.argv[2]!); fs.mkdirSync(directory);
const corpus = decode(fs.readFileSync(join(fixtures, 'cases.json'), 'utf8')) as { cases: Case[]; configs: Record<string, unknown> };
const results: Record<string, unknown> = {}, pending: string[] = [];
const worker = fileURLToPath(new URL('./worker.js', import.meta.url));
const env = Object.fromEntries(['SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TMP', 'TEMP', 'TMPDIR', 'LD_LIBRARY_PATH']
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]!]));
for (const fixture of corpus.cases) {
  if (!Object.hasOwn(handlers, fixture.kind)) { pending.push(fixture.id); continue; }
  const root = join(directory, fixture.id); fs.mkdirSync(root);
  const input = join(root, 'case.json'), output = join(root, 'result.json');
  fs.writeFileSync(input, encode({ ...fixture, config: fixture.config_id ? corpus.configs[fixture.config_id] : null }));
  execFileSync(process.execPath, [worker, input, output], { cwd: root, timeout: 30_000, env: { ...env,
    PATH: join(root, 'bin'), HOME: join(root, 'home'), USERPROFILE: join(root, 'home'),
    CLAUDE_CONFIG_DIR: join(root, 'config'), CLAUDE_STATUSLINE_RUNTIME_DIR: join(root, 'runtime'), CLAUDE_STATUSLINE_SESSIONS_DIR: join(root, 'sessions'),
  } });
  results[fixture.id] = decode(fs.readFileSync(output, 'utf8'));
}
const bytes = encode(results) + '\n'; fs.writeFileSync(join(directory, 'results.json'), bytes);
const receipt = { reference, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
  node: process.version, status: pending.length ? 'incomplete' : 'captured', completed: Object.keys(results).length, pending,
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()), source_hashes: sourceHashes(),
  result_sha256: sha256(bytes), lock_sha256: sha256(fs.readFileSync(join(fixtures, 'lock.json'))) };
fs.writeFileSync(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, completed: receipt.completed, pending: pending.length }));
process.exitCode = pending.length ? 2 : 0;
