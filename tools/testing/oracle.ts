/** Read-only, independently captured Python expectations. No interpreter fallback. */
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/u, '');
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function referenceDirectory(): string { return mkdtempSync(join(tmpdir(), 'frozen-oracle-context-')); }
export function oracle(args: string[], options: { input?: string | Uint8Array; encoding?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number } = {}): string {
  const command = args.filter(arg => arg !== '-B').map(arg => arg.replaceAll(root, '$ROOT').replaceAll('\\', '/'));
  if (args.includes('-c')) command[command.indexOf('-c') + 1] = args[args.indexOf('-c') + 1]!;
  const input = options.input === undefined ? '' : typeof options.input === 'string' ? options.input : Buffer.from(options.input).toString('utf8');
  const identity = sha(JSON.stringify({ command, input }));
  const path = join(root, 'tests/fixtures/migration/ts-05/oracles', identity + '.json');
  const raw = readFileSync(path, 'utf8');
  const lockRaw = readFileSync(join(root, 'tests/fixtures/migration/ts-05/oracles.lock.json'), 'utf8');
  if (sha(lockRaw) !== '9a9e8f835ed9c460c0306d1efd23db0604aa9c9377bfd53a7ca4282e3e8f4c9d') throw new Error('Frozen oracle lock changed');
  const lock = JSON.parse(lockRaw);
  if (lock.files[identity + '.json'] !== sha(raw)) throw new Error('Frozen oracle fixture changed: ' + identity);
  const value = JSON.parse(raw);
  if (value.identity_sha256 !== identity || value.reference_commit !== '9b6d2fab4bf165be280d428a874521bfbf02c7e1' || value.python !== 'Python 3.14.4' || sha(value.output) !== value.output_sha256) throw new Error('Invalid frozen oracle provenance: ' + identity);
  return value.output;
}
