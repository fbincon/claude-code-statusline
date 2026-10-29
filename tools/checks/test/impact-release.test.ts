import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { validateReleaseBinding, type ReleaseBinding, type MaintenanceReleaseSelection } from '../impact-release.js';
import { withImpactVerifier } from '../impact-trust.js';
import { fixture, run, hash } from './fixtures/ci-evidence.js';
import { SMOKE_TARGETS } from '../ci-integration.js';
import { parse } from 'yaml';

test('new release identity binds original product acceptance and every current delivery/smoke without relabeling', () => {
    const old = fixture(), commit = 'c'.repeat(40), tag = 'v3.13.1';
    const selection: MaintenanceReleaseSelection = { schema_version: 1, kind: 'maintenance-release-selection', tag, tag_object: 'd'.repeat(40), commit, integration_commit: 'e'.repeat(40),
        maintenance: [{ run_id: 22, commit, envelope: old.record.artifacts[0]!, sha256: hash }],
        product: { record: old.record, envelope: old.record.artifacts[0]!, artifact_ids: old.record.artifacts.map(item => item.id) } };
    const binding: ReleaseBinding = { schema_version: 1, kind: 'maintenance-release', status: 'pass', repository: run.repository.full_name, selection, run_id: 33, attempt: 1,
        delivery: Object.fromEntries(['SHA256SUMS', 'build-manifest.json', 'fbincon-claude-code-statusline-3.13.1.tgz', 'claude-code-statusline-3.13.1-source.tar.gz'].map(name => [name, hash])),
        package_artifact: old.record.artifacts[0]!, comparison: { schema_version: 1, kind: 'package-comparison', base: old.record.source_commit, head: commit, base_sha256: hash, head_sha256: hash, equivalent: true, changed_members: [] },
        smokes: SMOKE_TARGETS.map(target => ({ artifact: old.record.artifacts[0]!, receipt: { status: 'pass', kind: 'integration-smoke', source_commit: commit, integration_commit: commit, target,
            tarball_sha256: hash, execution: { run_id: 33, attempt: 1, job: 'release-smoke' }, model_calls: 0, lifecycle_scripts: false,
            checks: ['offline-empty-cache-install', 'version', 'install', 'doctor', 'render', 'configuration-read-write', 'uninstall-preserves-unowned-settings'] } })),
        executions: ['Build current maintenance release source', ...SMOKE_TARGETS.map(target => 'Maintenance release smoke / ' + target)].map((name, index) => ({ id: 300 + index, name, attempt: 1, started_at: '2026-01-01T00:00:00Z', completed_at: '2026-01-01T00:01:00Z' })),
        approval: {}, created_at: new Date().toISOString(), executed: ['maintenance-chain', 'tag-identity', 'reproducible-source-build', 'independent-product-comparison', 'three-platform-installation-smoke', 'release-approval'], reused: old.record.coverage };
    const current = { ...run, id: 33, run_attempt: 1, head_sha: commit, head_branch: tag };
    validateReleaseBinding(binding, selection, current);
    for (const mutate of [(value: ReleaseBinding) => value.comparison.head = old.record.source_commit,
        (value: ReleaseBinding) => value.comparison.equivalent = false, (value: ReleaseBinding) => value.smokes.pop(),
        (value: ReleaseBinding) => value.smokes[0]!.receipt.source_commit = old.record.source_commit,
        (value: ReleaseBinding) => value.delivery['fbincon-claude-code-statusline-3.13.1.tgz'] = 'f'.repeat(64),
        (value: ReleaseBinding) => value.executions[0]!.attempt = 2,
        (value: ReleaseBinding) => value.executed.pop()]) {
        const altered = structuredClone(binding); mutate(altered); assert.throws(() => validateReleaseBinding(altered, selection, current));
    }
    assert.throws(() => validateReleaseBinding(binding, selection, { ...current, conclusion: 'failure' }));
});
test('maintenance verifier executes immutable base modules even when head validators become no-ops', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'impact-trust-test-')), previous = process.cwd();
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const write = (path: string, bytes: string) => { fs.mkdirSync(join(root, path, '..'), { recursive: true }); fs.writeFileSync(join(root, path), bytes); };
    t.after(() => { process.chdir(previous); removeTree(root); assert(!fs.existsSync(root)); });
    git('init', '--initial-branch=main');
    write('tools/checks/impact-evidence.ts', 'import assert from "node:assert/strict"; export const verifyMaintenanceWithBase = async value => { assert.equal(value.bytes, "accepted"); assert.equal(value.pr, 23); };');
    write('tools/build/impact-package.ts', 'export const marker = "accepted base";'); write('tools/build/files.ts', 'export {};');
    write('package-lock.json', JSON.stringify({ packages: { 'node_modules/typescript': { version: '5.9.3', integrity: 'sha512-ts' }, 'node_modules/tar': { version: '7.5.22', integrity: 'sha512-tar' } } }));
    git('add', '.'); git('commit', '-m', 'trusted verifier'); const base = git('rev-parse', 'HEAD');
    write('tools/checks/impact-evidence.ts', 'export const verifyMaintenanceWithBase = async () => {};'); git('add', '.'); git('commit', '-m', 'no-op head'); process.chdir(root);
    await withImpactVerifier(base, async directory => {
        const old = await import(pathToFileURL(join(directory, 'tools/checks/impact-evidence.ts')).href);
        await old.verifyMaintenanceWithBase({ bytes: 'accepted', pr: 23 });
        await assert.rejects(old.verifyMaintenanceWithBase({ bytes: 'tampered', pr: 23 }));
        await assert.rejects(old.verifyMaintenanceWithBase({ bytes: 'accepted', pr: 24 }));
    }, directory => {
        const lock = JSON.parse(fs.readFileSync(join(directory, 'package-lock.json'), 'utf8'));
        assert.equal(lock.packages['node_modules/typescript'].integrity, 'sha512-ts'); assert.equal(lock.packages['node_modules/tar'].integrity, 'sha512-tar');
    });
});
test('workflow keeps full product obligations and uses separate scoped/release jobs and required aggregation', () => {
    const workflow = parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8')), jobs = workflow.jobs;
    assert.equal(workflow.on.push['paths-ignore'], undefined); assert.equal(workflow.on.pull_request['paths-ignore'], undefined);
    for (const name of ['scoped', 'maintenance', 'release-build', 'release-smoke', 'release-binding']) assert(jobs.acceptance.needs.includes(name));
    assert.equal(jobs.acceptance.if.startsWith('always()'), true);
    assert.equal(jobs.installed.strategy.matrix.include.length, 8); assert.equal(jobs.mods.strategy.matrix.include.length, 16);
    assert(jobs.scoped.if.includes("outputs.route == 'maintenance'"));
    assert(jobs.maintenance.steps.some((step: any) => step.run?.includes('impact-workflow.ts record')));
    assert.equal(jobs['release-smoke'].strategy.matrix.os.length, 3);
    assert(jobs['release-build'].steps.some((step: any) => step.run?.includes('impact-release-build.js')));
    const npm = parse(fs.readFileSync('.github/workflows/npm-publish.yml', 'utf8'));
    assert(npm.jobs.prepare.steps.some((step: any) => step.with?.['artifact-ids'] === '${{ steps.resolve.outputs.artifact_ids }}'));
});
