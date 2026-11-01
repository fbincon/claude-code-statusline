import assert from 'node:assert/strict';
import { baselineObligations, type CoveragePlan, type CoverageProducer } from './ci-coverage.ts';

/** A manual-only baseline exercise can measure both depths even when the PR itself must elevate all histories.
 * Its extra discriminator and reduced obligations cannot satisfy verifyCoveragePlan. */
export function probePlan(plan: CoveragePlan, inputs: unknown): CoveragePlan & { diagnostic: 'tiered-probe' } {
    assert.equal(plan.basis, 'conservative');
    const baseline = baselineObligations(inputs);
    const ids = new Set(['windows-11-arm-x64@22.0.0', 'ubuntu-24.04-x64', 'macos-15-intel-x64', 'linux-2.1.296', 'linux-2.1.310']);
    const producers = plan.producers.filter(p => p.obligations.some(id => ids.has(id))).map(p => {
        const rows = baseline.filter(row => p.obligations.includes(row.id));
        const depth: CoverageProducer['depth'] = rows.some(row => row.depth === 'full') ? 'full' : 'short';
        return { ...p, depth };
    });
    assert.equal(producers.length, 7);
    return { ...plan, diagnostic: 'tiered-probe', obligations: baseline.filter(row => producers.some(p => p.obligations.includes(row.id))), producers };
}
