import { NATIVE_CAPACITY_CASES, NATIVE_CAPACITY_TOTAL_CASES, NATIVE_CAPACITY_ADDITIONAL_CASES, NATIVE_CAPACITY_TIMEOUT_MS, nativeCapacitySourceInventory } from '../../../acceptance/native-capacity.js';
import { HISTORICAL_RELEASES } from '../../../acceptance/historical-releases.js';
import { compareVersions, PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { VERSION } from '@fbincon/statusline-core/release';
import { NODE_RUNTIME_CASES } from '@fbincon/statusline-core/node-runtime';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { sha256 } from '../../../build/files.js';
import { INSTALL_TARGETS, HOST_TARGETS } from '../../prepare.js';

export const commit = 'a'.repeat(40), hash = 'b'.repeat(64);
export const schema = PACKAGE_COMPATIBILITY.read.display[1];

// Synthetic but source-bound official executions for release-gate tests.
export const officialLog = 'tests/fixture.test.ts:\n(pass) fixture [1ms]\n\n1 pass\n0 fail\nRan 1 test across 1 file. [1ms]\n';
export const capacityValidationLog = 'Capacity validation passed\n';
export const capacityValidation = { status: 'pass', timeout_ms: NATIVE_CAPACITY_TIMEOUT_MS, elapsed_ms: 1, log: 'capacity-validation.log', log_sha256: sha256(capacityValidationLog) };
export const sourceEntries = new Map(['statusline-native', 'statusline-runtime'].map(name => [
    'mods/' + name + '/tests/fixture.test.ts', Buffer.from('// ' + name + ' test source\n'),
] as const));
const ordered = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
export function capacityLog(file: string, count: number) {
    return file + ':\n' + Array.from({ length: count }, (_, i) => '(pass) capacity fixture ' + i + ' [1ms]\n').join('') +
        `\n${count} pass\n0 fail\nRan ${count} tests across 1 file. [1ms]\n`;
}
export function officialReceipt(name: string, capacity = false, entries: ReadonlyMap<string, Uint8Array> = sourceEntries) {
    const prefix = 'mods/' + name + '/';
    const original = Object.fromEntries([...entries].filter(([path])=>path.startsWith(prefix)).map(([path,bytes])=>[path.slice(prefix.length),sha256(Buffer.from(bytes))]));
    const source_files = ordered(capacity ? nativeCapacitySourceInventory(original) : original);
    const source_sha256 = sha256(JSON.stringify(source_files)), host_sha256 = sha256('{}');
    const test_files = Object.keys(source_files).filter(path => path.endsWith('.test.ts'));
    const timeout_ms = capacity ? NATIVE_CAPACITY_TIMEOUT_MS : 180000;
    const batches = test_files.map((file, index) => {
        const start = Number(/capacity-(\d+)\.test\.ts$/u.exec(file)?.[1] ?? 0);
        const count = capacity ? Math.min(50, NATIVE_CAPACITY_TOTAL_CASES - start) : 1;
        const copied = ordered(Object.fromEntries(Object.entries(source_files).filter(([path]) => !path.endsWith('.test.ts') || path === file)));
        return { tests: count, files: 1, pass: count, fail: 0, skip: 0, index, test_files: [file], test_hashes: { [file]: source_files[file] },
            copied_source_sha256: sha256(JSON.stringify(copied)), host_sha256, timeout_ms, elapsed_ms: 1,
            log: capacity ? 'capacity-' + index + '.log' : file === 'tests/fixture.test.ts' ? 'fixture.log' : 'official-' + index + '.log',
            log_sha256: sha256(capacity ? capacityLog(file, count) : officialLog.replace('tests/fixture.test.ts',file)) };
    });
    return { schema_version: 1, kind: 'official-mod-test-batches', status: 'pass', timeout_ms,
        source_files, host_files: {}, source_sha256, host_sha256, test_files,
        totals: { tests: capacity ? NATIVE_CAPACITY_TOTAL_CASES : test_files.length, files: test_files.length, pass: capacity ? NATIVE_CAPACITY_TOTAL_CASES : test_files.length, fail: 0, skip: 0 }, batches };
}

export const transitions = (official = false, previous = false): any => ({ acceptance_phases: ['baseline', ...(previous ? ['editor_execution'] : [])].map(phase => ({ phase, budget_ms: official ? 1_200_000 : 900_000, elapsed_ms: 1, status: 'pass' })), editor_execution:previous?{verified_execution:true,retained_control:true,downgrade_roundtrip:true,old_protocol_rejected:true,detach_continues:true,progress_complete:true,package_recovery:true,separate_configuration_restore:true,protected_cleanup:true,configuration_preserved:true,real_npm:true,model_calls:0,operation_timings:Array.from({length:30},()=>({command:'ui execution',elapsed_ms:1}))}:null, editor_review:{local_reads_no_network:true,metadata_unverified:true,verified_dry_run:true,rollback_review:true,restore_review:true,cancellation:true,configuration_unchanged:true,package_unchanged:true,operation_timings:Array.from({length:15},()=>({command:'ui review',elapsed_ms:1}))}, cases: 7, historical_version: previous ? '3.8.0' : '3.7.0', historical_sha256: HISTORICAL_RELEASES[previous ? '3.8.0' : '3.7.0'], ...(compareVersions(VERSION, '3.8.0') > 0 && !previous ? { previous_release: transitions(official, true) } : {}), target_version: VERSION, schema_migration: schema > 13 ? { from: 13, to: schema, old_version_refused: true, backup_restored: true } : null, roundtrip: true, independent_runner: true, crash_recovery: true, configuration_restore: true, real_npm: true, host_mode: official ? 'official' : 'version-only', model_calls: 0, operation_timings: Array.from({ length: (official ? 20 : 19) + (schema > 13 ? 3 : 0) }, (_, index) => ({ command: 'operation-' + index, elapsed_ms: 1 })) });
export function receipts(): any[] {
    const base = { i18n_workflow: {languages:LANGUAGES,combinations:LANGUAGES.length**2,effective_resources:true,readonly_preview:true,save_reopen:true,installed_modules:true,model_calls:0}, appearance_scenarios:{languages:LANGUAGES,widths:[40,80,120],schemes:['powerline-daily','agent-workbench','quota-cost','narrow-terminal','light-readable'],semantic_fitting:true,scenario_previews:true,round_trip:true,save_reopen:true,installed_modules:true,model_calls:0}, status: 'pass', commit, tarball_sha256: hash,draft_reuse:{languages:LANGUAGES,widths:[40,80,120],history:true,atomic_repairs:true,style_fields:true,group_closure:true,unbound_sources:true,conflict_retry:true,unknown_reconciliation:true,save_reopen:true,installed_modules:true,model_calls:0},source_operations:{separate_approval:true,interval_300:true,ttl_independent:true,non_git:true,manual_consumer_preserved:true,last_success_after_failure:true,execution_summary:true,bindings_reused:true,drafts_protected:true,reviewed_cleanup:true,settings_unchanged:true,model_calls:0} };
    const installations = INSTALL_TARGETS.map(target => ({ ...base, target, offline_install: true, initially_empty_npm_cache: true, lifecycle_scripts: false, outside_checkout: true, path_excludes_python_and_compilers: true, powershell_setup: target.startsWith('windows-') ? { status: 'pass', candidate_invoked: false, receipt: { status: 0, timeout_ms: 60000, error: null } } : null, task_viewer:{languages:LANGUAGES.length,views:LANGUAGES.length*3,standalone_non_tty:true,readonly:true,installed_modules:true}, alignment_matrix: {languages:LANGUAGES,widths:[40,80,120],cases:LANGUAGES.length*3,installed_modules:true,saved_reopened:true,preview_matches:true}, appearance_preview_diagnosis:{theme:'ocean',gradient:'glacier',scenarios:6,readonly_file:true,input_only:true,unsaved_draft:true}, alignment_cases: 4, gradient_cases: 6, selective_import_cases: 4, setup_cases: 3, extension_cases: 4, indicator_cases: 3, group_cases: 4, automatic_refresh_cases: 4, cost_rate_cases: 4, git_policy_cases: 4, first_entry_cases: 4, version_management: transitions(), terminal_color_cases: target.startsWith('windows-') ? 15 : 3, checks: { i18n_workflow:true, appearance_scenarios:true, draft_reuse:true, task_viewer:true, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, true])), alignments: true, gradients: true, selective_import: true, setup: true, extensions: true, indicators: true, groups: true, automatic_refresh: true, cost_rates: true, git_policy: true, terminal_colors: true, first_entry: true, version_management: true } }));
    for (const row of installations as any[]) if (row.target.startsWith('windows-'))
        row.terminal_shell_evidence = ['setup','configure','slash'].flatMap(entry => ['powershell','cmd','git-bash'].map(shell => ({entry,shell,colors:256,input_tty:true,restored:true,cancelled:true})));
    return [...installations,
        ...installations.flatMap(receipt => NODE_RUNTIME_CASES.map(runtime_case => ({ ...receipt, kind: 'node-runtime', runtime_case, runtime_tests: true, node: 'v' + runtime_case.replace('x', '25.0'), node_sha256: hash }))),
        ...HOST_TARGETS.map(target => { const [platform, host] = target.split('-'); return { ...base, target, platform, host, model_calls: 0, mods: Object.fromEntries(['statusline-native', 'statusline-runtime'].map(name => [name, { validation: 'pass', official_tests: 'pass', official_test_batches: officialReceipt(name), capacity: { validation: { ...capacityValidation }, execution: officialReceipt(name, true), test_files: Math.ceil(NATIVE_CAPACITY_TOTAL_CASES / 50), original_cases: 197, model_calls: 0, total_cases:NATIVE_CAPACITY_TOTAL_CASES,additional_cases:NATIVE_CAPACITY_ADDITIONAL_CASES,shared_execution:true,baseline_names_sha256:hash,additional_names_sha256:hash,status: 'pass', cases: NATIVE_CAPACITY_CASES, actual_host: true }, types: host === '2.1.296' ? { status: 'unavailable', reason: 'no declarations' } : { status: 'pass', host } }])), package_management: { ...transitions(true), host, ...(compareVersions(VERSION,'3.8.0') > 0 ? { previous_release: { ...transitions(true,true), host } } : {}) }, installed: { ...base, source: { commit } } }; })];
}
