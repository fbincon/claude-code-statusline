import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEquivalence, validateIntegration, SMOKE_TARGETS } from '../ci-integration.js';
import { digest } from '../ci-evidence.js';
import { commit, hash, run, fixture } from './fixtures/ci-evidence.js';
import type { PromotionSelection } from '../ci-promotion.js';
test('integration requires unchanged head, base and tree and a two-parent merge', () => {
    const base = 'c'.repeat(40), merge = 'd'.repeat(40);
    const good = { commit: merge, parents: [base, commit], before: base, head: commit, base, tree: hash, headTree: hash };
    assert.equal(mergeEquivalence(good), null);
    for (const changed of [{ parents: [base] }, { parents: [base, commit, merge] }, { before: merge }, { base: merge }, { head: merge }, { headTree: 'f'.repeat(40) }])
        assert.notEqual(mergeEquivalence({ ...good, ...changed }), null);
});
function integrated() {
    const source = fixture(), merge = 'd'.repeat(40), base = 'c'.repeat(40), mainRun = { ...run, id: 44, run_attempt: 2, head_sha: merge };
    source.record.event = 'pull_request'; source.record.branch = 'ci/example'; source.record.pr = { number: 23, head: commit, base, base_ref: 'main', draft: false };
    const selection: PromotionSelection = { schema_version: 1, route: 'main', reason: 'fixture', commit: merge,
        integration: { commit: merge, base, head: commit, pr: 23, tree: commit }, source_commit: commit, source_run: run.id,
        source_record: source.record, source_envelope: source.record.artifacts[0], filename: 'fbincon-claude-code-statusline-3.9.1.tgz' };
    const artifacts = SMOKE_TARGETS.map((target, index) => ({ ...source.artifacts[0], id: 1000 + index, name: 'ci-integration-' + target }));
    const record = { schema_version: 1, kind: 'main-promotion', status: 'pass', repository: source.record.repository, run_id: 44, attempt: 2,
        integration: selection.integration, source_commit: commit, source_run: run.id, source_envelope: selection.source_envelope,
        source_record_sha256: digest(JSON.stringify(source.record)), delivery: source.record.delivery, policy_sha256: source.record.policy_sha256,
        artifacts: artifacts.map(({ expired: _, created_at: __, ...row }) => row), smokes: SMOKE_TARGETS.map((target, index) => ({
            schema_version: 1, kind: 'integration-smoke', status: 'pass', target, integration_commit: merge, source_commit: commit,
            tarball_sha256: hash, node: 'v24.21.0', node_sha256: hash,
            platform: ['linux', 'win32', 'darwin'][index], arch: index === 2 ? 'arm64' : 'x64',
            checks: ['offline-empty-cache-install', 'version', 'install', 'doctor', 'render', 'configuration-read-write', 'uninstall-preserves-unowned-settings'],
            model_calls: 0, lifecycle_scripts: false, execution: { run_id: 44, attempt: 1 }, job_id: 50 + index, receipt_sha256: hash,
        })) };
    return { record, mainRun, selection, artifacts };
}
test('main integration binds original PR bytes and all three real smoke jobs across attempts', () => {
    const value = integrated(); assert.doesNotThrow(() => validateIntegration(value.record, value.mainRun, value.selection, value.artifacts));
});
test('integration cannot substitute other runs, sources, policies, artifacts or partial smoke results', () => {
    const mutations = [
        (v: ReturnType<typeof integrated>) => { v.record.run_id++; },
        (v: ReturnType<typeof integrated>) => { v.record.source_run++; },
        (v: ReturnType<typeof integrated>) => { v.record.source_commit = 'f'.repeat(40); },
        (v: ReturnType<typeof integrated>) => { v.record.policy_sha256 = 'f'.repeat(64); },
        (v: ReturnType<typeof integrated>) => { v.record.source_record_sha256 = 'f'.repeat(64); },
        (v: ReturnType<typeof integrated>) => { v.mainRun.conclusion = 'failure'; },
        (v: ReturnType<typeof integrated>) => { v.mainRun.head_sha = commit; },
        (v: ReturnType<typeof integrated>) => { v.artifacts[0]!.expired = true; },
        (v: ReturnType<typeof integrated>) => { v.record.smokes.pop(); },
        (v: ReturnType<typeof integrated>) => { v.record.smokes[1] = v.record.smokes[0]!; },
        (v: ReturnType<typeof integrated>) => { v.record.smokes[0]!.status = 'skipped'; },
        (v: ReturnType<typeof integrated>) => { v.record.smokes[0]!.execution.run_id++; },
        (v: ReturnType<typeof integrated>) => { v.record.smokes[0]!.execution.attempt = 3; },
        (v: ReturnType<typeof integrated>) => { v.record.smokes[0]!.node = 'v24.0.0'; },
        (v: ReturnType<typeof integrated>) => { v.record.smokes[0]!.tarball_sha256 = 'f'.repeat(64); },
        (v: ReturnType<typeof integrated>) => { v.record.smokes[0]!.checks.pop(); },
    ];
    for (const mutate of mutations) { const value = integrated(); mutate(value); assert.throws(() => validateIntegration(value.record, value.mainRun, value.selection, value.artifacts)); }
});
