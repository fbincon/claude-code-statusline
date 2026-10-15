import test from 'node:test';
import assert from 'node:assert/strict';
import { assessEvidence, INSTALL_TARGETS, HOST_TARGETS } from '../prepare.js';
const commit = 'a'.repeat(40), hash = 'b'.repeat(64);
function receipts(): any[] {
    const base = { status: 'pass', commit, tarball_sha256: hash };
    return [...INSTALL_TARGETS.map(target => ({ ...base, target, offline_install: true, initially_empty_npm_cache: true, lifecycle_scripts: false, outside_checkout: true, path_excludes_python_and_compilers: true, powershell_setup: target.startsWith('windows-') ? { status: 'pass', candidate_invoked: false, receipt: { status: 0, timeout_ms: 60000, error: null } } : null, checks: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, true])) })),
        ...HOST_TARGETS.map(target => { const [platform, host] = target.split('-'); return { ...base, target, platform, host, model_calls: 0, mods: Object.fromEntries(['statusline-native', 'statusline-runtime'].map(name => [name, { validation: 'pass', official_tests: 'pass', types: host === '2.1.296' ? { status: 'unavailable', reason: 'no declarations' } : { status: 'pass', host } }])), installed: { ...base, source: { commit } } }; })];
}
test('tests.integration.test_publish_package.AcceptanceTests.test_completed_matrix_is_required', () => {
    assert.equal(assessEvidence(receipts(), commit, hash).hosts, 13);
    assert.equal(assessEvidence(receipts(), commit, hash).type_declarations_unavailable.length, 6);
    assert.throws(() => assessEvidence(receipts().slice(1), commit, hash), /Incomplete/);
});
test('tests.integration.test_publish_package.AcceptanceTests.test_other_commits_refs_events_and_skipped_jobs_do_not_pass', () => {
    for (const field of ['commit', 'tarball_sha256', 'status', 'target']) { const rows = receipts(); rows[0][field] = field === 'status' ? 'skipped' : 'different'; assert.throws(() => assessEvidence(rows, commit, hash)); }
    const rows = receipts(); rows.push(rows[0]); assert.throws(() => assessEvidence(rows, commit, hash), /Duplicate/);
    const wrongTypes = receipts(); wrongTypes.find(row => row.host === '2.1.296').mods['statusline-native'].types.status = 'pass'; assert.throws(() => assessEvidence(wrongTypes, commit, hash));
    for (const setup of [null, { status: 'fail' }, { status: 'pass', candidate_invoked: true }]) {
        const rows = receipts(); rows.find(row => row.target === 'windows-11-arm-x64').powershell_setup = setup;
        assert.throws(() => assessEvidence(rows, commit, hash));
    }
});
