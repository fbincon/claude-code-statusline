import { LEGACY_370_SHA256 } from '@fbincon/statusline-core/management/compatibility';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assessEvidence, INSTALL_TARGETS, HOST_TARGETS } from '../prepare.js';
import { assessStableApproval, stableApprovalPath, ACCEPTED_GAPS } from '../approval.js';
import { NODE_RUNTIME_CASES } from '@fbincon/statusline-core/node-runtime';
import { VERSION, isPrerelease } from '@fbincon/statusline-core/release';
import { repoRoot } from '../../migration/ts-03/common.js';
const commit = 'a'.repeat(40), hash = 'b'.repeat(64);
const transitions = (official = false) => ({ cases: 7, historical_version: '3.7.0', historical_sha256: LEGACY_370_SHA256, target_version: VERSION, roundtrip: true, independent_runner: true, crash_recovery: true, configuration_restore: true, real_npm: true, host_mode: official ? 'official' : 'version-only', model_calls: 0, operation_timings: Array.from({ length: official ? 20 : 19 }, (_, index) => ({ command: 'operation-' + index, elapsed_ms: 1 })) });
function receipts(): any[] {
    const base = { status: 'pass', commit, tarball_sha256: hash };
    const installations = INSTALL_TARGETS.map(target => ({ ...base, target, offline_install: true, initially_empty_npm_cache: true, lifecycle_scripts: false, outside_checkout: true, path_excludes_python_and_compilers: true, powershell_setup: target.startsWith('windows-') ? { status: 'pass', candidate_invoked: false, receipt: { status: 0, timeout_ms: 60000, error: null } } : null, setup_cases: 3, extension_cases: 4, indicator_cases: 3, group_cases: 4, automatic_refresh_cases: 4, cost_rate_cases: 4, git_policy_cases: 4, first_entry_cases: 4, version_management: transitions(), terminal_color_cases: target.startsWith('windows-') ? 15 : 3, checks: { ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, true])), setup: true, extensions: true, indicators: true, groups: true, automatic_refresh: true, cost_rates: true, git_policy: true, terminal_colors: true, first_entry: true, version_management: true } }));
    for (const row of installations as any[]) if (row.target.startsWith('windows-'))
        row.terminal_shell_evidence = ['setup','configure','slash'].flatMap(entry => ['powershell','cmd','git-bash'].map(shell => ({entry,shell,colors:256,input_tty:true,restored:true,cancelled:true})));
    return [...installations,
        ...installations.flatMap(receipt => NODE_RUNTIME_CASES.map(runtime_case => ({ ...receipt, kind: 'node-runtime', runtime_case, runtime_tests: true, node: 'v' + runtime_case.replace('x', '25.0'), node_sha256: hash }))),
        ...HOST_TARGETS.map(target => { const [platform, host] = target.split('-'); return { ...base, target, platform, host, model_calls: 0, mods: Object.fromEntries(['statusline-native', 'statusline-runtime'].map(name => [name, { validation: 'pass', official_tests: 'pass', types: host === '2.1.296' ? { status: 'unavailable', reason: 'no declarations' } : { status: 'pass', host } }])), package_management: { ...transitions(true), host }, installed: { ...base, source: { commit } } }; })];
}
test('tests.integration.test_publish_package.AcceptanceTests.test_completed_matrix_is_required', () => {
    assert.equal(assessEvidence(receipts(), commit, hash).hosts, 13);
    assert.equal(assessEvidence(receipts(), commit, hash).runtime_installations, 32);
    assert.equal(assessEvidence(receipts(), commit, hash).type_declarations_unavailable.length, 6);
    assert.throws(() => assessEvidence(receipts().slice(1), commit, hash), /Incomplete/);
});
test('the current stable application has a registered and version-scoped maintainer decision', { skip: isPrerelease(VERSION) }, () => {
    const record = JSON.parse(readFileSync(join(repoRoot, stableApprovalPath(VERSION)), 'utf8'));
    assert.equal(assessStableApproval(record, VERSION).version, VERSION);
    assert.throws(() => assessStableApproval({ ...record, version: '0.0.0' }, VERSION));
    assert.throws(() => assessStableApproval({ ...record, accepted_gaps: [...ACCEPTED_GAPS, 'failed-ci'] }, VERSION));
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
test('stable approval is explicit, scoped to v3.0.0 and retains the exact unverified gaps', () => {
    const approval = { schema_version: 1, version: '3.0.0', decision: 'accept-known-gaps', approved_by: 'fbincon', approved_on: '2026-10-18', authority: 'Maintainer confirmation', reference: 'https://github.com/fbincon/claude-code-statusline/issues/96', accepted_gaps: ACCEPTED_GAPS };
    assert.equal(assessStableApproval(approval, '3.0.0').decision, 'accept-known-gaps');
    assert.equal(assessStableApproval({ ...approval, version: '3.1.0' }, '3.1.0').decision, 'accept-known-gaps');
    assert.equal(assessStableApproval({ ...approval, version: '3.1.1' }, '3.1.1').decision, 'accept-known-gaps');
    const patch = { ...approval, version: '3.1.2', approved_on: '2026-10-19' };
    assert.equal(assessStableApproval(patch, '3.1.2').decision, 'accept-known-gaps');
    const performance = { ...patch, version: '3.1.4' };
    assert.equal(assessStableApproval(performance, '3.1.4').decision, 'accept-known-gaps');
    assert.throws(() => assessStableApproval({ ...performance, approved_on: '2026-10-18' }, '3.1.4'));
    assert.throws(() => assessStableApproval(patch, '3.1.4'));
    assert.throws(() => assessStableApproval({ ...performance, accepted_gaps: [...ACCEPTED_GAPS, 'failed-ci'] }, '3.1.4'));
    const diagnosis = { ...approval, version: '3.3.0', approved_on: '2026-10-20' };
    assert.equal(assessStableApproval(diagnosis, '3.3.0').decision, 'accept-known-gaps');
    assert.throws(() => assessStableApproval({ ...patch, version: '3.2.0' }, '3.3.0'));
    assert.throws(() => assessStableApproval({ ...diagnosis, approved_on: '2026-10-19' }, '3.3.0'));
    assert.throws(() => assessStableApproval({ ...diagnosis, accepted_gaps: [...ACCEPTED_GAPS, 'failed-ci'] }, '3.3.0'));
    assert.throws(() => assessStableApproval({ ...patch, approved_on: '2026-10-18' }, '3.1.2'));
    assert.throws(() => assessStableApproval({ ...approval, approved_on: '2026-10-19' }, '3.0.0'));
    assert.throws(() => assessStableApproval(patch, '3.1.1'));
    assert.throws(() => assessStableApproval(approval, '3.1.2'));
    assert.throws(() => assessStableApproval({ ...patch, accepted_gaps: [...ACCEPTED_GAPS, 'failed-ci'] }, '3.1.2'));
    assert.throws(() => assessStableApproval({ ...patch, accepted_gaps: [] }, '3.1.2'));
    assert.throws(() => assessStableApproval(approval, '3.1.0'));
    assert.throws(() => assessStableApproval({ ...approval, version: '3.1.0' }, '3.1.1'));
    for (const version of ['3.0.0-beta.1', '3.0.1', '3.1.3', '4.0.0']) assert.throws(() => assessStableApproval(approval, version));
    for (const value of [null, {}, { ...approval, version: '3.0.1' }, { ...approval, decision: 'all-passed' }, { ...approval, accepted_gaps: [] }, { ...approval, accepted_gaps: [...ACCEPTED_GAPS, 'failed-ci'] }])
        assert.throws(() => assessStableApproval(value, '3.0.0'));
    const failed = receipts(); failed[0].status = 'fail';
    assert.throws(() => assessEvidence(failed, commit, hash), /Failed/);
});

test('every runtime case must include the correct Node and passing product tests', () => {
    for (const change of [{ node: 'v26.0.0' }, { node: 'v24.0.0' }, { runtime_case: 'latest' }, { runtime_tests: false }, { node_sha256: '' }, { status: 'skipped' }]) {
        const rows = receipts(); Object.assign(rows.find(row => row.kind === 'node-runtime'), change);
        assert.throws(() => assessEvidence(rows, commit, hash));
    }
    assert.throws(() => assessEvidence(receipts().filter(row => row.kind !== 'node-runtime'), commit, hash), /Incomplete/);
});

test('installed and official-host version receipts must retain every recovery and operation result', () => {
    for (const official of [false, true]) {
        for (const patch of [{ independent_runner: false }, { crash_recovery: undefined }, { operation_timings: [] }, { model_calls: 1 }]) {
            const rows = receipts(), row = official ? rows.find(row => row.host) : rows[0];
            Object.assign(official ? row.package_management : row.version_management, patch);
            assert.throws(() => assessEvidence(rows, commit, hash));
        }
        const rows = receipts(), row = official ? rows.find(row => row.host) : rows[0];
        (official ? row.package_management : row.version_management).operation_timings[0].elapsed_ms = -1;
        assert.throws(() => assessEvidence(rows, commit, hash));
    }
});

test('Windows preview acceptance requires distinct actual shells and restored consoles', () => {
    for (const mutate of [(row:any)=>delete row.terminal_shell_evidence, (row:any)=>row.terminal_shell_evidence.pop(), (row:any)=>row.terminal_shell_evidence[0].shell='cmd', (row:any)=>row.terminal_shell_evidence[0].restored=false]) {
        const rows=receipts();mutate(rows.find(row=>row.target.startsWith('windows-')));
        assert.throws(()=>assessEvidence(rows,commit,hash));
    }
});
