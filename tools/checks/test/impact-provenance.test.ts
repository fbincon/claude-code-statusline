import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { crc32 } from 'node:zlib';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { createImpactPlan } from '../impact-plan.js';
import { canonical, hash, productInputs } from '../impact-content.js';
import { policyDigest } from '../ci-evidence.js';
import { selectMaintenanceRelease, publishedMaintenanceRelease } from '../impact-release.js';
import { fixture, run as fixtureRun } from './fixtures/ci-evidence.js';
import { CI_REPOSITORY } from '../ci-watch.js';
import { SMOKE_TARGETS } from '../ci-integration.js';

function zip(file: string, value: unknown): Buffer {
    const name = Buffer.from(file), body = Buffer.from(JSON.stringify(value)), local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt32LE(crc32(body), 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + body.length, 16);
    return Buffer.concat([local, name, body, central, name, end]);
}
test('complete baseline -> two maintenance commits -> tag -> npm retains identities and rejects failed, expired or tampered chains', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'impact-chain-')), previous = process.cwd(), previousToken = process.env.GH_TOKEN;
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const write = (path: string, bytes: string) => { fs.mkdirSync(join(root, path, '..'), { recursive: true }); fs.writeFileSync(join(root, path), bytes); };
    const commit = () => { git('add', '.'); git('commit', '-m', 'fixture'); return git('rev-parse', 'HEAD'); };
    t.after(() => { process.chdir(previous); if (previousToken === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = previousToken; removeTree(root); assert(!fs.existsSync(root)); });
    git('init', '--initial-branch=main'); write('.github/workflows/ci.yml', 'name: CI\n'); write('tools/checks/impact-plan.ts', '// Accepted schema\n'); write('tools/checks/ci-evidence.ts', '// Accepted full schema\n');
    write('.node-version', '24.21.0\n'); write('packages/core/src/value.ts', 'export const value = 1;');
    write('package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: Object.fromEntries(['core', 'platform', 'cli', 'tui'].map(name => ['packages/' + name, { version: '0.0.0' }])) }));
    const base = commit(); write('docs/first.md', '# First maintenance'); const first = commit(); write('docs/second.md', '# Second maintenance'); const second = commit();
    const tag = 'v3.13.1'; git('tag', '-a', tag, '-m', 'isolated fixture'); git('update-ref', 'refs/remotes/origin/main', second); process.chdir(root); process.env.GH_TOKEN = 'fixture-only-token';
    const complete = fixture(); complete.record.source_commit = base; complete.record.tree = git('rev-parse', base + '^{tree}'); complete.record.workflow_sha = base; complete.record.policy_sha256 = policyDigest(base);
    const runs = new Map<number, any>([[12, { ...fixtureRun, head_sha: base }], [21, { ...fixtureRun, id: 21, run_attempt: 1, head_sha: first }], [22, { ...fixtureRun, id: 22, run_attempt: 1, head_sha: second }], [33, { ...fixtureRun, id: 33, run_attempt: 1, head_sha: second, head_branch: tag }]]);
    const bodies = new Map<number, Buffer>(), artifacts = new Map<number, any[]>(); let next = 1000;
    const artifact = (name: string, file: string, value: unknown) => {
        const id = next++, bytes = zip(file, value); bodies.set(id, bytes);
        return { id, name, digest: 'sha256:' + hash(bytes), expired: false, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() };
    };
    artifacts.set(12, [...complete.artifacts, artifact('ts06-acceptance', 'ci-evidence.json', complete.record)]);
    const records: any[] = [];
    for (const [runId, from, to] of [[21, base, first], [22, first, second]] as const) {
        const plan = createImpactPlan(from, to), started = new Date(Date.now() - 1000).toISOString(), finished = new Date().toISOString();
        const receipt = { schema_version: 1, kind: 'scoped-checks', status: 'pass', commit: to, plan_sha256: hash(canonical(plan)), task: plan.tasks[0], checks: plan.tasks[0]!.checks,
            node: 'v24.21.0', platform: 'linux', started_at: started, completed_at: finished, execution: { run_id: String(runId), attempt: '1', job: 'scoped' } };
        const taskArtifact = artifact('ci-scoped-linux', 'receipt.json', receipt);
        const identity = { id: taskArtifact.id, name: taskArtifact.name, digest: taskArtifact.digest, expires_at: taskArtifact.expires_at };
        const record = { schema_version: 1, kind: 'maintenance', repository: CI_REPOSITORY, commit: to, tree: git('rev-parse', to + '^{tree}'), run_id: runId, attempt: 1, event: 'push', branch: 'main',
            created_at: finished, expires_at: new Date(Date.now() + 86400000).toISOString(), plan, plan_sha256: hash(canonical(plan)), product_base: from, product_inputs_sha256: productInputs(to), pr: null,
            receipts: [{ artifact: identity, sha256: hash(canonical(receipt)), receipt }] };
        records.push(record); artifacts.set(runId, [taskArtifact, artifact('ci-maintenance', 'maintenance.json', record)]);
    }
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === 'impact-fixture.invalid') { assert.equal(options?.headers, undefined); return new Response(new Uint8Array(bodies.get(Number(url.pathname.slice(1)))!)); }
        assert.equal(url.hostname, 'api.github.com'); assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer fixture-only-token');
        const path = url.pathname.slice(('/repos/' + CI_REPOSITORY).length); let result: any;
        if (path === '/actions/workflows/ci.yml/runs') result = { workflow_runs: [...runs.values()].filter(run => run.head_sha === url.searchParams.get('head_sha') && run.event === url.searchParams.get('event')) };
        else if (/^\/actions\/runs\/\d+\/artifacts$/u.test(path)) { const rows = artifacts.get(Number(path.split('/')[3])) ?? []; result = { artifacts: rows, total_count: rows.length }; }
        else if (/^\/actions\/runs\/\d+\/attempts\/\d+\/jobs$/u.test(path)) {
            const id = Number(path.split('/')[3]), record = records.find(row => row.run_id === id);
            const jobs = [{ id: 9999, name: 'Complete candidate evidence', conclusion: 'success' }, ...(id === 12 ? complete.record.executions.map(row => ({ id: row.job_id, name: row.job_name, conclusion: 'success', started_at: row.started_at, completed_at: row.completed_at })).filter((row, index, rows) => rows.findIndex(other => row.id === other.id) === index) : record ? [{ id: id * 10, name: 'Scoped / linux', conclusion: 'success', started_at: record.receipts[0].receipt.started_at, completed_at: record.receipts[0].receipt.completed_at }] : [])];
            result = { jobs, total_count: jobs.length };
        } else if (/^\/actions\/runs\/\d+$/u.test(path)) result = runs.get(Number(path.split('/')[3]));
        else if (path === '/contents/.github/workflows/ci.yml') result = { type: 'file', sha: git('rev-parse', url.searchParams.get('ref') + ':.github/workflows/ci.yml') };
        else if (/^\/actions\/artifacts\/\d+\/zip$/u.test(path)) return new Response(null, { status: 302, headers: { location: 'https://impact-fixture.invalid/' + path.split('/')[3] } });
        else throw new Error('Unexpected fixture API: ' + url);
        return new Response(JSON.stringify(result));
    });
    const selection = await selectMaintenanceRelease(tag, second); assert(selection); assert.equal(selection.product.record.source_commit, base); assert.deepEqual(selection.maintenance.map(row => row.commit), [second, first]);
    const delivery = Object.fromEntries(['SHA256SUMS', 'build-manifest.json', 'fbincon-claude-code-statusline-3.13.1.tgz', 'claude-code-statusline-3.13.1-source.tar.gz'].map(name => [name, 'b'.repeat(64)]));
    const packageArtifact = artifact('ci-release-package', 'unused.json', {}), smokes = SMOKE_TARGETS.map(target => {
        const receipt = { status: 'pass', kind: 'integration-smoke', source_commit: second, integration_commit: second, target, tarball_sha256: 'b'.repeat(64), execution: { run_id: 33, attempt: 1 }, model_calls: 0, lifecycle_scripts: false,
            checks: ['offline-empty-cache-install', 'version', 'install', 'doctor', 'render', 'configuration-read-write', 'uninstall-preserves-unowned-settings'] };
        return { artifact: artifact('ci-release-smoke-' + target, 'smoke.json', receipt), receipt };
    });
    const identity = (value: any) => ({ id: value.id, name: value.name, digest: value.digest, expires_at: value.expires_at });
    const binding = { schema_version: 1, kind: 'maintenance-release', status: 'pass', repository: CI_REPOSITORY, selection, run_id: 33, attempt: 1, delivery, package_artifact: identity(packageArtifact),
        comparison: { schema_version: 1, kind: 'package-comparison', base, head: second, base_sha256: 'b'.repeat(64), head_sha256: 'b'.repeat(64), equivalent: true, changed_members: [] },
        smokes: smokes.map(row => ({ ...row, artifact: identity(row.artifact) })), approval: {}, created_at: new Date().toISOString(),
        executed: ['maintenance-chain', 'tag-identity', 'reproducible-source-build', 'independent-product-comparison', 'three-platform-installation-smoke', 'release-approval'], reused: complete.record.coverage };
    artifacts.set(33, [packageArtifact, ...smokes.map(row => row.artifact), artifact('ci-release-binding', 'release-binding.json', binding)]);
    assert.deepEqual(await publishedMaintenanceRelease(tag, second, runs.get(33)), binding);
    runs.get(22).conclusion = 'failure'; await assert.rejects(selectMaintenanceRelease(tag, second), /did not pass/u); runs.get(22).conclusion = 'success';
    artifacts.get(21)![1].expired = true; await assert.rejects(selectMaintenanceRelease(tag, second)); artifacts.get(21)![1].expired = false;
    const changed = bodies.get(artifacts.get(21)![0].id)!; bodies.set(artifacts.get(21)![0].id, Buffer.from('tampered')); await assert.rejects(selectMaintenanceRelease(tag, second)); bodies.set(artifacts.get(21)![0].id, changed);
    artifacts.set(33, [artifact('ci-release-selection', 'unused.json', {})]); await assert.rejects(publishedMaintenanceRelease(tag, second, runs.get(33)), /Missing selected/u);
});
