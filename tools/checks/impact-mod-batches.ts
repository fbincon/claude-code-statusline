/** Scoped official Mod tests admit one immutable file at a time. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OfficialTestOptions } from '../acceptance/official-tests.js';
import { familyAdmissionMs, SCOPED_MOD_FILE_MS } from './impact-budget.ts';

export async function runScopedModTests(options: Omit<OfficialTestOptions, 'timeoutMs'>, expectedFiles: readonly string[],
    now = () => performance.now()) {
    const built = pathToFileURL(resolve('dist/typescript/tools/acceptance/official-tests.js')).href;
    const { officialTestInventory, runOfficialTestBatches } = await import(built) as typeof import('../acceptance/official-tests.js');
    assert.deepEqual(officialTestInventory(options.source).test_files, expectedFiles, 'Scoped Mod test inventory differs from the planned source');
    const deadline = now() + familyAdmissionMs(expectedFiles.length);
    return runOfficialTestBatches({ ...options, timeoutMs: SCOPED_MOD_FILE_MS }, (file, args, command) => {
        assert(now() < deadline, 'Scoped Mod file admission expired');
        return spawnSync(file, args, command);
    });
}
