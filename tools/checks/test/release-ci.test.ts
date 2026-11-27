import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { VERSION } from '@fbincon/statusline-core/release';
import { digest } from '../ci-evidence.js';
import { CI_REPOSITORY } from '../ci-watch.js';
import { mainCandidate, mergeSource, publishedReleaseTag, pullSource, recordCandidate, recordMain, recordTag, selectReleaseTag, verifyMainPackage } from '../release-ci-evidence.js';
import { buildChecks, candidateBuild, candidateCases, candidateGate, integrationCases, integrationGate, integrationPreflight,
    packageSmokeChecks, RELEASE_POLICY_PATH, releaseFilenames, releasePackageArtifact, releaseWorkflow, tagGate } from '../release-ci-policy.js';
import { prepareBundle, resolveRelease } from '../../release/npm.js';
import { envelope } from './fixtures/evidence-envelope.js';
import { AGENT_ROWS_MANIFEST, officialModsForHost } from '../runtime-inputs.js';

test('ordinary events have no runner, and the release stages depend on their verified producers', () => {
    const ci = parse(fs.readFileSync(releaseWorkflow, 'utf8'));
    const diagnostics = parse(fs.readFileSync('.github/workflows/ci-diagnostics.yml', 'utf8'));
    assert.deepEqual(Object.keys(diagnostics.on), ['workflow_dispatch']);
    assert.deepEqual(diagnostics.jobs['agent-rows'].strategy.matrix, {
        os: ['ubuntu-24.04', 'windows-2025', 'macos-15'], host: ['2.1.326', '2.1.332'],
    });
    assert.equal(ci.jobs['candidate-check'].env.HOST_VERSION, '${{ matrix.host }}');
    assert(!JSON.stringify(diagnostics.jobs).includes('ci-evidence.js record'));
    assert.deepEqual(ci.on.push, { tags: ['v3.*'] });
    assert.deepEqual(ci.on.pull_request.branches, ['main']);
    assert(ci.on.pull_request.types.includes('closed'));
    const roots = Object.entries<any>(ci.jobs).filter(([, job]) => !job.needs).map(([key]) => key);
    assert.deepEqual(roots, ['build', 'main-select', 'tag']);
    for (const key of ['build', 'main-select']) {
        assert(ci.jobs[key].if.includes("startsWith(github.event.pull_request.head.ref, 'release/')"));
        assert(ci.jobs[key].if.includes('github.event.pull_request.head.repo.full_name == github.repository'));
    }
    assert(ci.jobs.build.if.includes('!github.event.pull_request.draft'));
    assert(ci.jobs['main-select'].if.includes("github.event.action == 'closed'"));
    assert(ci.jobs['main-select'].if.includes('github.event.pull_request.merged'));
    for (const [key, needs] of [['candidate-check', 'build'], ['main-smoke', 'main-select']]) {
        assert.equal(ci.jobs[key!].needs, needs);
        assert.equal(ci.jobs[key!].strategy.matrix, '${{ fromJSON(needs.' + needs + '.outputs.matrix) }}');
    }
    assert.deepEqual(ci.jobs['candidate-evidence'].needs, ['build', 'candidate-check']);
    assert.deepEqual(ci.jobs['main-evidence'].needs, ['main-select', 'main-smoke']);
    assert(ci.jobs['candidate-evidence'].steps.at(-1).with.name.includes('ci-release-diagnostic'));
    assert(ci.jobs.tag.if.includes("github.event_name == 'push'"));
    const preflight = ci.jobs['main-select'].steps;
    assert(preflight.findIndex((step: any) => step.id === 'select') < preflight.findIndex((step: any) => step.with?.['artifact-ids']));
    assert(preflight.findIndex((step: any) => step.run?.includes('main-preflight')) > preflight.findIndex((step: any) => step.with?.['artifact-ids']));
    assert.equal(ci.permissions['id-token'], undefined);
});

for (const agentRows of [false, true]) test('release evidence binds PR, merge and tag to the original ' + (agentRows ? 'AgentRow' : 'two-Mod') + ' host matrix', async t => {
    const original = process.cwd(), root = fs.mkdtempSync(join(tmpdir(), 'statusline-release-ci-'));
    const env = ['GH_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_SHA', 'GITHUB_EVENT_NAME',
        'GITHUB_REF_NAME', 'GITHUB_REF', 'GITHUB_OUTPUT', 'RELEASE_TAG', 'DRY_RUN'];
    const previous = Object.fromEntries(env.map(key => [key, process.env[key]]));
    t.after(() => {
        process.chdir(original);
        for (const key of env) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
        fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    });
    delete process.env.GITHUB_OUTPUT;
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const write = (path: string, bytes: string | Buffer) => {
        const target = join(root, path);
        fs.mkdirSync(dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
    };
    const copy = (folder: string) => {
        for (const file of fs.readdirSync(join(original, folder)).filter(name => name.endsWith('.ts'))) {
            write(folder + '/' + file, fs.readFileSync(join(original, folder, file)));
        }
    };
    git('init', '--initial-branch=main');
    copy('tools/checks');
    copy('tools/generation/i18n');
    for (const file of [releaseWorkflow, '.node-version', 'tools/release/approval.ts', RELEASE_POLICY_PATH]) write(file, fs.readFileSync(join(original, file)));
    if (agentRows) write(AGENT_ROWS_MANIFEST, '{"name":"statusline-agent-rows"}\n');
    git('add', '.'); git('commit', '-m', 'Install verifier on protected main');
    const base = git('rev-parse', 'HEAD'), branch = 'release/fixture';
    git('switch', '-c', branch);
    write('packages/core/src/release.ts', `export const VERSION = '${VERSION}';\n`);
    // Frozen code has to come from the actual first parent.
    write('tools/checks/release-ci-evidence.ts', 'throw new Error("candidate verifier must not be used by main");\n');
    git('add', '.'); git('commit', '-m', 'Prepare release');
    const head = git('rev-parse', 'HEAD');
    git('switch', 'main'); git('merge', '--no-ff', branch, '-m', 'Merge approved release');
    const commit = git('rev-parse', 'HEAD'), tag = 'v' + VERSION;
    git('update-ref', 'refs/remotes/origin/main', commit);
    git('tag', '-a', tag, head, '-m', 'Local fixture');
    process.chdir(root);
    process.env.GH_TOKEN = 'release-fixture-token';
    process.env.GITHUB_REPOSITORY = CI_REPOSITORY;

    const repository = { full_name: CI_REPOSITORY };
    const pr = { number: 23, state: 'closed', merged_at: new Date().toISOString(), draft: false, merge_commit_sha: commit,
        base: { sha: base, ref: 'main', repo: repository }, head: { sha: head, ref: branch, repo: repository } };
    const run = (id: number, sha: string, ref: string, event: string, title: string) => ({ id, head_sha: sha, head_branch: ref, event,
        display_title: title, path: releaseWorkflow, repository, head_repository: repository, run_attempt: 1, status: 'completed', conclusion: 'success' });
    const prRun = run(11, head, branch, 'pull_request', `Release PR #23 ${head}`);
    // The closed event may be listed under its original PR head rather than the checked-out merge.
    const mainRun = run(12, head, branch, 'pull_request', `Release main #23 ${commit}`);
    const tagRun = run(13, head, tag, 'push', `Release tag ${tag} ${head}`);
    const diagnostic = run(20, head, branch, 'workflow_dispatch', `Release diagnostic ${head}`);
    const runs = [prRun, mainRun, tagRun, diagnostic];
    const artifacts = new Map<number, any[]>(), jobs = new Map<string, any[]>(), archives = new Map<number, Buffer>();
    const started_at = '2026-11-19T00:00:00.000Z', completed_at = '2026-11-19T00:03:00.000Z', created_at = '2026-11-19T00:01:00.000Z';
    let id = 100;
    const toolHash = 'a'.repeat(64);
    function job(execution: typeof prRun, name: string, os = 'ubuntu-24.04', attempt = execution.run_attempt) {
        const key = execution.id + '/' + attempt;
        const job = { id: id++, name, run_id: execution.id, run_attempt: attempt, head_sha: execution.head_sha,
            started_at, completed_at, created_at: started_at, conclusion: 'success', status: 'completed', labels: [os] };
        jobs.set(key, [...jobs.get(key) ?? [], job]);
        return job;
    }
    function artifact(execution: typeof prRun, name: string, data: unknown) {
        const zip = envelope('receipt.json', data), identity = { id: id++, name, digest: 'sha256:' + digest(zip), created_at,
            expired: false, expires_at: new Date(Date.now() + 86400000).toISOString() };
        archives.set(identity.id, zip);
        artifacts.set(execution.id, [...artifacts.get(execution.id) ?? [], identity]);
        return identity;
    }
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === 'release-fixture.invalid') {
            assert.equal(options?.headers, undefined);
            return new Response(new Uint8Array(archives.get(Number(url.pathname.slice(1)))!));
        }
        assert.equal(url.hostname, 'api.github.com');
        assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer release-fixture-token');
        const path = url.pathname.replace('/repos/' + CI_REPOSITORY, '');
        if (path === '/pulls/23') return Response.json(pr);
        if (path === '/commits/' + head + '/pulls') return Response.json([pr]);
        if (path === '/contents/' + releaseWorkflow) return Response.json({ type: 'file', sha: git('rev-parse', url.searchParams.get('ref') + ':' + releaseWorkflow) });
        if (path === '/actions/workflows/ci.yml/runs') {
            return Response.json({ workflow_runs: runs.filter(row => row.head_sha === url.searchParams.get('head_sha') && row.event === url.searchParams.get('event')) });
        }
        const archive = /^\/actions\/artifacts\/(\d+)\/zip$/u.exec(path);
        if (archive) return new Response(null, { status: 302, headers: { Location: 'https://release-fixture.invalid/' + archive[1] } });
        const list = /^\/actions\/runs\/(\d+)\/artifacts$/u.exec(path);
        if (list) {
            const items = artifacts.get(Number(list[1])) ?? [];
            return Response.json({ artifacts: items, total_count: items.length });
        }
        const attempt = /^\/actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs$/u.exec(path);
        if (attempt) {
            const items = jobs.get(attempt[1] + '/' + attempt[2]) ?? [];
            return Response.json({ jobs: items, total_count: items.length });
        }
        const record = /^\/actions\/runs\/(\d+)$/u.exec(path);
        if (record) return Response.json(runs.find(row => row.id === Number(record[1])));
        throw new Error('Unexpected GitHub call ' + path);
    });
    const files = releaseFilenames(VERSION), delivery = Object.fromEntries(Object.values(files).map(file => {
        write('package/' + file, file);
        return [file, digest(file)];
    }));
    function use(execution: typeof prRun, workflow_sha: string) {
        process.env.GITHUB_RUN_ID = String(execution.id);
        process.env.GITHUB_RUN_ATTEMPT = String(execution.run_attempt);
        process.env.GITHUB_WORKFLOW_SHA = workflow_sha;
    }
    for (const execution of [prRun, diagnostic]) {
        const packageArtifact = artifact(execution, releasePackageArtifact, { original: true });
        const stamp = { run_id: execution.id, attempt: 1, job: 'build' };
        const packageHash = delivery[files.package];
        job(execution, candidateBuild.job, candidateBuild.os);
        artifact(execution, candidateBuild.artifact, { schema_version: 1, kind: 'release-build', status: 'pass',
            commit: head, version: VERSION, execution: stamp, workflow_sha: head, checks: buildChecks, delivery,
            package_id: packageArtifact.id, package_digest: packageArtifact.digest });
        const cases = candidateCases(head);
        assert.deepEqual(cases.filter(row => row.kind === 'package').map(row => [row.os, row.arch, row.host_arch, row.node]), [
            ['ubuntu-24.04', 'x64', 'x64', '22.0.0'], ['windows-2025', 'x64', 'x64', '22.0.0'], ['macos-15', 'arm64', 'arm64', '22.0.0'],
            ['windows-11-arm', 'x64', 'arm64', '22.0.0'], ['macos-15-intel', 'x64', 'x64', '22.0.0'], ['ubuntu-24.04', 'x64', 'x64', '24.0.0'],
        ]);
        for (const spec of cases) {
            job(execution, spec.job, spec.os);
            const mods = spec.host ? officialModsForHost(spec.host, agentRows) : [];
            artifact(execution, spec.artifact, { schema_version: 1, status: 'pass', workflow_sha: head,
                node: 'v' + spec.node, node_sha256: toolHash, platform: spec.platform, arch: spec.arch, host_arch: spec.host_arch,
                tarball_sha256: packageHash, model_calls: 0, execution: { ...stamp, job: 'candidate-check' },
                ...(spec.kind === 'package' ? { kind: 'integration-smoke', target: spec.id, source_commit: head, integration_commit: head,
                    lifecycle_scripts: false, checks: packageSmokeChecks } : {
                    kind: 'release-host-smoke', commit: head, host: spec.host, host_sha256: toolHash,
                    mods: Object.fromEntries(mods.map(name => [name,
                        { validation: 'pass', official_tests: 'pass', types: { status: 'pass', host: spec.host } }])),
                    installed: { status: 'pass', tarball_sha256: packageHash, source: { commit: head, source_manifest_sha256: toolHash }, result: { installed_mods: mods } },
                    ...(agentRows && execution === prRun ? { envelope: {
                        schema_version: 1, kind: 'acceptance-envelope', status: 'pass', producer: { kind: 'official Mods' },
                        source: { commit: head, files_sha256: toolHash }, artifact: { sha256: packageHash },
                        runtime: { host: spec.host, node: 'v' + spec.node, node_sha256: toolHash, platform: spec.platform, arch: spec.arch },
                        checks: [...mods, 'installed integration'].map(name => ({ name, status: 'pass' })), limitations: ['Automated fixture.'],
                    } } : {}),
                }) });
        }
    }
    use(diagnostic, head); process.env.GITHUB_REF_NAME = branch;
    const diagnosticRecord = await recordCandidate(undefined, head);
    assert.equal(diagnosticRecord.kind, 'release-diagnostic');
    await assert.rejects(recordCandidate(pullSource(pr), head), /Wrong release workflow/);
    use(prRun, head);
    const candidate = await recordCandidate(pullSource(pr), head);
    assert.equal(candidate.kind, 'release-candidate');
    assert.equal(candidate.jobs.length, agentRows ? 16 : 10);
    job(prRun, candidateGate);
    artifact(prRun, 'ci-release-accepted', candidate);
    const merge = await mergeSource(pr), chosen = await mainCandidate(merge);
    assert.deepEqual(chosen.candidate, candidate);
    use(mainRun, commit);
    job(mainRun, integrationPreflight.job);
    write('package/' + files.source, 'changed');
    await assert.rejects(verifyMainPackage(chosen, join(root, 'package')), /Original delivery bytes changed/);
    write('package/' + files.source, files.source);
    artifact(mainRun, integrationPreflight.artifact, await verifyMainPackage(chosen, join(root, 'package')));
    for (const spec of integrationCases(commit)) {
        job(mainRun, spec.job, spec.os);
        artifact(mainRun, spec.artifact, { schema_version: 1, status: 'pass', kind: 'integration-smoke', workflow_sha: commit,
            node: 'v' + spec.node, node_sha256: toolHash, platform: spec.platform, arch: spec.arch, host_arch: spec.host_arch,
            tarball_sha256: delivery[files.package], model_calls: 0, target: spec.id, source_commit: head, integration_commit: commit,
            lifecycle_scripts: false, checks: packageSmokeChecks, execution: { run_id: mainRun.id, attempt: 1, job: 'main-smoke' } });
    }
    mainRun.run_attempt = 2;
    use(mainRun, commit);
    await assert.rejects(async () => {
        const retry = job(mainRun, integrationCases(commit)[0]!.job);
        retry.started_at = '2026-11-19T00:04:00.000Z';
        retry.completed_at = '2026-11-19T00:05:00.000Z';
        retry.conclusion = 'failure';
        await recordMain(chosen);
    }, /Latest physical execution did not pass/);
    jobs.delete(mainRun.id + '/2');
    const integrated = await recordMain(chosen);
    assert(integrated.jobs.every(row => row.attempt === 1));
    job(mainRun, integrationGate);
    artifact(mainRun, 'ci-release-integrated', integrated);
    use(tagRun, head);
    const selected = await selectReleaseTag(tag, head);
    job(tagRun, tagGate);
    artifact(tagRun, 'ci-release-tag', await recordTag(selected));
    const verified = await publishedReleaseTag(tag, head);
    assert.equal(verified.candidate.package.id, chosen.candidate.package.id);
    assert.equal(verified.integration_ref.attempt, 2);
    assert.equal(verified.tag_ref.run_id, tagRun.id);
    process.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
    process.env.GITHUB_REF = 'refs/tags/' + tag;
    process.env.RELEASE_TAG = tag;
    process.env.DRY_RUN = 'true';
    const npmSelection = join(root, 'npm-selection.json');
    await resolveRelease(npmSelection);
    const npmInput = JSON.parse(fs.readFileSync(npmSelection, 'utf8'));
    assert.deepEqual(npmInput.artifact_ids, [chosen.candidate.package.id]);
    assert.equal(npmInput.ci_run, prRun.id);
    write('package/' + files.package, 'changed');
    await assert.rejects(prepareBundle(npmSelection, join(root, 'package'), join(root, 'npm-bundle')), /Original delivery bytes changed/);
    const noRoute = join(root, 'legacy-selection.json');
    fs.writeFileSync(noRoute, JSON.stringify({ ...npmInput, release_ci: undefined }));
    await assert.rejects(prepareBundle(noRoute, join(root, 'package'), join(root, 'npm-bundle')), /must match the source/);
    const bad = { ...prRun, id: 99, conclusion: 'failure' };
    runs.push(bad);
    await assert.rejects(publishedReleaseTag(tag, head), /Missing artifact|did not pass/);
    runs.pop();
    const originalEnvelope = artifacts.get(mainRun.id)!.at(-1)!;
    originalEnvelope.expired = true;
    await assert.rejects(publishedReleaseTag(tag, head), /expired/);
    originalEnvelope.expired = false;
    pr.base.sha = head;
    await assert.rejects(publishedReleaseTag(tag, head), /base changed/);
});
