/** Promote an exact PR tree only through its real, protected main merge. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { githubRead, CI_REPOSITORY } from './ci-watch.ts';
import { artifactIdentity, artifactJson, digest, git, listRunArtifacts, newestArtifact, policyDigest, requireRun, type ArtifactIdentity } from './ci-evidence.ts';
import { completeSource, latestRun, runsFor, requireGate } from './ci-sources.ts';
import type { PromotionSelection } from './ci-promotion.ts';
import { BASE_VERIFICATION_CHECKS } from './ci-trust.ts';

export const SMOKE_TARGETS = ['ubuntu-24.04', 'windows-2025', 'macos-15'];
type Integration = NonNullable<PromotionSelection['integration']>;
async function associatedPulls(commit: string): Promise<any[]> {
    const result: any[] = [];
    for (let page = 1; page <= 10; page++) {
        const rows = await githubRead(`repos/${CI_REPOSITORY}/commits/${commit}/pulls?per_page=100&page=${page}`);
        assert(Array.isArray(rows)); result.push(...rows); if (rows.length < 100) return result;
    }
    throw new Error('Associated PR pagination limit exceeded');
}
function trustedMergedPr(pr: any): boolean {
    return Boolean(pr.merged_at && pr.state === 'closed' && !pr.draft && pr.base?.ref === 'main' &&
        pr.base.repo?.full_name === CI_REPOSITORY && pr.head?.repo?.full_name === CI_REPOSITORY);
}
export function mergeEquivalence(value: { commit: string; parents: string[]; before: string; head: string; base: string; tree: string; headTree: string }): string | null {
    if (value.parents.length !== 2) return 'Merge is not a two-parent merge commit';
    // A push may contain several merges. The actual first parent, not the push
    // boundary, is the integration base; selectMain checks the range separately.
    if (value.parents[0] !== value.base) return 'Main base changed after PR acceptance';
    if (value.parents[1] !== value.head) return 'Merged head differs from the accepted PR source';
    if (value.tree !== value.headTree) return 'Integrated tree differs from the accepted PR source';
    return null;
}
function localRelation(commit: string, before: string, pr: any) {
    const parts = git('rev-list', '--parents', '-n', '1', commit).split(' ');
    return { commit, parents: parts.slice(1), before, head: pr.head.sha, base: pr.base.sha,
        tree: git('rev-parse', commit + '^{tree}'), headTree: git('rev-parse', pr.head.sha + '^{tree}') };
}
export async function verifyMerge(integration: Integration): Promise<void> {
    const pr = await githubRead(`repos/${CI_REPOSITORY}/pulls/${integration.pr}`);
    assert(trustedMergedPr(pr), 'Integration is not an owned, reviewed main PR');
    assert.equal(pr.merge_commit_sha, integration.commit); assert.equal(pr.head.sha, integration.head); assert.equal(pr.base.sha, integration.base);
    const relation = localRelation(integration.commit, integration.base, pr);
    assert.equal(mergeEquivalence(relation), null); assert.equal(relation.tree, integration.tree);
    git('merge-base', '--is-ancestor', integration.commit, 'refs/remotes/origin/main');
}
async function acceptedPr(pr: any) {
    try {
        const run = latestRun(await runsFor(pr.head.sha, 'pull_request'), pr.head.sha, pr.head.ref, 'pull_request');
        assert(run, 'Missing final PR acceptance');
        const source = await completeSource(run);
        assert.equal(source.record.pr?.number, pr.number); assert.equal(source.record.pr?.head, pr.head.sha);
        return { run, ...source };
    } catch (error) { throw new Error(`PR #${pr.number} at ${pr.head.sha}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
}
export async function selectMain(commit: string, before: string): Promise<PromotionSelection> {
    const full = (reason: string): PromotionSelection => ({ schema_version: 1, route: 'full', commit, reason });
    const parents = git('rev-list', '--parents', '-n', '1', commit).split(' ').slice(1);
    if (parents.length !== 2) return full('Non-merge integration: source ancestry, compiler restoration and release identity require acceptance at main');
    assert.match(before, /^[a-f0-9]{40}$/u, 'Missing main push boundary');
    git('merge-base', '--is-ancestor', before, parents[0]!);
    const prs = (await associatedPulls(commit)).filter(pr => trustedMergedPr(pr) && pr.merge_commit_sha === commit);
    if (prs.length === 0) return full('No reusable owned merge-commit PR');
    assert.equal(prs.length, 1, 'Ambiguous merge provenance'); const pr = prs[0];
    const relation = localRelation(commit, before, pr), difference = mergeEquivalence(relation);
    try { git('cat-file', '-e', pr.head.sha + ':tools/checks/ci-evidence.ts'); } catch { return full('Legacy PR evidence requires complete main acceptance'); }
    const source = await acceptedPr(pr);
    // Invalid applicable evidence blocks even when the merge also needs new
    // acceptance. Never use a full run to hide a failed/missing source run.
    if (difference) return full(difference);
    if (source.record.pr!.base !== parents[0]) return full('PR acceptance used a different base commit');
    assert.equal(source.record.tree, relation.tree); assert.equal(source.record.policy_sha256, policyDigest(commit));
    try { git('cat-file', '-e', parents[0] + ':tools/checks/ci-sources.ts'); }
    catch { return full('Legacy base has no independent evidence verifier; establish complete main acceptance'); }
    const base = parents[0]!, baseRun = latestRun(await runsFor(base), base, 'main'); assert(baseRun, 'Previous main has no successful integration gate');
    await requireGate(baseRun);
    return { schema_version: 1, route: 'main', commit,
        reason: 'Reuse complete PR evidence for the identical integrated tree; verify with the accepted base and run three installation smokes',
        base_run: baseRun.id, push_before: before,
        changed_paths: git('diff', '--no-renames', '--name-only', base, commit, '--').split('\n').filter(Boolean),
        integration: { commit, base, head: pr.head.sha, pr: pr.number, tree: relation.tree },
        source_run: source.run.id, source_commit: pr.head.sha, filename: `fbincon-claude-code-statusline-${source.record.version}.tgz`,
        source_record: source.record, source_envelope: source.envelope, artifact_ids: source.artifact_ids };
}
export function validateSmokes(reports: any[], selection: PromotionSelection): void {
    assert(selection.integration && selection.source_record);
    assert.equal(reports.length, 3); assert.deepEqual(reports.map(row => row.target).sort(), [...SMOKE_TARGETS].sort());
    for (const row of reports) {
        assert.equal(row.schema_version, 1); assert.equal(row.status, 'pass'); assert.equal(row.kind, 'integration-smoke');
        assert.equal(row.integration_commit, selection.integration.commit); assert.equal(row.source_commit, selection.source_commit);
        assert.equal(row.tarball_sha256, selection.source_record.delivery[selection.filename!]);
        assert.equal(row.node, selection.source_record.toolchain.node); assert.match(row.node_sha256, /^[a-f0-9]{64}$/u);
        assert.equal(row.platform, ({ 'ubuntu-24.04': 'linux', 'windows-2025': 'win32', 'macos-15': 'darwin' } as Record<string, string>)[row.target]);
        assert.equal(row.arch, row.platform === 'darwin' ? 'arm64' : 'x64');
        assert.deepEqual(row.checks, ['offline-empty-cache-install', 'version', 'install', 'doctor', 'render', 'configuration-read-write', 'uninstall-preserves-unowned-settings']);
        assert.equal(row.model_calls, 0); assert.equal(row.lifecycle_scripts, false);
        assert(Number.isSafeInteger(Number(row.execution?.run_id)) && Number(row.execution.run_id) > 0);
        assert(Number.isSafeInteger(Number(row.execution?.attempt)) && Number(row.execution.attempt) > 0);
    }
}
export function validateBaseVerification(verification: any, selection: PromotionSelection, run: { id: number; run_attempt: number }, read = git): void {
    assert(verification && selection.integration && selection.source_record);
    assert.equal(verification.schema_version, 1); assert.equal(verification.kind, 'base-verifier'); assert.equal(verification.status, 'pass');
    assert.deepEqual(verification.checks, BASE_VERIFICATION_CHECKS);
    assert.equal(verification.verifier_commit, selection.integration.base);
    assert.equal(verification.verifier_tree, read('rev-parse', selection.integration.base + '^{tree}'));
    assert.equal(verification.source_run, selection.source_run); assert.equal(verification.source_commit, selection.source_commit);
    assert.equal(verification.source_record_sha256, digest(JSON.stringify(selection.source_record)));
    assert.deepEqual(verification.source_envelope, selection.source_envelope);
    assert.equal(verification.integration_commit, selection.integration.commit);
    assert.equal(verification.run_id, run.id); assert.equal(verification.attempt, run.run_attempt);
    assert(Number.isSafeInteger(verification.base_run) && verification.base_run > 0);
    if (selection.base_run) assert.equal(verification.base_run, selection.base_run);
}
export function validateIntegration(record: any, run: any, selection: PromotionSelection, artifacts: any[], read = git): void {
    assert(selection.integration && selection.source_record && selection.source_envelope);
    requireRun(run, selection.integration.commit, 'main');
    assert([1, 2].includes(record.schema_version)); assert.equal(record.kind, 'main-promotion'); assert.equal(record.status, 'pass');
    assert.equal(record.repository, CI_REPOSITORY); assert.equal(record.run_id, run.id); assert.equal(record.attempt, run.run_attempt);
    assert.deepEqual(record.integration, selection.integration); assert.equal(record.source_commit, selection.source_commit); assert.equal(record.source_run, selection.source_run);
    assert.deepEqual(record.source_envelope, selection.source_envelope); assert.equal(record.source_record_sha256, digest(JSON.stringify(selection.source_record)));
    assert.deepEqual(record.delivery, selection.source_record.delivery); assert.equal(record.policy_sha256, selection.source_record.policy_sha256);
    if (record.schema_version === 2) validateBaseVerification(record.verification, selection, run, read);
    validateSmokes(record.smokes, selection);
    const expectedNames = SMOKE_TARGETS.map(target => 'ci-integration-' + target).sort();
    assert.deepEqual(record.artifacts.map((item: ArtifactIdentity) => item.name).sort(), expectedNames);
    for (const expected of record.artifacts) {
        const actual = newestArtifact(artifacts, expected.name);
        assert.deepEqual(artifactIdentity(actual), expected, 'Original integration artifact changed');
    }
    for (const smoke of record.smokes) {
        assert.equal(Number(smoke.execution.run_id), run.id); assert(Number(smoke.execution.attempt) <= record.attempt);
        assert(Number.isSafeInteger(smoke.job_id) && smoke.job_id > 0); assert.match(smoke.receipt_sha256, /^[a-f0-9]{64}$/u);
    }
}
export async function integratedCandidate(commit: string): Promise<PromotionSelection | undefined> {
    const prs = (await associatedPulls(commit)).filter(pr => trustedMergedPr(pr) && pr.head.sha === commit);
    if (!prs.length) return undefined; assert.equal(prs.length, 1, 'Ambiguous candidate integration'); const pr = prs[0];
    const integration: Integration = { commit: pr.merge_commit_sha, base: pr.base.sha, head: commit, pr: pr.number, tree: git('rev-parse', commit + '^{tree}') };
    await verifyMerge(integration);
    const source = await acceptedPr(pr); assert.equal(source.record.pr!.base, integration.base);
    const main = latestRun(await runsFor(integration.commit), integration.commit, 'main'); assert(main, 'Missing successful main integration');
    await requireGate(main);
    const artifacts = await listRunArtifacts(main.id), envelope = newestArtifact(artifacts, 'ci-promotion');
    const record = await artifactJson(envelope, 'promotion.json');
    const result: PromotionSelection = { schema_version: 1, route: 'main', reason: 'Verified original PR candidate and its main integration', commit: integration.commit, integration,
        source_commit: commit, source_run: source.run.id, source_record: source.record, source_envelope: source.envelope, artifact_ids: source.artifact_ids,
        filename: `fbincon-claude-code-statusline-${source.record.version}.tgz`, integration_run: main.id, integration_envelope: artifactIdentity(envelope), integration_record_sha256: digest(JSON.stringify(record)) };
    validateIntegration(record, main, result, artifacts);
    if (record.schema_version === 2) {
        const base = latestRun(await runsFor(integration.base), integration.base, 'main');
        assert(base && base.id === record.verification.base_run, 'Accepted base verification changed'); await requireGate(base);
    }
    await Promise.all(record.smokes.map(async (smoke: any) => {
        const artifact = newestArtifact(artifacts, 'ci-integration-' + smoke.target);
        const original = await artifactJson(artifact, 'smoke.json', smoke.receipt_sha256);
        const { job_id: _, receipt_sha256: __, ...expected } = smoke;
        assert.deepEqual(original, expected, 'Original integration receipt changed');
    }));
    return result;
}
export async function recordIntegration(selection: PromotionSelection, directory: string, selectionFile: string, output: string, verification?: any): Promise<void> {
    const selected = JSON.parse(fs.readFileSync(selectionFile, 'utf8'));
    const reports = SMOKE_TARGETS.map(target => {
        const bytes = fs.readFileSync(join(directory, 'ci-integration-' + target, 'smoke.json'));
        return { ...JSON.parse(bytes.toString('utf8')), receipt_sha256: digest(bytes) };
    });
    validateSmokes(reports, selection);
    const runId = Number(process.env.GITHUB_RUN_ID), attempt = Number(process.env.GITHUB_RUN_ATTEMPT), byAttempt = new Map<number, any[]>();
    assert.equal(selected.run_id, runId);
    for (const report of reports) {
        assert.equal(Number(report.execution.run_id), runId); const originalAttempt = Number(report.execution.attempt); assert(originalAttempt <= attempt);
        if (!byAttempt.has(originalAttempt)) {
            const jobs: any[] = [];
            for (let page = 1; page <= 20; page++) {
                const result = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${runId}/attempts/${originalAttempt}/jobs?per_page=100&page=${page}`);
                jobs.push(...result.jobs); if (jobs.length >= result.total_count) break; assert(page < 20);
            }
            byAttempt.set(originalAttempt, jobs);
        }
        const name = 'Integration smoke / ' + report.target;
        const matches = byAttempt.get(originalAttempt)!.filter(row => row.name === name && row.conclusion === 'success');
        assert.equal(matches.length, 1, 'Missing successful original integration job'); report.job_id = matches[0].id;
    }
    validateBaseVerification(verification, selection, { id: runId, run_attempt: attempt });
    const record = { schema_version: 2, kind: selection.mode === 'diagnostic' ? 'diagnostic-main-promotion' : 'main-promotion', status: 'pass', repository: CI_REPOSITORY, run_id: runId, attempt,
        integration: selection.integration, source_commit: selection.source_commit, source_run: selection.source_run, source_envelope: selection.source_envelope,
        source_record_sha256: digest(JSON.stringify(selection.source_record)), delivery: selection.source_record!.delivery, policy_sha256: selection.source_record!.policy_sha256,
        verification, executed: ['merge-parents', 'pr-head-base', 'tree-and-policy', 'original-artifacts', 'complete-receipts', 'accepted-base-verifier', 'promotion-contract-regressions', 'three-platform-installation-smoke'],
        reused: selection.source_record!.coverage, smokes: reports, artifacts: selected.artifacts, created_at: new Date().toISOString() };
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { run: { type: 'string' }, output: { type: 'string' } } }); assert(values.run && values.output);
    const runId = Number(values.run); assert(Number.isSafeInteger(runId) && runId > 0);
    const available = await listRunArtifacts(runId), artifacts = SMOKE_TARGETS.map(target => artifactIdentity(newestArtifact(available, 'ci-integration-' + target)));
    fs.writeFileSync(values.output, JSON.stringify({ run_id: runId, artifacts }, null, 2) + '\n');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `artifact_ids=${artifacts.map(row => row.id).join(',')}\n`);
}
