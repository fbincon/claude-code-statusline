import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { nativeCapacityData } from '../generation/native-capacity.js';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
/** Actual-host acceptance of projected production states, separate from UI reducers. */
import * as fs from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import type { LaunchSpec } from '@fbincon/statusline-core/integration/binding';
import { isolatedHostEnvironment } from './mod-types.js';
import { repoRoot } from '../migration/ts-03/common.js';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { retainLog } from './diagnostics.js';
import { officialTestInventory, runOfficialTestBatches, verifyOfficialTestBatches, type OfficialTestExecute } from './official-tests.js';
export const NATIVE_CAPACITY_CASES = 197;
export const NATIVE_CAPACITY_ADDITIONAL_CASES = 56 + 5 * LANGUAGES.length;
export const NATIVE_CAPACITY_TOTAL_CASES = NATIVE_CAPACITY_CASES + NATIVE_CAPACITY_ADDITIONAL_CASES;
export const NATIVE_CAPACITY_TIMEOUT_MS = 300_000;
export const NATIVE_CAPACITY_BATCH_SIZE = 50;
export const NATIVE_CAPACITY_TEST_FILES = Math.ceil(NATIVE_CAPACITY_TOTAL_CASES / NATIVE_CAPACITY_BATCH_SIZE);
const capacityHooks = JSON.stringify({ modules: ['../tests/capacity-register.ts'] }) + '\n';
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function capacityEntrypoints(): [string, string][] {
    const entries: [string, string][] = [];
    for (let start = 0; start < NATIVE_CAPACITY_TOTAL_CASES; start += NATIVE_CAPACITY_BATCH_SIZE)
        entries.push(['tests/capacity-' + start + '.test.ts', "import {registerCapacityCases} from './integration/capacity-cases.ts';\nregisterCapacityCases(" + start + ',' + Math.min(start + NATIVE_CAPACITY_BATCH_SIZE, NATIVE_CAPACITY_TOTAL_CASES) + ');\n']);
    return entries;
}

/** Reproduce the exact disposable capacity-source transformation from immutable source hashes. */
export function nativeCapacitySourceInventory(originalSource: Readonly<Record<string, string>>): Record<string, string> {
    const files = Object.fromEntries(Object.entries(originalSource).filter(([path]) =>
        !path.split('/').some(part => part === 'node_modules' || part === 'types') &&
        !(path.startsWith('tests/') && /\.test\.tsx?$/u.test(path))));
    files['hooks/hooks.json'] = hash(capacityHooks);
    for (const [path, content] of capacityEntrypoints()) files[path] = hash(content);
    return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export function nativeCapacity(host: LaunchSpec, destination: string, logs = destination + '-logs', execute: OfficialTestExecute = (file, args, options) => spawnSync(file, args, options)) {
    assert(!fs.existsSync(destination), 'Native capacity requires a fresh destination');
    assert(!fs.existsSync(join(logs, 'native-capacity-validate.log')), 'Use a new native capacity log directory');
    const source = join(repoRoot, 'mods/statusline-native');
    const originalSource = officialTestInventory(source).source_files, expectedSource = nativeCapacitySourceInventory(originalSource);
    fs.cpSync(source, destination, { recursive: true, filter: path => !['node_modules', 'types'].includes(basename(path)) });
    function removeTests(directory: string): void {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) removeTests(path);
            else if (/\.test\.tsx?$/u.test(entry.name)) { removeTree(path); assert(!fs.existsSync(path), 'Original capacity-copy test was not removed'); }
        }
    }
    removeTests(join(destination, 'tests'));
    fs.writeFileSync(join(destination, 'hooks/hooks.json'), capacityHooks);
    // Bound each official test child while preserving every original assertion.
    // This also prevents a single sandbox from accumulating hundreds of mounts.
    for (const [path, content] of capacityEntrypoints()) fs.writeFileSync(join(destination, path), content);
    const copied = officialTestInventory(destination);
    assert.deepEqual(copied.source_files, expectedSource, 'Capacity source copy differs');
    assert.deepEqual(copied.host_files, {}, 'Capacity source must not include host declarations');
    assert.equal(copied.test_files.length, NATIVE_CAPACITY_TEST_FILES);
    assert.deepEqual(officialTestInventory(source).source_files, originalSource, 'Native source changed while preparing capacity tests');
    const environment = isolatedHostEnvironment(process.env, destination + '-config');
    const started = performance.now();
    let result: ReturnType<OfficialTestExecute>;
    try { result = execute(host.executable, [...host.args, 'plugin', 'validate', '--strict', destination], { cwd: repoRoot, env: environment, encoding: 'utf8', timeout: NATIVE_CAPACITY_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }); }
    catch (error) { result = { status: null, error: error instanceof Error ? error : new Error(String(error)) }; }
    const elapsed_ms = performance.now() - started, output = (result.stdout ?? '') + (result.stderr ?? '');
    const log = retainLog(logs, 'native-capacity-validate.log', output + (result.error ? '\n' + String(result.error) : ''));
    assert(result.status === 0 && !result.error && !result.signal && elapsed_ms <= NATIVE_CAPACITY_TIMEOUT_MS, 'Native capacity validation failed; see ' + log);
    const validation = { status: 'pass', timeout_ms: NATIVE_CAPACITY_TIMEOUT_MS, elapsed_ms, log, log_sha256: hash(fs.readFileSync(join(logs, log))) };
    assert.deepEqual(officialTestInventory(destination), copied, 'Capacity validation changed its source copy');
    // The host runs test files concurrently within one invocation. Run the same
    // bounded files serially so seven sandboxes cannot exhaust host memory.
    const execution = runOfficialTestBatches({ source: destination, temporary: destination + '-batches', logs, host, cwd: repoRoot, env: environment,
        timeoutMs: NATIVE_CAPACITY_TIMEOUT_MS, logPrefix: 'native-capacity' }, execute);
    verifyOfficialTestBatches(execution, expectedSource, NATIVE_CAPACITY_TIMEOUT_MS);
    assert.equal(execution.totals.tests, NATIVE_CAPACITY_TOTAL_CASES);
    assert.equal(execution.totals.files, NATIVE_CAPACITY_TEST_FILES);
    assert.deepEqual(officialTestInventory(source).source_files, originalSource, 'Native source changed during capacity acceptance');
    const cases=nativeCapacityData().cases;
    if(cases.length!==NATIVE_CAPACITY_TOTAL_CASES)throw new Error('Capacity inventory differs');
    const names=(start:number,end:number)=>createHash('sha256').update(JSON.stringify(cases.slice(start,end).map(c=>c.name))).digest('hex');
    return { status: 'pass', cases: NATIVE_CAPACITY_CASES, original_cases: 197, total_cases:NATIVE_CAPACITY_TOTAL_CASES, additional_cases:NATIVE_CAPACITY_ADDITIONAL_CASES, test_files:NATIVE_CAPACITY_TEST_FILES, shared_execution:true, baseline_names_sha256:names(0,NATIVE_CAPACITY_CASES),additional_names_sha256:names(NATIVE_CAPACITY_CASES,cases.length), actual_host: true, model_calls: 0, validation, execution };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { claude: { type: 'string', default: 'claude' }, output: { type: 'string' } } });
    if (!values.output) throw new Error('Require --output NEW_DIRECTORY');
    const destination = resolve(values.output);
    if (fs.existsSync(destination)) throw new Error('Capacity output directory already exists');
    console.log(JSON.stringify(nativeCapacity(claudeLaunch(values.claude), destination)));
}
