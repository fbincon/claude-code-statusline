import { compareVersions, PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { HISTORICAL_RELEASES, type HistoricalRelease } from '../acceptance/historical-releases.js';
import { VERSION } from '@fbincon/statusline-core/release';
/** Read-only candidate readiness, never uploads, tags or publishes. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { verifyDelivery } from '../build/verify.js';
import { UNVERIFIED_GATES, sourceStableApproval } from './approval.js';
import { NODE_RUNTIME_CASES, matchesNodeCase } from '@fbincon/statusline-core/node-runtime';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { NATIVE_CAPACITY_CASES, NATIVE_CAPACITY_TOTAL_CASES, NATIVE_CAPACITY_ADDITIONAL_CASES } from '../acceptance/native-capacity.js';
export const INSTALL_TARGETS = ['ubuntu-24.04-x64', 'windows-2025-x64', 'windows-11-arm-x64', 'macos-14-arm64', 'macos-15-arm64', 'macos-15-intel-x64', 'macos-26-arm64', 'macos-26-intel-x64'];
export const HOST_TARGETS = [...['2.1.287', '2.1.288', '2.1.289', '2.1.294', '2.1.296', '2.1.310'].map(host => 'linux-' + host), ...['win32', 'darwin'].flatMap(os => ['2.1.288', '2.1.289', '2.1.294', '2.1.296', '2.1.310'].map(host => os + '-' + host))];
function versionSequence(value: any, official: boolean, historical: HistoricalRelease = '3.7.0'): void {
    assert(value && typeof value === 'object', 'Missing version-management receipt');
    assert.equal(value.cases, 7);
    assert.equal(value.historical_version, historical);
    assert.equal(value.historical_sha256, HISTORICAL_RELEASES[historical]);
    assert.equal(value.target_version, VERSION);
    assert.equal(value.host_mode, official ? 'official' : 'version-only');
    assert.equal(value.model_calls, 0);
    for (const key of ['roundtrip', 'independent_runner', 'crash_recovery', 'configuration_restore', 'real_npm']) assert.equal(value[key], true);
    const review=value.editor_review;assert(review,'Missing editor-review receipt');
    for(const key of ['local_reads_no_network','metadata_unverified','verified_dry_run','rollback_review','restore_review','cancellation','configuration_unchanged','package_unchanged'])assert.equal(review[key],true);
    assert(Array.isArray(review.operation_timings)&&review.operation_timings.length>=15,'Incomplete editor-review operations');
    for(const operation of review.operation_timings)assert(operation&&typeof operation.command==='string'&&Number.isFinite(operation.elapsed_ms)&&operation.elapsed_ms>=0);
    if(historical==='3.8.0'&&compareVersions(VERSION,'3.12.0')>=0){
        const execution=value.editor_execution;assert(execution,'Missing editor-execution receipt');
        for(const key of ['verified_execution','retained_control','downgrade_roundtrip','old_protocol_rejected','detach_continues','progress_complete','package_recovery','separate_configuration_restore','protected_cleanup','configuration_preserved','real_npm'])assert.equal(execution[key],true);
        assert.equal(execution.model_calls,0);assert(Array.isArray(execution.operation_timings)&&execution.operation_timings.length>=30,'Incomplete editor-execution operations');
        for(const operation of execution.operation_timings)assert(operation&&typeof operation.command==='string'&&Number.isFinite(operation.elapsed_ms)&&operation.elapsed_ms>=0);
    }
    const schema = PACKAGE_COMPATIBILITY.read.display[1];
    assert.deepEqual(value.schema_migration, schema > 13 ? { from: 13, to: schema, old_version_refused: true, backup_restored: true } : null);
    assert(Array.isArray(value.operation_timings) && value.operation_timings.length === (official ? 20 : 19) + (schema > 13 ? 3 : 0), 'Incomplete version-operation evidence');
    for (const operation of value.operation_timings)
        assert(operation && typeof operation.command === 'string' && operation.command.length > 0 && Number.isFinite(operation.elapsed_ms) && operation.elapsed_ms >= 0, 'Invalid version-operation evidence');
    if (historical === '3.7.0' && compareVersions(VERSION, '3.8.0') > 0) {
        versionSequence(value.previous_release, official, '3.8.0');
        assert.equal(value.previous_release.host, value.host);
    }
}
export function assessEvidence(reports: any[], commit: string, sha256: string) {
    const typesUnavailable: string[] = [], seen = new Set<string>();
    for (const report of reports) {
        assert.equal(report.status, 'pass', 'Failed/skipped evidence cannot pass');
        assert.equal(report.commit, commit, 'Evidence belongs to another commit');
        assert.equal(report.tarball_sha256, sha256, 'Evidence belongs to another artifact');
        const runtime = report.kind === 'node-runtime';
        const key = runtime ? report.target + '@' + report.runtime_case : report.target;
        assert(!seen.has(key), 'Duplicate target evidence'); seen.add(key);
        if (runtime) {
            assert(INSTALL_TARGETS.includes(report.target), 'Unexpected runtime target');
            assert(NODE_RUNTIME_CASES.includes(report.runtime_case), 'Unexpected runtime case');
            assert(typeof report.node === 'string' && report.node.startsWith('v') && matchesNodeCase(report.node.slice(1), report.runtime_case), 'Wrong runtime version');
            assert.match(report.node_sha256, /^[a-f0-9]{64}$/u);
            assert.equal(report.runtime_tests, true, 'Missing product runtime tests');
        }
        if (INSTALL_TARGETS.includes(report.target)) {
            assert.equal(report.offline_install, true); assert.equal(report.initially_empty_npm_cache, true);
            assert.equal(report.lifecycle_scripts, false); assert.equal(report.outside_checkout, true);
            assert.equal(report.path_excludes_python_and_compilers, true);
            if (report.target.startsWith('windows-')) {
                assert.equal(report.powershell_setup?.status, 'pass', 'Windows shell environment evidence is required');
                assert.equal(report.powershell_setup.candidate_invoked, false);
                assert.equal(report.powershell_setup.receipt.status, 0);
                assert.equal(report.powershell_setup.receipt.timeout_ms, 60000);
                assert.equal(report.powershell_setup.receipt.error, null);
            }
            assert.equal(Object.keys(report.checks).length, 24); assert(Object.values(report.checks).every(value => value === true));
            assert(report.source_operations&&typeof report.source_operations==='object');
            for(const key of ['separate_approval','interval_300','ttl_independent','non_git','manual_consumer_preserved','last_success_after_failure','execution_summary','bindings_reused','drafts_protected','reviewed_cleanup','settings_unchanged'])assert.equal(report.source_operations[key],true);assert.equal(report.source_operations.model_calls,0);
            assert.equal(report.checks.selective_import, true); assert.equal(report.selective_import_cases, 4);
            assert.equal(report.checks.gradients, true); assert.equal(report.gradient_cases, 6);
            if(compareVersions(VERSION,'3.10.0')>=0)assert.deepEqual(report.appearance_preview_diagnosis,{theme:'ocean',gradient:'glacier',scenarios:6,readonly_file:true,input_only:true,unsaved_draft:true});
            assert.equal(report.checks.task_viewer,true);assert.deepEqual(report.task_viewer,{languages:6,views:18,standalone_non_tty:true,readonly:true,installed_modules:true});
            assert.equal(report.checks.alignments, true); assert.equal(report.alignment_cases, 4);
            assert.deepEqual(report.alignment_matrix, {languages:LANGUAGES,widths:[40,80,120],cases:18,installed_modules:true,saved_reopened:true,preview_matches:true});
            assert.equal(report.checks.version_management, true); versionSequence(report.version_management, false);
            assert.equal(report.checks.first_entry, true); assert.equal(report.first_entry_cases, 4);
            assert.equal(report.checks.git_policy, true); assert.equal(report.git_policy_cases, 4);
            assert.equal(report.checks.terminal_colors, true); assert.equal(report.terminal_color_cases, report.target.startsWith('windows-') ? 15 : 3);
            if (report.target.startsWith('windows-')) {
                assert(Array.isArray(report.terminal_shell_evidence), 'Missing actual Windows shell preview evidence');
                const expected = ['setup', 'configure', 'slash'].flatMap(entry => ['powershell', 'cmd', 'git-bash'].map(shell => entry + '/' + shell));
                assert.deepEqual(report.terminal_shell_evidence.map((row: any) => row.entry + '/' + row.shell).sort(), expected.sort(), 'Incomplete Windows shell preview evidence');
                for (const row of report.terminal_shell_evidence) {
                    assert.equal(row.colors, 256); assert.equal(row.input_tty, true); assert.equal(row.restored, true); assert.equal(row.cancelled, true);
                }
            }
            assert.equal(report.checks.cost_rates, true); assert.equal(report.cost_rate_cases, 4);
            assert.equal(report.checks.automatic_refresh, true); assert.equal(report.automatic_refresh_cases, 4);
            assert.equal(report.checks.groups, true); assert.equal(report.group_cases, 4);
            assert.equal(report.checks.indicators, true); assert.equal(report.indicator_cases, 3);
            assert.equal(report.checks.setup, true); assert.equal(report.setup_cases, 3);
            assert.equal(report.checks.extensions, true); assert.equal(report.extension_cases, 4);
        } else {
            assert(HOST_TARGETS.includes(report.target), 'Unexpected host target');
            assert.equal(report.target, report.platform + '-' + report.host);
            assert.equal(report.model_calls, 0);
            const required = Number(report.host.split('.')[2]) >= 289 ? ['statusline-native', 'statusline-runtime'] : ['statusline-native'];
            for (const name of required) {
                const mod = report.mods[name]; assert.equal(mod.validation, 'pass'); assert.equal(mod.official_tests, 'pass');
                if (name === 'statusline-native') { assert.equal(mod.capacity?.status, 'pass'); assert.equal(mod.capacity.cases, NATIVE_CAPACITY_CASES); assert.equal(mod.capacity.actual_host, true); if(compareVersions(VERSION,'3.12.0')>=0){assert.equal(mod.capacity.total_cases,NATIVE_CAPACITY_TOTAL_CASES);assert.equal(mod.capacity.additional_cases,NATIVE_CAPACITY_ADDITIONAL_CASES);assert.equal(mod.capacity.shared_execution,true);assert.match(mod.capacity.baseline_names_sha256,/^[a-f0-9]{64}$/u);assert.match(mod.capacity.additional_names_sha256,/^[a-f0-9]{64}$/u);} }
                if (report.host === '2.1.296') { assert.equal(mod.types.status, 'unavailable'); assert(mod.types.reason); typesUnavailable.push(report.target + '/' + name); }
                else { assert.equal(mod.types.status, 'pass'); assert.equal(mod.types.host, report.host); }
            }
            assert.equal(report.installed.status, 'pass'); assert.equal(report.installed.tarball_sha256, sha256);
            assert.equal(report.installed.source.commit, commit);
            versionSequence(report.package_management, true); assert.equal(report.package_management.host, report.host);
        }
    }
    const runtimeTargets = INSTALL_TARGETS.flatMap(target => NODE_RUNTIME_CASES.map(runtime => target + '@' + runtime));
    assert.deepEqual([...seen].sort(), [...INSTALL_TARGETS, ...HOST_TARGETS, ...runtimeTargets].sort(), 'Incomplete candidate matrix');
    return { status: 'pass', commit, tarball_sha256: sha256, installations: INSTALL_TARGETS.length, hosts: HOST_TARGETS.length, runtime_installations: runtimeTargets.length, type_declarations_unavailable: typesUnavailable, public_release: false };
}
export function evidenceFiles(root: string): any[] {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
        const path = join(root, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Linked evidence is not accepted');
        return entry.isDirectory() ? evidenceFiles(path) : ['installed.json', 'mods.json', 'runtime.json'].includes(entry.name) ? [JSON.parse(fs.readFileSync(path, 'utf8'))] : [];
    });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, evidence: { type: 'string' }, report: { type: 'string' }, preview: { type: 'boolean' }, stable: { type: 'boolean' } } });
    if (!values.artifact || !values.commit || !values.evidence || !values.report) throw new Error('Require --artifact TGZ --commit FULL_SHA --evidence DIRECTORY --report NEW_FILE');
    assert(!(values.preview && values.stable), 'Choose preview or stable readiness');
    const candidate = verifyDelivery(resolve(values.artifact), values.commit);
    const result = assessEvidence(evidenceFiles(resolve(values.evidence)), values.commit, candidate.sha256);
    if (values.preview) assert.equal(candidate.source.channel, 'preview', 'Preview gate requires the public package');
    let approval = null;
    if (values.stable) {
        assert.equal(candidate.source.channel, 'stable', 'Stable gate requires the stable public package');
        approval = sourceStableApproval(candidate.sourceEntries, candidate.source.application_version);
    }
    const report = { ...result, application_version: candidate.source.application_version, channel: candidate.source.channel ?? 'candidate',
        preview_ready: values.preview === true, stable_ready: values.stable === true && approval !== null,
        unverified_gates: UNVERIFIED_GATES, maintainer_approval: approval,
        deferred_to_stable: values.stable ? [] : UNVERIFIED_GATES };
    fs.writeFileSync(resolve(values.report), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
}
