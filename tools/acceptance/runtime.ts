/** Verify the same offline package under a selected product runtime. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { matchesNodeCase } from '@fbincon/statusline-core/node-runtime';
import { verifyCandidate } from '../build/verify.js';
import { repoRoot, sourceHashes } from '../migration/ts-03/common.js';

const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' }, case: { type: 'string' } } });
assert(values.artifact && values.commit && values.report && values.case, 'Require --artifact TGZ --commit FULL_SHA --report FILE --case RUNTIME');
assert(matchesNodeCase(process.versions.node, values.case), 'Wrong product runtime for this matrix case');
const checked = verifyCandidate(resolve(values.artifact), values.commit);
assert.deepEqual(sourceHashes(), checked.source.source_hashes, 'Runtime test sources differ from the package');
const report = resolve(values.report);
fs.mkdirSync(dirname(report), { recursive: true });
function run(args: string[]): void {
    const env = { ...process.env, NODE_OPTIONS: '--import=' + pathToFileURL(join(repoRoot, 'tools/testing/no-python.mjs')).href };
    const result = spawnSync(process.execPath, args, { cwd: repoRoot, env, stdio: 'inherit', timeout: 600000 });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'Runtime acceptance failed');
}
const installation = join(dirname(report), 'runtime-installation.json');
// Installed acceptance first records the same bounded system-shell readiness
// phase used by the platform matrix. Fresh ARM Windows images can otherwise
// spend the first source job's deadline initializing PowerShell, before any
// candidate script runs. Product deadlines and assertions stay unchanged.
run([fileURLToPath(new URL('./installed.js', import.meta.url)), '--artifact', resolve(values.artifact), '--commit', values.commit, '--report', installation]);
const receipt = JSON.parse(fs.readFileSync(installation, 'utf8'));
assert.equal(receipt.status, 'pass'); assert.equal(receipt.node, process.version);
run(['tools/typescript/test.mjs', '--runtime']);
fs.writeFileSync(report, JSON.stringify({ ...receipt, kind: 'node-runtime', runtime_case: values.case, runtime_tests: true }, null, 2) + '\n', { flag: 'wx' });
