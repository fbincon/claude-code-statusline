/** Bind a new release source to old product coverage plus its own maintenance and delivery checks. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, git, hash, productInputs } from './impact-content.ts';
import { completeSource, latestRun, runsFor, requireGate } from './ci-sources.ts';
import { artifactIdentity, artifactJson, listRunArtifacts, newestArtifact, requireRun, verifyRecordedFiles, type ArtifactIdentity, type CompleteEvidence } from './ci-evidence.ts';
import { githubRead, CI_REPOSITORY } from './ci-watch.ts';
import { maintenanceSource, type MaintenanceReference } from './impact-evidence.ts';
import { integratedCandidate, SMOKE_TARGETS } from './ci-integration.ts';
import { verifyTagIdentity } from './ci-tag.ts';
import { withImpactVerifier } from './impact-trust.ts';
import { comparePackages, type PackageComparison } from '../build/impact-package.ts';

export interface MaintenanceReleaseSelection {
    schema_version: 1; kind: 'maintenance-release-selection'; tag: string; tag_object: string; commit: string; integration_commit: string;
    maintenance: MaintenanceReference[]; product: { record: CompleteEvidence; envelope: ArtifactIdentity; artifact_ids: number[] };
}
export interface ReleaseBinding {
    schema_version: 1; kind: 'maintenance-release'; status: 'pass'; repository: string; selection: MaintenanceReleaseSelection;
    run_id: number; attempt: number; delivery: Record<string, string>; package_artifact: ArtifactIdentity; comparison: PackageComparison;
    smokes: { artifact: ArtifactIdentity; receipt: any }[]; approval: unknown; created_at: string;
    executed: string[]; reused: CompleteEvidence['coverage'];
}
async function mainForSource(commit: string): Promise<any | undefined> {
    const direct = latestRun(await runsFor(commit), commit, 'main'); if (direct) return direct;
    const pulls: any[] = [];
    for (let page = 1; page <= 10; page++) {
        const rows = await githubRead(`repos/${CI_REPOSITORY}/commits/${commit}/pulls?per_page=100&page=${page}`); pulls.push(...rows);
        if (rows.length < 100) break; assert(page < 10);
    }
    const selected = pulls.filter(pr => pr.merged_at && pr.state === 'closed' && !pr.draft && pr.head.sha === commit && pr.base.ref === 'main' && pr.base.repo?.full_name === CI_REPOSITORY && pr.head.repo?.full_name === CI_REPOSITORY);
    assert(selected.length <= 1, 'Ambiguous release source integration'); if (!selected.length) return undefined;
    const run = latestRun(await runsFor(selected[0].merge_commit_sha), selected[0].merge_commit_sha, 'main'); assert(run, 'Missing integrated release source'); return run;
}
export async function selectMaintenanceRelease(tag: string, commit: string): Promise<MaintenanceReleaseSelection | null> {
    const main = await mainForSource(commit); if (!main) return null;
    await requireGate(main);
    const initial = await listRunArtifacts(main.id);
    if (!initial.some(item => item.name === 'ci-maintenance')) {
        assert(!initial.some(item => item.name === 'ci-impact-plan'), 'Missing supported maintenance evidence'); return null;
    }
    const maintenance: MaintenanceReference[] = [], seen = new Set<string>(); let run = main;
    for (let depth = 0; depth < 100; depth++) {
        assert(!seen.has(run.head_sha), 'Cyclic maintenance ancestry'); seen.add(run.head_sha);
        const artifacts = await listRunArtifacts(run.id);
        if (artifacts.some(item => item.name === 'ci-maintenance')) {
            const source = await maintenanceSource(run); maintenance.push(source.reference);
            if (depth === 0) {
                assert([source.record.commit, source.record.plan.head].includes(commit), 'Tag is not the accepted maintenance source');
                assert.equal(git('rev-parse', commit + '^{tree}'), source.record.tree);
            }
            run = latestRun(await runsFor(source.record.product_base), source.record.product_base, 'main'); assert(run, 'Missing product baseline main'); continue;
        }
        let product: MaintenanceReleaseSelection['product'];
        if (artifacts.some(item => item.name === 'ci-promotion')) {
            const promotion = await artifactJson(newestArtifact(artifacts, 'ci-promotion'), 'promotion.json');
            assert.equal(promotion.kind, 'main-promotion'); assert.equal(promotion.integration.commit, run.head_sha);
            const accepted = await integratedCandidate(promotion.source_commit); assert(accepted && accepted.integration_run === run.id);
            product = { record: accepted.source_record!, envelope: accepted.source_envelope!, artifact_ids: accepted.artifact_ids! };
        } else product = await completeSource(run);
        assert.equal(productInputs(product.record.source_commit), productInputs(commit), 'Core product inputs changed since complete acceptance');
        return { schema_version: 1, kind: 'maintenance-release-selection', tag, tag_object: verifyTagIdentity(tag, commit), commit,
            integration_commit: main.head_sha, maintenance, product };
    }
    throw new Error('Maintenance chain exceeds bound');
}
export async function verifyReleaseSelection(selection: MaintenanceReleaseSelection): Promise<void> {
    assert.equal(selection.schema_version, 1); assert.equal(selection.kind, 'maintenance-release-selection');
    const current = await selectMaintenanceRelease(selection.tag, selection.commit); assert.deepEqual(current, selection, 'Release evidence changed');
}
export function validateReleaseBinding(binding: ReleaseBinding, selection: MaintenanceReleaseSelection, run: any): void {
    assert.equal(binding.schema_version, 1); assert.equal(binding.kind, 'maintenance-release'); assert.equal(binding.status, 'pass');
    assert.equal(binding.repository, CI_REPOSITORY); requireRun(run, selection.commit, selection.tag); assert.deepEqual(binding.selection, selection);
    assert.equal(binding.run_id, run.id); assert.equal(binding.attempt, run.run_attempt);
    assert.equal(binding.comparison.base, selection.product.record.source_commit); assert.equal(binding.comparison.head, selection.commit);
    assert.equal(binding.comparison.equivalent, true); assert.deepEqual(binding.comparison.changed_members, []);
    assert.equal(binding.comparison.base_sha256, selection.product.record.delivery[`fbincon-claude-code-statusline-${selection.product.record.version}.tgz`]);
    const version = selection.tag.slice(1); assert.equal(binding.comparison.head_sha256, binding.delivery[`fbincon-claude-code-statusline-${version}.tgz`]);
    assert.deepEqual(Object.keys(binding.delivery).sort(), ['SHA256SUMS', 'build-manifest.json', `fbincon-claude-code-statusline-${version}.tgz`, `claude-code-statusline-${version}-source.tar.gz`].sort());
    assert.deepEqual(binding.reused, selection.product.record.coverage);
    assert.deepEqual(binding.executed, ['maintenance-chain', 'tag-identity', 'reproducible-source-build', 'independent-product-comparison', 'three-platform-installation-smoke', 'release-approval']);
    assert.deepEqual(binding.smokes.map(item => item.receipt.target).sort(), [...SMOKE_TARGETS].sort());
    for (const { receipt } of binding.smokes) {
        assert.equal(receipt.status, 'pass'); assert.equal(receipt.kind, 'integration-smoke'); assert.equal(receipt.source_commit, selection.commit);
        assert.equal(receipt.integration_commit, selection.commit); assert.equal(receipt.tarball_sha256, binding.comparison.head_sha256);
        assert.equal(Number(receipt.execution.run_id), run.id); assert.equal(receipt.model_calls, 0); assert.equal(receipt.lifecycle_scripts, false);
        assert.deepEqual(receipt.checks, ['offline-empty-cache-install', 'version', 'install', 'doctor', 'render', 'configuration-read-write', 'uninstall-preserves-unowned-settings']);
    }
}
export async function recordReleaseBinding(selection: MaintenanceReleaseSelection, original: string, delivery: string, output: string): Promise<ReleaseBinding> {
    await verifyReleaseSelection(selection); assert.equal(git('rev-parse', 'HEAD'), selection.commit);
    const { verifyDelivery } = await import('../build/verify.ts');
    const { sourceStableApproval } = await import('../release/approval.ts');
    const version = selection.tag.slice(1), filename = `fbincon-claude-code-statusline-${version}.tgz`, checked = verifyDelivery(join(delivery, filename), selection.commit);
    assert.equal(checked.source.application_version, version); verifyRecordedFiles(selection.product.record, original);
    const baseline = join(original, 'ts06-candidate', `fbincon-claude-code-statusline-${selection.product.record.version}.tgz`);
    const comparison = comparePackages(selection.product.record.source_commit, selection.commit, baseline, join(delivery, filename)); assert(comparison.equivalent, 'Release changes product payload');
    await withImpactVerifier(selection.product.record.source_commit, async directory => {
        const verifier = await import(pathToFileURL(join(directory, 'tools/build/impact-package.ts')).href);
        assert.deepEqual(verifier.comparePackages(comparison.base, comparison.head, baseline, join(delivery, filename)), comparison);
    });
    const buildProof = JSON.parse(fs.readFileSync(join(delivery, 'release-build-proof.json'), 'utf8'));
    assert.deepEqual(buildProof, { schema_version: 1, commit: selection.commit, tarball_sha256: checked.sha256, source_rebuild_sha256: checked.sha256 });
    const runId = Number(process.env.GITHUB_RUN_ID), artifacts = await listRunArtifacts(runId), smokes: ReleaseBinding['smokes'] = [];
    for (const target of SMOKE_TARGETS) {
        const artifact = artifactIdentity(newestArtifact(artifacts, 'ci-release-smoke-' + target));
        smokes.push({ artifact, receipt: await artifactJson({ ...artifact, expired: false }, 'smoke.json') });
    }
    const binding: ReleaseBinding = { schema_version: 1, kind: 'maintenance-release', status: 'pass', repository: CI_REPOSITORY, selection,
        run_id: runId, attempt: Number(process.env.GITHUB_RUN_ATTEMPT), package_artifact: artifactIdentity(newestArtifact(artifacts, 'ci-release-package')),
        delivery: Object.fromEntries([filename, `claude-code-statusline-${version}-source.tar.gz`, 'build-manifest.json', 'SHA256SUMS'].map(name => [name, hash(fs.readFileSync(join(delivery, name)))])),
        comparison, smokes, approval: checked.source.channel === 'stable' ? sourceStableApproval(checked.sourceEntries, version) : null,
        created_at: new Date().toISOString(), executed: ['maintenance-chain', 'tag-identity', 'reproducible-source-build', 'independent-product-comparison', 'three-platform-installation-smoke', 'release-approval'], reused: selection.product.record.coverage };
    const run = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${runId}`);
    validateReleaseBinding(binding, selection, { ...run, status: 'completed', conclusion: 'success' }); // The aggregate still must pass before any consumer accepts this receipt.
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(binding, null, 2) + '\n', { flag: 'wx' }); return binding;
}
export async function publishedMaintenanceRelease(tag: string, commit: string, run: any): Promise<ReleaseBinding | null> {
    requireRun(run, commit, tag); const artifacts = await listRunArtifacts(run.id);
    if (!artifacts.some(item => item.name === 'ci-release-binding')) {
        assert(!artifacts.some(item => item.name === 'ci-release-selection'), 'Missing selected maintenance release receipt'); return null;
    }
    const binding = await artifactJson(newestArtifact(artifacts, 'ci-release-binding'), 'release-binding.json') as ReleaseBinding;
    await requireGate(run); await verifyReleaseSelection(binding.selection); validateReleaseBinding(binding, binding.selection, run);
    assert.deepEqual(artifactIdentity(newestArtifact(artifacts, 'ci-release-package')), binding.package_artifact);
    for (const smoke of binding.smokes) {
        assert.deepEqual(artifactIdentity(newestArtifact(artifacts, smoke.artifact.name)), smoke.artifact);
        assert.deepEqual(await artifactJson({ ...smoke.artifact, expired: false }, 'smoke.json'), smoke.receipt);
    }
    return binding;
}
export async function verifyMaintenanceBundle(binding: ReleaseBinding, directory: string): Promise<void> {
    const { selection } = binding, run = latestRun(await runsFor(selection.commit), selection.commit, selection.tag); assert(run);
    assert.deepEqual(await publishedMaintenanceRelease(selection.tag, selection.commit, run), binding);
    for (const [name, digest] of Object.entries(binding.delivery)) assert.equal(hash(fs.readFileSync(join(directory, name))), digest, 'Release delivery bytes changed');
    const { verifyDelivery } = await import('../build/verify.ts'), { sourceStableApproval } = await import('../release/approval.ts');
    const checked = verifyDelivery(join(directory, `fbincon-claude-code-statusline-${selection.tag.slice(1)}.tgz`), selection.commit);
    if (checked.source.channel === 'stable') assert.deepEqual(sourceStableApproval(checked.sourceEntries, checked.source.application_version), binding.approval);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { selection: { type: 'string' }, original: { type: 'string' }, delivery: { type: 'string' }, output: { type: 'string' } } });
    assert(values.selection && values.original && values.delivery && values.output);
    const selected = JSON.parse(fs.readFileSync(values.selection, 'utf8'));
    await recordReleaseBinding(selected.release, resolve(values.original), resolve(values.delivery), resolve(values.output));
}
