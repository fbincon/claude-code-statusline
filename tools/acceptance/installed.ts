import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { verifyCandidate } from '../build/verify.js';
const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' } } });
if (!values.artifact || !values.commit || !values.report) throw new Error('Usage: test:installed -- --artifact TGZ --commit FULL_SHA --report FILE');
const artifact = resolve(values.artifact), report = resolve(values.report);
verifyCandidate(artifact, values.commit); mkdirSync(dirname(report), { recursive: true });
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', fileURLToPath(new URL('../migration/ts-04/test/installed.test.js', import.meta.url))], {
    env: { ...process.env, TS05_CANDIDATE_ARTIFACT: artifact, TS05_CANDIDATE_COMMIT: values.commit, TS04_INSTALLED_REPORT: report }, stdio: 'inherit', timeout: 600000,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
