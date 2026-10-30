/** Select and verify existing acceptance; this tool never creates refs or publishes. */
import assert from 'node:assert/strict';
import { verifyLanguageEvidence, verifySourceLanguage } from './i18n-evidence.ts';
import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { CI_REPOSITORY } from './ci-watch.ts';
import { completeSource, runsFor, latestRun } from './ci-sources.ts';
import { selectMain, integratedCandidate, verifyMerge, recordIntegration } from './ci-integration.ts';
export { completeSource, runsFor, latestRun } from './ci-sources.ts';
import { artifactIdentity, artifactJson, digest, git, listRunArtifacts, newestArtifact, requireRun, verifyRecordedFiles, type CompleteEvidence, type ArtifactIdentity } from './ci-evidence.ts';
import type { MaintenanceReleaseSelection } from './impact-release.ts';
import { verifyTagIdentity } from './ci-tag.ts';
export { verifyTagIdentity } from './ci-tag.ts';

export interface PromotionSelection {
    schema_version: 1; route: 'full' | 'tag' | 'main' | 'maintenance' | 'release'; reason: string; commit: string; tag?: string; tag_object?: string;
    release?: MaintenanceReleaseSelection;
    source_run?: number; source_commit?: string; filename?: string; source_record?: CompleteEvidence; source_envelope?: ArtifactIdentity; artifact_ids?: number[];
    integration?: { commit: string; base: string; head: string; pr: number; tree: string };
    integration_run?: number; integration_envelope?: ArtifactIdentity; integration_record_sha256?: string;
    mode?: 'automatic' | 'diagnostic' | 'full'; base_run?: number; push_before?: string; changed_paths?: string[];
    prediction?: { route: 'main' | 'full'; reason: string; head: string; base: string };
}
/** A forecast is conditional on the final complete run; it is never evidence. */
export function predictMain(head: string, base: string): NonNullable<PromotionSelection['prediction']> {
    try {
        assert.match(head, /^[a-f0-9]{40}$/u); assert.match(base, /^[a-f0-9]{40}$/u);
        git('merge-base', '--is-ancestor', base, head);
        assert.equal(git('merge-tree', '--write-tree', base, head), git('rev-parse', head + '^{tree}'));
        git('cat-file', '-e', base + ':tools/checks/ci-sources.ts');
        return { route: 'main', head, base, reason: 'Merge commit with this base/tree can reuse final complete PR evidence, subject to live provenance and accepted-base verification' };
    } catch { return { route: 'full', head, base, reason: 'Update the PR base or supply a supported accepted verifier before an equivalent merge can be proven' }; }
}
export async function selectTag(tag: string, commit: string): Promise<PromotionSelection> {
    const tagObject = verifyTagIdentity(tag, commit);
    let impact = false;
    try { git('cat-file', '-e', commit + ':tools/checks/impact-release.ts'); impact = true; } catch { /* Historical evidence retains its original reader. */ }
    if (impact) {
        const { selectMaintenanceRelease } = await import('./impact-release.ts');
        const release = await selectMaintenanceRelease(tag, commit);
        if (release) return { schema_version: 1, route: 'release', reason: 'Build the current maintenance source and bind it to original product acceptance', commit, tag, tag_object: tagObject,
            release, source_run: release.product.record.run_id, source_commit: release.product.record.source_commit, artifact_ids: release.product.artifact_ids };
    }
    const full: PromotionSelection = { schema_version: 1, route: 'full', reason: 'No reusable complete main evidence', commit, tag, tag_object: tagObject };
    // Historical sources retain their original full-gate policy.
    try { git('cat-file', '-e', commit + ':tools/checks/ci-evidence.ts'); } catch { return { ...full, reason: 'Legacy source requires full tag acceptance' }; }
    const main = latestRun(await runsFor(commit), commit, 'main');
    if (!main) {
        const integrated = await integratedCandidate(commit);
        assert(integrated, 'Missing applicable source/main integration evidence for tag');
        assert.equal(tag, 'v' + integrated.source_record!.version, 'Tag/version mismatch');
        return { ...integrated, route: 'tag', commit, tag, tag_object: tagObject, reason: 'Promote the original PR candidate through its successful main integration' };
    }
    const source = await completeSource(main); assert.equal(tag, 'v' + source.record.version, 'Tag/version mismatch');
    const filename = `fbincon-claude-code-statusline-${source.record.version}.tgz`; assert(source.record.delivery[filename]);
    return { schema_version: 1, route: 'tag', reason: 'Reuse complete main acceptance at the identical commit', commit, tag, tag_object: tagObject,
        source_run: main.id, source_commit: commit, filename, source_record: source.record, source_envelope: source.envelope, artifact_ids: source.artifact_ids };
}
export async function verifyOriginal(selection: PromotionSelection, evidence: string): Promise<CompleteEvidence> {
    assert.equal(selection.schema_version, 1); assert(['main', 'tag'].includes(selection.route));
    assert(selection.source_record && selection.source_run && selection.source_commit && selection.filename && selection.source_envelope);
    assert.equal(git('rev-parse', 'HEAD'), selection.commit);
    if (selection.route === 'tag') {
        assert(selection.tag); assert.equal(selection.commit, selection.source_commit);
        assert.equal(verifyTagIdentity(selection.tag, selection.commit), selection.tag_object);
        if (selection.integration) {
            const integrated = await integratedCandidate(selection.source_commit); assert(integrated);
            for (const key of ['integration', 'integration_run', 'integration_envelope', 'integration_record_sha256'] as const)
                assert.deepEqual(integrated[key], selection[key], 'Integration evidence changed during promotion');
        }
    } else {
        assert(selection.integration); assert.equal(selection.source_commit, selection.integration.head);
        assert.equal(selection.commit, selection.integration.commit); await verifyMerge(selection.integration);
    }
    const source = selection.source_record;
    const current = latestRun(await runsFor(selection.source_commit, source.event), selection.source_commit, source.branch, source.event);
    assert(current && current.id === selection.source_run, 'Original evidence changed during promotion');
    const original = await completeSource(current);
    assert.deepEqual(original.record, selection.source_record); assert.deepEqual(original.envelope, selection.source_envelope);
    assert.deepEqual(original.artifact_ids, selection.artifact_ids);
    verifyRecordedFiles(original.record, evidence); return original.record;
}
export async function verifyPromotion(selection: PromotionSelection, evidence: string, output: string, smokes?: string, smokeSelection?: string, verificationFile?: string): Promise<void> {
    const record = await verifyOriginal(selection, evidence), directory = join(evidence, 'ts06-candidate');
    assert(selection.filename && selection.source_commit);
    const { verifyDelivery } = await import('../build/verify.js');
    const { assessEvidence, evidenceFiles } = await import('../release/prepare.js');
    const checked = verifyDelivery(join(directory, selection.filename), selection.source_commit);
    verifyLanguageEvidence(record.language, checked.sourceEntries, selection.source_commit, selection.route === 'tag');
    const accepted = assessEvidence(evidenceFiles(evidence), selection.source_commit, checked.sha256, checked.sourceEntries);
    const previous = JSON.parse(fs.readFileSync(join(evidence, 'ts06-acceptance/candidate-acceptance.json'), 'utf8'));
    verifyLanguageEvidence(previous.language, checked.sourceEntries, selection.source_commit, selection.route === 'tag');
    assert.equal(previous.status, accepted.status); assert.equal(previous.commit, selection.source_commit); assert.equal(previous.tarball_sha256, checked.sha256);
    assert.equal(previous.application_version, record.version);
    // Recheck version-scoped approval from the immutable source, not the current working tree.
    const { sourceStableApproval } = await import('../release/approval.js');
    if (checked.source.channel === 'stable') {
        const approval = sourceStableApproval(checked.sourceEntries, record.version);
        assert.deepEqual(previous.maintainer_approval, approval, 'Original approval evidence differs');
        assert.equal(previous.stable_ready, checked.language?.report.release_ready ?? true);
    } else { assert.equal(checked.source.channel, 'preview'); assert.equal(previous.preview_ready, checked.language?.report.release_ready ?? true); }
    assert.deepEqual(record.toolchain, { node: checked.source.node, npm: checked.source.npm, typescript: checked.source.typescript, lock_sha256: checked.source.lock_sha256 });
    if (selection.route === 'main') {
        assert(smokes && smokeSelection && verificationFile);
        await recordIntegration(selection, smokes, smokeSelection, output, JSON.parse(fs.readFileSync(verificationFile, 'utf8'))); return;
    }
    const result = { schema_version: 1, kind: 'tag-promotion', repository: CI_REPOSITORY, commit: selection.commit, source_commit: selection.source_commit,
        tag: selection.tag, tag_object: selection.tag_object, run_id: Number(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
        source_run: selection.source_run, source_envelope: selection.source_envelope, source_record_sha256: digest(JSON.stringify(record)), delivery: record.delivery,
        integration: selection.integration ?? null, integration_run: selection.integration_run ?? null, integration_envelope: selection.integration_envelope ?? null, integration_record_sha256: selection.integration_record_sha256 ?? null,
        executed: ['tag-identity', 'main-ancestry', 'original-artifacts', 'complete-receipts', 'release-approval'], reused: record.coverage, created_at: new Date().toISOString(), status: 'pass' };
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
}
export async function publishedTagEvidence(tag: string, commit: string, run: any): Promise<{ sourceRun: number; integrationRun: number; promotion: any; artifacts: number[]; record: CompleteEvidence } | null> {
    requireRun(run, commit, tag);
    const artifacts = await listRunArtifacts(run.id);
    if (!artifacts.some(value => value.name === 'ci-promotion')) {
        assert(!artifacts.some(value => value.name === 'ci-promotion-selection'), 'Selected tag promotion is missing its original receipt');
        return null;
    }
    const promotion = await artifactJson(newestArtifact(artifacts, 'ci-promotion'), 'promotion.json');
    assert.equal(promotion.schema_version, 1); assert.equal(promotion.kind, 'tag-promotion'); assert.equal(promotion.status, 'pass');
    assert.equal(promotion.repository, CI_REPOSITORY); assert.equal(promotion.commit, commit); assert.equal(promotion.source_commit, commit);
    assert.equal(promotion.run_id, run.id); assert.equal(promotion.attempt, run.run_attempt); assert.equal(promotion.tag, tag);
    assert.equal(promotion.tag_object, verifyTagIdentity(tag, commit));
    let original: Awaited<ReturnType<typeof completeSource>>, integrationRun: number;
    if (promotion.integration) {
        const integrated = await integratedCandidate(commit); assert(integrated);
        for (const key of ['integration', 'integration_run', 'integration_envelope', 'integration_record_sha256'] as const) assert.deepEqual(integrated[key], promotion[key]);
        assert.equal(integrated.source_run, promotion.source_run);
        original = { record: integrated.source_record!, envelope: integrated.source_envelope!, artifact_ids: integrated.artifact_ids! }; integrationRun = integrated.integration_run!;
    } else {
        const source = latestRun(await runsFor(commit), commit, 'main'); assert(source && source.id === promotion.source_run);
        original = await completeSource(source); integrationRun = source.id;
    }
    assert.deepEqual(original.envelope, promotion.source_envelope); assert.equal(digest(JSON.stringify(original.record)), promotion.source_record_sha256);
    assert.deepEqual(original.record.delivery, promotion.delivery);
    verifySourceLanguage(original.record.language, original.record.source_commit, true);
    return { sourceRun: promotion.source_run, integrationRun, promotion, artifacts: original.artifact_ids, record: original.record };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { output: { type: 'string' }, selection: { type: 'string' }, evidence: { type: 'string' }, smokes: { type: 'string' }, 'smoke-selection': { type: 'string' }, 'trusted-verification': { type: 'string' } } });
    assert(values.output || positionals[0] === 'preflight');
    if (positionals[0] === 'select') {
        const commit = git('rev-parse', 'HEAD');
        try {
            const diagnostic = process.env.CI_EVENT === 'workflow_dispatch' && process.env.CI_VALIDATION === 'promotion-shadow';
            if (diagnostic) assert.equal(process.env.CI_REF_NAME, 'main', 'Promotion shadow must run on main');
            const result = process.env.CI_IMPACT_ROUTE === 'maintenance' ? { schema_version: 1, route: 'maintenance', reason: 'Scoped impact checks; no complete product receipt is created', commit } as PromotionSelection :
                diagnostic ? { ...await selectMain(commit, git('rev-parse', commit + '^1')), mode: 'diagnostic' as const } :
                process.env.CI_EVENT === 'push' && process.env.CI_REF_TYPE === 'tag' ? await selectTag(process.env.CI_REF_NAME!, commit) :
                process.env.CI_EVENT === 'push' && process.env.CI_REF_NAME === 'main' && process.env.CI_DOCS_ONLY !== 'true' ? await selectMain(commit, process.env.CI_BASE ?? '') :
                { schema_version: 1, route: 'full', reason: process.env.CI_EVENT === 'workflow_dispatch' ? 'Explicit manual validation; not PR or release evidence' :
                    process.env.CI_DOCS_ONLY === 'true' ? 'Documentation allowlist; no candidate acceptance' : 'Complete final PR acceptance required', commit } as PromotionSelection;
            if (diagnostic) assert.equal(result.route, 'main', 'No reusable candidate for shadow diagnostics; use explicit full validation');
            result.mode ??= process.env.CI_EVENT === 'workflow_dispatch' ? 'full' : 'automatic';
            if (process.env.CI_EVENT === 'pull_request' && process.env.CI_DOCS_ONLY !== 'true' && result.route === 'full') result.prediction = predictMain(commit, process.env.CI_BASE ?? '');
            fs.writeFileSync(values.output!, JSON.stringify(result, null, 2) + '\n');
            if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `route=${result.route}\npromotion_route=${['main', 'tag'].includes(result.route) ? result.route : ''}\nmode=${result.mode}\nsource_run=${result.source_run ?? ''}\nsource_commit=${result.source_commit ?? ''}\nfilename=${result.filename ?? ''}\nartifact_ids=${result.artifact_ids?.join(',') ?? ''}\n`);
            const summary = { route: process.env.CI_DOCS_ONLY === 'true' ? 'documentation' : result.route, mode: result.mode, reason: result.reason,
                prediction: result.prediction, integration: result.integration, push_before: result.push_before, base_run: result.base_run,
                source_run: result.source_run, source_commit: result.source_commit, source_envelope: result.source_envelope,
                original_delivery: result.source_record?.delivery, artifact_ids: result.artifact_ids, changed_paths: result.changed_paths };
            console.log(JSON.stringify(summary, null, 2));
            if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### CI route and original evidence\n\n```json\n' + JSON.stringify(summary, null, 2) + '\n```\n');
        } catch (error) {
            const blocked = { route: 'blocked', commit, event: process.env.CI_EVENT, reason: error instanceof Error ? error.message : String(error),
                action: 'Repair applicable evidence or provenance; no automatic full fallback and no older green substitution' };
            console.error(JSON.stringify(blocked, null, 2));
            if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### CI blocked\n\n```json\n' + JSON.stringify(blocked, null, 2) + '\n```\n');
            throw error;
        }
    } else if (positionals[0] === 'preflight') {
        assert(values.selection && values.evidence);
        await verifyOriginal(JSON.parse(fs.readFileSync(values.selection, 'utf8')), resolve(values.evidence));
    } else {
        assert.equal(positionals[0], 'verify'); assert(values.selection && values.evidence && values.output);
        await verifyPromotion(JSON.parse(fs.readFileSync(values.selection, 'utf8')), resolve(values.evidence), resolve(values.output), values.smokes, values['smoke-selection'], values['trusted-verification']);
    }
}
