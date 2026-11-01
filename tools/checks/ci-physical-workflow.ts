/** The scheduler and collector derive the comparison independently from the Actions event. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCoveragePlan, type CoveragePlan, type CoverageProducer } from './ci-coverage.ts';
import { artifactIdentity, digest, git, listRunArtifacts, newestArtifact, type ArtifactIdentity } from './ci-evidence.ts';
import { validateFragmentIdentity, type PhysicalExecution } from './ci-fragment.ts';
import { sectionInputsAt, validateSectionEvidence, verifySectionLogBytes } from './ci-section-evidence.ts';
import { latestPhysicalJobs, latestRun, requireGate, runsFor } from './ci-sources.ts';
import { CI_REPOSITORY } from './ci-watch.ts';
import { probePlan } from './ci-probe-plan.ts';
export { probePlan } from './ci-probe-plan.ts';

const candidateName = 'ts06-candidate', compiledName = 'ci-compiled-tests';
function json(path: string, limit = 1024 * 1024): any {
    const stat = fs.lstatSync(path); assert(stat.isFile() && stat.size <= limit, 'Invalid workflow input: ' + path);
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}
const actionsEvent = () => json(process.env.GITHUB_EVENT_PATH!, 32 * 1024 * 1024);
const write = (path: string, value: unknown) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const output = (name: string, value: string) => fs.appendFileSync(process.env.GITHUB_OUTPUT!, name + '=' + value + '\n');
export function probeMode(): boolean {
    if (process.env.CI_VALIDATION !== 'tiered-probe') return false;
    assert(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.GITHUB_REF_TYPE === 'branch', 'Tiered diagnostics require a branch dispatch');
    assert.equal(actionsEvent().inputs.validation, 'tiered-probe');
    return true;
}
export function coverageRun() {
    const run_id = Number(process.env.GITHUB_RUN_ID), attempt = Number(process.env.GITHUB_RUN_ATTEMPT), workflow_sha = process.env.GITHUB_WORKFLOW_SHA!;
    assert(Number.isSafeInteger(run_id) && run_id > 0 && Number.isSafeInteger(attempt) && attempt > 0 && attempt <= 100);
    assert.match(workflow_sha, /^[a-f0-9]{40}$/u);
    return { run_id, attempt, workflow_sha };
}
export async function eventBasis(head: string, keepConservative = false): Promise<{ base: string | null; basis: CoveragePlan['basis'] }> {
    const event = actionsEvent();
    assert.equal(process.env.GITHUB_REPOSITORY, CI_REPOSITORY); assert.equal(event.repository.full_name, CI_REPOSITORY);
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
        const pr = event.pull_request;
        assert.equal(pr.head.sha, head); assert.equal(pr.draft, false); assert.equal(pr.base.ref, 'main');
        assert.equal(pr.head.repo.full_name, CI_REPOSITORY); assert.equal(pr.base.repo.full_name, CI_REPOSITORY);
        assert(Number.isSafeInteger(event.number) && event.number > 0); assert.match(pr.base.sha, /^[a-f0-9]{40}$/u);
        return keepConservative ? { base: null, basis: 'conservative' } : { base: pr.base.sha, basis: 'pull_request' };
    }
    assert.equal(process.env.GITHUB_SHA, head);
    if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF_NAME === 'main' && process.env.GITHUB_REF_TYPE === 'branch') {
        assert.equal(event.after, head); assert.equal(event.ref, 'refs/heads/main');
        const first = git('rev-list', '--parents', '-n', '1', head).split(' ')[1];
        if (!keepConservative && first && event.before === first) {
            const raw = await runsFor(first);
            const prior = latestRun(raw, first, 'main');
            if (prior) { await requireGate(prior); return { base: first, basis: 'accepted-main' }; }
        }
    } else assert(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF_TYPE === 'tag');
    return { base: null, basis: 'conservative' };
}
export async function workflowPlan(candidate: string, keepConservative = false): Promise<CoveragePlan> {
    const head = git('rev-parse', 'HEAD'), inputs = json(join(candidate, 'runtime-inputs.json')), basis = await eventBasis(head, keepConservative);
    const plan = createCoveragePlan(basis.base, head, inputs, basis.basis);
    return probeMode() ? probePlan(plan, inputs) : plan;
}
const physicalName = (spec: CoverageProducer, probe: boolean) => (probe ? 'ci-diagnostic-tiered-' : '') + spec.artifact;
export function selectPhysicalArtifacts(plan: CoveragePlan, raw: any[], probe: boolean, candidateId: number, compiledId: number) {
    const names = [candidateName, compiledName, ...plan.producers.map(spec => physicalName(spec, probe))];
    assert.equal(new Set(names).size, names.length);
    const selected = names.map(name => artifactIdentity(newestArtifact(raw, name)));
    assert.equal(selected[0]!.id, candidateId, 'Candidate job output no longer identifies the latest candidate');
    assert.equal(selected[1]!.id, compiledId, 'Development job output no longer identifies the latest compiled tests');
    return selected;
}
interface PhysicalSelection { run_id: number; commit: string; artifacts: ArtifactIdentity[] }
export async function collectPhysical(evidence: string, plan: CoveragePlan, selection: PhysicalSelection, raw: any[], tarball: string, diagnostic: boolean): Promise<PhysicalExecution[]> {
    const context = coverageRun();
    assert.equal('diagnostic' in plan, diagnostic);
    if (diagnostic) assert(probeMode());
    assert.equal(selection.run_id, context.run_id); assert.equal(selection.commit, plan.head);
    const artifacts = selectPhysicalArtifacts(plan, raw, diagnostic, Number(process.env.CI_CANDIDATE_ID), Number(process.env.CI_COMPILED_ID));
    assert.deepEqual(selection.artifacts, artifacts, 'The immutable artifact selection changed');
    const jobs = await latestPhysicalJobs(context.run_id, context.attempt, plan.head, plan.producers);
    const entries = sectionInputsAt(plan.head), binaries = new Map<string,string>();
    return plan.producers.map(spec => {
        const name = physicalName(spec, diagnostic), directory = join(evidence, name), file = join(directory, 'fragment.json');
        assert(fs.lstatSync(directory).isDirectory());
        const stat = fs.lstatSync(file); assert(stat.isFile() && stat.size <= 16 * 1024 * 1024, 'Invalid physical receipt');
        const bytes = fs.readFileSync(file), fragment: unknown = JSON.parse(bytes.toString('utf8'));
        validateFragmentIdentity(fragment, spec, plan, { ...context, tarball_sha256: tarball });
        const identity = fragment.identity, runtime = [identity.os, identity.process_arch, identity.host_arch, identity.node].join('/');
        const tools = [identity.node_sha256, identity.npm, identity.npm_sha256].join('/');
        assert(!binaries.has(runtime) || binaries.get(runtime) === tools, 'Different Node/npm executables for the same frozen target');
        binaries.set(runtime, tools);
        // Complete readiness independently verifies all sections and original official logs before issuance.
        // A manual subset has no release-readiness pass, so verify its raw sections and logs here.
        if (diagnostic) { validateSectionEvidence(fragment, spec, plan, entries); verifySectionLogBytes(directory, fragment.report); }
        const { job, attempt } = jobs.get(spec.job)!;
        assert.equal(attempt, fragment.identity.attempt, 'A later execution supersedes this receipt');
        const artifact = newestArtifact(raw, name), created = Date.parse(artifact.created_at);
        assert(created >= Date.parse(job.started_at) - 1000 && created <= Date.parse(job.completed_at) + 1000, 'Artifact was created outside the original job');
        return { identity: fragment.identity, receipt_sha256: digest(bytes), artifact_id: artifact.id, job_id: job.id,
            job_name: job.name, job_created_at: job.created_at, started_at: job.started_at, completed_at: job.completed_at, artifact_created_at: artifact.created_at };
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [command, directory, file] = process.argv.slice(2); assert(directory);
    const candidate = command === 'plan' ? directory : join(directory, candidateName);
    const path = join(candidate, 'coverage-plan.json');
    // A stronger all-full plan stays valid if a predecessor becomes available during this run.
    const plan = await workflowPlan(candidate, command !== 'plan' && json(path).basis === 'conservative');
    if (command === 'plan') {
        write(path, plan);
        const historyInput = (spec: CoverageProducer) => spec.stage === 'history' || spec.stage === 'complete' ? spec.depth : 'none';
        output('short_history', String(plan.producers.some(spec => historyInput(spec) === 'short')));
        for (const group of ['installed', 'runtime', 'mods']) {
            const include = plan.producers.filter(spec => spec.job_key === group).map(spec => ({
                id: spec.id, job: spec.job, artifact: physicalName(spec, probeMode()), os: spec.os, arch: spec.arch,
                host_arch: spec.host_arch, node: spec.node, host: spec.host ?? '', history: historyInput(spec),
            }));
            assert(include.length); output(group + '_matrix', JSON.stringify({ include }));
        }
    } else {
        assert.deepEqual(json(path), plan, 'Candidate plan differs from the independent scheduler');
        assert(file);
        const { run_id, attempt, workflow_sha } = coverageRun(), raw = await listRunArtifacts(run_id);
        if (command === 'select') {
            const artifacts = selectPhysicalArtifacts(plan, raw, probeMode(), Number(process.env.CI_CANDIDATE_ID), Number(process.env.CI_COMPILED_ID));
            write(file, { run_id, commit: plan.head, artifacts });
            // The candidate has already been downloaded by its exact job output ID.
            output('artifact_ids', artifacts.filter(a => a.name !== candidateName).map(a => a.id).join(','));
            output('basis', plan.basis); output('base', plan.base ?? '');
        } else {
            assert.equal(command, 'probe'); assert(probeMode(), 'Only an explicit branch dispatch can collect diagnostic subsets');
            const build = json(join(candidate, 'build-manifest.json')); assert.equal(build.commit, plan.head);
            assert.match(build.candidate.file, /^fbincon-claude-code-statusline-[0-9A-Za-z.-]+\.tgz$/u);
            const tarball = digest(fs.readFileSync(join(candidate, build.candidate.file))); assert.equal(tarball, build.candidate.sha256);
            const selection = json(file);
            const executions = await collectPhysical(directory, plan, selection, raw, tarball, true);
            assert(process.argv[5]); write(process.argv[5], { schema_version: 1, kind: 'tiered-diagnostic', promotable: false,
                source_commit: plan.head, run_id, attempt, workflow_sha, tarball_sha256: tarball, coverage_plan_sha256: digest(fs.readFileSync(path)),
                artifacts: selection.artifacts, executions });
        }
    }
}
