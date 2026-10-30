import { NATIVE_CAPACITY_CASES, NATIVE_CAPACITY_TOTAL_CASES, NATIVE_CAPACITY_ADDITIONAL_CASES } from '../../acceptance/native-capacity.js';
import { HISTORICAL_RELEASES } from '../../acceptance/historical-releases.js';
import { compareVersions, PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { join } from 'node:path';
import { assessEvidence as assessBoundEvidence, evidenceFiles, INSTALL_TARGETS, HOST_TARGETS } from '../prepare.js';
import { assessStableApproval as assessRegisteredApproval, stableApprovalPath as registeredApprovalPath, assessApprovalRegistry, sourceStableApproval, APPROVAL_REGISTRY_PATH, ACCEPTED_GAPS } from '../approval.js';
import { NODE_RUNTIME_CASES } from '@fbincon/statusline-core/node-runtime';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { VERSION, isPrerelease } from '@fbincon/statusline-core/release';
import { repoRoot } from '../../migration/ts-03/common.js';
import { sha256 } from '../../build/files.js';
const registry = assessApprovalRegistry(JSON.parse(readFileSync(join(repoRoot, APPROVAL_REGISTRY_PATH), 'utf8')));
const assessStableApproval = (value: unknown, version: string) => assessRegisteredApproval(value, version, registry);
const stableApprovalPath = (version: string) => registeredApprovalPath(version, registry);
const commit = 'a'.repeat(40), hash = 'b'.repeat(64);
const schema = PACKAGE_COMPATIBILITY.read.display[1];

// Synthetic but source-bound official executions for release-gate tests.
const officialLog = 'tests/fixture.test.ts:\n(pass) fixture [1ms]\n\n1 pass\n0 fail\nRan 1 test across 1 file. [1ms]\n';
const sourceEntries = new Map(['statusline-native', 'statusline-runtime'].map(name => [
    'mods/' + name + '/tests/fixture.test.ts', Buffer.from('// ' + name + ' test source\n'),
] as const));
const assessEvidence = (reports: any[], commit: string, artifact: string) => assessBoundEvidence(reports, commit, artifact, sourceEntries);
function officialReceipt(name: string) {
    const file = 'tests/fixture.test.ts', source_files = { [file]: sha256(sourceEntries.get('mods/' + name + '/' + file)!) };
    const source_sha256 = sha256(JSON.stringify(source_files)), host_sha256 = sha256('{}');
    const summary = { tests: 1, files: 1, pass: 1, fail: 0, skip: 0 };
    return { schema_version: 1, kind: 'official-mod-test-batches', status: 'pass', timeout_ms: 180000,
        source_files, host_files: {}, source_sha256, host_sha256, test_files: [file], totals: summary,
        batches: [{ ...summary, index: 0, test_files: [file], test_hashes: source_files,
            copied_source_sha256: source_sha256, host_sha256, timeout_ms: 180000, elapsed_ms: 1,
            log: 'fixture.log', log_sha256: sha256(officialLog) }] };
}

const transitions = (official = false, previous = false): any => ({ acceptance_phases: ['baseline', ...(previous ? ['editor_execution'] : [])].map(phase => ({ phase, budget_ms: official ? 1_200_000 : 900_000, elapsed_ms: 1, status: 'pass' })), editor_execution:previous?{verified_execution:true,retained_control:true,downgrade_roundtrip:true,old_protocol_rejected:true,detach_continues:true,progress_complete:true,package_recovery:true,separate_configuration_restore:true,protected_cleanup:true,configuration_preserved:true,real_npm:true,model_calls:0,operation_timings:Array.from({length:30},()=>({command:'ui execution',elapsed_ms:1}))}:null, editor_review:{local_reads_no_network:true,metadata_unverified:true,verified_dry_run:true,rollback_review:true,restore_review:true,cancellation:true,configuration_unchanged:true,package_unchanged:true,operation_timings:Array.from({length:15},()=>({command:'ui review',elapsed_ms:1}))}, cases: 7, historical_version: previous ? '3.8.0' : '3.7.0', historical_sha256: HISTORICAL_RELEASES[previous ? '3.8.0' : '3.7.0'], ...(compareVersions(VERSION, '3.8.0') > 0 && !previous ? { previous_release: transitions(official, true) } : {}), target_version: VERSION, schema_migration: schema > 13 ? { from: 13, to: schema, old_version_refused: true, backup_restored: true } : null, roundtrip: true, independent_runner: true, crash_recovery: true, configuration_restore: true, real_npm: true, host_mode: official ? 'official' : 'version-only', model_calls: 0, operation_timings: Array.from({ length: (official ? 20 : 19) + (schema > 13 ? 3 : 0) }, (_, index) => ({ command: 'operation-' + index, elapsed_ms: 1 })) });
function receipts(): any[] {
    const base = { i18n_workflow: {languages:LANGUAGES,combinations:LANGUAGES.length**2,effective_resources:true,readonly_preview:true,save_reopen:true,installed_modules:true,model_calls:0}, appearance_scenarios:{languages:LANGUAGES,widths:[40,80,120],schemes:['powerline-daily','agent-workbench','quota-cost','narrow-terminal','light-readable'],semantic_fitting:true,scenario_previews:true,round_trip:true,save_reopen:true,installed_modules:true,model_calls:0}, status: 'pass', commit, tarball_sha256: hash,draft_reuse:{languages:LANGUAGES,widths:[40,80,120],history:true,atomic_repairs:true,style_fields:true,group_closure:true,unbound_sources:true,conflict_retry:true,unknown_reconciliation:true,save_reopen:true,installed_modules:true,model_calls:0},source_operations:{separate_approval:true,interval_300:true,ttl_independent:true,non_git:true,manual_consumer_preserved:true,last_success_after_failure:true,execution_summary:true,bindings_reused:true,drafts_protected:true,reviewed_cleanup:true,settings_unchanged:true,model_calls:0} };
    const installations = INSTALL_TARGETS.map(target => ({ ...base, target, offline_install: true, initially_empty_npm_cache: true, lifecycle_scripts: false, outside_checkout: true, path_excludes_python_and_compilers: true, powershell_setup: target.startsWith('windows-') ? { status: 'pass', candidate_invoked: false, receipt: { status: 0, timeout_ms: 60000, error: null } } : null, task_viewer:{languages:LANGUAGES.length,views:LANGUAGES.length*3,standalone_non_tty:true,readonly:true,installed_modules:true}, alignment_matrix: {languages:LANGUAGES,widths:[40,80,120],cases:LANGUAGES.length*3,installed_modules:true,saved_reopened:true,preview_matches:true}, appearance_preview_diagnosis:{theme:'ocean',gradient:'glacier',scenarios:6,readonly_file:true,input_only:true,unsaved_draft:true}, alignment_cases: 4, gradient_cases: 6, selective_import_cases: 4, setup_cases: 3, extension_cases: 4, indicator_cases: 3, group_cases: 4, automatic_refresh_cases: 4, cost_rate_cases: 4, git_policy_cases: 4, first_entry_cases: 4, version_management: transitions(), terminal_color_cases: target.startsWith('windows-') ? 15 : 3, checks: { i18n_workflow:true, appearance_scenarios:true, draft_reuse:true, task_viewer:true, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, true])), alignments: true, gradients: true, selective_import: true, setup: true, extensions: true, indicators: true, groups: true, automatic_refresh: true, cost_rates: true, git_policy: true, terminal_colors: true, first_entry: true, version_management: true } }));
    for (const row of installations as any[]) if (row.target.startsWith('windows-'))
        row.terminal_shell_evidence = ['setup','configure','slash'].flatMap(entry => ['powershell','cmd','git-bash'].map(shell => ({entry,shell,colors:256,input_tty:true,restored:true,cancelled:true})));
    return [...installations,
        ...installations.flatMap(receipt => NODE_RUNTIME_CASES.map(runtime_case => ({ ...receipt, kind: 'node-runtime', runtime_case, runtime_tests: true, node: 'v' + runtime_case.replace('x', '25.0'), node_sha256: hash }))),
        ...HOST_TARGETS.map(target => { const [platform, host] = target.split('-'); return { ...base, target, platform, host, model_calls: 0, mods: Object.fromEntries(['statusline-native', 'statusline-runtime'].map(name => [name, { validation: 'pass', official_tests: 'pass', official_test_batches: officialReceipt(name), capacity: { total_cases:NATIVE_CAPACITY_TOTAL_CASES,additional_cases:NATIVE_CAPACITY_ADDITIONAL_CASES,shared_execution:true,baseline_names_sha256:hash,additional_names_sha256:hash,status: 'pass', cases: NATIVE_CAPACITY_CASES, actual_host: true }, types: host === '2.1.296' ? { status: 'unavailable', reason: 'no declarations' } : { status: 'pass', host } }])), package_management: { ...transitions(true), host, ...(compareVersions(VERSION,'3.8.0') > 0 ? { previous_release: { ...transitions(true,true), host } } : {}) }, installed: { ...base, source: { commit } } }; })];
}
test('tests.integration.test_publish_package.AcceptanceTests.test_completed_matrix_is_required', () => {
    assert.equal(assessEvidence(receipts(), commit, hash).hosts, 16);
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


test('release evidence includes the published 3.8.0 upgrade and refusal/restore path', () => {
    const rows = receipts();
    delete rows[0].version_management.previous_release;
    assert.throws(() => assessEvidence(rows, commit, hash), /Missing version-management/);
    const modified = receipts();
    modified[0].version_management.previous_release.schema_migration.old_version_refused = false;
    assert.throws(() => assessEvidence(modified, commit, hash));
});

test('all migrated registrations retain historical approval dates, paths and decisions', () => {
    const legacy = readFileSync(join(repoRoot, 'tools/release/test/fixtures/legacy-approval.txt'));
    const historicalVersions = [...legacy.toString('utf8').matchAll(/^\s+'([^']+)': \{ path:/gmu)].map(match => match[1]!);
    assert(historicalVersions.length > 0);
    // Future data-only registrations do not need additions to this frozen legacy fixture.
    for (const version of historicalVersions) {
        const entry = registry.approvals.find(row => row.version === version); assert(entry);
        const approval = readFileSync(join(repoRoot, entry.path));
        const entries = new Map([['tools/release/approval.ts', legacy], [entry.path, approval]]);
        const historical = sourceStableApproval(entries, entry.version);
        entries.set(APPROVAL_REGISTRY_PATH, readFileSync(join(repoRoot, APPROVAL_REGISTRY_PATH)));
        const { registry: input, ...current } = sourceStableApproval(entries, entry.version);
        assert.deepEqual(current, historical);
        assert.equal(input?.path, APPROVAL_REGISTRY_PATH);
        assert.match(input!.sha256, /^[a-f0-9]{64}$/u);
    }
});

test('a new stable approval is data-only and comes entirely from the verified source', () => {
    const version = '9.9.9', path = `docs/releases/approvals/v${version}.json`, date = '2026-10-28';
    const record = { schema_version: 1, version, decision: 'accept-known-gaps', approved_by: 'fbincon', approved_on: date,
        authority: 'Isolated test decision', reference: 'https://github.com/fbincon/claude-code-statusline/issues/96', accepted_gaps: ACCEPTED_GAPS };
    const input = { schema_version: 1, approvals: [{ version, path, approved_on: date }] };
    const entries = new Map([[APPROVAL_REGISTRY_PATH, Buffer.from(JSON.stringify(input))], [path, Buffer.from(JSON.stringify(record))],
        ['tools/release/approval.ts', readFileSync(join(repoRoot, 'tools/release/approval.ts'))]]);
    const good = sourceStableApproval(entries, version);
    assert.equal(good.record.version, version);
    assert.throws(() => sourceStableApproval(entries, VERSION), /No unique/u); // No checkout registry fallback.
    for (const patch of [{ version: VERSION }, { approved_on: '2026-10-27' }, { approved_by: 'someone' }, { schema_version: 2 },
        { decision: 'all-passed' }, { authority: ' ' }, { reference: 'https://example.invalid' }, { accepted_gaps: [] }, { accepted_gaps: [...ACCEPTED_GAPS, 'failed-ci'] }]) {
        entries.set(path, Buffer.from(JSON.stringify({ ...record, ...patch })));
        assert.throws(() => sourceStableApproval(entries, version));
    }
    entries.set(path, Buffer.from(JSON.stringify(record)));
    entries.set(APPROVAL_REGISTRY_PATH, Buffer.from(JSON.stringify(input, null, 2)));
    assert.notEqual(sourceStableApproval(entries, version).registry?.sha256, good.registry?.sha256);
    entries.delete(APPROVAL_REGISTRY_PATH);
    assert.throws(() => sourceStableApproval(entries, version), /missing the approval registry/u);
    entries.set(APPROVAL_REGISTRY_PATH, Buffer.from(JSON.stringify(input)));
    entries.delete(path); assert.throws(() => sourceStableApproval(entries, version), /missing the maintainer approval/u);
});

test('invalid, duplicate or missing registration fails without historical fallback', () => {
    const row = registry.approvals[0]!;
    for (const invalid of [null, {}, { schema_version: 2, approvals: [row] }, { schema_version: 1, approvals: [] },
        { schema_version: 1, approvals: [row, row] }, { schema_version: 1, approvals: [row, { ...row, version: '9.9.9' }] },
        ...[{ version: '9.9.9-beta.1' }, { version: '../escape' }, { path: 'docs/../outside.json' }, { path: '/outside.json' },
            { approved_on: '2026-02-30' }, { approved_on: '2026-10-28T00:00:00Z' }, { extra: true }]
            .map(patch => ({ schema_version: 1, approvals: [{ ...row, ...patch }] }))]) {
        assert.throws(() => assessApprovalRegistry(invalid));
    }
    const legacy = readFileSync(join(repoRoot, 'tools/release/test/fixtures/legacy-approval.txt'));
    for (const raw of ['{', '{}', '', '{"schema_version":1,"approvals":[]}']) {
        assert.throws(() => sourceStableApproval(new Map([['tools/release/approval.ts', legacy], [APPROVAL_REGISTRY_PATH, Buffer.from(raw)]]), row.version));
    }
    const corrupt = Buffer.from(legacy.toString().replace("approvedOn: '2026-10-28'", "approvedOn: evaluateCode()"));
    assert.throws(() => sourceStableApproval(new Map([['tools/release/approval.ts', corrupt]]), row.version), /Invalid historical/u);
});

test('task-viewer and read-only package-review receipts cannot be omitted or weakened',()=>{
    for(const official of [false,true])for(const key of ['local_reads_no_network','metadata_unverified','verified_dry_run','rollback_review','restore_review','cancellation','configuration_unchanged','package_unchanged']){
        const rows=receipts(),row=official?rows.find(row=>row.host):rows[0];
        (official?row.package_management:row.version_management).editor_review[key]=false;
        assert.throws(()=>assessEvidence(rows,commit,hash));
    }
    const missing=receipts();delete missing[0].task_viewer;assert.throws(()=>assessEvidence(missing,commit,hash));
    const changed=receipts();changed[0].task_viewer.readonly=false;assert.throws(()=>assessEvidence(changed,commit,hash));
});
test('twelve-language release rejects old combination and capacity counts', () => {
    for (const change of [
        (rows: any[]) => { rows[0].i18n_workflow.combinations = 36; },
        (rows: any[]) => { rows[0].task_viewer.languages = 6; },
        (rows: any[]) => { rows[0].alignment_matrix.cases = 18; },
        (rows: any[]) => { rows.find(row => row.host).mods['statusline-native'].capacity.total_cases = 283; },
    ]) {
        const rows = receipts(); change(rows);
        assert.throws(() => assessEvidence(rows, commit, hash));
    }
});
test('release binds complete official test batches to immutable source bytes', () => {
    const changed = new Map(sourceEntries);
    changed.set('mods/statusline-native/tests/fixture.test.ts', Buffer.from('changed source'));
    assert.throws(() => assessBoundEvidence(receipts(), commit, hash, changed), /Official source files changed/);
    const missing = receipts(); delete missing.find(row => row.host).mods['statusline-native'].official_test_batches;
    assert.throws(() => assessEvidence(missing, commit, hash));
    const omitted = receipts(); omitted.find(row => row.host).mods['statusline-native'].official_test_batches.batches = [];
    assert.throws(() => assessEvidence(omitted, commit, hash), /omitted or duplicated/);
});

test('v3.12 rejects missing source, execution and additional capacity receipts',()=>{
    for(const mutate of [(rows:any[])=>delete rows[0].source_operations,(rows:any[])=>delete rows[0].version_management.previous_release.editor_execution,(rows:any[])=>delete rows.find(row=>row.mods).mods['statusline-native'].capacity.total_cases]){const rows=receipts();mutate(rows);assert.throws(()=>assessEvidence(rows,commit,hash));}
});


test('each acceptance phase must retain its own original budget and passing elapsed receipt', () => {
    for (const official of [false, true]) for (const mutate of [
        (value: any) => delete value.acceptance_phases,
        (value: any) => value.previous_release.acceptance_phases.pop(),
        (value: any) => value.acceptance_phases[0].budget_ms++,
        (value: any) => value.acceptance_phases[0].elapsed_ms = value.acceptance_phases[0].budget_ms + 1,
        (value: any) => value.previous_release.acceptance_phases[1].elapsed_ms = -1,
        (value: any) => value.previous_release.acceptance_phases[1].status = 'timeout',
        (value: any) => value.previous_release.acceptance_phases.reverse(),
    ]) {
        const rows = receipts(), row = official ? rows.find(row => row.host) : rows[0];
        mutate(official ? row.package_management : row.version_management);
        assert.throws(() => assessEvidence(rows, commit, hash));
    }
});


test('release evidence requires unchanged official logs matching every batch summary', t => {
    const root = mkdtempSync(join(tmpdir(), 'official-evidence-'));
    t.after(() => { removeTree(root); assert(!existsSync(root)); });
    const report = receipts().find(row => row.host === '2.1.287');
    mkdirSync(join(root, 'logs'));
    writeFileSync(join(root, 'mods.json'), JSON.stringify(report));
    const log = join(root, 'logs/fixture.log');
    assert.throws(() => evidenceFiles(root), /ENOENT/);
    writeFileSync(log, officialLog); assert.equal(evidenceFiles(root).length, 1);
    writeFileSync(log, officialLog.replace('1 pass', '0 pass'));
    assert.throws(() => evidenceFiles(root), /Official result log changed/);
    for (const mod of Object.values(report.mods) as any[]) mod.official_test_batches.batches[0].log_sha256 = sha256(readFileSync(log));
    writeFileSync(join(root, 'mods.json'), JSON.stringify(report));
    assert.throws(() => evidenceFiles(root), /Official batch must execute tests/);
});
