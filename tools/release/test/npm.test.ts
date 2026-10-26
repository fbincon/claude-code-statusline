import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCiRun, legacyArtifactIds } from '../npm.js';
import { REPOSITORY, validatePlan, requirePublishContext, verifyRegistryVersion, tagCorrections, type PublishPlan } from '../npm-registry.js';

const plan: PublishPlan = { schema_version: 1, tag: 'v3.0.1', version: '3.0.1', commit: 'a'.repeat(40), channel: 'stable',
    dist_tag: 'latest', filename: 'fbincon-claude-code-statusline-3.0.1.tgz', sha256: 'b'.repeat(64), integrity: 'sha512-' + 'A'.repeat(86) + '==', ci_run: 10 };
test('publication requires an exact source tag and rejects branch provenance or another repository', () => {
    const env = { GITHUB_REPOSITORY: REPOSITORY, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/tags/v3.0.1', GITHUB_SHA: plan.commit };
    requirePublishContext(plan, env);
    for (const changed of [{ GITHUB_REPOSITORY: 'other/repo' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_SHA: 'c'.repeat(40) }])
        assert.throws(() => requirePublishContext(plan, { ...env, ...changed }));
    validatePlan(plan);
    for (const changed of [{ filename: '../package.tgz' }, { tag: 'v3.0.0' }, { dist_tag: 'beta' }, { sha256: 'bad' }, { ci_run: -1 }])
        assert.throws(() => validatePlan({ ...plan, ...changed } as PublishPlan));
});
test('latest exact main/tag push CI must succeed; PR, foreign and older green runs cannot substitute', () => {
    const run = { id: 10, head_sha: plan.commit, head_branch: plan.tag, event: 'push', path: '.github/workflows/ci.yml',
        repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY }, status: 'completed', conclusion: 'success' };
    assert.equal(selectCiRun([run], plan.commit, plan.tag), 10);
    for (const changed of [{ event: 'pull_request' }, { head_sha: 'c'.repeat(40) }, { head_branch: 'main' }, { path: '.github/workflows/other.yml' },
        { head_repository: { full_name: 'other/repo' } }, { conclusion: 'failure' }, { status: 'in_progress' }])
        assert.throws(() => selectCiRun([{ ...run, ...changed }], plan.commit, plan.tag));
    assert.throws(() => selectCiRun([run, { ...run, id: 11, conclusion: 'failure' }], plan.commit, plan.tag));
});
test('legacy release reads select exact newest artifact IDs and never hide corrupt retries', () => {
    const make = (name: string, id: number) => ({ name, id, expired: false, expires_at: new Date(Date.now() + 86400000).toISOString(), digest: 'sha256:' + 'a'.repeat(64) });
    const artifacts = [make('ts06-candidate', 1), make('ts06-acceptance', 2), make('ts06-mods-windows-2025-2.1.288', 3), make('ts06-mods-windows-2025-2.1.288', 4)];
    assert.deepEqual(legacyArtifactIds(artifacts), [2, 1, 4]);
    artifacts[3]!.expired = true; assert.throws(() => legacyArtifactIds(artifacts));
    assert.throws(() => legacyArtifactIds([make('ts06-candidate', 1)]));
});
test('an existing npm version is accepted only with the expected identity, integrity and registry URL', () => {
    const version = { name: '@fbincon/claude-code-statusline', version: plan.version, dist: { integrity: plan.integrity, tarball: 'https://registry.npmjs.org/package.tgz' } };
    assert.equal(verifyRegistryVersion({ versions: {} }, plan), false);
    assert.equal(verifyRegistryVersion({ versions: { [plan.version]: version } }, plan), true);
    for (const changed of [{ name: 'other' }, { version: '3.0.0' }, { dist: { ...version.dist, integrity: 'sha512-wrong' } }, { dist: { ...version.dist, tarball: 'https://other.example/package.tgz' } }])
        assert.throws(() => verifyRegistryVersion({ versions: { [plan.version]: { ...version, ...changed } } }, plan));
});
test('publishing preserves other selectors, repairs publish-induced changes and rejects concurrent changes', () => {
    const before = { latest: '3.0.0', beta: '3.0.0-beta.1' };
    assert.deepEqual(tagCorrections(before, { ...before, latest: plan.version }, plan), []);
    assert.deepEqual(tagCorrections(before, { latest: plan.version, beta: plan.version }, plan), [['beta', before.beta]]);
    const preview: PublishPlan = { ...plan, channel: 'preview', dist_tag: 'beta', version: '3.1.0-beta.1' };
    assert.deepEqual(tagCorrections(before, { latest: preview.version, beta: preview.version }, preview), [['latest', before.latest]]);
    assert.deepEqual(tagCorrections(before, before, preview), [['beta', preview.version]]);
    assert.throws(() => tagCorrections(before, { latest: plan.version, beta: '3.1.0-beta.2' }, plan), /Concurrent/);
    assert.throws(() => tagCorrections({}, { beta: preview.version }, preview), /existing stable/);
});
