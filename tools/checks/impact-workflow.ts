/** Actions adapter. Stage one installs this protocol without enabling scoped scheduling. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createImpactPlan, assertPlan, type ImpactPlan } from './impact-plan.ts';
import { hash, canonical, git, productInputs } from './impact-content.ts';
import { selectMaintenanceMain, collectScopedReceipts, verifyScopedJobs, maintenanceSource, type MaintenanceRecord } from './impact-evidence.ts';
import { independentMaintenance } from './impact-trust.ts';
import { githubRead, CI_REPOSITORY } from './ci-watch.ts';
import { latestRun, runsFor, requireGate } from './ci-sources.ts';
import { listRunArtifacts, newestArtifact, artifactIdentity } from './ci-evidence.ts';
import { resolveComparison } from './impact-comparison.ts';
import { languageEvidence, languageInputsAt } from './i18n-evidence.ts';

export interface ImpactSelection { schema_version: 1; plan: ImpactPlan; reused?: MaintenanceRecord['reused']; package?: { file: string; comparison_sha256: string }; source_package_artifact?: number; source_run?: number }
export async function selectImpact(directory: string): Promise<ImpactSelection> {
    fs.mkdirSync(directory, { recursive: true });
    const head = git('rev-parse', 'HEAD'), event = process.env.CI_EVENT;
    assert(['pull_request', 'push'].includes(event ?? ''));
    const base = event === 'pull_request' ? git('merge-base', process.env.CI_BASE!, head) : git('rev-parse', head + '^1');
    let plan = createImpactPlan(base, head);
    assert.notEqual(plan.route, 'blocked', 'Unclassified changes: ' + plan.unknown.join(', '));
    const selected: ImpactSelection = { schema_version: 1, plan };
    if (plan.route !== 'product' && event === 'push' && process.env.CI_REF_NAME === 'main') {
        selected.reused = await selectMaintenanceMain(plan, process.env.CI_BASE!);
        if (selected.reused) {
            const sourceRun = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${selected.reused.source.run_id}`);
            const source = await maintenanceSource(sourceRun); selected.plan = source.record.plan; selected.source_run = sourceRun.id;
            if (selected.plan.checks.includes('packaging')) {
                const artifact = artifactIdentity(newestArtifact(await listRunArtifacts(sourceRun.id), 'ci-impact-package'));
                selected.source_package_artifact = artifact.id;
            }
        }
    }
    if (!selected.reused && event === 'push' && process.env.CI_BASE !== base) {
        git('merge-base', '--is-ancestor', process.env.CI_BASE!, head);
        plan = createImpactPlan(process.env.CI_BASE!, head); selected.plan = plan;
        assert.notEqual(plan.route, 'blocked', 'Unclassified integration changes: ' + plan.unknown.join(', '));
    }
    if (!selected.reused && plan.route !== 'product' && plan.checks.includes('packaging')) {
        selected.package = await resolveComparison(plan, join(directory, 'package'));
    }
    fs.writeFileSync(join(directory, 'selection.json'), JSON.stringify(selected, null, 2) + '\n');
    fs.writeFileSync(join(directory, 'plan.json'), JSON.stringify(selected.plan, null, 2) + '\n');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, [
        `route=${selected.plan.route === 'product' ? 'full' : 'maintenance'}`, `matrix=${JSON.stringify({ include: selected.plan.tasks })}`,
        `reused=${Boolean(selected.reused)}`, `packaging=${Boolean(selected.package)}`, `source_run=${selected.source_run ?? ''}`, `source_package_artifact=${selected.source_package_artifact ?? ''}`,
    ].join('\n') + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Impact checks\n\n```json\n' + JSON.stringify(selected, null, 2) + '\n```\n');
    return selected;
}
export async function recordMaintenance(selection: ImpactSelection, output: string, packageDirectory?: string): Promise<MaintenanceRecord> {
    const plan = selection.plan; assertPlan(plan); assert.equal(plan.route, 'maintenance');
    const event = process.env.CI_EVENT!, commit = git('rev-parse', 'HEAD'); assert(['push', 'pull_request'].includes(event));
    assert.equal(process.env.GITHUB_REPOSITORY, CI_REPOSITORY);
    let reused = selection.reused;
    if (reused) {
        assert.equal(reused.integration.commit, commit);
        if (plan.checks.includes('packaging')) { assert(packageDirectory); assert.equal(hash(fs.readFileSync(join(packageDirectory, 'comparison.json'))), plan.comparison_sha256); }
        reused = { ...reused, verifier_sha256: await independentMaintenance(reused, packageDirectory) };
    } else {
        assert.equal(commit, plan.head);
        if (event === 'push') {
            const baseRun = latestRun(await runsFor(plan.base), plan.base, 'main'); assert(baseRun, 'Missing actual integration base gate'); await requireGate(baseRun);
        }
    }
    const runId = Number(process.env.GITHUB_RUN_ID), created = new Date();
    const language = languageEvidence(languageInputsAt(plan.head), plan.head);
    const record: MaintenanceRecord = { ...(language ? { language } : {}), schema_version: 1, kind: 'maintenance', repository: CI_REPOSITORY, commit, tree: git('rev-parse', commit + '^{tree}'),
        run_id: runId, attempt: Number(process.env.GITHUB_RUN_ATTEMPT), event, branch: process.env.CI_BRANCH!, created_at: created.toISOString(), expires_at: new Date(created.getTime() + 30 * 86400000).toISOString(),
        plan, plan_sha256: hash(canonical(plan)), product_base: plan.base, product_inputs_sha256: productInputs(commit),
        pr: event === 'pull_request' ? { number: Number(process.env.CI_PR), head: plan.head, base: plan.base, draft: process.env.CI_DRAFT === 'true' } : null,
        receipts: reused ? [] : await collectScopedReceipts(plan, runId), ...(reused ? { reused } : {}) };
    assert(!record.pr?.draft, 'Draft cannot issue maintenance acceptance'); await verifyScopedJobs(record);
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' }); return record;
}
export function assessImpactNeeds(needs: Record<string, { result: string; outputs?: Record<string, string> }>): void {
    assert.equal(needs.scope?.result, 'success'); assert.notEqual(needs.scope.outputs?.draft, 'true');
    assert.equal(needs.scope.outputs?.route, 'maintenance'); assert.equal(needs.maintenance?.result, 'success');
    assert.equal(needs.scoped?.result, needs.scope.outputs?.impact_reused === 'true' ? 'skipped' : 'success');
    for (const name of ['development', 'candidate', 'installed', 'runtime', 'mods', 'integration', 'promotion']) assert.equal(needs[name]?.result, 'skipped', 'Unexpected product execution: ' + name);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { directory: { type: 'string' }, selection: { type: 'string' }, output: { type: 'string' }, package: { type: 'string' } } });
    if (positionals[0] === 'select') { assert(values.directory); await selectImpact(resolve(values.directory)); }
    else if (positionals[0] === 'record') { assert(values.selection && values.output); await recordMaintenance(JSON.parse(fs.readFileSync(values.selection, 'utf8')), resolve(values.output), values.package); }
    else { assert.equal(positionals[0], 'gate'); assessImpactNeeds(JSON.parse(process.env.CI_NEEDS ?? '{}')); }
}
