import { lstatSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputs = [
  'packages/core/dist',
  'packages/platform/dist',
  'packages/cli/dist',
  'packages/tui/dist',
  'tools/testing/dist',
  'dist/typescript',
];

try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== '--dry-run')) {
    throw new Error('Usage: npm run clean [-- --dry-run]');
  }
  const dryRun = args.length === 1;
  const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
  const existing = [];
  // Validate every target before removing anything. A linked parent or output
  // must never redirect cleanup into source files or historical evidence.
  for (const output of outputs) {
    let path = root;
    for (const part of output.split('/')) {
      path = join(path, part);
      const stat = lstatSync(path, { throwIfNoEntry: false });
      if (!stat) break;
      if (stat.isSymbolicLink()) throw new Error('Refusing to clean through a symbolic link: ' + path);
      if (!stat.isDirectory()) throw new Error('Expected a build output directory: ' + path);
      if (path === join(root, output)) existing.push(output);
    }
  }
  for (const output of existing) {
    if (!dryRun) rmSync(join(root, output), { recursive: true, force: true, maxRetries: 3 });
    console.log((dryRun ? 'Would remove ' : 'Removed ') + output);
  }
  if (!existing.length) console.log('No compiled outputs to clean.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
