/** Read original successful CI executions and their source-bound envelopes. */
import assert from 'node:assert/strict';
import { githubRead, CI_REPOSITORY } from './ci-watch.ts';
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
export async function completeSource(run: any): Promise<{ record: CompleteEvidence; envelope: ArtifactIdentity; artifact_ids: number[] }> {
    const artifacts = await listRunArtifacts(run.id), envelope = newestArtifact(artifacts, 'ts06-acceptance');
    const record = await artifactJson(envelope, 'ci-evidence.json') as CompleteEvidence;
    validateComplete(record, run, artifacts);
    await verifyWorkflowSource(record);
    assert.equal(record.tree, git('rev-parse', record.source_commit + '^{tree}'), 'Accepted tree differs');
    assert.equal(record.policy_sha256, policyDigest(record.source_commit), 'Acceptance policy differs');
    return { record, envelope: artifactIdentity(envelope), artifact_ids: [...record.artifacts.map(value => value.id), envelope.id] };
}
