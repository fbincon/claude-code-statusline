/** Explicit historical entry: reconstruct original paths without editing archive bytes or the installed product. */
import * as fs from 'node:fs';
import { join, resolve, dirname, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { repoRoot } from '../ts-03/common.js';
import { checkArchive } from '../../checks/archive.js';
import { sha256, npmEntry } from '../../build/files.js';
const { values } = parseArgs({ options: { python: { type: 'string', default: process.platform === 'win32' ? 'python' : 'python3' }, report: { type: 'string' } } });
if (!values.report) throw new Error('Usage: reference:verify -- --python PYTHON_3_14_4 --report NEW_FILE');
const reportPath = resolve(values.report);
if (fs.existsSync(reportPath)) throw new Error('Historical evidence is immutable; choose a new report');
const archive = checkArchive(), temp = fs.mkdtempSync(join(tmpdir(), 'ts05 historical reference ')), root = join(temp, 'checkout');
const report: Record<string, any> = { status: 'fail', archive, started: new Date().toISOString(), paid_calls: 0, checks: {} };
const logs = reportPath.replace(/\.json$/u, '') + '-logs'; fs.mkdirSync(logs, { recursive: false, mode: 0o700 });
let sequence = 0;
function run(executable: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv = process.env) {
    const result = spawnSync(executable, args, { cwd, env: environment, encoding: 'utf8', timeout: 900000, maxBuffer: 32 * 1024 * 1024 });
    const name = String(++sequence).padStart(2, '0') + '.log';
    fs.writeFileSync(join(logs, name), (result.stdout ?? '') + (result.stderr ?? ''), { mode: 0o600 });
    if (result.status !== 0 || result.error) throw new Error('Historical command failed; see ' + name + ': ' + (result.error?.message ?? result.status));
    return result.stdout.trim();
}
try {
    const python = run(values.python!, ['-c', 'import sys;assert sys.version_info[:3]==(3,14,4);print(sys.executable)'], repoRoot);
    run(python, ['-c', 'import importlib.metadata as m;assert m.version("wcwidth")=="0.9.1";assert m.version("pyte")=="0.8.2"'], repoRoot);
    report.python = { version: '3.14.4', executable_sha256: sha256(fs.readFileSync(python)) };
    run('git', ['clone', '--shared', '--no-checkout', '--quiet', repoRoot, root], temp);
    run('git', ['checkout', '--detach', '--quiet', archive.reference_commit], root);
    const env = { ...process.env, PYTHONPATH: join(root, 'src'), PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1', TS03_PYTHON: python, PATH: dirname(python) + delimiter + dirname(process.execPath) + delimiter + (process.env.PATH ?? '') };
    delete (env as NodeJS.ProcessEnv).NODE_OPTIONS;
    report.checks.frozen = JSON.parse(run(python, ['-m', 'tools.migration', 'verify', '--python', python], root, env));
    run(python, ['-m', 'unittest', 'discover', '-s', 'tests', '-t', '.', '-v'], root, env); report.checks.python_suite = 'pass; platform skips remain in the log';
    run(process.execPath, [npmEntry(), 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], root, env);
    const files = ['packages/core/test/json.test.ts', ...['cli-help', 'json-boundaries', 'rendering-primitives', 'runtime-numbers', 'runtime-parity', 'streaming-usage'].map(name => `tools/migration/ts-03/test/${name}.test.ts`)];
    for (const name of files) fs.writeFileSync(join(root, name), execFileSync('git', ['show', '250ea02:' + name], { cwd: root, maxBuffer: 8 * 1024 * 1024 }));
    for (const name of ['platform', 'transactions']) fs.copyFileSync(join(repoRoot, 'archive/python/comparisons/' + name + '.test.ts'), join(root, 'tools/migration/ts-03/test/' + name + '.test.ts'));
    fs.copyFileSync(join(repoRoot, 'archive/python/comparisons/installed.test.ts'), join(root, 'tools/migration/ts-04/test/installed.test.ts'));
    run(process.execPath, [npmEntry(), 'run', 'build'], root, env);
    const goldenDirectory = join(temp, 'oracles');
    const testFiles = files.map(name => name.startsWith('packages/') ? name.replace('/test/', '/dist/test/').replace(/\.ts$/u, '.js') : 'dist/typescript/' + name.replace(/\.ts$/u, '.js'));
    run(process.execPath, ['--import', join(repoRoot, 'tools/migration/ts-05/capture-oracles.mjs'), '--test', '--test-concurrency=1', ...testFiles], root, { ...env, TS05_ORACLE_OUTPUT: goldenDirectory });
    const lock = JSON.parse(fs.readFileSync(join(repoRoot, 'tests/fixtures/migration/ts-05/oracles.lock.json'), 'utf8'));
    const entries = lock.files;
    if (fs.readdirSync(goldenDirectory).length !== Object.keys(entries).length) throw new Error('Incomplete historical oracle recapture');
    for (const [name, hash] of Object.entries(entries)) if (sha256(fs.readFileSync(join(goldenDirectory, name))) !== hash) throw new Error('Historical oracle differs: ' + name);
    report.checks.oracles = { status: 'pass', files: Object.keys(entries).length };
    run(process.execPath, ['--test', '--test-concurrency=1', 'dist/typescript/tools/migration/ts-03/test/platform.test.js', 'dist/typescript/tools/migration/ts-03/test/transactions.test.js', 'dist/typescript/tools/migration/ts-04/test/installed.test.js'], root, env);
    report.checks.mixed_locks_and_python_rollback = 'pass'; report.status = 'pass';
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
    report.finished = new Date().toISOString(); fs.mkdirSync(dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.rmSync(temp, { recursive: true, force: true });
}
console.log(JSON.stringify(report));
