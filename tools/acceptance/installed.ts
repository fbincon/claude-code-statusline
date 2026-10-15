import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { verifyCandidate } from '../build/verify.js';
import { prepareWindowsPowerShell } from './windows-shell.js';
const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' } } });
if (!values.artifact || !values.commit || !values.report) throw new Error('Usage: test:installed -- --artifact TGZ --commit FULL_SHA --report FILE');
const artifact = resolve(values.artifact), report = resolve(values.report);
verifyCandidate(artifact, values.commit); mkdirSync(dirname(report), { recursive: true });
const shellSetup = process.platform === 'win32' ? prepareWindowsPowerShell() : null;
if (shellSetup) {
    writeFileSync(report + '.shell-setup.json', JSON.stringify(shellSetup, null, 2) + '\n');
    console.log(JSON.stringify({ powershell_environment_setup: shellSetup }));
    if (shellSetup.status !== 'pass') throw new Error('Windows PowerShell environment preparation failed; no candidate test was run');
}
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', fileURLToPath(new URL('../migration/ts-04/test/installed.test.js', import.meta.url))], {
    env: { ...process.env, TS05_CANDIDATE_ARTIFACT: artifact, TS05_CANDIDATE_COMMIT: values.commit, TS04_INSTALLED_REPORT: report, TS05_POWERSHELL_SETUP: JSON.stringify(shellSetup) }, stdio: 'inherit', timeout: 600000,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
