/** Maintenance evidence is distinct from the immutable complete product receipts. */
import assert from 'node:assert/strict';
import { artifactIdentity, artifactJson, listRunArtifacts, newestArtifact, requireRun, type ArtifactIdentity } from './ci-evidence.ts';
import { completeSource, latestRun, runsFor, requireGate } from './ci-sources.ts';
import { githubRead, CI_REPOSITORY } from './ci-watch.ts';
import { assertPlan, createImpactPlan, type ImpactPlan } from './impact-plan.ts';
import { canonical, git, hash, productInputs } from './impact-content.ts';
import type { ScopedReceipt } from './impact-runner.ts';

export interface MaintenanceReference { run_id: number; commit: string; envelope: ArtifactIdentity; sha256: string }
export interface ExecutionJob { id: number; name: string; attempt: number; started_at: string; completed_at: string }
export interface MaintenanceRecord {
    schema_version: 1; kind: 'maintenance'; repository: string; commit: string; tree: string;
    run_id: number; attempt: number; event: string; branch: string; created_at: string; expires_at: string;
    plan: ImpactPlan; plan_sha256: string; product_base: string; product_inputs_sha256: string;
    pr: { number: number; head: string; base: string; draft: boolean } | null;
    receipts: { artifact: ArtifactIdentity; sha256: string; receipt: ScopedReceipt; job: ExecutionJob }[];
    reused?: { source: MaintenanceReference; integration: { commit: string; base: string; head: string; pr: number; tree: string }; verifier_commit: string; verifier_sha256: string };
}
export function validateScopedReceipt(receipt: ScopedReceipt, plan: ImpactPlan, taskId: string, runId: number): void {
    assert.equal(receipt.schema_version, 1); assert.equal(receipt.kind, 'scoped-checks'); assert.equal(receipt.status, 'pass');
    assert.equal(receipt.commit, plan.head); assert.equal(receipt.plan_sha256, hash(canonical(plan)));
    const task = plan.tasks.find(item => item.id === taskId); assert(task);
    assert.deepEqual(receipt.task, task); assert.deepEqual(receipt.checks, task.checks);
    assert.equal(receipt.platform, task.os.startsWith('ubuntu') ? 'linux' : task.os.startsWith('windows') ? 'win32' : 'darwin');
    assert.equal(receipt.node, 'v' + git('show', plan.head + ':.node-version'));
    assert.equal(Number(receipt.execution.run_id), runId); assert.equal(receipt.execution.job, 'scoped');
    assert(Number.isSafeInteger(Number(receipt.execution.attempt)) && Number(receipt.execution.attempt) > 0);
    assert(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at));
    if (task.checks.includes('packaging')) assert.match(receipt.package_sha256!, /^[a-f0-9]{64}$/u);
}
export function validateMaintenance(record: MaintenanceRecord, run: any, now = Date.now()): void {
    assert.equal(record.schema_version, 1); assert.equal(record.kind, 'maintenance'); assert.equal(record.repository, CI_REPOSITORY);
    requireRun(run, record.commit, record.branch, record.event);
    assert.equal(record.run_id, run.id); assert.equal(record.attempt, run.run_attempt);
    assert.equal(record.tree, git('rev-parse', record.commit + '^{tree}'));
    assert(Date.parse(record.created_at) <= now + 60000 && Date.parse(record.expires_at) > now && Date.parse(record.expires_at) - Date.parse(record.created_at) <= 30 * 86400000);
    assertPlan(record.plan); assert.equal(record.plan.route, 'maintenance'); assert.equal(record.plan_sha256, hash(canonical(record.plan)));
    assert.equal(record.product_inputs_sha256, productInputs(record.commit)); assert.equal(record.product_base, record.plan.base);
    if (record.reused) {
        assert.equal(record.event, 'push'); assert.equal(record.branch, 'main');
        assert.equal(record.reused.integration.commit, record.commit); assert.equal(record.reused.integration.head, record.plan.head);
        assert.equal(record.reused.integration.base, record.plan.base); assert.equal(record.reused.verifier_commit, record.plan.base);
        assert.match(record.reused.verifier_sha256, /^[a-f0-9]{64}$/u); assert.equal(record.receipts.length, 0);
    } else {
        assert.equal(record.plan.head, record.commit);
        assert.deepEqual(record.receipts.map(item => item.receipt.task.id).sort(), record.plan.tasks.map(task => task.id).sort());
        for (const item of record.receipts) {
            artifactIdentity({ ...item.artifact, expired: false }, now); assert.equal(hash(canonical(item.receipt)), item.sha256);
            validateScopedReceipt(item.receipt, record.plan, item.receipt.task.id, record.run_id);
            assert(Number.isSafeInteger(item.job.id) && item.job.id > 0); assert.equal(item.job.name, 'Scoped / ' + item.receipt.task.id);
            assert.equal(item.job.attempt, Number(item.receipt.execution.attempt));
        }
    }
    if (record.event === 'pull_request') {
        assert(record.pr && !record.pr.draft); assert.equal(record.pr.head, record.commit); assert.equal(record.pr.base, record.plan.base);
    } else assert.equal(record.pr, null);
}
export async function jobsFor(runId: number, attempt: number): Promise<any[]> {
    const jobs: any[] = [];
    for (let page = 1; page <= 20; page++) {
        const result = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`);
        jobs.push(...result.jobs); if (jobs.length >= result.total_count) return jobs;
    }
    throw new Error('Scoped job pagination exceeded');
}
export function executionJob(jobs: any[], name: string, attempt: number): ExecutionJob {
    const matches = jobs.filter(job => job.name === name); assert.equal(matches.length, 1, 'Missing or ambiguous execution: ' + name);
    const job = matches[0]; assert.equal(job.conclusion, 'success', 'Original execution did not pass: ' + name);
    assert(Number.isSafeInteger(job.id) && job.id > 0 && Date.parse(job.started_at) <= Date.parse(job.completed_at));
    return { id: job.id, name, attempt, started_at: job.started_at, completed_at: job.completed_at };
}
export async function verifyScopedJobs(record: MaintenanceRecord): Promise<void> {
    for (const attempt of new Set(record.receipts.map(item => Number(item.receipt.execution.attempt)))) {
        const jobs = await jobsFor(record.run_id, attempt);
        for (const item of record.receipts.filter(row => Number(row.receipt.execution.attempt) === attempt)) {
            const selected = executionJob(jobs, 'Scoped / ' + item.receipt.task.id, attempt); assert.deepEqual(selected, item.job);
            assert(Date.parse(selected.started_at) <= Date.parse(item.receipt.started_at) + 1000);
            assert(Date.parse(selected.completed_at) + 1000 >= Date.parse(item.receipt.completed_at));
        }
    }
}
export async function maintenanceSource(run: any, visited = new Set<number>()): Promise<{ record: MaintenanceRecord; reference: MaintenanceReference }> {
    assert(!visited.has(run.id) && visited.size < 100, 'Cyclic or excessive maintenance chain'); visited.add(run.id);
    const artifacts = await listRunArtifacts(run.id), artifact = newestArtifact(artifacts, 'ci-maintenance');
    const record = await artifactJson(artifact, 'maintenance.json') as MaintenanceRecord;
    validateMaintenance(record, run); await requireGate(run);
    const workflow = await githubRead(`repos/${CI_REPOSITORY}/contents/.github/workflows/ci.yml?ref=${record.commit}`);
    assert.equal(workflow.sha, git('rev-parse', record.commit + ':.github/workflows/ci.yml'));
    if (record.reused) {
        const pr = await verifyMaintenanceMerge(record.reused.integration);
        const sourceRun = latestRun(await runsFor(pr.head.sha, 'pull_request'), pr.head.sha, pr.head.ref, 'pull_request'); assert(sourceRun);
        const original = await maintenanceSource(sourceRun, visited); assert.deepEqual(original.reference, record.reused.source);
        assert.deepEqual(original.record.plan, record.plan);
    } else {
        for (const item of record.receipts) {
            const current = artifactIdentity(newestArtifact(artifacts, item.artifact.name)); assert.deepEqual(current, item.artifact);
            assert.deepEqual(await artifactJson({ ...current, expired: false }, 'receipt.json'), item.receipt);
        }
        await verifyScopedJobs(record);
    }
    await requireGate(run);
    return { record, reference: { run_id: run.id, commit: record.commit, envelope: artifactIdentity(artifact), sha256: hash(canonical(record)) } };
}
export async function verifyMaintenanceMerge(relation: NonNullable<MaintenanceRecord['reused']>['integration']): Promise<any> {
    const pr = await githubRead(`repos/${CI_REPOSITORY}/pulls/${relation.pr}`);
    assert(pr.merged_at && pr.state === 'closed' && !pr.draft);
    assert.equal(pr.base.repo.full_name, CI_REPOSITORY); assert.equal(pr.head.repo.full_name, CI_REPOSITORY); assert.equal(pr.base.ref, 'main');
    assert.equal(pr.merge_commit_sha, relation.commit); assert.equal(pr.head.sha, relation.head); assert.equal(pr.base.sha, relation.base);
    assert.deepEqual(git('rev-list', '--parents', '-n', '1', relation.commit).split(' '), [relation.commit, relation.base, relation.head]);
    assert.equal(git('rev-parse', relation.commit + '^{tree}'), relation.tree); assert.equal(git('rev-parse', relation.head + '^{tree}'), relation.tree);
    git('merge-base', '--is-ancestor', relation.commit, 'refs/remotes/origin/main'); return pr;
}
export async function selectMaintenanceMain(plan: ImpactPlan, before: string): Promise<MaintenanceRecord['reused'] | undefined> {
    const parts = git('rev-list', '--parents', '-n', '1', plan.head).split(' ');
    if (parts.length !== 3) return undefined;
    git('merge-base', '--is-ancestor', before, parts[1]!);
    const pulls: any[] = [];
    for (let page = 1; page <= 10; page++) {
        const rows = await githubRead(`repos/${CI_REPOSITORY}/commits/${plan.head}/pulls?per_page=100&page=${page}`); pulls.push(...rows);
        if (rows.length < 100) break; assert(page < 10, 'Associated PR pagination exceeded');
    }
    const owned = pulls.filter(pr => pr.merged_at && pr.merge_commit_sha === plan.head && pr.head.repo?.full_name === CI_REPOSITORY && pr.base.repo?.full_name === CI_REPOSITORY);
    assert(owned.length <= 1, 'Ambiguous maintenance merge'); if (!owned.length) return undefined;
    const pr = owned[0], run = latestRun(await runsFor(pr.head.sha, 'pull_request'), pr.head.sha, pr.head.ref, 'pull_request'); assert(run, 'Missing final maintenance PR run');
    await requireGate(run);
    if (parts[1] !== pr.base.sha || parts[2] !== pr.head.sha || git('rev-parse', pr.head.sha + '^{tree}') !== plan.tree) return undefined;
    const artifacts = await listRunArtifacts(run.id);
    if (maintenanceSourceKind(artifacts) === 'complete') {
        // Only a genuinely verified complete compatibility PR can use this
        // transition. Missing supported maintenance evidence must stay blocking.
        await completeSource(run); return undefined;
    }
    const source = await maintenanceSource(run);
    if (source.record.plan.base !== parts[1]) return undefined;
    const baseRun = latestRun(await runsFor(parts[1]!), parts[1]!, 'main'); assert(baseRun); await requireGate(baseRun);
    const integration = { commit: plan.head, base: parts[1]!, head: pr.head.sha, pr: pr.number, tree: plan.tree };
    await verifyMaintenanceMerge(integration);
    return { source: source.reference, integration, verifier_commit: parts[1]!, verifier_sha256: '' };
}
export async function collectScopedReceipts(plan: ImpactPlan, runId: number): Promise<MaintenanceRecord['receipts']> {
    const artifacts = await listRunArtifacts(runId), receipts: MaintenanceRecord['receipts'] = [], attempts = new Map<number, any[]>();
    for (const task of plan.tasks) {
        const artifact = artifactIdentity(newestArtifact(artifacts, 'ci-scoped-' + task.id));
        const receipt = await artifactJson({ ...artifact, expired: false }, 'receipt.json') as ScopedReceipt;
        validateScopedReceipt(receipt, plan, task.id, runId);
        const attempt = Number(receipt.execution.attempt);
        if (!attempts.has(attempt)) attempts.set(attempt, await jobsFor(runId, attempt));
        receipts.push({ artifact, receipt, sha256: hash(canonical(receipt)), job: executionJob(attempts.get(attempt)!, 'Scoped / ' + task.id, attempt) });
    }
    return receipts;
}
export function maintenanceSourceKind(artifacts: { name: string }[]): 'complete' | 'maintenance' {
    if (artifacts.some(item => item.name === 'ci-maintenance')) return 'maintenance';
    assert(!artifacts.some(item => item.name === 'ci-impact-plan'), 'Missing supported maintenance evidence');
    assert(artifacts.some(item => item.name === 'ts06-acceptance'), 'Missing applicable PR evidence');
    return 'complete';
}
export async function verifyMaintenanceWithBase(reused: NonNullable<MaintenanceRecord['reused']>): Promise<void> {
    const pr = await verifyMaintenanceMerge(reused.integration);
    const baseRun = latestRun(await runsFor(reused.integration.base), reused.integration.base, 'main'); assert(baseRun); await requireGate(baseRun);
    const run = latestRun(await runsFor(pr.head.sha, 'pull_request'), pr.head.sha, pr.head.ref, 'pull_request'); assert(run);
    const source = await maintenanceSource(run); assert.deepEqual(source.reference, reused.source);
    const expected = createImpactPlan(reused.integration.base, reused.integration.head);
    assert(!['product', 'blocked'].includes(expected.route), 'Accepted base rejects maintenance classification');
    assert.deepEqual(source.record.plan.changes, expected.changes); assert.deepEqual(source.record.plan.tasks, expected.tasks);
}
