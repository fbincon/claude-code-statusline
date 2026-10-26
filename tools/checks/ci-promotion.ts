/** Select and verify existing acceptance; this tool never creates refs or publishes. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { githubRead, CI_REPOSITORY } from './ci-watch.ts';
import { artifactIdentity, artifactJson, digest, git, listRunArtifacts, newestArtifact, policyDigest, requireRun, validateComplete, verifyRecordedFiles, verifyWorkflowSource, type CompleteEvidence, type ArtifactIdentity } from './ci-evidence.ts';

export interface PromotionSelection {
    schema_version: 1; route: 'full' | 'tag'; reason: string; commit: string; tag?: string; tag_object?: string;
    source_run?: number; source_commit?: string; filename?: string; source_record?: CompleteEvidence; source_envelope?: ArtifactIdentity; artifact_ids?: number[];
}
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
export function verifyTagIdentity(tag: string, commit: string, read = git): string {
    assert.match(tag, /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
    assert.equal(read('cat-file', '-t', 'refs/tags/' + tag), 'tag', 'Annotated release tag required');
    assert.equal(read('rev-parse', 'refs/tags/' + tag + '^{commit}'), commit, 'Tag moved');
    read('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main');
    return read('rev-parse', 'refs/tags/' + tag);
}
export async function selectTag(tag: string, commit: string): Promise<PromotionSelection> {
    const tagObject = verifyTagIdentity(tag, commit);
    const full: PromotionSelection = { schema_version: 1, route: 'full', reason: 'No reusable complete main evidence', commit, tag, tag_object: tagObject };
    // Historical sources retain their original full-gate policy.
    try { git('cat-file', '-e', commit + ':tools/checks/ci-evidence.ts'); } catch { return { ...full, reason: 'Legacy source requires full tag acceptance' }; }
    const main = latestRun(await runsFor(commit), commit, 'main'); if (!main) return full;
    const source = await completeSource(main); assert.equal(tag, 'v' + source.record.version, 'Tag/version mismatch');
    const filename = `fbincon-claude-code-statusline-${source.record.version}.tgz`; assert(source.record.delivery[filename]);
    return { schema_version: 1, route: 'tag', reason: 'Reuse complete main acceptance at the identical commit', commit, tag, tag_object: tagObject,
        source_run: main.id, source_commit: commit, filename, source_record: source.record, source_envelope: source.envelope, artifact_ids: source.artifact_ids };
}
export async function verifyOriginal(selection: PromotionSelection, evidence: string): Promise<CompleteEvidence> {
    assert.equal(selection.schema_version, 1); assert.equal(selection.route, 'tag');
    assert(selection.tag && selection.source_record && selection.source_run && selection.source_commit && selection.filename && selection.source_envelope);
    assert.equal(selection.commit, selection.source_commit); assert.equal(git('rev-parse', 'HEAD'), selection.commit);
    assert.equal(verifyTagIdentity(selection.tag, selection.commit), selection.tag_object);
    const current = latestRun(await runsFor(selection.source_commit), selection.source_commit, 'main');
    assert(current && current.id === selection.source_run, 'Main evidence changed during promotion');
    const original = await completeSource(current);
    assert.deepEqual(original.record, selection.source_record); assert.deepEqual(original.envelope, selection.source_envelope);
    assert.deepEqual(original.artifact_ids, selection.artifact_ids);
    verifyRecordedFiles(original.record, evidence); return original.record;
}
export async function verifyPromotion(selection: PromotionSelection, evidence: string, output: string): Promise<void> {
    const record = await verifyOriginal(selection, evidence), directory = join(evidence, 'ts06-candidate');
    assert(selection.filename && selection.source_commit);
    const { verifyDelivery } = await import('../build/verify.js');
    const { assessEvidence, evidenceFiles } = await import('../release/prepare.js');
    const checked = verifyDelivery(join(directory, selection.filename), selection.source_commit);
    const accepted = assessEvidence(evidenceFiles(evidence), selection.source_commit, checked.sha256);
    const previous = JSON.parse(fs.readFileSync(join(evidence, 'ts06-acceptance/candidate-acceptance.json'), 'utf8'));
    assert.equal(previous.status, accepted.status); assert.equal(previous.commit, selection.source_commit); assert.equal(previous.tarball_sha256, checked.sha256);
    assert.equal(previous.application_version, record.version);
    // Recheck version-scoped approval from the immutable source, not the current working tree.
    const { assessStableApproval, stableApprovalPath } = await import('../release/approval.js');
    if (checked.source.channel === 'stable') {
        const raw = checked.sourceEntries.get(stableApprovalPath(record.version)); assert(raw);
        assessStableApproval(JSON.parse(raw.toString('utf8')), record.version); assert.equal(previous.stable_ready, true);
    } else { assert.equal(checked.source.channel, 'preview'); assert.equal(previous.preview_ready, true); }
    const result = { schema_version: 1, kind: 'tag-promotion', repository: CI_REPOSITORY, commit: selection.commit, source_commit: selection.source_commit,
        tag: selection.tag, tag_object: selection.tag_object, run_id: Number(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
        source_run: selection.source_run, source_envelope: selection.source_envelope, source_record_sha256: digest(JSON.stringify(record)), delivery: record.delivery,
        executed: ['tag-identity', 'main-ancestry', 'original-artifacts', 'complete-receipts', 'release-approval'], reused: record.coverage, created_at: new Date().toISOString(), status: 'pass' };
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
}
export async function publishedTagEvidence(tag: string, commit: string, run: any): Promise<{ sourceRun: number; promotion: any; artifacts: number[]; record: CompleteEvidence } | null> {
    requireRun(run, commit, tag);
    const artifacts = await listRunArtifacts(run.id);
    if (!artifacts.some(value => value.name === 'ci-promotion')) return null;
    const promotion = await artifactJson(newestArtifact(artifacts, 'ci-promotion'), 'promotion.json');
    assert.equal(promotion.schema_version, 1); assert.equal(promotion.kind, 'tag-promotion'); assert.equal(promotion.status, 'pass');
    assert.equal(promotion.repository, CI_REPOSITORY); assert.equal(promotion.commit, commit); assert.equal(promotion.source_commit, commit);
    assert.equal(promotion.run_id, run.id); assert.equal(promotion.attempt, run.run_attempt); assert.equal(promotion.tag, tag);
    assert.equal(promotion.tag_object, verifyTagIdentity(tag, commit));
    const source = latestRun(await runsFor(commit), commit, 'main'); assert(source && source.id === promotion.source_run);
    const original = await completeSource(source);
    assert.deepEqual(original.envelope, promotion.source_envelope); assert.equal(digest(JSON.stringify(original.record)), promotion.source_record_sha256);
    assert.deepEqual(original.record.delivery, promotion.delivery);
    return { sourceRun: source.id, promotion, artifacts: original.artifact_ids, record: original.record };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { output: { type: 'string' }, selection: { type: 'string' }, evidence: { type: 'string' } } });
    assert(values.output || positionals[0] === 'preflight');
    if (positionals[0] === 'select') {
        const commit = git('rev-parse', 'HEAD');
        const result = process.env.CI_EVENT === 'push' && process.env.CI_REF_TYPE === 'tag' ? await selectTag(process.env.CI_REF_NAME!, commit) :
            { schema_version: 1, route: 'full', reason: 'Full acceptance required', commit } as PromotionSelection;
        fs.writeFileSync(values.output!, JSON.stringify(result, null, 2) + '\n');
        if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `route=${result.route}\nsource_run=${result.source_run ?? ''}\nsource_commit=${result.source_commit ?? ''}\nfilename=${result.filename ?? ''}\nartifact_ids=${result.artifact_ids?.join(',') ?? ''}\n`);
        console.log(JSON.stringify({ route: result.route, reason: result.reason, source_run: result.source_run }));
    } else if (positionals[0] === 'preflight') {
        assert(values.selection && values.evidence);
        await verifyOriginal(JSON.parse(fs.readFileSync(values.selection, 'utf8')), resolve(values.evidence));
    } else {
        assert.equal(positionals[0], 'verify'); assert(values.selection && values.evidence && values.output);
        await verifyPromotion(JSON.parse(fs.readFileSync(values.selection, 'utf8')), resolve(values.evidence), resolve(values.output));
    }
}
