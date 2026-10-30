import { createHash } from 'node:crypto';
import { nativeCapacityData } from '../generation/native-capacity.js';
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
export const NATIVE_CAPACITY_CASES = 197;
export const NATIVE_CAPACITY_ADDITIONAL_CASES = 86;
export const NATIVE_CAPACITY_TOTAL_CASES = NATIVE_CAPACITY_CASES + NATIVE_CAPACITY_ADDITIONAL_CASES;

export function nativeCapacity(host: LaunchSpec, destination: string) {
    const source = join(repoRoot, 'mods/statusline-native');
    fs.cpSync(source, destination, { recursive: true, filter: path => !['node_modules', 'types'].includes(basename(path)) });
    function removeTests(directory: string): void {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) removeTests(path);
            else if (/\.test\.tsx?$/u.test(entry.name)) fs.unlinkSync(path);
        }
    }
    removeTests(join(destination, 'tests'));
    fs.writeFileSync(join(destination, 'hooks/hooks.json'), JSON.stringify({ modules: ['../tests/capacity-register.ts'] }) + '\n');
    // Bound each official test child while preserving every original assertion.
    // This also prevents a single sandbox from accumulating hundreds of mounts.
    const batchSize=50;
    for(let start=0;start<NATIVE_CAPACITY_TOTAL_CASES;start+=batchSize)fs.writeFileSync(join(destination,'tests/capacity-'+start+'.test.ts'),"import {registerCapacityCases} from './integration/capacity-cases.ts';\nregisterCapacityCases("+start+","+Math.min(start+batchSize,NATIVE_CAPACITY_TOTAL_CASES)+");\n");
    const environment = isolatedHostEnvironment(process.env, join(destination, 'config'));
    for (const args of [['plugin', 'validate', '--strict', destination], ['plugin', 'test', destination]]) {
        const result = spawnSync(host.executable, [...host.args, ...args], { cwd: repoRoot, env: environment, encoding: 'utf8', timeout: 300000, maxBuffer: 8 * 1024 * 1024 });
        const output = (result.stdout ?? '') + (result.stderr ?? '');
        fs.writeFileSync(destination + (args[1] === 'test' ? '.tests.log' : '.validate.log'), output);
        if (result.status !== 0 || result.error) throw new Error('Native capacity acceptance failed: ' + output.slice(-12000));
        if (args[1] === 'test' && (!new RegExp('\\b' + NATIVE_CAPACITY_TOTAL_CASES + ' pass\\b').test(output) || !/\b0 fail\b/.test(output))) throw new Error('Incomplete native capacity test results');
    }
    const cases=nativeCapacityData().cases;
    if(cases.length!==NATIVE_CAPACITY_TOTAL_CASES)throw new Error('Capacity inventory differs');
    const names=(start:number,end:number)=>createHash('sha256').update(JSON.stringify(cases.slice(start,end).map(c=>c.name))).digest('hex');
    return { status: 'pass', cases: NATIVE_CAPACITY_CASES, original_cases: 197, total_cases:NATIVE_CAPACITY_TOTAL_CASES, additional_cases:NATIVE_CAPACITY_ADDITIONAL_CASES, test_files:Math.ceil(NATIVE_CAPACITY_TOTAL_CASES/batchSize), shared_execution:true, baseline_names_sha256:names(0,NATIVE_CAPACITY_CASES),additional_names_sha256:names(NATIVE_CAPACITY_CASES,cases.length), actual_host: true, model_calls: 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { claude: { type: 'string', default: 'claude' }, output: { type: 'string' } } });
    if (!values.output) throw new Error('Require --output NEW_DIRECTORY');
    const destination = resolve(values.output);
    if (fs.existsSync(destination)) throw new Error('Capacity output directory already exists');
    console.log(JSON.stringify(nativeCapacity(claudeLaunch(values.claude), destination)));
}
