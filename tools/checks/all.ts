import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, sourceHashes } from '../migration/ts-03/common.js';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { sha256 } from '../build/files.js';
const env = { ...process.env, NODE_OPTIONS: '--import=' + pathToFileURL(join(repoRoot, 'tools/testing/no-python.mjs')).href };
const platform = process.argv.includes('--platform');
for (const args of platform ? [['tools/typescript/test.mjs']] : [
    ['dist/typescript/tools/checks/actions.js'],
    ['tools/typescript/test.mjs'],
    ['dist/typescript/tools/generation/resources.js', '--check'],
    ['dist/typescript/tools/checks/docs.js'],
    ['dist/typescript/tools/checks/archive.js'],
    ['dist/typescript/tools/migration/ts-03/inventory.js', '--complete'],
    ['dist/typescript/tools/migration/ts-04/inventory.js', '--complete'],
    ['dist/typescript/tools/migration/ts-05/inventory.js', '--complete'],
]) {
    const result = spawnSync(process.execPath, args, { cwd: repoRoot, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
const report = process.argv.indexOf('--report');
if (!process.exitCode && report >= 0) {
    if (!platform || !process.argv[report + 1]) throw new Error('Only a complete platform suite can issue its receipt');
    fs.writeFileSync(process.argv[report + 1]!, JSON.stringify({ status: 'pass', suite: 'complete-platform-suite',
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(), node: process.version,
        node_sha256: sha256(fs.readFileSync(process.execPath)), source_hashes: sourceHashes(), platform: process.platform, arch: process.arch,
        run_id: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB }, null, 2) + '\n', { flag: 'wx' });
}
