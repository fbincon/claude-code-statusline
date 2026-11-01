import { appendFileSync, readdirSync, writeFileSync } from 'node:fs';
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
if (runtime) files.push('dist/typescript/tools/acceptance/test/version-command-input.test.js');
if (!files.length) throw new Error('No compiled tests found');
const groups = [files.filter(file => !testResponsibility(file).serial), files.filter(file => testResponsibility(file).serial)];
const concurrency = Number(process.env.STATUSLINE_TEST_WORKERS ?? 2);
if (![1, 2].includes(concurrency)) throw new Error('Test workers must be 1 or 2');
const completed = [];
const report = process.env.TS05_SOURCE_GROUP_REPORT;
const childEnv = { ...process.env };
if (report) {
  delete childEnv.TS05_SOURCE_GROUP_REPORT;
  delete childEnv.TS05_PHASE_EVENTS;
}
function phase(name, event) {
  if (report && process.env.TS05_PHASE_EVENTS) appendFileSync(process.env.TS05_PHASE_EVENTS, JSON.stringify({ name, event }) + '\n');
}
for (const [index, selected] of groups.entries()) {
  if (!selected.length) continue;
  const name = index === 0 ? 'isolated' : 'serial';
  phase(name, 'start');
  console.log(JSON.stringify({ test_group: name, files: selected.length, workers: index === 0 ? concurrency : 1 }));
  const result = spawnSync(process.execPath, ['--test', `--test-concurrency=${index === 0 ? concurrency : 1}`, ...process.argv.slice(2).filter(arg => arg !== '--runtime'), ...selected], { stdio: 'inherit', env: childEnv });
  phase(name, result.error || result.status !== 0 ? 'fail' : 'end');
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  completed.push({ name, files: selected.length, exit_code: result.status });
}
// Only the original unfiltered source suite may attest both real subprocess exits.
if (report && !process.exitCode) {
  if (process.argv.slice(2).some(arg => arg !== '--runtime') || completed.length !== 2) throw new Error('Incomplete source test groups');
  writeFileSync(report, JSON.stringify(completed) + '\n', { flag: 'wx' });
}
