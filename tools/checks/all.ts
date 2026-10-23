import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from '../migration/ts-03/common.js';
const env = { ...process.env, NODE_OPTIONS: '--import=' + pathToFileURL(join(repoRoot, 'tools/testing/no-python.mjs')).href };
for (const args of [
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
