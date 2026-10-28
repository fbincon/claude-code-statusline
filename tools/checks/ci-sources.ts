/** Read original successful CI executions and their source-bound envelopes. */
import assert from 'node:assert/strict';
import { githubRead, readJobs, CI_REPOSITORY } from './ci-watch.ts';
import { artifactIdentity, artifactJson, git, listRunArtifacts, newestArtifact, policyDigest, requireRun, validateComplete, verifyWorkflowSource, type CompleteEvidence, type ArtifactIdentity } from './ci-evidence.ts';
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
export async function requireGate(run: any): Promise<void> {
    const gates = (await readJobs(run.id, 'latest')).filter(job => job.name === 'Complete candidate evidence');
    assert.equal(gates.length, 1, 'Missing or ambiguous required aggregate');
    assert.equal(gates[0].conclusion, 'success', 'Required aggregate did not pass');
}
export async function verifyExecutionJobs(record: CompleteEvidence): Promise<void> {
    const attempts = [...new Set<number>(record.executions.map(value => Number(value.execution.attempt)))];
    for (const attempt of attempts) {
        const jobs: any[] = [];
        for (let page = 1; page <= 20; page++) {
            const result = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${record.run_id}/attempts/${attempt}/jobs?per_page=100&page=${page}`);
            jobs.push(...result.jobs); if (jobs.length >= result.total_count) break; assert(page < 20, 'Original job pagination exceeded');
        }
        for (const execution of record.executions.filter(value => Number(value.execution.attempt) === attempt)) {
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
    validateComplete(record, run, artifacts);
    await requireGate(run);
    await verifyExecutionJobs(record);
    await verifyWorkflowSource(record);
    assert.equal(record.tree, git('rev-parse', record.source_commit + '^{tree}'), 'Accepted tree differs');
    assert.equal(record.policy_sha256, policyDigest(record.source_commit), 'Acceptance policy differs');
    return { record, envelope: artifactIdentity(envelope), artifact_ids: [...record.artifacts.map(value => value.id), envelope.id] };
}
