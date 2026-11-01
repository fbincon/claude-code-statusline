import { NATIVE_CAPACITY_TIMEOUT_MS } from '../../acceptance/native-capacity.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { join } from 'node:path';
import { assessEvidence as assessBoundEvidence, evidenceFiles } from '../prepare.js';
import { assessStableApproval as assessRegisteredApproval, stableApprovalPath as registeredApprovalPath, assessApprovalRegistry, sourceStableApproval, APPROVAL_REGISTRY_PATH, ACCEPTED_GAPS } from '../approval.js';
import { VERSION, isPrerelease } from '@fbincon/statusline-core/release';
import { repoRoot } from '../../migration/ts-03/common.js';
import { sha256 } from '../../build/files.js';
import { commit, hash, officialLog, capacityValidationLog, sourceEntries, capacityLog, receipts, capacityValidation } from './fixtures/acceptance.js';
const registry = assessApprovalRegistry(JSON.parse(readFileSync(join(repoRoot, APPROVAL_REGISTRY_PATH), 'utf8')));
const assessStableApproval = (value: unknown, version: string) => assessRegisteredApproval(value, version, registry);
const stableApprovalPath = (version: string) => registeredApprovalPath(version, registry);
const assessEvidence = (reports: any[], commit: string, artifact: string) => assessBoundEvidence(reports, commit, artifact, sourceEntries);
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
    writeFileSync(log, officialLog);
    for (const mod of Object.values(report.mods) as any[]) for (const batch of mod.capacity.execution.batches)
        writeFileSync(join(root, 'logs', batch.log), capacityLog(batch.test_files[0], batch.tests));
    writeFileSync(join(root, 'logs/capacity-validation.log'), capacityValidationLog);
    assert.equal(evidenceFiles(root).length, 1);
    writeFileSync(log, officialLog.replace('1 pass', '0 pass'));
    assert.throws(() => evidenceFiles(root), /Official result log changed/);
    for (const mod of Object.values(report.mods) as any[]) mod.official_test_batches.batches[0].log_sha256 = sha256(readFileSync(log));
    writeFileSync(join(root, 'mods.json'), JSON.stringify(report));
    assert.throws(() => evidenceFiles(root), /Official batch must execute tests/);
});


test('capacity receipts retain every immutable entry point, original deadline and actual result log', t => {
    for (const mutate of [
        (capacity: any) => delete capacity.execution,
        (capacity: any) => delete capacity.validation,
        (capacity: any) => capacity.validation.timeout_ms++,
        (capacity: any) => capacity.validation.elapsed_ms = NATIVE_CAPACITY_TIMEOUT_MS + 1,
        (capacity: any) => capacity.validation.status = 'fail',
        (capacity: any) => capacity.execution.batches.pop(),
        (capacity: any) => capacity.execution.timeout_ms++,
        (capacity: any) => capacity.execution.batches[0].timeout_ms++,
        (capacity: any) => capacity.execution.batches[0].tests--,
        (capacity: any) => capacity.execution.source_files['hooks/hooks.json'] = hash,
        (capacity: any) => capacity.model_calls++,
        (capacity: any) => capacity.test_files--,
    ]) {
        const rows = receipts(); mutate(rows.find(row => row.host).mods['statusline-native'].capacity);
        assert.throws(() => assessEvidence(rows, commit, hash));
    }
    const root = mkdtempSync(join(tmpdir(), 'capacity-evidence-'));
    t.after(() => { removeTree(root); assert(!existsSync(root)); });
    const report = receipts().find(row => row.host === '2.1.287');
    mkdirSync(join(root, 'logs'));
    writeFileSync(join(root, 'mods.json'), JSON.stringify(report));
    writeFileSync(join(root, 'logs/fixture.log'), officialLog);
    assert.throws(() => evidenceFiles(root), /ENOENT/);
    for (const mod of Object.values(report.mods) as any[]) for (const batch of mod.capacity.execution.batches)
        writeFileSync(join(root, 'logs', batch.log), capacityLog(batch.test_files[0], batch.tests));
    writeFileSync(join(root, 'logs/capacity-validation.log'), capacityValidationLog);
    assert.equal(evidenceFiles(root).length, 1);
    const last = report.mods['statusline-native'].capacity.execution.batches.at(-1);
    writeFileSync(join(root, 'logs', last.log), capacityLog(last.test_files[0], last.tests - 1));
    assert.throws(() => evidenceFiles(root), /Official result log changed/);
    for (const mod of Object.values(report.mods) as any[]) mod.capacity.execution.batches.at(-1).log_sha256 = sha256(readFileSync(join(root, 'logs', last.log)));
    writeFileSync(join(root, 'mods.json'), JSON.stringify(report));
    assert.throws(() => evidenceFiles(root), /Official result log does not match its receipt/);
});


test('capacity validation logs must be present and unchanged alongside executed tests', t => {
    const root = mkdtempSync(join(tmpdir(), 'capacity-validation-'));
    t.after(() => { removeTree(root); assert(!existsSync(root)); });
    mkdirSync(join(root, 'logs'));
    writeFileSync(join(root, 'mods.json'), JSON.stringify({ mods: { 'statusline-native': { capacity: { validation: capacityValidation } } } }));
    assert.throws(() => evidenceFiles(root), /ENOENT/);
    writeFileSync(join(root, 'logs/capacity-validation.log'), capacityValidationLog);
    assert.equal(evidenceFiles(root).length, 1);
    writeFileSync(join(root, 'logs/capacity-validation.log'), 'different validation output');
    assert.throws(() => evidenceFiles(root), /Official result log changed/);
});
