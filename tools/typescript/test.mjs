import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { testResponsibility } from '../../dist/typescript/tools/checks/test-responsibilities.js';

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
const groups = [files.filter(file => !testResponsibility(file).serial), files.filter(file => testResponsibility(file).serial)];
const concurrency = Number(process.env.STATUSLINE_TEST_WORKERS ?? 2);
if (![1, 2].includes(concurrency)) throw new Error('Test workers must be 1 or 2');
for (const [index, selected] of groups.entries()) {
  if (!selected.length) continue;
  console.log(JSON.stringify({ test_group: index === 0 ? 'isolated' : 'serial', files: selected.length, workers: index === 0 ? concurrency : 1 }));
  const result = spawnSync(process.execPath, ['--test', `--test-concurrency=${index === 0 ? concurrency : 1}`, ...process.argv.slice(2).filter(arg => arg !== '--runtime'), ...selected], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
