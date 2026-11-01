/** Read original successful CI executions and their source-bound envelopes. */
import assert from 'node:assert/strict';
import { githubRead, CI_REPOSITORY } from './ci-watch.ts';
import { artifactIdentity, artifactJson, git, listRunArtifacts, newestArtifact, policyDigest, requireRun, validateComplete, verifyWorkflowSource, coverageContext, type CompleteEvidenceV2, type CompleteEvidence, type ArtifactIdentity } from './ci-evidence.ts';
import { coverageVersionAt } from './ci-coverage.ts';
import { verifySourceLanguage } from './i18n-evidence.ts';
export async function runsFor(commit: string, event = 'push'): Promise<any[]> {
    assert.match(commit, /^[a-f0-9]{40}$/u);
    const runs: any[] = [];
    for (let page = 1; page <= 10; page++) {
        const value = await githubRead(`repos/${CI_REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${commit}&event=${event}&per_page=100&page=${page}`);
        runs.push(...value.workflow_runs); if (value.workflow_runs.length < 100) return runs;
    }
    throw new Error('CI run pagination limit exceeded');
}
export function latestRun(runs: any[], commit: string, branch: string, event = 'push'): any | undefined {
    const result = runs.filter(run => run.head_sha === commit && run.head_branch === branch && run.event === event && run.path === '.github/workflows/ci.yml' &&
        run.repository?.full_name === CI_REPOSITORY && run.head_repository?.full_name === CI_REPOSITORY).sort((a, b) => b.id - a.id)[0];
    if (result) requireRun(result, commit, branch, event); return result;
}
async function attemptJobs(runId: number, attempt: number): Promise<any[]> {
    assert(Number.isSafeInteger(runId) && runId > 0 && Number.isSafeInteger(attempt) && attempt > 0);
    const jobs: any[] = [];
    for (let page = 1; page <= 20; page++) {
        const result = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`);
        jobs.push(...result.jobs); if (jobs.length >= result.total_count) return jobs;
    }
    throw new Error('Original job pagination exceeded');
}
export async function requireGate(run: any): Promise<any> {
    // Pin the observed attempt. The mutable latest-jobs alias can be expensive
    // (and fail with 502 after retries), and may switch attempts while reading.
    const gates = (await attemptJobs(run.id, run.run_attempt)).filter(job => job.name === 'Complete candidate evidence');
    assert.equal(gates.length, 1, 'Missing or ambiguous required aggregate');
    assert.equal(gates[0].conclusion, 'success', 'Required aggregate did not pass');
    const fresh = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${run.id}`);
    requireRun(fresh, run.head_sha, run.head_branch, run.event);
    assert.equal(fresh.run_attempt, run.run_attempt, 'Applicable CI attempt changed during verification');
    return gates[0];
}
/** A subsequent attempt can retain a previous success with a different job ID but
 * its original timestamps. A real later execution supersedes the earlier one,
 * including when it failed to upload any artifact. */
export async function latestPhysicalJobs(runId: number, lastAttempt: number, commit: string, specs: { job: string; os: string }[]) {
    assert(Number.isSafeInteger(lastAttempt) && lastAttempt >= 1 && lastAttempt <= 100, 'Invalid Actions attempt count');
    const expected = new Map(specs.map(spec => [spec.job, spec.os]));
    assert.equal(expected.size, specs.length, 'Duplicate planned physical job');
    const latest = new Map<string, { job: any; attempt: number }>();
    for (let attempt = 1; attempt <= lastAttempt; attempt++) {
        const visited = new Set<string>();
        for (const job of await attemptJobs(runId, attempt)) {
            if (!expected.has(job.name)) continue;
            assert(!visited.has(job.name), 'Ambiguous physical jobs in attempt ' + attempt); visited.add(job.name);
            assert.equal(job.run_id, runId); assert.equal(job.head_sha, commit); assert.equal(job.run_attempt, attempt);
            assert(Number.isSafeInteger(job.id) && job.id > 0);
            const prior = latest.get(job.name)?.job;
            if (prior && prior.started_at === job.started_at && prior.completed_at === job.completed_at) {
                assert.equal(job.conclusion, prior.conclusion, 'Conflicting retained job result');
                assert(job.id === prior.id || Date.parse(job.created_at) > Date.parse(job.completed_at),
                    'Indistinguishable original and repeated physical job times');
                continue;
            }
            latest.set(job.name, { job, attempt });
        }
    }
    for (const [name, os] of expected) {
        const original = latest.get(name); assert(original, 'Missing original physical job ' + name);
        const job = original.job;
        assert.equal(job.conclusion, 'success', 'Latest physical execution did not pass: ' + name); assert.equal(job.status, 'completed');
        assert(Array.isArray(job.labels) && job.labels.includes(os), 'Physical job ran on an unrelated runner');
        assert(Date.parse(job.created_at) <= Date.parse(job.started_at), 'Retained job cannot impersonate its original');
    }
    return latest;
}
async function verifyLatestPhysicalJobs(record: CompleteEvidenceV2): Promise<void> {
    const latest = await latestPhysicalJobs(record.run_id, record.attempt, record.source_commit, record.coverage_plan.producers);
    for (const execution of record.executions) {
        const original = latest.get(execution.job_name); assert(original, 'Missing original physical job');
        assert.equal(original.job.id, execution.job_id, 'A later actual physical execution supersedes this receipt');
        assert.equal(original.attempt, execution.identity.attempt, 'Receipt attribution is not the original execution attempt');
        if (execution.job_created_at !== undefined) assert.equal(original.job.created_at, execution.job_created_at, 'Original job creation identity changed');
        assert.equal(original.job.started_at, execution.started_at); assert.equal(original.job.completed_at, execution.completed_at);
    }
}
async function verifyPhysicalBasis(record: CompleteEvidenceV2, run: any): Promise<void> {
    const { basis, base } = coverageContext(record);
    if (record.event === 'pull_request') {
        const pr = await githubRead(`repos/${CI_REPOSITORY}/pulls/${record.pr!.number}`);
        assert.equal(pr.number, record.pr!.number); assert.equal(pr.draft, false);
        assert.equal(pr.base.repo.full_name, CI_REPOSITORY); assert.equal(pr.head.repo.full_name, CI_REPOSITORY); assert.equal(pr.base.ref, 'main');
        assert.equal(pr.head.sha, record.source_commit); assert.equal(pr.head.ref, record.branch);
        // The current PR base can have advanced. Prefer GitHub's exact linkage on
        // the original run so a changed integration can subsequently reclassify.
        const associations = (run.pull_requests ?? []).filter((item: any) => item.number === pr.number && item.head?.sha === record.source_commit);
        if (associations.length) {
            assert.equal(associations.length, 1, 'Ambiguous Actions pull-request relation');
            const [original] = associations;
            assert.equal(original.head.ref, record.branch); assert.equal(original.base.ref, 'main');
            assert.equal(original.base.sha, record.pr!.base, 'Source coverage uses the wrong original PR base');
            for (const repository of [original.head.repo, original.base.repo])
                assert(repository?.url === `https://api.github.com/repos/${CI_REPOSITORY}` || repository?.full_name === CI_REPOSITORY, 'Unrelated original PR repository');
        } else assert.equal(pr.base.sha, record.pr!.base, 'Original PR base is unverifiable');
    } else if (basis === 'accepted-main') {
        assert(base); git('merge-base', '--is-ancestor', record.source_commit, 'refs/remotes/origin/main');
        const previous = latestRun(await runsFor(base), base, 'main'); assert(previous, 'Missing verified first-parent gate for coverage'); await requireGate(previous);
    }
}
export async function verifyExecutionJobs(record: CompleteEvidence): Promise<void> {
    if (record.schema_version === 2) return verifyLatestPhysicalJobs(record);
    const executions: any[] = record.executions;
    const attempts = [...new Set<number>(executions.map(value => Number(value.execution.attempt)))];
    for (const attempt of attempts) {
        const jobs = await attemptJobs(record.run_id, attempt);
        for (const execution of executions.filter(value => Number(value.execution.attempt) === attempt)) {
            const matching = jobs.filter(job => job.id === execution.job_id);
            assert.equal(matching.length, 1, 'Missing original execution job'); const job = matching[0];
            assert.equal(job.conclusion, 'success', 'Original execution job did not pass');
            assert.equal(job.name, execution.job_name, 'Original execution attribution changed');
            assert.equal(job.started_at, execution.started_at); assert.equal(job.completed_at, execution.completed_at);
        }
    }
}
export async function completeSource(run: any): Promise<{ record: CompleteEvidence; envelope: ArtifactIdentity; artifact_ids: number[] }> {
    const artifacts = await listRunArtifacts(run.id), envelope = newestArtifact(artifacts, 'ts06-acceptance');
    const record = await artifactJson(envelope, 'ci-evidence.json') as CompleteEvidence;
    assert.equal(record.source_commit, run.head_sha);
    assert.equal(record.schema_version, coverageVersionAt(record.source_commit), 'Evidence schema differs from immutable source activation');
    validateComplete(record, run, artifacts);
    if (record.schema_version === 2) await verifyPhysicalBasis(record, run);
    const gate = await requireGate(run);
    if (record.schema_version === 2 && record.product_checks) {
        const receipt = record.product_checks;
        assert.equal(gate.id,receipt.job_id,'Supplemental receipt names a different aggregate job');
        assert(Date.parse(gate.started_at) <= Date.parse(receipt.started_at) + 1000 &&
            Date.parse(receipt.completed_at) <= Date.parse(gate.completed_at) + 1000, 'Supplemental checks outside aggregate execution');
    }
    await verifyExecutionJobs(record);
    await verifyWorkflowSource(record);
    assert.equal(record.tree, git('rev-parse', record.source_commit + '^{tree}'), 'Accepted tree differs');
    assert.equal(record.policy_sha256, policyDigest(record.source_commit), 'Acceptance policy differs');
    verifySourceLanguage(record.language, record.source_commit);
    if (record.schema_version === 2) {
        // A new run/attempt can start while an older attempt's entire physical job graph is being checked.
        const newest = latestRun(await runsFor(record.source_commit, record.event), record.source_commit, record.branch, record.event);
        assert(newest && newest.id === run.id && newest.run_attempt === record.attempt, 'Latest applicable physical source changed during verification');
    }
    return { record, envelope: artifactIdentity(envelope), artifact_ids: [...record.artifacts.map(value => value.id), envelope.id] };
}
