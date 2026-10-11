import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const repoRoot = resolve(packageRoot, '../../..');
export const cli = join(packageRoot, 'dist/cli.js');
export const reference = '9b6d2fab4bf165be280d428a874521bfbf02c7e1';
export const python = process.env.TS02_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
export function sha(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
export function exportReference(): string {
  const directory = mkdtempSync(join(tmpdir(), 'ts02-reference-'));
  const archive = execFileSync('git', ['archive', reference, 'src'], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  execFileSync('tar', ['-xf', '-', '-C', directory], { input: archive });
  // tar output is checked against the actual immutable Git blobs.
  const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', reference, '--', 'src'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n');
  for (const path of tracked) {
    const expected = execFileSync('git', ['show', `${reference}:${path}`], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
    if (sha(readFileSync(join(directory, path))) !== sha(expected)) throw new Error(`Oracle export mismatch: ${path}`);
  }
  writeFileSync(join(directory, '.reference'), reference);
  return directory;
}
export function sourceHashes(): Record<string, string> {
  const result: Record<string, string> = {};
  function walk(path: string) {
    for (const entry of readdirSync(join(packageRoot, path), { withFileTypes: true })) {
      if (['node_modules', 'dist', 'generated', '.git'].includes(entry.name)) continue;
      const name = path ? path + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(name); else result[name] = sha(readFileSync(join(packageRoot, name)));
    }
  }
  walk(''); return result;
}
