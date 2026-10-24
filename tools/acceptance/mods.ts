import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { prepareModTypes, isolatedHostEnvironment } from './mod-types.js';
import { verifyCandidate } from '../build/verify.js';
import { repoRoot } from '../migration/ts-03/common.js';
const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' }, claude: { type: 'string', default: 'claude' } } });
if (!values.artifact || !values.commit || !values.report) throw new Error('Require --artifact TGZ --commit FULL_SHA --report FILE [--claude EXECUTABLE]');
const artifact = resolve(values.artifact), reportPath = resolve(values.report), candidate = verifyCandidate(artifact, values.commit);
const temporary = fs.mkdtempSync(join(tmpdir(), 'ts05-mod-validation-')), host = claudeLaunch(values.claude);
const environment = isolatedHostEnvironment(process.env, temporary);
const report: Record<string, any> = { status: 'fail', commit: values.commit, tarball_sha256: candidate.sha256, model_calls: 0, mods: {} };
function run(executable: string, args: string[], env = environment, timeout = 180000) {
    const result = spawnSync(executable, args, { cwd: repoRoot, env, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0 || result.error) {
        const output = result.stdout + result.stderr;
        const lines = output.split(/\r?\n/u);
        const failures = lines.flatMap((line, index) => /\(fail\)|error:|expect\(|timed out/iu.test(line) ? lines.slice(Math.max(0,index-8),index+12) : []);
        throw new Error('Mod acceptance failed: ' + JSON.stringify({ args, status: result.status, signal: result.signal, error: result.error?.message, failures: failures.join('\n').slice(0,16000), output: output.slice(-4000) }));
    }
    return result.stdout;
}
try {
    const version = run(host.executable, [...host.args, '--version']).match(/\d+\.\d+\.\d+/u)?.[0];
    if (!version || !['2.1.287', '2.1.288', '2.1.289', '2.1.294', '2.1.296'].includes(version)) throw new Error('Unsupported unpinned host');
    report.host = version; report.platform = process.platform; report.target = process.platform + '-' + version;
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const directory = join(repoRoot, 'mods', name);
        if (name === 'statusline-runtime' && Number(version.split('.')[2]) < 289) { report.mods[name] = { status: 'unsupported', reason: 'Runtime Mod requires host 2.1.289+' }; continue; }
        run(host.executable, [...host.args, 'plugin', 'validate', '--strict', directory]);
        run(host.executable, [...host.args, 'plugin', 'test', directory]);
        let types: Record<string, string>;
        if (version === '2.1.296') types = { status: 'unavailable', reason: 'This exact host does not emit /plugin-types declarations; no typecheck pass is claimed' };
        else {
            prepareModTypes(directory, values.claude);
            run(process.execPath, [join(repoRoot, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', join(directory, 'tsconfig.json')]);
            types = { status: 'pass', host: version };
        }
        report.mods[name] = { validation: 'pass', official_tests: 'pass', types };
    }
    const installedReport = join(temporary, 'installed.json');
    run(process.execPath, [fileURLToPath(new URL('../migration/ts-04/official-installed.js', import.meta.url)), installedReport], {
        ...process.env, TS05_CANDIDATE_ARTIFACT: artifact, TS05_CANDIDATE_COMMIT: values.commit!, TS05_CLAUDE: values.claude,
    }, 600000);
    report.installed = JSON.parse(fs.readFileSync(installedReport, 'utf8'));
    if (report.installed.tarball_sha256 !== candidate.sha256 || report.installed.status !== 'pass') throw new Error('Installed Mod evidence differs from candidate');
    report.status = 'pass';
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
    fs.mkdirSync(dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    fs.rmSync(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify({ status: report.status, host: report.host, mods: report.mods, error: report.error }));
