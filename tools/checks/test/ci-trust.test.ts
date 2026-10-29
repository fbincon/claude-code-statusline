import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { exportBaseVerifiers, verifyWithAcceptedBase } from '../ci-trust.js';
import { digest } from '../ci-evidence.js';
import type { PromotionSelection } from '../ci-promotion.js';

test('cross-check loads immutable base code even if HEAD replaces every verifier with a no-op', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'trusted-base-')), previous = process.cwd();
    t.after(() => { process.chdir(previous); fs.rmSync(root, { recursive: true, force: true }); });
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const write = (path: string, content: string) => { fs.mkdirSync(join(root, path, '..'), { recursive: true }); fs.writeFileSync(join(root, path), content); };
    // This deliberately small old contract is distinguishable from HEAD. Actual
    // CI executes the protected parent's production validators, not this fixture.
    const modules: Record<string, string> = {
        'ci-sources.ts': `import fs from 'node:fs';
export const runsFor = async () => [];
export const latestRun = (_runs, _commit, _branch, event) => ({id: event === 'pull_request' ? 12 : 1});
export const completeSource = async () => JSON.parse(fs.readFileSync('source.json', 'utf8'));
`,
        'ci-evidence.ts': `import fs from 'node:fs'; import assert from 'node:assert/strict'; import { createHash } from 'node:crypto';
import { verifyBytes } from '../generation/i18n/analysis.ts';
export const digest = value => createHash('sha256').update(value).digest('hex');
export const verifyRecordedFiles = (_record, directory) => verifyBytes(fs.readFileSync(directory + '/original.tgz', 'utf8'));
`,
        'ci-integration.ts': `import assert from 'node:assert/strict';
export const verifyMerge = async relation => assert.equal(relation.pr, 23, 'OLD verifier rejects wrong PR');
`,
    };
    for (const [name, content] of Object.entries(modules)) write('tools/checks/' + name, content);
    write('tools/generation/i18n/analysis.ts', "import assert from 'node:assert/strict'; export const verifyBytes = value => assert.equal(value, 'accepted bytes', 'OLD verifier rejects changed bytes');\n");
    git('init', '--initial-branch=main'); git('add', '.'); git('commit', '-m', 'trusted contract'); const base = git('rev-parse', 'HEAD');
    git('switch', '-c', 'change');
    for (const name of Object.keys(modules)) write('tools/checks/' + name, 'export const verifyRecordedFiles = () => {};\n');
    write('tools/generation/i18n/analysis.ts', 'export const verifyBytes = () => {};\n');
    git('add', '.'); git('commit', '-m', 'untrusted no-op checker'); const head = git('rev-parse', 'HEAD');
    git('switch', 'main'); git('merge', '--no-ff', 'change', '-m', 'merge'); const commit = git('rev-parse', 'HEAD');
    const record = { branch: 'change', pr: { head, base, number: 23 }, tree: git('rev-parse', head + '^{tree}') };
    const envelope = { id: 99, name: 'ts06-acceptance', digest: 'sha256:' + 'a'.repeat(64), expires_at: '2099-01-01' };
    write('source.json', JSON.stringify({ record, envelope, artifact_ids: [99] })); write('evidence/original.tgz', 'accepted bytes');
    const selection = { schema_version: 1, route: 'main', reason: 'test', commit, source_commit: head, source_run: 12, base_run: 1,
        integration: { commit, base, head, pr: 23, tree: record.tree }, source_record: record, source_envelope: envelope, artifact_ids: [99] } as PromotionSelection;
    process.chdir(root);
    const exported = join(root, 'exported'); exportBaseVerifiers(base, exported);
    assert.equal(fs.readFileSync(join(exported, 'tools/checks/ci-evidence.ts'), 'utf8'), modules['ci-evidence.ts']);
    assert(fs.readFileSync(join(exported, 'tools/generation/i18n/analysis.ts'), 'utf8').includes('OLD verifier rejects changed bytes'));
    const report = await verifyWithAcceptedBase(selection, join(root, 'evidence'));
    assert.equal(report.verifier_commit, base); assert.equal(report.source_record_sha256, digest(JSON.stringify(record)));
    write('evidence/original.tgz', 'tampered bytes');
    await assert.rejects(verifyWithAcceptedBase(selection, join(root, 'evidence')), /OLD verifier rejects changed bytes/u);
    write('evidence/original.tgz', 'accepted bytes'); selection.integration!.pr = 24;
    await assert.rejects(verifyWithAcceptedBase(selection, join(root, 'evidence')), /OLD verifier rejects wrong PR/u);
    selection.integration!.pr = 23; selection.source_commit = base;
    await assert.rejects(verifyWithAcceptedBase(selection, join(root, 'evidence')));
});

test('workflow wires independent verification and targeted contracts into promotion, never full-matrix shadow', () => {
    const workflow = parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
    assert(workflow.on.workflow_dispatch.inputs.validation.options.includes('promotion-shadow'));
    assert.equal(workflow.on.workflow_dispatch.inputs.validation.default, 'full');
    const jobs = workflow.jobs, promotion = jobs.promotion.steps;
    const trust = promotion.findIndex((step: any) => step.run?.startsWith('node tools/checks/ci-trust.ts '));
    const restore = promotion.findIndex((step: any) => step.run?.startsWith('node tools/build/test-bundle.ts restore '));
    const contracts = promotion.findIndex((step: any) => step.run?.includes('ci-{evidence,integration,routing,scope,trust}.test.js'));
    const verify = promotion.findIndex((step: any) => step.run?.includes('ci-promotion.js verify '));
    assert(trust >= 0 && trust < restore && restore < contracts && contracts < verify);
    assert(promotion[verify].run.includes('--trusted-verification '));
    assert.deepEqual(jobs.integration.strategy.matrix.os, ['ubuntu-24.04', 'windows-2025', 'macos-15']);
    assert.equal(jobs.installed.strategy.matrix.include.length, 8);
    assert.equal(jobs.mods.strategy.matrix.include.length, 16);
    for (const name of ['development', 'candidate']) assert(jobs[name].if.includes("needs.scope.outputs.route == 'full'"));
    assert(!JSON.stringify(jobs).includes('outputs.shadow'));
    assert(jobs.acceptance.needs.includes('promotion') && jobs.acceptance.needs.includes('integration'));
    assert(jobs.acceptance.name.includes('Manual validation (not PR evidence)'));
    const record = jobs.acceptance.steps.find((step: any) => step.run?.includes('ci-evidence.js record'));
    assert(record.if.includes("github.event_name != 'workflow_dispatch'"));
    assert(jobs.scope.steps.find((step: any) => step.id === 'promotion').env.CI_BASE.includes('pull_request.base.sha'));
});
