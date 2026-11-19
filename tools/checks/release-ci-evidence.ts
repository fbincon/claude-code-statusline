import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifactIdentity, artifactJson, digest, git, listRunArtifacts, newestArtifact, verifyWorkflowSource, type ArtifactIdentity } from './ci-evidence.ts';
import { associatedPulls, trustedMergedPr, verifyMerge } from './ci-integration.ts';
import { latestPhysicalJobs, requireGate, runsFor } from './ci-sources.ts';
import { verifyTagIdentity } from './ci-tag.ts';
import { exportBaseVerifiers } from './ci-trust.ts';
import { CI_REPOSITORY, githubRead } from './ci-watch.ts';
import {
    buildChecks, candidateBuild, candidateCases, candidateGate, digestPattern, hostVersion, integrationCases, integrationGate,
    integrationPreflight, isReleaseBranch, packageSmokeChecks, recordDigest, releaseFilenames, releasePackageArtifact,
    releasePolicyAt, releaseWorkflow, shaPattern, sourceVersion, tagGate, validateDeliveryHashes, type Case, type Producer,
} from './release-ci-policy.ts';

type Execution = { run_id: number; attempt: number; workflow_sha: string };
export type Pull = { pr: number; head: string; base: string; branch: string; tree: string };
export type Merge = Pull & { commit: string };
type ReceiptRef = { artifact: ArtifactIdentity; job_id: number; job: string; attempt: number; started_at: string; completed_at: string };
type EvidenceRef = { run_id: number; attempt: number; artifact: ArtifactIdentity; sha256: string };
type ReleaseContext = { schema_version: 1; execution: Execution; status: 'pass' };
type Candidate = ReleaseContext & {
    kind: 'release-candidate'; pull: Pull; version: string; delivery: Record<string, string>;
    package: ArtifactIdentity; jobs: ReceiptRef[];
};
export type AcceptedCandidate = { candidate: Candidate; candidate_ref: EvidenceRef; merge: Merge };
type Preflight = ReleaseContext & {
    kind: 'release-preflight'; merge: Merge; candidate_ref: EvidenceRef;
    verifier_commit: string; verifier_tree: string; workflow_sha: string; delivery: Record<string, string>;
};
type Integration = ReleaseContext & { kind: 'release-main'; verification: Preflight; jobs: ReceiptRef[] };
type Tag = ReleaseContext & {
    kind: 'release-tag'; tag: string; tag_object: string; merge: Merge;
    candidate_ref: EvidenceRef; integration_ref: EvidenceRef; delivery: Record<string, string>;
};
export type TagInput = AcceptedCandidate & { tag: string; tag_object: string; integration_ref: EvidenceRef };

const candidateEnvelope = 'ci-release-accepted', mainEnvelope = 'ci-release-integrated', tagEnvelope = 'ci-release-tag';

export function pullSource(pr: any): Pull {
    assert(pr && Number.isSafeInteger(pr.number) && pr.number > 0);
    assert.equal(pr.draft, false, 'Release acceptance requires a ready PR');
    assert.equal(pr.base?.ref, 'main');
    assert.equal(pr.base.repo?.full_name, CI_REPOSITORY);
    assert.equal(pr.head?.repo?.full_name, CI_REPOSITORY);
    assert(isReleaseBranch(pr.head.ref), 'Release acceptance requires an owned release/ branch');
    const head: string = pr.head.sha, base: string = pr.base.sha;
    assert.match(head, shaPattern); assert.match(base, shaPattern);
    git('merge-base', '--is-ancestor', base, head);
    return { pr: pr.number, head, base, branch: pr.head.ref, tree: git('rev-parse', head + '^{tree}') };
}

export async function mergeSource(pr: any): Promise<Merge> {
    assert(trustedMergedPr(pr), 'Release integration requires a merged PR');
    const merge = { ...pullSource(pr), commit: pr.merge_commit_sha as string };
    assert.match(merge.commit, shaPattern);
    await verifyMerge(merge);
    return merge;
}

type RunTarget =
    | { phase: 'candidate' | 'main'; pull: Pull; commit: string }
    | { phase: 'tag'; tag: string; commit: string }
    | { phase: 'diagnostic'; branch: string; commit: string };

function runTitle(target: RunTarget): string {
    if (target.phase === 'tag') return `Release tag ${target.tag} ${target.commit}`;
    if (target.phase === 'diagnostic') return `Release diagnostic ${target.commit}`;
    return `Release ${target.phase === 'candidate' ? 'PR' : 'main'} #${target.pull.pr} ${target.commit}`;
}

function matchesRun(run: any, target: RunTarget): boolean {
    const event = target.phase === 'tag' ? 'push' : target.phase === 'diagnostic' ? 'workflow_dispatch' : 'pull_request';
    const shas = target.phase === 'main' ? [target.commit, target.pull.head] : [target.commit];
    const branches = target.phase === 'tag' ? [target.tag] : target.phase === 'diagnostic' ? [target.branch] :
        target.phase === 'main' ? ['main', target.pull.branch] : [target.pull.branch];
    return run?.path === releaseWorkflow && run.event === event && run.repository?.full_name === CI_REPOSITORY &&
        run.head_repository?.full_name === CI_REPOSITORY && run.display_title === runTitle(target) &&
        shas.includes(run.head_sha) && branches.includes(run.head_branch);
}

async function latest(target: Exclude<RunTarget, { phase: 'diagnostic' }>) {
    const candidates = target.phase === 'tag' ? await runsFor(target.commit) : target.phase === 'main' ?
        (await Promise.all([target.commit, target.pull.head].map(commit => runsFor(commit, 'pull_request')))).flat() :
        await runsFor(target.commit, 'pull_request');
    const run = candidates.filter(item => matchesRun(item, target)).sort((a, b) => b.id - a.id)[0];
    assert(run, 'Missing Actions run for ' + runTitle(target));
    return run;
}

export function currentExecution(): Execution {
    assert.equal(process.env.GITHUB_REPOSITORY, CI_REPOSITORY);
    const run_id = Number(process.env.GITHUB_RUN_ID), attempt = Number(process.env.GITHUB_RUN_ATTEMPT), workflow_sha = process.env.GITHUB_WORKFLOW_SHA ?? '';
    assert(Number.isSafeInteger(run_id) && run_id > 0);
    assert(Number.isSafeInteger(attempt) && attempt > 0);
    assert.match(workflow_sha, shaPattern);
    return { run_id, attempt, workflow_sha };
}

async function bindExecution(run: any, execution: Execution, target: RunTarget): Promise<void> {
    assert(matchesRun(run, target), 'Wrong release workflow or source identity');
    assert.equal(execution.run_id, run.id); assert.equal(execution.attempt, run.run_attempt);
    assert.match(execution.workflow_sha, shaPattern);
    await verifyWorkflowSource({ workflow: releaseWorkflow, workflow_sha: execution.workflow_sha, source_commit: target.commit });
}

async function currentRun(execution: Execution) {
    return githubRead(`repos/${CI_REPOSITORY}/actions/runs/${execution.run_id}`);
}

async function verifyLatest(run: any, target: Exclude<RunTarget, { phase: 'diagnostic' }>, gate: string) {
    const job = await requireGate(run, gate);
    const current = await latest(target);
    assert.equal(current.id, run.id, 'A newer release run supersedes this evidence');
    assert.equal(current.run_attempt, run.run_attempt, 'The release attempt changed during verification');
    return job;
}

function withinJob(artifact: any, job: any) {
    const created = Date.parse(artifact.created_at);
    assert(created >= Date.parse(job.started_at) - 1000 && created <= Date.parse(job.completed_at) + 1000,
        'Artifact was created outside the original job: ' + artifact.name);
}

async function receipts(run: any, execution: Execution, specs: readonly Producer[], artifacts: any[]) {
    const jobs = await latestPhysicalJobs(run.id, execution.attempt, run.head_sha, [...specs]);
    return Promise.all(specs.map(async spec => {
        const { job, attempt } = jobs.get(spec.job)!;
        const raw = newestArtifact(artifacts, spec.artifact);
        withinJob(raw, job);
        const report = await artifactJson(raw, 'receipt.json');
        assert.equal(report.status, 'pass');
        assert.equal(Number(report.execution.run_id), run.id);
        assert.equal(Number(report.execution.attempt), attempt, 'A later job superseded this receipt');
        assert.equal(report.workflow_sha, execution.workflow_sha);
        const ref: ReceiptRef = { artifact: artifactIdentity(raw), job_id: job.id, job: spec.job, attempt, started_at: job.started_at, completed_at: job.completed_at };
        return { report, ref, job };
    }));
}

function verifySmoke(report: any, spec: Case, commit: string, head: string, sha256: string, job: string) {
    assert.equal(report.schema_version, 1);
    assert.equal(report.node, 'v' + spec.node); assert.match(report.node_sha256, digestPattern);
    assert.equal(report.platform, spec.platform); assert.equal(report.arch, spec.arch); assert.equal(report.host_arch, spec.host_arch);
    assert.equal(report.tarball_sha256, sha256); assert.equal(report.model_calls, 0);
    assert.equal(report.execution.job, job);
    if (spec.kind === 'package') {
        assert.equal(report.kind, 'integration-smoke'); assert.equal(report.target, spec.id);
        assert.equal(report.source_commit, head); assert.equal(report.integration_commit, commit);
        assert.equal(report.lifecycle_scripts, false); assert.deepEqual(report.checks, packageSmokeChecks);
    } else {
        assert.equal(report.kind, 'release-host-smoke'); assert.equal(report.commit, head);
        assert.equal(report.host, hostVersion); assert.match(report.host_sha256, digestPattern);
        assert.deepEqual(Object.keys(report.mods).sort(), ['statusline-native', 'statusline-runtime']);
        for (const mod of Object.values<any>(report.mods)) {
            assert.equal(mod.validation, 'pass'); assert.equal(mod.official_tests, 'pass');
            assert.deepEqual(mod.types, { status: 'pass', host: hostVersion });
        }
        assert.equal(report.installed.status, 'pass'); assert.equal(report.installed.tarball_sha256, sha256);
    }
}

async function candidateCoverage(run: any, execution: Execution, target: Extract<RunTarget, { phase: 'diagnostic' }> | { phase: 'candidate'; pull: Pull; commit: string },
    artifacts: any[]) {
    const { commit } = target;
    assert(releasePolicyAt(commit));
    await bindExecution(run, execution, target);
    const version = sourceVersion(commit), cases = candidateCases(commit);
    const [build, ...smokes] = await receipts(run, execution, [candidateBuild, ...cases], artifacts);
    assert(build);
    const report = build.report;
    assert.equal(report.schema_version, 1); assert.equal(report.kind, 'release-build');
    assert.equal(report.execution.job, 'build'); assert.equal(report.commit, commit); assert.equal(report.version, version);
    assert.deepEqual(report.checks, buildChecks);
    const delivery: Record<string, string> = report.delivery;
    validateDeliveryHashes(delivery, version);
    const raw = newestArtifact(artifacts, releasePackageArtifact), original = artifactIdentity(raw);
    withinJob(raw, build.job);
    assert.equal(original.id, report.package_id); assert.equal(original.digest, report.package_digest);
    for (const [index, spec] of cases.entries())
        verifySmoke(smokes[index]!.report, spec, commit, commit, delivery[releaseFilenames(version).package]!, 'candidate-check');
    return { version, delivery, package: original, jobs: [build, ...smokes].map(row => row.ref) };
}

export async function recordCandidate(pull: Pull | undefined, commit: string): Promise<Candidate | { kind: 'release-diagnostic'; commit: string; status: 'pass'; jobs: ReceiptRef[] }> {
    const execution = currentExecution(), run = await currentRun(execution);
    const target = pull ? { phase: 'candidate' as const, pull, commit } :
        { phase: 'diagnostic' as const, branch: process.env.GITHUB_REF_NAME!, commit };
    const coverage = await candidateCoverage(run, execution, target, await listRunArtifacts(run.id));
    if (!pull) return { kind: 'release-diagnostic', commit, status: 'pass', jobs: coverage.jobs };
    assert.equal(pull.head, commit);
    return { schema_version: 1, kind: 'release-candidate', status: 'pass', execution, pull, ...coverage };
}

function evidenceRef(record: ReleaseContext, artifact: any): EvidenceRef {
    return { run_id: record.execution.run_id, attempt: record.execution.attempt, artifact: artifactIdentity(artifact), sha256: recordDigest(record) };
}

export async function acceptedCandidate(pull: Pull): Promise<{ candidate: Candidate; candidate_ref: EvidenceRef }> {
    const target = { phase: 'candidate' as const, pull, commit: pull.head }, run = await latest(target);
    const artifacts = await listRunArtifacts(run.id), envelope = newestArtifact(artifacts, candidateEnvelope);
    withinJob(envelope, await verifyLatest(run, target, candidateGate));
    const record: Candidate = await artifactJson(envelope, 'receipt.json');
    const coverage = await candidateCoverage(run, record.execution, target, artifacts);
    assert.deepEqual(record, { schema_version: 1, kind: 'release-candidate', status: 'pass', execution: record.execution, pull, ...coverage });
    await verifyLatest(run, target, candidateGate);
    return { candidate: record, candidate_ref: evidenceRef(record, envelope) };
}

/** Use the actual integrated first parent's verifier in isolation. The
 * protected merge establishes its provenance without a daily Actions gate. */
async function withBase<T>(merge: Merge, use: (reader: typeof import('./release-ci-evidence.ts')) => Promise<T> | T): Promise<T> {
    assert(releasePolicyAt(merge.base), 'The integrated first parent must contain the release verifier');
    const temporary = fs.mkdtempSync(join(tmpdir(), 'statusline-release-verifier-'));
    try {
        exportBaseVerifiers(merge.base, temporary);
        const reader = await import(pathToFileURL(join(temporary, 'tools/checks/release-ci-evidence.ts')).href);
        return await use(reader);
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 3 });
    }
}

export async function mainCandidate(merge: Merge): Promise<AcceptedCandidate> {
    const { commit: _commit, ...pull } = merge;
    return { ...await withBase(merge, reader => reader.acceptedCandidate(pull)), merge };
}

export function verifyDeliveryBytes(directory: string, version: string, delivery: Record<string, string>): void {
    validateDeliveryHashes(delivery, version);
    for (const [file, hash] of Object.entries(delivery))
        assert.equal(digest(fs.readFileSync(join(directory, file))), hash, 'Original delivery bytes changed: ' + file);
}

function preflight(input: AcceptedCandidate, execution: Execution): Preflight {
    return {
        schema_version: 1, kind: 'release-preflight', status: 'pass', execution, workflow_sha: execution.workflow_sha,
        merge: input.merge, candidate_ref: input.candidate_ref,
        verifier_commit: input.merge.base, verifier_tree: git('rev-parse', input.merge.base + '^{tree}'), delivery: input.candidate.delivery,
    };
}

export async function verifyMainPackage(input: AcceptedCandidate, directory: string): Promise<Preflight> {
    const execution = currentExecution();
    await bindExecution(await currentRun(execution), execution, { phase: 'main', pull: input.merge, commit: input.merge.commit });
    await withBase(input.merge, reader => reader.verifyDeliveryBytes(directory, input.candidate.version, input.candidate.delivery));
    return preflight(input, execution);
}

async function integrationCoverage(input: AcceptedCandidate, run: any, execution: Execution, artifacts: any[]): Promise<Integration> {
    const { merge, candidate } = input;
    await bindExecution(run, execution, { phase: 'main', pull: merge, commit: merge.commit });
    const cases = integrationCases(merge.commit);
    const [verification, ...smokes] = await receipts(run, execution, [integrationPreflight, ...cases], artifacts);
    assert(verification);
    assert.deepEqual(verification.report, preflight(input, { ...execution, attempt: verification.ref.attempt }));
    for (const [index, spec] of cases.entries())
        verifySmoke(smokes[index]!.report, spec, merge.commit, merge.head, candidate.delivery[releaseFilenames(candidate.version).package]!, 'main-smoke');
    return { schema_version: 1, kind: 'release-main', status: 'pass', execution, verification: verification.report, jobs: [verification, ...smokes].map(row => row.ref) };
}

export async function recordMain(input: AcceptedCandidate): Promise<Integration> {
    const execution = currentExecution(), run = await currentRun(execution);
    return integrationCoverage(input, run, execution, await listRunArtifacts(run.id));
}

export async function selectReleaseTag(tag: string, commit: string): Promise<TagInput> {
    assert(releasePolicyAt(commit), 'Missing release CI policy');
    assert.equal(tag, 'v' + sourceVersion(commit), 'Tag and canonical version differ');
    const tag_object = verifyTagIdentity(tag, commit);
    const merged = (await associatedPulls(commit)).filter(pr => trustedMergedPr(pr) && pr.head.sha === commit && isReleaseBranch(pr.head.ref));
    assert.equal(merged.length, 1, 'Missing or ambiguous integrated release PR');
    const merge = await mergeSource(merged[0]), input = await mainCandidate(merge);
    const target = { phase: 'main' as const, pull: merge, commit: merge.commit }, run = await latest(target);
    const artifacts = await listRunArtifacts(run.id), envelope = newestArtifact(artifacts, mainEnvelope);
    withinJob(envelope, await verifyLatest(run, target, integrationGate));
    const record: Integration = await artifactJson(envelope, 'receipt.json');
    assert.deepEqual(record, await integrationCoverage(input, run, record.execution, artifacts));
    await verifyLatest(run, target, integrationGate);
    assert.equal(verifyTagIdentity(tag, commit), tag_object, 'Release tag changed during verification');
    return { ...input, tag, tag_object, integration_ref: evidenceRef(record, envelope) };
}

function tagRecord(input: TagInput, execution: Execution): Tag {
    return {
        schema_version: 1, kind: 'release-tag', status: 'pass', execution, tag: input.tag,
        tag_object: input.tag_object, merge: input.merge, candidate_ref: input.candidate_ref,
        integration_ref: input.integration_ref, delivery: input.candidate.delivery,
    };
}

export async function recordTag(input: TagInput): Promise<Tag> {
    const execution = currentExecution();
    await bindExecution(await currentRun(execution), execution, { phase: 'tag', tag: input.tag, commit: input.merge.head });
    assert.equal(verifyTagIdentity(input.tag, input.merge.head), input.tag_object);
    return tagRecord(input, execution);
}

export async function publishedReleaseTag(tag: string, commit: string) {
    const target = { phase: 'tag' as const, tag, commit }, run = await latest(target);
    const envelope = newestArtifact(await listRunArtifacts(run.id), tagEnvelope);
    withinJob(envelope, await verifyLatest(run, target, tagGate));
    const record: Tag = await artifactJson(envelope, 'receipt.json');
    await bindExecution(run, record.execution, target);
    const input = await selectReleaseTag(tag, commit);
    assert.deepEqual(record, tagRecord(input, record.execution));
    await verifyLatest(run, target, tagGate);
    return { ...input, tag_ref: evidenceRef(record, envelope) };
}
