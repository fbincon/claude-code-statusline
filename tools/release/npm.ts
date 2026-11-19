/** Resolve trusted CI inputs and prepare a bundle without npm write credentials. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { VERSION } from '@fbincon/statusline-core/release';
import { publicChannel, sourceFilename } from '../build/model.js';
import { verifyDelivery } from '../build/verify.js';
import { REPOSITORY, validatePlan, requirePublishContext, registryMetadata, verifyPublishedBytes, type PublishPlan } from './npm-registry.js';
import { publishedTagEvidence, runsFor } from '../checks/ci-promotion.js';
import { verifyRecordedFiles, artifactIdentity, newestArtifact, listRunArtifacts, type CompleteEvidence } from '../checks/ci-evidence.js';
import { publishedMaintenanceRelease, verifyMaintenanceBundle } from '../checks/impact-release.js';
import { coverageVersionInArchive } from '../checks/ci-coverage.js';
import { originalContext } from '../checks/ci-reused-coverage.js';
import { publishedReleaseTag, verifyDeliveryBytes } from '../checks/release-ci-evidence.js';
import { candidateCases, releasePolicyAt } from '../checks/release-ci-policy.js';
import { verifyReleaseDelivery } from './ci-delivery.js';

export function selectCiRun(runs: any[], commit: string, branch: string) {
    const matching = runs.filter(run => run.head_sha === commit && run.head_branch === branch && run.event === 'push'
        && run.path === '.github/workflows/ci.yml' && run.repository?.full_name === REPOSITORY && run.head_repository?.full_name === REPOSITORY)
        .sort((a, b) => b.id - a.id);
    assert(matching.length, 'Missing source-bound CI for ' + branch);
    const run = matching[0];
    assert.equal(run.status, 'completed', 'CI has not completed for ' + branch);
    assert.equal(run.conclusion, 'success', 'Latest CI did not pass for ' + branch);
    return run.id as number;
}
export function legacyArtifactIds(artifacts: any[]): number[] {
    const names = [...new Set<string>(artifacts.map(row => row.name).filter(name => /^ts06-(?:candidate$|acceptance$|installed-|runtime-|mods-)/u.test(name)))].sort();
    assert(names.includes('ts06-candidate') && names.includes('ts06-acceptance'), 'Missing legacy release inputs');
    return names.map(name => artifactIdentity(newestArtifact(artifacts, name)).id);
}

function releaseReferences(verified: Awaited<ReturnType<typeof publishedReleaseTag>>) {
    return { candidate: verified.candidate_ref, integration: verified.integration_ref, tag: verified.tag_ref };
}

function writeSelection(selection: string, result: { ci_run: number; artifact_ids: number[]; release_ci?: unknown }) {
    fs.writeFileSync(selection, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
        `ci_run=${result.ci_run}\nartifact_ids=${result.artifact_ids.join(',')}\nrelease_ci=${Boolean(result.release_ci)}\n`);
    console.log(JSON.stringify(result));
}

export async function resolveRelease(selection: string) {
    assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
    assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
    assert(['true', 'false'].includes(process.env.DRY_RUN ?? ''), 'Choose an explicit dry-run value');
    const tag = process.env.RELEASE_TAG;
    assert.equal(tag, 'v' + VERSION, 'Tag must match the verifier application version');
    const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
    assert.equal(git(['cat-file', '-t', 'refs/tags/' + tag]), 'tag', 'Annotated release tag required');
    const commit = git(['rev-parse', '--verify', 'refs/tags/' + tag + '^{commit}']);
    assert.match(commit, /^[a-f0-9]{40}$/u);
    git(['merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main']);
    const dryRun = process.env.DRY_RUN === 'true';
    if (!dryRun) requirePublishContext({ tag: tag!, commit });
    else assert(['refs/heads/main', 'refs/tags/' + tag].includes(process.env.GITHUB_REF ?? ''), 'Dry-run must use main or the release tag');
    if (releasePolicyAt(commit)) {
        const verified = await publishedReleaseTag(tag!, commit);
        const result = { tag, commit, dry_run: dryRun, version: VERSION, channel: publicChannel(), release_ci: releaseReferences(verified),
            ci_run: verified.candidate_ref.run_id, tag_ci_run: verified.tag_ref.run_id, main_ci_run: verified.integration_ref.run_id,
            artifact_ids: [verified.candidate.package.id] };
        writeSelection(selection, result);
        return;
    }
    const runs = await runsFor(commit), tagRun = selectCiRun(runs, commit, tag!);
    const maintenance = await publishedMaintenanceRelease(tag!, commit, runs.find(run => run.id === tagRun));
    const promotion = maintenance ? null : await publishedTagEvidence(tag!, commit, runs.find(run => run.id === tagRun));
    const mainRun = maintenance ? maintenance.selection.maintenance[0]!.run_id : promotion?.integrationRun ?? selectCiRun(runs, commit, 'main');
    const ciRun = maintenance ? tagRun : promotion?.sourceRun ?? tagRun;
    const artifactIds = maintenance ? [maintenance.package_artifact.id] : promotion?.artifacts ?? legacyArtifactIds(await listRunArtifacts(ciRun));
    const result = { tag, commit, ci_run: ciRun, tag_ci_run: tagRun, main_ci_run: mainRun, dry_run: dryRun, version: VERSION, channel: publicChannel(),
        artifact_ids: artifactIds, ...(promotion ? { promotion: promotion.promotion } : {}), ...(maintenance ? { maintenance_release: maintenance } : {}) };
    writeSelection(selection, result);
}
export async function prepareBundle(selectionFile: string, evidence: string, output: string) {
    const selection = JSON.parse(fs.readFileSync(selectionFile, 'utf8'));
    assert.equal(selection.version, VERSION); assert.equal(selection.tag, 'v' + VERSION);
    assert.equal(selection.channel, publicChannel());
    assert.equal(Boolean(selection.release_ci), releasePolicyAt(selection.commit), 'Release evidence route must match the source');
    const directory = selection.release_ci ? evidence : join(evidence, selection.maintenance_release ? 'ci-release-package' : 'ts06-candidate');
    const filename = 'fbincon-claude-code-statusline-' + VERSION + '.tgz', artifact = join(directory, filename);
    const verifiedRelease = selection.release_ci ? await publishedReleaseTag(selection.tag, selection.commit) : undefined;
    if (verifiedRelease) {
        assert.deepEqual(selection.release_ci, releaseReferences(verifiedRelease), 'Selected release evidence changed');
        assert.equal(selection.ci_run, verifiedRelease.candidate_ref.run_id);
        assert.equal(selection.main_ci_run, verifiedRelease.integration_ref.run_id);
        assert.equal(selection.tag_ci_run, verifiedRelease.tag_ref.run_id);
        assert.deepEqual(selection.artifact_ids, [verifiedRelease.candidate.package.id]);
        verifyDeliveryBytes(directory, VERSION, verifiedRelease.candidate.delivery);
    }
    const checked = verifiedRelease ? verifyReleaseDelivery(directory, selection.commit) : verifyDelivery(artifact, selection.commit);
    let coverage: ReturnType<typeof originalContext>;
    if (selection.promotion) {
        const run = (await runsFor(selection.commit)).find(value => value.id === selection.tag_ci_run);
        const verified = await publishedTagEvidence(selection.tag, selection.commit, run);
        assert(verified); assert.equal(verified.sourceRun, selection.ci_run); assert.deepEqual(verified.promotion, selection.promotion);
        assert.deepEqual(verified.artifacts, selection.artifact_ids); verifyRecordedFiles(verified.record, evidence);
        coverage = originalContext(verified.record);
    }
    assert.equal(checked.source.channel, selection.channel);
    fs.mkdirSync(output);
    let matrix: Pick<CompleteEvidence['coverage'], 'installations' | 'runtime_installations' | 'hosts'>;
    if (verifiedRelease) {
        const cases = candidateCases(selection.commit), packages = cases.filter(spec => spec.kind === 'package');
        matrix = { installations: new Set(packages.map(spec => spec.os)).size, runtime_installations: packages.length, hosts: cases.length - packages.length };
        fs.writeFileSync(join(output, 'acceptance.json'), JSON.stringify({ kind: 'release-ci', status: 'pass', commit: selection.commit,
            tarball_sha256: checked.sha256, coverage: matrix, evidence: releaseReferences(verifiedRelease) }, null, 2) + '\n');
    } else if (selection.maintenance_release) {
        await verifyMaintenanceBundle(selection.maintenance_release, directory);
        matrix = selection.maintenance_release.selection.product.record.coverage;
        fs.writeFileSync(join(output, 'acceptance.json'), JSON.stringify({ kind: 'maintenance-release', status: 'pass', commit: selection.commit,
            tarball_sha256: checked.sha256, executed: selection.maintenance_release.executed, reused: selection.maintenance_release.reused,
            original_history: selection.maintenance_release.original_history }, null, 2) + '\n');
    } else {
        assert.equal(coverageVersionInArchive(checked.sourceEntries), coverage ? 2 : 1, 'Missing original tag coverage');
        const args = coverage ? ['--coverage-basis', coverage.basis, '--coverage-run-id', String(coverage.run_id),
            '--coverage-attempt', String(coverage.attempt), '--coverage-workflow-sha', coverage.workflow_sha,
            ...(coverage.base ? ['--coverage-base', coverage.base] : [])] : [];
        execFileSync(process.execPath, [join(import.meta.dirname, 'prepare.js'), '--' + selection.channel,
            '--artifact', artifact, '--commit', selection.commit, '--evidence', evidence, '--report', join(output, 'acceptance.json'), ...args], { stdio: 'pipe' });
        const acceptance = JSON.parse(fs.readFileSync(join(output, 'acceptance.json'), 'utf8'));
        const ciAcceptance = JSON.parse(fs.readFileSync(join(evidence, 'ts06-acceptance', 'candidate-acceptance.json'), 'utf8'));
        for (const field of ['status', 'commit', 'tarball_sha256', 'channel', 'preview_ready', 'stable_ready', 'installations', 'runtime_installations', 'hosts',
            ...(coverage ? ['coverage_version', 'history_coverage', 'physical_producers'] : [])])
            assert.deepEqual(ciAcceptance[field], acceptance[field], 'CI acceptance differs: ' + field);
        assert.equal(acceptance[selection.channel === 'stable' ? 'stable_ready' : 'preview_ready'], true);
        matrix = acceptance;
    }
    const plan: PublishPlan = { schema_version: 1, tag: selection.tag, commit: selection.commit, version: VERSION,
        channel: selection.channel, dist_tag: selection.channel === 'stable' ? 'latest' : 'beta', filename,
        sha256: checked.sha256, integrity: 'sha512-' + createHash('sha512').update(fs.readFileSync(artifact)).digest('base64'), ci_run: selection.ci_run };
    validatePlan(plan);
    const existing = await verifyPublishedBytes(await registryMetadata(), plan);
    for (const name of [filename, sourceFilename(selection.commit, selection.channel), 'build-manifest.json', 'SHA256SUMS'])
        fs.copyFileSync(join(directory, name), join(output, name));
    fs.copyFileSync(join(import.meta.dirname, 'npm-registry.js'), join(output, 'npm-registry.js'));
    // setup-node is not needed to interpret this file as ESM in the isolated job.
    fs.writeFileSync(join(output, 'package.json'), '{"private":true,"type":"module"}\n', { flag: 'wx' });
    fs.writeFileSync(join(output, 'release-plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
    const sourceRun = selection.maintenance_release?.selection.product.record.run_id ?? selection.ci_run;
    const message = `Verified **${selection.tag}** at \`${selection.commit}\`. Main CI ${selection.main_ci_run}; tag CI ${selection.tag_ci_run ?? selection.ci_run}; original acceptance ${sourceRun}. The original matrix covered ${matrix.installations} installation targets, ${matrix.runtime_installations} Node cases and ${matrix.hosts} fixed hosts.${selection.maintenance_release ? ' Current maintenance, build and installation checks passed.' : ''} Registry version: ${existing ? 'already published with identical bytes' : 'not yet published'}. Dry-run: ${selection.dry_run}.\n\nA dry-run does not authenticate to npm or validate its trusted-publisher binding.\n`;
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, message);
    console.log(message);
    const history = selection.maintenance_release?.original_history ?? selection.promotion?.original_history;
    if (history) {
        const detail = `Original v${history.source_schema} run ${history.run_id} executed ${history.history_jobs.full} full and ${history.history_jobs.short} short history jobs.\n`;
        if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, detail);
        console.log(detail);
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { selection: { type: 'string' }, evidence: { type: 'string' }, output: { type: 'string' } } });
    assert(values.selection);
    if (positionals.join(' ') === 'resolve') await resolveRelease(resolve(values.selection));
    else {
        assert.equal(positionals.join(' '), 'prepare'); assert(values.evidence && values.output);
        await prepareBundle(resolve(values.selection), resolve(values.evidence), resolve(values.output));
    }
}
