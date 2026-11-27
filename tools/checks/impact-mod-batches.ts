/** Scoped official Mod tests admit bounded batches from the immutable source. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OfficialTestOptions } from '../acceptance/official-tests.js';
import { familyAdmissionMs, SCOPED_MOD_FILE_MS } from './impact-budget.ts';

export async function runScopedModTests(options: Omit<OfficialTestOptions, 'timeoutMs' | 'beforeCommand'>, expectedFiles: readonly string[],
    now = () => performance.now()) {
    const built = pathToFileURL(resolve('dist/typescript/tools/acceptance/official-tests.js')).href;
    const { officialTestInventory, runOfficialTestBatches } = await import(built) as typeof import('../acceptance/official-tests.js');
    assert.deepEqual(officialTestInventory(options.source).test_files, expectedFiles, 'Scoped Mod test inventory differs from the planned source');
    const deadline = now() + familyAdmissionMs(expectedFiles.length);
    return runOfficialTestBatches({ ...options, timeoutMs: SCOPED_MOD_FILE_MS,
        beforeCommand() { assert(now() < deadline, 'Scoped Mod file admission expired'); },
    });
}
