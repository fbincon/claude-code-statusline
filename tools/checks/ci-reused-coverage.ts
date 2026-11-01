/** A promotion describes the original run and never manufactures new history receipts. */
import assert from 'node:assert/strict';
import { coverageContext, type CompleteEvidence } from './ci-evidence.ts';
import { baselineObligations, historyCounts } from './ci-coverage.ts';

export function originalContext(record: CompleteEvidence) {
    if (record.schema_version === 1) return undefined;
    return { ...coverageContext(record), run_id: record.run_id,
        attempt: record.attempt, workflow_sha: record.workflow_sha };
}

/** v1 complete runs executed both historical routes for every applicable lane.
 * Only use that bridge for the product generation that included the twelve-language
 * and editor recovery obligations. Earlier records keep their own release policy. */
export function originalHistory(record: CompleteEvidence, releaseEpoch: 1 | 2 = record.schema_version) {
    if (releaseEpoch === 1) {
        assert.equal(record.schema_version, 1, 'A v2 product baseline cannot lose its coverage contract');
        return undefined;
    }
    const baseline = baselineObligations(record.inputs);
    if (record.schema_version === 1) {
        const [major, minor] = record.version.split('.').map(Number);
        assert(major === 3 && minor! >= 16, 'Original v1 product predates the v2 compatibility baseline');
        const rows = new Map(record.executions.map(row => [row.runtime_case ? row.target + '@' + row.runtime_case : row.target, row]));
        for (const obligation of baseline) {
            const row = rows.get(obligation.id);
            assert(row && row.node === 'v' + obligation.node && (row.host || null) === (obligation.host || null),
                'Original v1 product lacks required execution ' + obligation.id);
        }
        return { source_schema: 1 as const, source_commit: record.source_commit, run_id: record.run_id,
            logical: historyCounts(baseline.map(row => ({ ...row, depth: 'full' as const }))),
            history_jobs: { full: new Set(record.executions.map(row => row.job_id)).size, short: 0 } };
    }

    const plan = record.coverage_plan;
    const histories = record.executions.map(row => row.identity).filter(row => row.stage === 'complete' || row.stage === 'history');
    for (const obligation of baseline) {
        const original = plan.obligations.find(row => row.id === obligation.id);
        const owners = histories.filter(row => row.obligations.includes(obligation.id));
        assert(original && original.node === obligation.node && original.host === obligation.host && owners.length === 1,
            'Original v2 product lacks required history ' + obligation.id);
        assert(obligation.depth === 'short' || owners[0]!.depth === 'full', 'Required complete history was not executed for ' + obligation.id);
    }
    return { source_schema: 2 as const, source_commit: record.source_commit, run_id: record.run_id,
        coverage_plan_sha256: record.coverage_plan_sha256, logical: historyCounts(plan.obligations),
        history_jobs: { full: histories.filter(row => row.depth === 'full').length, short: histories.filter(row => row.depth === 'short').length } };
}
