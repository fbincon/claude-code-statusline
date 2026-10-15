import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
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
  // Export raw blobs rather than archive/checkout filters (CRLF differs on Windows).
  const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', reference, '--', 'src'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n');
  for (const path of tracked) {
    const expected = execFileSync('git', ['cat-file', 'blob', `${reference}:${path}`], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), expected);
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
  walk('');
  // The approved Windows clock fix is compared separately from the immutable
  // oracle. Bind the actual working Python clock implementation in receipts.
  for (const name of [
    'src/claude_statusline/platforms/clocks.py', 'src/claude_statusline/platforms/environment.py',
    'src/claude_statusline/platforms/processes.py', 'src/claude_statusline/runtime/timing/clock.py',
  ]) {
    result['@repository/' + name] = sha(readFileSync(join(repoRoot, name)));
  }
  return result;
}
