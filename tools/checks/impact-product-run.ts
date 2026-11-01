/** Complete acceptance issues this receipt after running the checks outstanding for its actual diff. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { supplementPlan, supplementBoundary, runProductChecks, type ProductCheckReceipt } from './impact-product.ts';
import type { CompleteEvidenceV2 } from './ci-evidence.ts';
import { jobsFor } from './impact-evidence.ts';

export async function issueProductChecks(record: CompleteEvidenceV2): Promise<ProductCheckReceipt | undefined> {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!,'utf8'));
    const base = record.event === 'push' && /^[a-f0-9]{40}$/u.test(event.before) && !/^0+$/u.test(event.before) ?
        event.before : supplementBoundary(record);
    const plan = supplementPlan(record,base);
    if (!plan.checks.length) return undefined;
    assert.equal(process.env.GITHUB_JOB,'acceptance');
    const job = 'Complete candidate evidence';
    const matches = (await jobsFor(record.run_id,record.attempt)).filter(row => row.name === job);
    assert.equal(matches.length,1,'Missing or ambiguous current product gate');
    const started_at = new Date().toISOString(), inputs_sha256 = runProductChecks(record.source_commit,plan);
    const receipt: ProductCheckReceipt = {schema_version:1,kind:'supplemental-product-checks',status:'pass',commit:record.source_commit,
        tree:record.tree,plan,inputs_sha256,run_id:record.run_id,attempt:record.attempt,job_id:matches[0].id,job,
        started_at,completed_at:new Date().toISOString()};
    console.log(JSON.stringify({supplemental_checks:plan.checks,paths:plan.paths,inputs_sha256}));
    return receipt;
}
