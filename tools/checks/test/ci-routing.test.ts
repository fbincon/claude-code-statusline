import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { crc32 } from 'node:zlib';
import { selectMain, recordIntegration, SMOKE_TARGETS } from '../ci-integration.js';
import { selectTag, publishedTagEvidence, predictMain } from '../ci-promotion.js';
import { digest, policyDigest } from '../ci-evidence.js';
import { documentationOnly, assessCiNeeds } from '../ci-scope.js';
import { CI_REPOSITORY } from '../ci-watch.js';
import { BASE_VERIFICATION_CHECKS } from '../ci-trust.js';
import { fixture, run, hash } from './fixtures/ci-evidence.js';

function envelope(file: string, value: unknown): Buffer {
    const name = Buffer.from(file), body = Buffer.from(JSON.stringify(value));
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt32LE(crc32(body), 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + body.length, 16);
    return Buffer.concat([local, name, body, central, name, end]);
}

const changes = [
    'docs/releases/approvals/registry.json', 'packages/core/src/render.ts', 'packages/cli/resources/generated.json',
    'tools/acceptance/new-journey.ts', 'tools/acceptance/screenshots.ts', 'tools/checks/ci-watch.ts',
    'tools/release/notes.ts', 'tools/acceptance/package-lock.json', 'tools/build/pack.ts',
    '.github/workflows/ci.yml', 'tools/release/approval.ts', 'tools/checks/ci-evidence.ts', 'tools/checks/ci-sources.ts',
];
for (const changedPath of changes) test(changedPath + ': full PR evidence reuses the identical bytes through main, tag and npm', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ci routing ')), originalCwd = process.cwd();
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=CI fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const write = (path: string, text: string) => { fs.mkdirSync(join(root, path, '..'), { recursive: true }); fs.writeFileSync(join(root, path), text); };
    const env = ['GH_TOKEN', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'CI_EVENT', 'CI_REF_TYPE', 'CI_REF_NAME'] as const;
    const previous = Object.fromEntries(env.map(key => [key, process.env[key]]));
    t.after(() => {
        process.chdir(originalCwd);
        for (const key of env) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
        fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    });
    git('init', '--initial-branch=main');
    write('.github/workflows/ci.yml', 'name: CI\n'); write('tools/checks/ci-evidence.ts', '// Policy fixture\n');
    write('tools/release/approval.ts', '// Stable approval validator\n');
    write('docs/releases/approvals/registry.json', '{"schema_version":1,"approvals":[]}\n');
    write('tools/checks/ci-sources.ts', '// Baseline verifier fixture\n');
    git('add', '.'); git('commit', '-m', 'earlier main'); const earlier = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'accepted base'); const base = git('rev-parse', 'HEAD');
    git('switch', '-c', 'release-fixture');
    const version = '9.9.9', path = `docs/releases/approvals/v${version}.json`;
    write('docs/releases/approvals/registry.json', JSON.stringify({ schema_version: 1, approvals: [{ version, path, approved_on: '2026-10-28' }] }));
    write(path, JSON.stringify({ version })); write('packages/core/src/release.ts', `export const VERSION = '${version}';\n`);
    if (changedPath !== 'docs/releases/approvals/registry.json') write(changedPath, '// Accepted change\n');
    git('add', '.'); git('commit', '-m', 'release data'); const head = git('rev-parse', 'HEAD');
    assert.equal(policyDigest(base, git) === policyDigest(head, git), !changedPath.startsWith('tools/') && !changedPath.startsWith('.github/'));
    assert.notEqual(git('rev-parse', base + '^{tree}'), git('rev-parse', head + '^{tree}'));
    assert.equal(documentationOnly('pull_request', 'branch', [path, 'docs/releases/approvals/registry.json']), false);
    git('switch', 'main'); git('merge', '--no-ff', 'release-fixture', '-m', 'integrate'); const commit = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', commit); git('tag', '-a', 'v' + version, head, '-m', 'isolated local fixture');
    process.chdir(root); process.env.GH_TOKEN = 'isolated-test-token'; process.env.GITHUB_RUN_ID = '44'; process.env.GITHUB_RUN_ATTEMPT = '2';
    const { record: source, artifacts: originalArtifacts } = fixture();
    source.source_commit = head; source.tree = git('rev-parse', head + '^{tree}'); source.workflow_sha = head;
    source.policy_sha256 = policyDigest(head); source.event = 'pull_request'; source.branch = 'release-fixture';
    source.pr = { number: 23, head, base, base_ref: 'main', draft: false }; source.version = version;
    source.delivery = Object.fromEntries(Object.entries(source.delivery).map(([name, value]) => [name.replaceAll('3.9.1', version), value]));
    const prRun = { ...run, head_sha: head, head_branch: source.branch, event: 'pull_request' };
    const baseRun = { ...run, id: 1, head_sha: base }, mainRun = { ...run, id: 44, head_sha: commit };
    const tagRun = { ...run, id: 45, head_sha: head, head_branch: 'v' + version };
    const pr = { number: 23, state: 'closed', merged_at: new Date().toISOString(), draft: false, merge_commit_sha: commit,
        base: { sha: base, ref: 'main', repo: { full_name: CI_REPOSITORY } }, head: { sha: head, ref: source.branch, repo: { full_name: CI_REPOSITORY } } };
    const archives = new Map<number, Buffer>();
    const artifact = (id: number, name: string, file: string, body: unknown) => {
        const zip = envelope(file, body); archives.set(id, zip);
        return { id, name, expired: false, digest: 'sha256:' + digest(zip), expires_at: originalArtifacts[0]!.expires_at };
    };
    let available = [...originalArtifacts], mainArtifacts: any[] = [], tagArtifacts: any[] = [], extraRuns: any[] = [];
    let missingEnvelope = false;
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === 'ci-fixture.invalid') {
            assert.equal(options?.headers, undefined, 'API token must not reach artifact storage');
            const zip = archives.get(Number(url.pathname.slice(1))); assert(zip);
            return new Response(new Uint8Array(zip));
        }
        assert.equal(url.hostname, 'api.github.com');
        assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer isolated-test-token');
        const prefix = '/repos/' + CI_REPOSITORY, pathname = url.pathname.slice(prefix.length);
        assert(url.pathname.startsWith(prefix));
        let result: unknown;
        if (pathname === '/actions/workflows/ci.yml/runs') {
            const sha = url.searchParams.get('head_sha'), event = url.searchParams.get('event');
            result = { workflow_runs: sha === head ? (event === 'pull_request' ? [prRun, ...extraRuns] : [tagRun]) : sha === commit ? [mainRun] : sha === base ? [baseRun] : [] };
        } else if (/^\/commits\/[a-f0-9]{40}\/pulls$/u.test(pathname)) result = [pr];
        else if (pathname === '/pulls/23') result = pr;
        else if (pathname === '/contents/.github/workflows/ci.yml') result = { type: 'file', sha: git('rev-parse', head + ':.github/workflows/ci.yml') };
        else if (pathname === '/actions/runs/12/artifacts') {
            const artifacts = [...available, ...(missingEnvelope ? [] : [artifact(900, 'ts06-acceptance', 'ci-evidence.json', source)])];
            result = { artifacts, total_count: artifacts.length };
        } else if (pathname === '/actions/runs/44/artifacts') result = { artifacts: mainArtifacts, total_count: mainArtifacts.length };
        else if (pathname === '/actions/runs/45/artifacts') result = { artifacts: tagArtifacts, total_count: tagArtifacts.length };
        else if (/^\/actions\/runs\/\d+\/jobs$/u.test(pathname)) result = { total_count: 1, jobs: [{ name: 'Complete candidate evidence', conclusion: 'success' }] };
        else if (pathname === '/actions/runs/12/attempts/1/jobs') {
            const jobs = [...new Map(source.executions.map(row => [row.job_id, { id: row.job_id, name: row.job_name, started_at: row.started_at, completed_at: row.completed_at, conclusion: 'success' }])).values()];
            result = { jobs, total_count: jobs.length };
        }
        else if (pathname === '/actions/runs/44/attempts/2/jobs') result = { total_count: 3, jobs: SMOKE_TARGETS.map((target, index) => ({ id: 1000 + index, name: 'Integration smoke / ' + target, conclusion: 'success' })) };
        else if (/^\/actions\/artifacts\/\d+\/zip$/u.test(pathname)) return new Response(null, { status: 302, headers: { location: 'https://ci-fixture.invalid/' + pathname.split('/')[3] } });
        else throw new Error('Unexpected API call: ' + url.href);
        return Response.json(result);
    });
    const selection = await selectMain(commit, base);
    assert.equal(selection.route, 'main'); assert.equal('shadow' in selection, false); assert.equal(selection.source_commit, head);
    assert.equal(selection.source_run, prRun.id); assert.deepEqual(selection.source_record?.delivery, source.delivery);
    const smokes = SMOKE_TARGETS.map((target, index) => ({ schema_version: 1, kind: 'integration-smoke', status: 'pass', target,
        integration_commit: commit, source_commit: head, tarball_sha256: hash, node: source.toolchain.node, node_sha256: hash,
        platform: ['linux', 'win32', 'darwin'][index], arch: index === 2 ? 'arm64' : 'x64',
        checks: ['offline-empty-cache-install', 'version', 'install', 'doctor', 'render', 'configuration-read-write', 'uninstall-preserves-unowned-settings'],
        model_calls: 0, lifecycle_scripts: false, execution: { run_id: 44, attempt: 2, job: 'integration' } }));
    mainArtifacts = smokes.map(row => artifact(1000 + SMOKE_TARGETS.indexOf(row.target), 'ci-integration-' + row.target, 'smoke.json', row));
    for (const smoke of smokes) write(`smokes/ci-integration-${smoke.target}/smoke.json`, JSON.stringify(smoke));
    write('smoke-selection.json', JSON.stringify({ run_id: 44, artifacts: mainArtifacts.map(({ expired: _, ...item }) => item) }));
    const verification = { schema_version: 1, kind: 'base-verifier', status: 'pass', verifier_commit: base, verifier_tree: git('rev-parse', base + '^{tree}'),
        base_run: 1, integration_commit: commit, source_commit: head, source_run: prRun.id, source_envelope: selection.source_envelope,
        source_record_sha256: digest(JSON.stringify(source)), run_id: 44, attempt: 2, checks: BASE_VERIFICATION_CHECKS };
    await recordIntegration(selection, join(root, 'smokes'), join(root, 'smoke-selection.json'), join(root, 'promotion.json'), verification);
    const integration = JSON.parse(fs.readFileSync(join(root, 'promotion.json'), 'utf8'));
    mainArtifacts.push(artifact(2000, 'ci-promotion', 'promotion.json', integration));
    process.env.CI_EVENT = 'push'; process.env.CI_REF_TYPE = 'branch'; process.env.CI_REF_NAME = 'main';
    const needs = { scope: { result: 'success', outputs: { route: 'main' } },
        integration: { result: 'success' }, promotion: { result: 'success' }, ...Object.fromEntries(['development', 'candidate', 'installed', 'runtime', 'mods'].map(name => [name, { result: 'skipped' }])) };
    assessCiNeeds(needs);
    assert.throws(() => assessCiNeeds({ ...needs, integration: { result: 'skipped' } }));
    assert.throws(() => assessCiNeeds({ ...needs, development: { result: 'success' } }));
    const tag = await selectTag('v' + version, head);
    assert.equal(tag.route, 'tag'); assert.equal(tag.source_run, prRun.id); assert.equal(tag.integration_run, mainRun.id);
    assert.deepEqual(tag.source_record?.delivery, source.delivery);
    const promoted = { schema_version: 1, kind: 'tag-promotion', status: 'pass', repository: CI_REPOSITORY, commit: head, source_commit: head,
        run_id: tagRun.id, attempt: tagRun.run_attempt, tag: 'v' + version, tag_object: tag.tag_object, source_run: tag.source_run,
        source_envelope: tag.source_envelope, source_record_sha256: digest(JSON.stringify(source)), delivery: source.delivery,
        integration: tag.integration, integration_run: tag.integration_run, integration_envelope: tag.integration_envelope, integration_record_sha256: tag.integration_record_sha256 };
    tagArtifacts = [artifact(3000, 'ci-promotion', 'promotion.json', promoted)];
    const published = await publishedTagEvidence('v' + version, head, tagRun);
    assert.equal(published?.sourceRun, prRun.id); assert.equal(published?.integrationRun, mainRun.id);
    assert.equal(predictMain(head, base).route, 'main');
    if (changedPath === changes[0]) {
        assert.equal((await selectMain(commit, earlier)).route, 'main', 'Batched push uses the accepted real first parent');
        for (const patch of [{ conclusion: 'failure' }, { conclusion: 'cancelled' }, { status: 'in_progress' }]) {
            extraRuns = [{ ...prRun, id: 99, ...patch }];
            await assert.rejects(selectMain(commit, base)); await assert.rejects(selectTag('v' + version, head));
        }
        extraRuns = [{ ...prRun, id: 99, event: 'workflow_dispatch', conclusion: 'failure' }];
        assert.equal((await selectMain(commit, base)).route, 'main', 'Manual runs are not applicable PR evidence'); extraRuns = [];
        missingEnvelope = true; await assert.rejects(selectMain(commit, base), /Missing artifact/u); missingEnvelope = false;
        source.pr!.base = earlier;
        assert.match((await selectMain(commit, base)).reason, /different base/u); source.pr!.base = base;
        const tree = git('rev-parse', head + '^{tree}');
        for (const label of ['squash', 'rebase']) {
            const rewritten = git('commit-tree', tree, '-p', base, '-m', label);
            assert.equal((await selectMain(rewritten, base)).route, 'full', 'Same tree cannot replace source ancestry/tag identity');
        }
        const unrelated = git('commit-tree', tree, '-m', 'unrelated same tree');
        await assert.rejects(selectMain(commit, unrelated));
        const wrongParent = git('commit-tree', tree, '-p', base, '-p', unrelated, '-m', 'wrong head');
        pr.merge_commit_sha = wrongParent;
        assert.match((await selectMain(wrongParent, base)).reason, /Merged head differs/u);
        const changedTree = git('commit-tree', base + '^{tree}', '-p', base, '-p', head, '-m', 'different integrated content');
        pr.merge_commit_sha = changedTree;
        assert.match((await selectMain(changedTree, base)).reason, /Integrated tree differs/u);
        pr.merge_commit_sha = commit;
        pr.base.sha = earlier;
        assert.match((await selectMain(commit, base)).reason, /base changed/u); pr.base.sha = base;
        const validExpiry = source.expires_at;
        source.expires_at = new Date(Date.now() - 1).toISOString();
        await assert.rejects(selectMain(commit, base)); await assert.rejects(selectTag('v' + version, head)); source.expires_at = validExpiry;
        available = available.slice(1); await assert.rejects(selectMain(commit, base)); available = [...originalArtifacts];
        const acceptedHash = source.policy_sha256; source.policy_sha256 = 'f'.repeat(64);
        await assert.rejects(selectMain(commit, base), /Acceptance policy differs/u); source.policy_sha256 = acceptedHash;
        source.delivery[selection.filename!] = 'f'.repeat(64);
        await assert.rejects(selectTag('v' + version, head)); source.delivery[selection.filename!] = hash;
        mainArtifacts = mainArtifacts.filter(value => value.name !== 'ci-promotion');
        await assert.rejects(selectTag('v' + version, head), /Missing artifact/u);
        // Each genuine build/acceptance/trust change still alters policy; no release directory exclusion.
        for (const path of ['tools/build/pack.ts', 'tools/acceptance/installed.ts', 'tools/checks/ci-sources.ts', 'tools/release/new-validator.ts', '.github/workflows/ci.yml']) {
            const beforePolicy = policyDigest(git('rev-parse', 'HEAD'), git);
            write(path, '// Changed acceptance rule\n'); git('add', path); git('commit', '-m', 'policy fixture');
            assert.notEqual(policyDigest(git('rev-parse', 'HEAD'), git), beforePolicy);
        }
    }
});
