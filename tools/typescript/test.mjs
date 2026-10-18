import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function tests(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? tests(path) : path.endsWith('.test.js') ? [path] : [];
  });
}
const runtime = process.argv.includes('--runtime');
const roots = ['packages/core/dist', 'packages/platform/dist', 'packages/cli/dist', 'packages/tui/dist'];
if (!runtime) roots.push('dist/typescript');
const files = roots
  .flatMap(tests).filter(path => !path.endsWith(join('ts-04', 'test', 'installed.test.js'))).sort();
if (runtime) for (const name of ['platform', 'transactions', 'json-boundaries', 'runtime-numbers']) files.push(`dist/typescript/tools/migration/ts-03/test/${name}.test.js`);
if (!files.length) throw new Error('No compiled tests found');
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...process.argv.slice(2).filter(arg => arg !== '--runtime'), ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
