import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { prepareModTypes, recordModHost, isolatedHostEnvironment } from './mod-types.js';
import { verifyCandidate } from '../build/verify.js';
import { repoRoot } from '../migration/ts-03/common.js';
import { Writable } from 'node:stream';
import { OFFICIAL_TRANSITION_MS, officialTransitionPhases, requireHostedBudget } from './budgets.js';
import { nativeCapacity } from './native-capacity.js';
import { superviseInstalled } from './installed-supervisor.js';
import { retainLog, sanitizeLog } from './diagnostics.js';
import { sha256 } from '../build/files.js';
import assert from 'node:assert/strict';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { runOfficialTestBatches } from './official-tests.js';
const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' }, claude: { type: 'string', default: 'claude' } } });
if (!values.artifact || !values.commit || !values.report) throw new Error('Require --artifact TGZ --commit FULL_SHA --report FILE [--claude EXECUTABLE]');
const artifact = resolve(values.artifact), reportPath = resolve(values.report), candidate = verifyCandidate(artifact, values.commit);
const temporary = fs.mkdtempSync(join(tmpdir(), 'ts05-mod-validation-')), host = claudeLaunch(values.claude);
const environment = isolatedHostEnvironment(process.env, temporary);
const report: Record<string, any> = { status: 'fail', commit: values.commit, tarball_sha256: candidate.sha256, model_calls: 0, mods: {}, phases: [], node: process.version,
    execution: { run_id: process.env.GITHUB_RUN_ID ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, job: process.env.GITHUB_JOB ?? null, runner: process.env.RUNNER_OS ?? process.platform } };
function run(executable: string, args: string[], env = environment, timeout = 180000) {
    const started = performance.now();
    const result = spawnSync(executable, args, { cwd: repoRoot, env, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
    const log = retainLog(join(dirname(reportPath), 'logs'), `command-${report.phases.length + 1}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
    report.phases.push({ argv: args.map(arg => sanitizeLog(arg)), elapsed_ms: performance.now() - started, timeout_ms: timeout, status: result.status, signal: result.signal, error: result.error?.name ?? null, log });
    if (result.status !== 0 || result.error) {
        const output = result.stdout + result.stderr;
        const lines = output.split(/\r?\n/u);
        const failures = lines.flatMap((line, index) => /\(fail\)|error:|expect\(|timed out/iu.test(line) ? lines.slice(Math.max(0,index-8),index+12) : []);
        throw new Error('Mod acceptance failed: ' + JSON.stringify({ args, status: result.status, signal: result.signal, error: result.error?.message, failures: failures.join('\n').slice(0,16000), output: output.slice(-4000) }));
    }
    return result.stdout;
}
const startedHost = performance.now();
try {
    const version = run(host.executable, [...host.args, '--version']).match(/\d+\.\d+\.\d+/u)?.[0];
    if (!version || !['2.1.287', '2.1.288', '2.1.289', '2.1.294', '2.1.296', '2.1.310'].includes(version)) throw new Error('Unsupported unpinned host');
    report.host = version; report.platform = process.platform; report.target = process.platform + '-' + version;
    report.node_sha256 = sha256(fs.readFileSync(process.execPath)); report.host_sha256 = sha256(fs.readFileSync(host.executable));
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const directory = join(repoRoot, 'mods', name);
        if (name === 'statusline-runtime' && Number(version.split('.')[2]) < 289) { report.mods[name] = { status: 'unsupported', reason: 'Runtime Mod requires host 2.1.289+' }; continue; }
        recordModHost(directory, version);
        run(host.executable, [...host.args, 'plugin', 'validate', '--strict', directory]);
        const official_test_batches = runOfficialTestBatches({ source: directory, temporary: join(temporary, name + '-tests'), logs: join(dirname(reportPath), 'logs'),
            host, cwd: repoRoot, env: environment, onCommand: phase => report.phases.push(phase) });
        let types: Record<string, string>;
        if (version === '2.1.296') types = { status: 'unavailable', reason: 'This exact host does not emit /plugin-types declarations; no typecheck pass is claimed' };
        else {
            await prepareModTypes(directory, values.claude);
            run(process.execPath, [join(repoRoot, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', join(directory, 'tsconfig.json')]);
            types = { status: 'pass', host: version };
        }
        report.mods[name] = { validation: 'pass', official_tests: 'pass', official_test_batches, types, ...(name === 'statusline-native' ? { capacity: nativeCapacity(host, join(temporary, 'capacity'), join(dirname(reportPath), 'logs')) } : {}) };
    }
    const installedReport = join(temporary, 'installed.json');
    run(process.execPath, [fileURLToPath(new URL('../migration/ts-04/official-installed.js', import.meta.url)), installedReport], {
        ...process.env, TS05_CANDIDATE_ARTIFACT: artifact, TS05_CANDIDATE_COMMIT: values.commit!, TS05_CLAUDE: values.claude,
    }, 600000);
    report.installed = JSON.parse(fs.readFileSync(installedReport, 'utf8'));
    if (report.installed.tarball_sha256 !== candidate.sha256 || report.installed.status !== 'pass') throw new Error('Installed Mod evidence differs from candidate');
    const transitionReport=join(temporary,'package-management.json');
    const transitionArgs = [fileURLToPath(new URL('./version-management-official.js', import.meta.url)), artifact, values.commit!,
        JSON.stringify({ ...host, version }), transitionReport, join(dirname(reportPath), 'package-management-trace.jsonl')];
    if (process.env.GITHUB_ACTIONS) requireHostedBudget(OFFICIAL_TRANSITION_MS, performance.now() - startedHost);
    const transitionStarted = performance.now();
    let transitionError: unknown, bytes = 0;
    const chunks: Buffer[] = [];
    const capture = new Writable({ write(chunk: Buffer, _encoding, done) {
        // The worker's original output remains visible; retain a bounded command log in the official receipt.
        if (bytes < 1024 * 1024) chunks.push(Buffer.from(chunk.subarray(0, 1024 * 1024 - bytes)));
        bytes += chunk.length; process.stdout.write(chunk, done);
    } });
    try {
        await superviseInstalled(transitionArgs, officialTransitionPhases(process.platform === 'win32'), process.env,
            join(dirname(reportPath), 'official-transition'), { cwd: repoRoot, output: { stdout: capture, stderr: capture } });
    } catch (error) { transitionError = error; throw error; }
    finally {
        const output = Buffer.concat(chunks).toString('utf8') + (bytes > 1024 * 1024 ? '\n<output truncated>\n' : '');
        const log = retainLog(join(dirname(reportPath), 'logs'), `command-${report.phases.length + 1}.log`, output);
        report.phases.push({ argv: transitionArgs.map(arg => sanitizeLog(arg)), elapsed_ms: performance.now() - transitionStarted,
            timeout_ms: OFFICIAL_TRANSITION_MS, status: transitionError ? null : 0, signal: null,
            error: transitionError instanceof Error ? sanitizeLog(transitionError.message) : null, log });
    }
    report.package_management=JSON.parse(fs.readFileSync(transitionReport,'utf8'));
    report.status = 'pass';
} catch (error) { report.error = sanitizeLog(String(error)); process.exitCode = 1; }
finally {
    fs.mkdirSync(dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    removeTree(temporary); assert(!fs.existsSync(temporary), 'Mod validation workspace was not removed');
}
console.log(JSON.stringify({ status: report.status, host: report.host, mods: report.mods, error: report.error }));
