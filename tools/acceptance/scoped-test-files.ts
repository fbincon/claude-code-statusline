/** Run serial file obligations inside one externally supervised process tree. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { phaseEvent } from './installed-supervisor.js';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const budget = Number(process.argv[2]), admission = Number(process.argv[3]), files = process.argv.slice(4);
    assert(process.env.TS05_PHASE_EVENTS && Number.isSafeInteger(budget) && budget > 0 && Number.isSafeInteger(admission) && admission > 0 && files.length,
        'Scoped test files require their external deadline supervisor');
    let exitCode = 0;
    const deadline = performance.now() + admission;
    for (const file of files) {
        phaseEvent(file, 'start');
        if (performance.now() >= deadline) {
            phaseEvent(file, 'fail');
            throw new Error('Scoped family admission expired before starting ' + file + '; partition the workload');
        }
        const start = performance.now();
        // The parent owns the hard timer and the entire process tree. Retain Node's
        // normal test isolation, console output and behavior after an assertion fails.
        const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--', file], { stdio: 'inherit' });
        const elapsed = performance.now() - start;
        const passed = !result.error && !result.signal && result.status === 0 && elapsed <= budget;
        if (!passed) {
            console.error(JSON.stringify({ scoped_test_file: file, exit_code: result.status, signal: result.signal,
                error: result.error?.message ?? null, elapsed_ms: elapsed, budget_ms: budget }));
            exitCode ||= result.status || 1;
        }
        phaseEvent(file, passed ? 'end' : 'fail');
    }
    process.exitCode = exitCode;
}
