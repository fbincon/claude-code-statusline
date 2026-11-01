/** Versioned, source-bound Actions evidence. Original receipts are never relabeled. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ghReadBytes, githubRead, CI_REPOSITORY } from './ci-watch.ts';
import { responseError, retryRead } from './ci-transfer-policy.ts';
import { TARGETS, HOSTS } from './runtime-inputs.ts';
import { coverageVersionAt, verifyCoveragePlan, type CoveragePlan } from './ci-coverage.ts';
import { validateFragmentIdentity, validatePhysicalIdentity, type PhysicalExecution } from './ci-fragment.ts';
import { sectionInputsAt, sourceCapacityCount, sourceContract, validateSectionEvidence, verifySectionLogBytes } from './ci-section-evidence.ts';
import { envelopeBytes } from './evidence-zip.ts';
import { languageEvidence, type LanguageEvidence } from './i18n-evidence.ts';
import { validateProductChecks, type ProductCheckReceipt } from './impact-product.ts';

export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const git = (...args: string[]) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const SHA = /^[a-f0-9]{40}$/u, HASH = /^[a-f0-9]{64}$/u;
export interface ArtifactIdentity { id: number; name: string; digest: string; expires_at: string }
interface EvidenceBase {
    kind: 'complete'; repository: string; source_commit: string; tree: string;
    run_id: number; attempt: number; event: string; branch: string; workflow: string; workflow_sha: string;
    pr: { number: number; head: string; base: string; base_ref: string; draft: boolean } | null;
    created_at: string; expires_at: string; policy_sha256: string; version: string;
    toolchain: { node: string; npm: string; typescript: string; lock_sha256: string };
    coverage: { installations: number; runtime_installations: number; hosts: number; native_capacity_cases: number };
    inputs: unknown; delivery: Record<string, string>; receipts: Record<string, string>;
    acceptance_sha256: string; input_file_sha256: string; compiled: Record<string, string>;
    artifacts: ArtifactIdentity[];
    language?: LanguageEvidence;
}
export interface CompleteEvidenceV1 extends EvidenceBase { schema_version: 1; executions: any[] }
export interface CompleteEvidenceV2 extends EvidenceBase {
    product_checks?: ProductCheckReceipt;
    schema_version: 2; coverage_plan: CoveragePlan; coverage_plan_sha256: string; executions: PhysicalExecution[];
}
export type CompleteEvidence = CompleteEvidenceV1 | CompleteEvidenceV2;
export { validateFragmentIdentity, type PhysicalIdentity, type PhysicalFragment, type PhysicalExecution } from './ci-fragment.ts';
/** Release registrations are data; executable release checks remain acceptance policy. */
export function acceptancePolicyPath(path: string): boolean {
    return path.startsWith('.github/workflows/') || path.startsWith('.github/actions/transfer-artifact/') ||
        /^(?:tools\/(?:checks|build|release|acceptance|typescript)\/|packages\/core\/src\/node-runtime\.ts$)/u.test(path) && !/\/test\//u.test(path);
}
export function policyDigest(revision: string, read = git): string {
    assert(SHA.test(revision));
    const lines = read('ls-tree', '-r', revision).split('\n').filter(line => {
        const path = line.split('\t')[1] ?? '';
        return acceptancePolicyPath(path);
    });
    assert(lines.length > 0); return digest(lines.sort().join('\n'));
}
export async function listRunArtifacts(runId: number): Promise<any[]> {
    const result: any[] = [];
    for (let page = 1; page <= 20; page++) {
        const value = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`);
        result.push(...value.artifacts); if (result.length >= value.total_count) return result;
    }
    throw new Error('Artifact pagination limit exceeded');
}
export function artifactIdentity(value: any, now = Date.now()): ArtifactIdentity {
    assert(Number.isSafeInteger(value.id) && value.id > 0); assert.match(value.name, /^(?:ts06-|ci-)[a-zA-Z0-9.-]+$/u);
    assert.equal(value.expired, false, 'Evidence artifact expired');
    assert(Date.parse(value.expires_at) > now, 'Evidence artifact unavailable or expired');
    assert.match(value.digest, /^sha256:[a-f0-9]{64}$/u, 'Missing artifact digest');
    return { id: value.id, name: value.name, digest: value.digest, expires_at: value.expires_at };
}
export function newestArtifact(artifacts: any[], name: string): any {
    const matching = artifacts.filter(value => value.name === name);
    assert(matching.length, 'Missing artifact: ' + name);
    if (matching.length > 1) {
        // Artifact IDs identify objects, not chronology: retries can receive smaller IDs.
        for (const value of matching) assert(typeof value.created_at === 'string' && Number.isFinite(Date.parse(value.created_at)), 'Missing artifact creation time');
        matching.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        assert(Date.parse(matching[0].created_at) > Date.parse(matching[1].created_at), 'Ambiguous artifact creation time');
    }
    // Never fall back to an older artifact when the newest is expired, corrupt or failed.
    artifactIdentity(matching[0]); return matching[0];
}
export function selectCompleteArtifacts(artifacts: any[]): ArtifactIdentity[] {
    const names = [...new Set<string>(artifacts.map(value => value.name).filter(name => name === 'ts06-candidate' || name === 'ci-compiled-tests' || /^ts06-(?:installed|runtime|mods)-/u.test(name)))].sort();
    assert(names.includes('ts06-candidate') && names.includes('ci-compiled-tests'), 'Missing build outputs');
    return names.map(name => artifactIdentity(newestArtifact(artifacts, name)));
}
export async function artifactJson(artifact: any, file: string, expectedHash?: string): Promise<any> {
    assert(['ci-evidence.json', 'promotion.json', 'smoke.json', 'maintenance.json', 'receipt.json', 'release-binding.json'].includes(file));
    const identity = artifactIdentity(artifact), path = `repos/${CI_REPOSITORY}/actions/artifacts/${identity.id}/zip`;
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    const bytes = await retryRead(async signal => {
        if (!token) return ghReadBytes(path,4 * 1024 * 1024,signal);
        const response = await fetch('https://api.github.com/' + path, { headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'statusline-ci-evidence' }, redirect: 'manual', signal });
        await response.body?.cancel();
        if (response.status >= 400) throw responseError(response);
        assert.equal(response.status, 302, 'Cannot resolve evidence download');
        const location = response.headers.get('location'); assert(location);
        const url = new URL(location); assert(url.protocol === 'https:' && !url.username && !url.password);
        // Never forward API credentials to the signed object-storage URL.
        const body = await fetch(url, { signal });
        if (!body.ok) { await body.body?.cancel(); throw responseError(body); }
        assert(body.body, 'Missing evidence download');
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of body.body) { size += chunk.length; assert(size <= 4 * 1024 * 1024, 'Evidence envelope too large'); chunks.push(Buffer.from(chunk)); }
        return Buffer.concat(chunks);
    });
    assert.equal('sha256:' + digest(bytes), identity.digest, 'Evidence ZIP digest mismatch');
    const content = envelopeBytes(bytes, file);
    if (expectedHash) assert.equal(digest(content), expectedHash, 'Original envelope file changed');
    return JSON.parse(content.toString('utf8'));
}
function requireRunIdentity(run: any, commit: string, branch: string, event: string): void {
    assert.match(commit, SHA); assert.equal(run.head_sha, commit); assert.equal(run.head_branch, branch); assert.equal(run.event, event);
    assert.equal(run.repository?.full_name, CI_REPOSITORY); assert.equal(run.head_repository?.full_name, CI_REPOSITORY);
    assert.equal(run.path, '.github/workflows/ci.yml');
}
export function requireRun(run: any, commit: string, branch: string, event = 'push'): void {
    requireRunIdentity(run, commit, branch, event);
    assert.equal(run.status, 'completed', `Latest applicable CI ${run.id} has not completed`);
    assert.equal(run.conclusion, 'success', `Latest applicable CI ${run.id} did not pass`);
}
export function validateComplete(record: CompleteEvidence, run: any, artifacts: any[], now = Date.now()): void {
    requireRun(run, record.source_commit, record.branch, record.event);
    validateEnvelope(record, run, artifacts, now);
}
function validateEnvelope(record: CompleteEvidence, run: any, artifacts: any[], now: number): void {
    assert([1, 2].includes(record.schema_version), 'Unsupported complete evidence schema'); assert.equal(record.kind, 'complete'); assert.equal(record.repository, CI_REPOSITORY);
    assert.equal(record.run_id, run.id); assert.equal(record.attempt, run.run_attempt); assert.equal(record.workflow, run.path);
    assert.match(record.tree, SHA); assert.match(record.workflow_sha, SHA); assert.match(record.policy_sha256, HASH);
    assert(Date.parse(record.created_at) <= now + 60000 && Date.parse(record.expires_at) > now, 'Evidence envelope is expired or has an invalid creation time');
    assert(Date.parse(record.expires_at) - Date.parse(record.created_at) <= 30 * 86400000);
    let capacity = 197;
    if (record.schema_version === 2) {
        const entries = sectionInputsAt(record.source_commit);
        assert.equal(record.version, sourceContract(entries).version, 'Physical envelope names the wrong source version');
        capacity = sourceCapacityCount(entries);
    }
    assert.deepEqual(record.coverage, { installations: 8, runtime_installations: 32, hosts: 16, native_capacity_cases: capacity });
    assert.match(record.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
    assert.deepEqual(Object.keys(record.delivery).sort(), ['SHA256SUMS', 'build-manifest.json', `fbincon-claude-code-statusline-${record.version}.tgz`, `claude-code-statusline-${record.version}-source.tar.gz`].sort());
    assert(Object.values(record.delivery).every(value => HASH.test(value)));
    assert.match(record.acceptance_sha256, HASH); assert.match(record.input_file_sha256, HASH);
    assert.deepEqual(Object.keys(record.compiled).sort(), ['compiled-tests.json', 'compiled-tests.tar']);
    assert(Object.values(record.compiled).every(value => HASH.test(value)));
    if (record.schema_version === 1) assert(Object.keys(record.receipts).length >= 56);
    assert(Object.values(record.receipts).every(value => HASH.test(value)));
    assert(Object.keys(record.receipts).every(path => !path.startsWith('/') && !path.includes('\\') && path.split('/').every(part => part && part !== '.' && part !== '..')));
    const inputs = record.inputs as any;
    assert.equal(inputs?.schema_version, 1); assert.match(inputs.development, /^24\.\d+\.\d+$/u);
    assert.equal(record.toolchain.node.replace(/^v/u, ''), inputs.development); assert.match(record.toolchain.lock_sha256, HASH);
    for (const value of [record.toolchain.npm, record.toolchain.typescript]) assert.match(value, /^\d+\.\d+\.\d+$/u);
    assert.deepEqual(Object.keys(inputs.versions).sort(), ['22.0.0', '22.x', '24.0.0', '24.x'].sort());
    for (const [key, value] of Object.entries(inputs.versions)) {
        assert(typeof value === 'string' && new RegExp('^' + key.slice(0, 2) + '\\.\\d+\\.\\d+$', 'u').test(value));
        if (!key.endsWith('.x')) assert.equal(value, key);
    }
    assert.deepEqual(inputs.shared, Object.keys(inputs.versions).filter(key => inputs.versions[key] === inputs.development));
    const legacyNames = ['ts06-candidate', 'ci-compiled-tests', ...TARGETS.map(target => `ts06-installed-${target.os}-${target.arch}`),
        ...HOSTS.map(host => `ts06-mods-${host.os}-${host.claude}`), ...Object.keys(inputs.versions).filter(key => !inputs.shared.includes(key))
            .flatMap(key => TARGETS.map(target => `ts06-runtime-${target.os}-${target.arch}-${key}`))];
    const expectedNames = record.schema_version === 1 ? legacyNames :
        ['ts06-candidate', 'ci-compiled-tests', ...record.coverage_plan.producers.map(producer => producer.artifact)];
    const ids = new Set<number>(), names = new Set<string>();
    for (const expected of record.artifacts) {
        assert(!ids.has(expected.id) && !names.has(expected.name), 'Ambiguous source artifacts'); ids.add(expected.id); names.add(expected.name);
        const actual = artifacts.find(value => value.id === expected.id); assert(actual, 'Missing original artifact');
        assert.deepEqual(artifactIdentity(actual, now), expected, 'Original artifact identity changed');
        assert.equal(newestArtifact(artifacts, expected.name).id, expected.id, 'Newer source artifact invalidates this evidence');
    }
    assert(names.has('ts06-candidate') && names.has('ci-compiled-tests'));
    assert.deepEqual([...names].sort(), expectedNames.sort(), 'Incomplete original artifact coverage');
    if (record.event === 'pull_request') {
        assert(record.pr && record.pr.draft === false && record.pr.head === record.source_commit && record.pr.base_ref === 'main'); assert.match(record.pr.base, SHA);
        assert(Number.isSafeInteger(record.pr.number) && record.pr.number > 0);
    } else { assert.equal(record.event, 'push'); assert.equal(record.branch, 'main'); assert.equal(record.pr, null); }
    if (record.schema_version === 2) validateV2Coverage(record, artifacts);
    else validateLegacyExecutions(record, inputs);
}
function validateLegacyExecutions(record: CompleteEvidenceV1, inputs: any): void {
    assert.equal(record.executions.length, 56, 'Missing original execution references');
    const obligations = new Set<string>();
    for (const execution of record.executions) {
        const key = execution.target + (execution.runtime_case ? '@' + execution.runtime_case : '');
        assert(!obligations.has(key), 'Duplicate execution obligation'); obligations.add(key);
        assert(Number.isSafeInteger(execution.job_id) && execution.job_id > 0);
        const split = execution.target.lastIndexOf('-'), os = execution.target.slice(0, split), arch = execution.target.slice(split + 1);
        const expectedJob = execution.host ? `Mods / ${({ linux: 'ubuntu-24.04', win32: 'windows-2025', darwin: 'macos-15' } as Record<string, string>)[os]} / Claude ${execution.host}` :
            execution.runtime_case && !execution.execution?.reused_installed ? `Node ${execution.runtime_case} / ${os} / ${arch}` : `Installed / ${os} / ${arch}`;
        assert.equal(execution.job_name, expectedJob, 'Execution names an unrelated job');
        assert(Number.isFinite(Date.parse(execution.started_at)) && Date.parse(execution.completed_at) >= Date.parse(execution.started_at), 'Missing original execution times');
        assert.equal(Number(execution.execution?.run_id), record.run_id);
        assert(Number.isSafeInteger(Number(execution.execution?.attempt)) && Number(execution.execution.attempt) > 0 && Number(execution.execution.attempt) <= record.attempt);
        assert.match(execution.node_sha256, HASH);
        assert.equal(execution.node.replace(/^v/u, ''), execution.runtime_case ? inputs.versions[execution.runtime_case] : inputs.development);
        if (execution.host) assert.match(execution.host_sha256, HASH);
    }
    const expectedObligations = [...TARGETS.map(target => `${target.os}-${target.arch}`),
        ...TARGETS.flatMap(target => Object.keys(inputs.versions).map(key => `${target.os}-${target.arch}@${key}`)),
        ...HOSTS.map(host => `${({ 'ubuntu-24.04': 'linux', 'windows-2025': 'win32', 'macos-15': 'darwin' } as Record<string, string>)[host.os]}-${host.claude}`)];
    assert.deepEqual([...obligations].sort(), expectedObligations.sort(), 'Incomplete execution obligations');
    for (const execution of record.executions.filter(value => value.runtime_case)) {
        if (inputs.shared.includes(execution.runtime_case)) {
            const installed = record.executions.find(value => value.target === execution.target && !value.runtime_case && !value.host);
            assert(installed); assert.equal(execution.execution.reused_installed, true); assert.equal(execution.execution.source_suite, 'complete-platform-suite');
            assert.equal(execution.job_id, installed.job_id, 'Shared runtime must reference the installed job');
            assert.equal(execution.node_sha256, installed.node_sha256, 'Shared runtime must use the identical executable');
            for (const key of ['run_id', 'attempt', 'job']) assert.equal(execution.execution[key], installed.execution[key], 'Shared runtime execution changed');
        } else assert.notEqual(execution.execution.reused_installed, true, 'Different runtime cannot share installation execution');
    }
}
/** For reduced main coverage only an independently accepted, actual first parent is eligible. */
export function coverageContext(record: CompleteEvidenceV2): { base: string | null; basis: CoveragePlan['basis'] } {
    const basis = record.coverage_plan.basis;
    if (basis === 'conservative') return { base: null, basis };
    if (record.event === 'pull_request') {
        assert.equal(basis, 'pull_request'); assert(record.pr); return { base: record.pr.base, basis };
    }
    assert.equal(basis, 'accepted-main'); assert.equal(record.event, 'push'); assert.equal(record.branch, 'main');
    return { base: git('rev-parse', record.source_commit + '^1'), basis };
}
function validateV2Coverage(record: CompleteEvidenceV2, artifacts: any[]): void {
    assert.equal(coverageVersionAt(record.source_commit), 2, 'Physical receipts require an activated source');
    const manifest = JSON.parse(git('show', record.source_commit + ':package.json'));
    const lock = execFileSync('git', ['--no-replace-objects', 'cat-file', 'blob', record.source_commit + ':package-lock.json'], {maxBuffer:16 * 1024 * 1024});
    assert.equal(manifest.packageManager, 'npm@' + record.toolchain.npm, 'Development npm differs from the source toolchain');
    assert.equal(manifest.devDependencies?.typescript, record.toolchain.typescript, 'TypeScript differs from the source toolchain');
    assert.equal(digest(lock), record.toolchain.lock_sha256, 'Development lockfile bytes differ from the source');
    const context = coverageContext(record);
    const plan = verifyCoveragePlan(record.coverage_plan, context.base, record.source_commit, record.inputs, context.basis);
    validateProductChecks(record);
    assert.equal(plan.tree, record.tree); assert.match(record.coverage_plan_sha256, HASH);
    const tarball = record.delivery[`fbincon-claude-code-statusline-${record.version}.tgz`]!;
    const specs = new Map(plan.producers.map(spec => [spec.id, spec]));
    const jobs = new Set<number>(), identities = new Map<string, string>();
    assert.deepEqual(Object.keys(record.receipts).sort(), plan.producers.map(p => p.receipt).sort(), 'Incomplete physical receipt paths');
    for (const row of record.executions) {
        const id = row.identity.producer_id, spec = specs.get(id); assert(spec, 'Unexpected or duplicate physical execution: ' + id); specs.delete(id);
        validatePhysicalIdentity(row.identity, spec, plan, { run_id: record.run_id, attempt: record.attempt,
            workflow_sha: record.workflow_sha, tarball_sha256: tarball });
        const identity = row.identity;
        if (identity.node === record.toolchain.node.replace(/^v/u, '')) assert.equal(identity.npm, record.toolchain.npm, 'Development npm identity differs');
        // Only sections credited to the same logical obligation are joined.
        // Independent targets retain the actual executable identities they ran.
        const binaries = JSON.stringify([identity.os, identity.platform, identity.process_arch, identity.host_arch,
            identity.node, identity.node_sha256, identity.npm, identity.npm_sha256, identity.host, identity.host_sha256]);
        for (const obligation of spec.obligations) {
            if (identities.has(obligation)) assert.equal(identities.get(obligation), binaries, 'Shared obligation changed runner or Node/npm/host binaries');
            identities.set(obligation, binaries);
        }
        assert.equal(row.receipt_sha256, record.receipts[spec.receipt]); assert.equal(row.job_name, spec.job);
        assert(Number.isSafeInteger(row.job_id) && row.job_id > 0 && !jobs.has(row.job_id), 'Duplicate or invalid physical job ID'); jobs.add(row.job_id);
        const artifact = newestArtifact(artifacts, spec.artifact);
        assert.equal(row.artifact_id, artifact.id, 'Physical execution names an unrelated artifact');
        if (row.artifact_created_at !== undefined) assert.equal(row.artifact_created_at, artifact.created_at, 'Artifact creation identity changed');
        const start = Date.parse(row.started_at), end = Date.parse(row.completed_at), created = Date.parse(artifact.created_at);
        // Actions job timestamps have second precision. The producer uploads before completion.
        assert(Number.isFinite(start) && end >= start && created >= start - 1000 && created <= end + 1000,
            'Physical artifact creation is outside the original job interval');
    }
    assert.equal(specs.size, 0, 'Missing physical execution(s): ' + [...specs.keys()].join(', '));
}
export function fileReceipts(directory: string, version: 1 | 2 = 1): Record<string, string> {
    const result: Record<string, string> = {};
    const files = version === 1 ? ['installed.json', 'runtime.json', 'mods.json', 'source-tests.json', 'native-stability.json'] : ['fragment.json'];
    function visit(root: string, prefix: string) {
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            assert(!entry.isSymbolicLink(), 'Linked evidence is not accepted');
            const path = join(root, entry.name), name = prefix + entry.name;
            if (entry.isDirectory()) visit(path, name + '/');
            else if (files.includes(entry.name)) {
                if (version === 2) assert(entry.isFile() && fs.statSync(path).size <= 16 * 1024 * 1024, 'Invalid physical fragment file');
                result[name] = digest(fs.readFileSync(path));
            }
        }
    }
    visit(directory, ''); return Object.fromEntries(Object.entries(result).sort());
}
export function verifyRecordedFiles(record: CompleteEvidence, directory: string): void {
    assert.deepEqual(fileReceipts(directory, record.schema_version), record.receipts, 'Original receipts changed');
    for (const [name, hash] of Object.entries(record.delivery))
        assert.equal(digest(fs.readFileSync(join(directory, 'ts06-candidate', name))), hash, 'Delivery bytes changed');
    assert.equal(digest(fs.readFileSync(join(directory, 'ts06-candidate/runtime-inputs.json'))), record.input_file_sha256, 'Runtime input bytes changed');
    assert.deepEqual(JSON.parse(fs.readFileSync(join(directory, 'ts06-candidate/runtime-inputs.json'), 'utf8')), record.inputs, 'Recorded runtime inputs differ from original bytes');
    if (record.schema_version === 2) {
        const bytes = fs.readFileSync(join(directory, 'ts06-candidate/coverage-plan.json'));
        assert.equal(digest(bytes), record.coverage_plan_sha256, 'Coverage plan bytes changed');
        assert.deepEqual(JSON.parse(bytes.toString('utf8')), record.coverage_plan, 'Coverage plan differs from original candidate');
        const context = coverageContext(record);
        const plan = verifyCoveragePlan(record.coverage_plan, context.base, record.source_commit, record.inputs, context.basis);
        const physical = new Map(record.executions.map(row => [row.identity.producer_id, row]));
        assert.equal(physical.size, record.executions.length, 'Duplicate physical execution'); assert.equal(physical.size, plan.producers.length);
        const entries = sectionInputsAt(record.source_commit);
        for (const spec of plan.producers) {
            const row = physical.get(spec.id); assert(row, 'Missing physical execution: ' + spec.id);
            const raw = fs.readFileSync(join(directory, spec.receipt)); assert.equal(digest(raw), row.receipt_sha256, 'Original fragment bytes changed');
            const fragment: unknown = JSON.parse(raw.toString('utf8'));
            validateFragmentIdentity(fragment, spec, plan, { run_id: record.run_id, attempt: record.attempt, workflow_sha: record.workflow_sha,
                tarball_sha256: record.delivery[`fbincon-claude-code-statusline-${record.version}.tgz`]! });
            assert.deepEqual(fragment.identity, row.identity, 'Original fragment identity differs from execution record');
            validateSectionEvidence(fragment, spec, plan, entries);
            verifySectionLogBytes(join(directory, spec.artifact), fragment.report);
        }
    }
    assert.equal(digest(fs.readFileSync(join(directory, 'ts06-acceptance/candidate-acceptance.json'))), record.acceptance_sha256, 'Acceptance bytes changed');
    for (const [name, hash] of Object.entries(record.compiled))
        assert.equal(digest(fs.readFileSync(join(directory, 'ci-compiled-tests', name))), hash, 'Compiled test bytes changed');
}
export async function verifyWorkflowSource(record: CompleteEvidence): Promise<void> {
    const workflow = await githubRead(`repos/${CI_REPOSITORY}/contents/${record.workflow}?ref=${record.workflow_sha}`);
    assert.equal(workflow.type, 'file');
    assert.equal(workflow.sha, git('rev-parse', record.source_commit + ':' + record.workflow), 'Executed workflow differs from the accepted source');
}
export async function recordComplete(evidence: string, selectionFile: string, acceptanceFile: string, output: string): Promise<void> {
    assert(process.env.GITHUB_EVENT_NAME === 'pull_request' || process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF_NAME === 'main',
        'Only automatic PR/main acceptance can create promotable evidence');
    const version = coverageVersionAt(git('rev-parse', 'HEAD'));
    const selection = JSON.parse(fs.readFileSync(selectionFile, 'utf8')), accepted = JSON.parse(fs.readFileSync(acceptanceFile, 'utf8'));
    assert.equal(accepted.status, 'pass');
    const { assessEvidenceDirectory, evidenceFiles } = await import('../release/prepare.js');
    const source = join(evidence, 'ts06-candidate'), build = JSON.parse(fs.readFileSync(join(source, 'build-manifest.json'), 'utf8'));
    const { verifyDelivery } = await import('../build/verify.js');
    const verified = verifyDelivery(join(source, build.candidate.file), build.commit);
    assert.equal(build.commit, accepted.commit); assert.equal(build.commit, git('rev-parse', 'HEAD'));
    assert.equal(verified.sha256, accepted.tarball_sha256); assert.equal(verified.source.application_version, accepted.application_version);
    const workflow = version === 2 ? await import('./ci-physical-workflow.ts') : null;
    const planBytes = workflow ? fs.readFileSync(join(source, 'coverage-plan.json')) : null;
    const proposed = planBytes ? JSON.parse(planBytes.toString('utf8')) : null;
    const context = workflow ? { ...await workflow.eventBasis(build.commit, proposed.basis === 'conservative'), ...workflow.coverageRun() } : undefined;
    const assessed = assessEvidenceDirectory(evidence, build.commit, verified.sha256, verified.sourceEntries, context);
    for (const [key, value] of Object.entries(assessed)) assert.deepEqual(accepted[key], value, 'Acceptance report differs from source receipts: ' + key);
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8'));
    const pr = process.env.GITHUB_EVENT_NAME === 'pull_request' ? { number: event.number, head: event.pull_request.head.sha, base: event.pull_request.base.sha, base_ref: event.pull_request.base.ref, draft: event.pull_request.draft } : null;
    const created = new Date();
    const runId = Number(process.env.GITHUB_RUN_ID), attempt = Number(process.env.GITHUB_RUN_ATTEMPT), jobsByAttempt = new Map<number, any[]>();
    const reports = version === 1 ? evidenceFiles(evidence) : [], executions: any[] = [];
    for (const report of reports) {
        const execution = report.execution, originalAttempt = Number(execution?.attempt);
        assert.equal(Number(execution?.run_id), runId); assert(Number.isSafeInteger(originalAttempt) && originalAttempt > 0 && originalAttempt <= attempt);
        if (!jobsByAttempt.has(originalAttempt)) {
            const jobs: any[] = [];
            for (let page = 1; page <= 20; page++) {
                const value = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${runId}/attempts/${originalAttempt}/jobs?per_page=100&page=${page}`);
                jobs.push(...value.jobs); if (jobs.length >= value.total_count) break;
                assert(page < 20, 'Job pagination limit exceeded');
            }
            jobsByAttempt.set(originalAttempt, jobs);
        }
        const target = report.target as string, split = target.lastIndexOf('-');
        const os = target.slice(0, split), arch = target.slice(split + 1);
        const name = report.host ? `Mods / ${({ linux: 'ubuntu-24.04', win32: 'windows-2025', darwin: 'macos-15' } as Record<string, string>)[report.platform]} / Claude ${report.host}` :
            report.kind === 'node-runtime' && !execution.reused_installed ? `Node ${report.runtime_case} / ${os} / ${arch}` : `Installed / ${os} / ${arch}`;
        const matching = jobsByAttempt.get(originalAttempt)!.filter(job => job.name === name && job.conclusion === 'success');
        assert.equal(matching.length, 1, 'Missing or ambiguous successful execution: ' + name);
        executions.push({ target, kind: report.kind ?? (report.host ? 'official-host' : 'installed'), runtime_case: report.runtime_case ?? null, node: report.node,
            node_sha256: report.node_sha256, host: report.host ?? null, host_sha256: report.host_sha256 ?? null, execution,
            job_id: matching[0].id, job_name: name, started_at: matching[0].started_at, completed_at: matching[0].completed_at });
    }
    const language = languageEvidence(verified.sourceEntries, build.commit);
    const common: EvidenceBase = { ...(language ? { language } : {}), kind: 'complete', repository: CI_REPOSITORY, source_commit: build.commit,
        tree: git('rev-parse', 'HEAD^{tree}'), run_id: runId, attempt, event: process.env.GITHUB_EVENT_NAME!,
        branch: pr ? event.pull_request.head.ref : process.env.GITHUB_REF_NAME!, workflow: '.github/workflows/ci.yml', workflow_sha: process.env.GITHUB_WORKFLOW_SHA!, pr,
        created_at: created.toISOString(), expires_at: new Date(created.getTime() + 30 * 86400000).toISOString(), policy_sha256: policyDigest(build.commit), version: accepted.application_version,
        toolchain: { node: verified.source.node, npm: verified.source.npm, typescript: verified.source.typescript, lock_sha256: verified.source.lock_sha256 },
        coverage: { installations: assessed.installations, runtime_installations: assessed.runtime_installations, hosts: assessed.hosts, native_capacity_cases: version === 1 ? 197 : sourceCapacityCount(verified.sourceEntries) },
        inputs: JSON.parse(fs.readFileSync(join(source, 'runtime-inputs.json'), 'utf8')),
        delivery: Object.fromEntries([build.candidate.file, build.source.file, 'build-manifest.json', 'SHA256SUMS'].map(name => [name, digest(fs.readFileSync(join(source, name)))])),
        receipts: fileReceipts(evidence, version), artifacts: selection.artifacts,
        acceptance_sha256: digest(fs.readFileSync(acceptanceFile)), input_file_sha256: digest(fs.readFileSync(join(source, 'runtime-inputs.json'))),
        compiled: Object.fromEntries(['compiled-tests.json', 'compiled-tests.tar'].map(name => [name, digest(fs.readFileSync(join(evidence, 'ci-compiled-tests', name)))])),
    };
    let record: CompleteEvidence;
    if (workflow && context && planBytes) {
        const plan = verifyCoveragePlan(proposed, context.base, build.commit, common.inputs, context.basis);
        const raw = await listRunArtifacts(runId);
        const physical = await workflow.collectPhysical(evidence, plan, selection, raw, verified.sha256, false);
        assert('physical_producers' in assessed);
        assert.deepEqual(physical.map(row => row.receipt_sha256), assessed.physical_producers.map(row => row.receipt_sha256),
            'Original receipt bytes changed after release readiness');
        record = { ...common, schema_version: 2, coverage_plan: plan, coverage_plan_sha256: digest(planBytes), executions: physical };
        const { issueProductChecks } = await import('./impact-product-run.ts');
        record.product_checks = await issueProductChecks(record);
        const run = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${runId}`);
        requireRunIdentity(run, record.source_commit, record.branch, record.event);
        assert.equal(run.status, 'in_progress', 'The aggregate must issue its own current running attempt');
        assert.equal(run.conclusion, null);
        validateEnvelope(record, run, raw, Date.now());
    } else record = { ...common, schema_version: 1, executions };
    assert.equal(selection.run_id, record.run_id); assert.equal(selection.commit, record.source_commit);
    await verifyWorkflowSource(record);
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { run: { type: 'string' }, output: { type: 'string' }, evidence: { type: 'string' }, selection: { type: 'string' }, acceptance: { type: 'string' } } });
    assert(values.output);
    if (positionals[0] === 'select') {
        const runId = Number(values.run); assert(Number.isSafeInteger(runId) && runId > 0);
        const artifacts = selectCompleteArtifacts(await listRunArtifacts(runId));
        fs.writeFileSync(values.output, JSON.stringify({ run_id: runId, commit: git('rev-parse', 'HEAD'), artifacts }, null, 2) + '\n');
        if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `artifact_ids=${artifacts.map(value => value.id).join(',')}\n`);
    } else {
        assert.equal(positionals[0], 'record'); assert(values.evidence && values.selection && values.acceptance);
        await recordComplete(resolve(values.evidence), resolve(values.selection), resolve(values.acceptance), resolve(values.output));
    }
}
