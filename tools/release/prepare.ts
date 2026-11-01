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
import { NATIVE_CAPACITY_CASES, NATIVE_CAPACITY_TOTAL_CASES, NATIVE_CAPACITY_ADDITIONAL_CASES, NATIVE_CAPACITY_TIMEOUT_MS, nativeCapacitySourceInventory } from '../acceptance/native-capacity.js';
import { VERSION_SEQUENCE_MS, OFFICIAL_VERSION_SEQUENCE_MS, VERSION_EDITOR_EXECUTION_MS, OFFICIAL_VERSION_EDITOR_EXECUTION_MS } from '../acceptance/budgets.js';
import { verifyLanguageEvidence } from '../checks/i18n-evidence.ts';
import { parseOfficialTestSummary, verifyOfficialTestBatches, type OfficialTestReceipt } from '../acceptance/official-tests.js';
import { sha256 as digestBytes } from '../build/files.js';
import { coverageVersionAt, coverageVersionInArchive, historyCounts, verifyCoveragePlan, type CoveragePlan } from '../checks/ci-coverage.ts';
import { validateFragmentIdentity } from '../checks/ci-fragment.ts';
import { validateSectionEvidence, validateInstalledDetails, verifySectionLogBytes, SECTION_INPUT_PATHS, sectionInputsAt } from '../checks/ci-section-evidence.ts';
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
    if (compareVersions(VERSION, '3.12.0') >= 0) {
        const phases = ['baseline', ...(historical === '3.8.0' ? ['editor_execution'] : [])];
        assert(Array.isArray(value.acceptance_phases) && value.acceptance_phases.length === phases.length, 'Incomplete acceptance phase budgets');
        for (const [index, phase] of phases.entries()) {
            const receipt = value.acceptance_phases[index];
            const budget = phase === 'baseline' ? official ? OFFICIAL_VERSION_SEQUENCE_MS : VERSION_SEQUENCE_MS : official ? OFFICIAL_VERSION_EDITOR_EXECUTION_MS : VERSION_EDITOR_EXECUTION_MS;
            assert.equal(receipt?.phase, phase); assert.equal(receipt.status, 'pass'); assert.equal(receipt.budget_ms, budget);
            assert(Number.isFinite(receipt.elapsed_ms) && receipt.elapsed_ms >= 0 && receipt.elapsed_ms <= budget, 'Acceptance phase exceeded its own budget');
        }
    }
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
function officialInputs(sourceEntries: ReadonlyMap<string, Uint8Array>) {
    assert(sourceEntries instanceof Map, 'Immutable source entries are required for official test coverage');
    return Object.fromEntries(['statusline-native', 'statusline-runtime'].map(name => {
        const prefix = 'mods/' + name + '/';
        return [name, Object.fromEntries([...sourceEntries].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), digestBytes(Buffer.from(bytes))]))];
    }));
}
function hostDetails(report: any, commit: string, sha256: string, officialSources: ReturnType<typeof officialInputs>, typesUnavailable: string[]): void {
    assert(HOST_TARGETS.includes(report.target), 'Unexpected host target');
    assert.equal(report.target, report.platform + '-' + report.host);
    assert.equal(report.model_calls, 0);
    const required = Number(report.host.split('.')[2]) >= 289 ? ['statusline-native', 'statusline-runtime'] : ['statusline-native'];
    for (const name of required) {
        const mod = report.mods[name]; assert.equal(mod.validation, 'pass'); assert.equal(mod.official_tests, 'pass');
        verifyOfficialTestBatches(mod.official_test_batches, officialSources[name]!);
        if (name === 'statusline-native') {
            assert.equal(mod.capacity?.status, 'pass'); assert.equal(mod.capacity.cases, NATIVE_CAPACITY_CASES);
            assert.equal(mod.capacity.actual_host, true); assert.equal(mod.capacity.model_calls, 0);
            assert.equal(mod.capacity.original_cases, 197);
            assert.equal(mod.capacity.total_cases, NATIVE_CAPACITY_TOTAL_CASES);
            assert.equal(mod.capacity.additional_cases, NATIVE_CAPACITY_ADDITIONAL_CASES);
            assert.equal(mod.capacity.shared_execution, true);
            assert.match(mod.capacity.baseline_names_sha256, /^[a-f0-9]{64}$/u);
            assert.match(mod.capacity.additional_names_sha256, /^[a-f0-9]{64}$/u);
            assert.equal(mod.capacity.validation?.status, 'pass');
            assert.equal(mod.capacity.validation.timeout_ms, NATIVE_CAPACITY_TIMEOUT_MS);
            assert(Number.isFinite(mod.capacity.validation.elapsed_ms) && mod.capacity.validation.elapsed_ms >= 0 && mod.capacity.validation.elapsed_ms <= NATIVE_CAPACITY_TIMEOUT_MS, 'Invalid capacity validation duration');
            verifyOfficialTestBatches(mod.capacity.execution, nativeCapacitySourceInventory(officialSources[name]!), NATIVE_CAPACITY_TIMEOUT_MS);
            assert.equal(mod.capacity.execution.totals.tests, NATIVE_CAPACITY_TOTAL_CASES, 'Incomplete actual-host capacity execution');
            assert.equal(mod.capacity.test_files, mod.capacity.execution.totals.files, 'Capacity file count differs');
        }
        if (report.host === '2.1.296') { assert.equal(mod.types.status, 'unavailable'); assert(mod.types.reason); typesUnavailable.push(report.target + '/' + name); }
        else { assert.equal(mod.types.status, 'pass'); assert.equal(mod.types.host, report.host); }
    }
    assert.equal(report.installed.status, 'pass'); assert.equal(report.installed.tarball_sha256, sha256);
    assert.equal(report.installed.source.commit, commit);
}
function officialLogs(report: any, root: string): void {
    const readLog = (log: string, sha256: string): Buffer => {
        assert(/^[a-z0-9.-]+\.log$/u.test(log), 'Invalid official log name');
        const logs = join(root, 'logs'), file = join(logs, log);
        assert(!fs.lstatSync(logs).isSymbolicLink() && fs.lstatSync(logs).isDirectory(), 'Linked official log directory');
        const stat = fs.lstatSync(file);
        assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4 * 1024 * 1024, 'Invalid official result log');
        const bytes = fs.readFileSync(file);
        assert.equal(digestBytes(bytes), sha256, 'Official result log changed');
        return bytes;
    };
    for (const mod of Object.values(report.mods ?? {}) as { official_test_batches?: OfficialTestReceipt; capacity?: { execution?: OfficialTestReceipt; validation?: { log: string; log_sha256: string } } }[]) {
        for (const batch of [...mod.official_test_batches?.batches ?? [], ...mod.capacity?.execution?.batches ?? []]) {
            const bytes = readLog(batch.log, batch.log_sha256);
            assert.deepEqual(parseOfficialTestSummary(bytes.toString('utf8'), batch.test_files), {
                tests: batch.tests, files: batch.files, pass: batch.pass, fail: batch.fail, skip: batch.skip,
            }, 'Official result log does not match its receipt');
        }
        if (mod.capacity?.validation) readLog(mod.capacity.validation.log, mod.capacity.validation.log_sha256);
    }
}
export function assessEvidence(reports: any[], commit: string, sha256: string, sourceEntries: ReadonlyMap<string, Uint8Array>) {
    assert.equal(coverageVersionInArchive(sourceEntries), 1, 'Activated source requires physical evidence');
    const officialSources = officialInputs(sourceEntries);
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
            assert.equal(Object.keys(report.checks).length, compareVersions(VERSION, '3.15.0') >= 0 ? 27 : 26); assert(Object.values(report.checks).every(value => value === true));
            validateInstalledDetails(report, LANGUAGES, compareVersions(VERSION,'3.10.0')>=0);
            assert.equal(report.checks.version_management, true); versionSequence(report.version_management, false);
            if (compareVersions(VERSION, '3.15.0') >= 0) {
                assert.equal(report.checks.i18n_workflow, true);
                assert.deepEqual(report.i18n_workflow, { languages: LANGUAGES, combinations: LANGUAGES.length ** 2, effective_resources: true, readonly_preview: true, save_reopen: true, installed_modules: true, model_calls: 0 });
            }
        } else {
            hostDetails(report, commit, sha256, officialSources, typesUnavailable);
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
        if (entry.isDirectory()) return evidenceFiles(path);
        assert.notEqual(entry.name,'fragment.json','Physical receipts cannot be accepted as v1 evidence');
        if (!['installed.json', 'mods.json', 'runtime.json'].includes(entry.name)) return [];
        const report = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (entry.name === 'mods.json') {
            officialLogs(report, root);
        }
        return [report];
    });
}
export interface ReleaseCoverageContext { base: string | null; basis: CoveragePlan['basis']; run_id: number; attempt: number; workflow_sha: string }
function evidenceBytes(path: string, limit: number): Buffer {
    const stat = fs.lstatSync(path); assert(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= limit, 'Invalid evidence file: ' + path);
    const bytes = fs.readFileSync(path); assert.equal(bytes.length,stat.size); return bytes;
}
function physicalPaths(root: string): string[] {
    const found: string[] = []; let visited=0;
    function inspect(prefix: string, depth: number): void {
        assert(depth<=64,'Physical evidence directory nesting exceeds bound');
        for (const entry of fs.readdirSync(join(root,prefix),{withFileTypes:true})) {
            assert(++visited<=100_000,'Physical evidence inventory exceeds bound');
            assert(!entry.isSymbolicLink(), 'Linked evidence is not accepted');
            const path = prefix ? prefix + '/' + entry.name : entry.name;
            if (entry.isDirectory()) inspect(path,depth+1);
            else if (entry.name === 'fragment.json') found.push(path);
            else assert(!['installed.json','runtime.json','mods.json'].includes(entry.name), 'Mixed v1/v2 receipt: ' + path);
        }
    }
    inspect('',0); return found.sort();
}
/** The caller supplies independently established comparison and run provenance.
 * Embedded plan fields never select their own required coverage. */
export function assessEvidenceDirectory(directory: string, commit: string, sha256: string, entries: ReadonlyMap<string, Uint8Array>, context?: ReleaseCoverageContext) {
    const root = resolve(directory); assert(fs.lstatSync(root).isDirectory());
    const version = coverageVersionInArchive(entries);
    assert.equal(coverageVersionAt(commit),version,'Git and archive coverage activation disagree');
    if (version === 1) {
        assert(!context, 'Cannot use a v2 context with historical evidence');
        return assessEvidence(evidenceFiles(root),commit,sha256,entries);
    }
    assert(context && Number.isSafeInteger(context.run_id) && context.run_id > 0 && Number.isSafeInteger(context.attempt) && context.attempt > 0,
        'v2 requires independently verified comparison and original run context');
    assert.match(context.workflow_sha,/^[a-f0-9]{40}$/u);
    const candidate = join(root,'ts06-candidate'); assert(fs.lstatSync(candidate).isDirectory());
    const inputs = JSON.parse(evidenceBytes(join(candidate,'runtime-inputs.json'),1024*1024).toString());
    const plan = verifyCoveragePlan(JSON.parse(evidenceBytes(join(candidate,'coverage-plan.json'),1024*1024).toString()),context.base,commit,inputs,context.basis);
    assert.deepEqual(physicalPaths(root),plan.producers.map(p=>p.receipt).sort(),'Missing, duplicate or unexpected physical receipts');
    const gitInputs = sectionInputsAt(commit), contractPaths = new Set<string>(SECTION_INPUT_PATHS);
    const archived = [...entries.keys()].filter(path=>contractPaths.has(path)||path.startsWith('mods/statusline-native/')||path.startsWith('mods/statusline-runtime/'));
    assert.deepEqual(archived.sort(),[...gitInputs.keys()].sort(),'Archive and Git section inventories differ');
    for (const path of archived) assert(Buffer.from(entries.get(path)!).equals(gitInputs.get(path)!),'Archive and Git section inputs differ: '+path);
    const manifest = JSON.parse(Buffer.from(entries.get('package.json')!).toString('utf8'));
    const npm = /^npm@(\d+\.\d+\.\d+)$/u.exec(manifest.packageManager)?.[1]; assert(npm,'Missing source development npm identity');
    const officialSources = officialInputs(entries), unavailable: string[] = [], executables = new Map<string,string>();
    const physical = plan.producers.map(producer => {
        const bytes = evidenceBytes(join(root,producer.receipt),16*1024*1024), fragment: unknown = JSON.parse(bytes.toString('utf8'));
        validateFragmentIdentity(fragment,producer,plan,{...context,tarball_sha256:sha256});
        const id = fragment.identity, key = [id.os,id.process_arch,id.host_arch,id.node].join('/');
        const tools = [id.node_sha256,id.npm,id.npm_sha256].join('/');
        assert(!executables.has(key) || executables.get(key) === tools,'Different executables for the same frozen runner and Node');
        executables.set(key,tools); if (id.node === inputs.development) assert.equal(id.npm,npm,'Development npm differs from original source');
        validateSectionEvidence(fragment,producer,plan,entries);
        if (fragment.report.official) {
            const official = fragment.report.official as any;
            const requiredNames = Number(id.host!.split('.')[2]) >= 289 ? ['statusline-native','statusline-runtime'] : ['statusline-native'];
            for (const name of requiredNames) {
                const mod = official.mods[name];
                verifyOfficialTestBatches(mod.official_test_batches,officialSources[name]!);
                // The frozen section verifier already reconstructed this inventory
                // using the original languages, independent of this reader's release.
                if (name==='statusline-native') verifyOfficialTestBatches(mod.capacity.execution,mod.capacity.execution.source_files,300_000);
                if (id.host==='2.1.296') unavailable.push(official.target+'/'+name);
            }
            verifySectionLogBytes(join(root,producer.artifact),fragment.report,(output,batch) => {
                assert.deepEqual(parseOfficialTestSummary(output,batch.test_files),{tests:batch.tests,files:batch.files,pass:batch.pass,fail:batch.fail,skip:batch.skip},'Official log differs from physical receipt');
            });
        }
        return {producer_id:id.producer_id,artifact:producer.artifact,stage:id.stage,depth:id.depth,obligations:id.obligations,
            run_id:id.run_id,attempt:id.attempt,job:id.job,job_key:id.job_key,receipt_sha256:digestBytes(bytes)};
    });
    return {status:'pass',commit,tarball_sha256:sha256,installations:plan.obligations.filter(r=>r.kind==='installed').length,
        runtime_installations:plan.obligations.filter(r=>r.kind==='runtime').length,hosts:plan.obligations.filter(r=>r.kind==='host').length,
        type_declarations_unavailable:unavailable,public_release:false,coverage_version:2,history_coverage:historyCounts(plan.obligations),physical_producers:physical};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, evidence: { type: 'string' }, report: { type: 'string' }, preview: { type: 'boolean' }, stable: { type: 'boolean' }, candidate: { type: 'boolean' },
        'coverage-basis':{type:'string'},'coverage-base':{type:'string'},'coverage-run-id':{type:'string'},'coverage-attempt':{type:'string'},'coverage-workflow-sha':{type:'string'} } });
    if (!values.artifact || !values.commit || !values.evidence || !values.report) throw new Error('Require --artifact TGZ --commit FULL_SHA --evidence DIRECTORY --report NEW_FILE');
    assert(!(values.preview && values.stable), 'Choose preview or stable readiness');
    assert(!(values.candidate && (values.preview || values.stable)), 'Candidate acceptance and publication are separate modes');
    const candidate = verifyDelivery(resolve(values.artifact), values.commit);
    verifyLanguageEvidence(candidate.language, candidate.sourceEntries, values.commit, values.preview === true || values.stable === true);
    const basis = values['coverage-basis'];
    if (Object.keys(values).some(key=>key.startsWith('coverage-'))) assert(basis && ['pull_request','accepted-main','conservative'].includes(basis),'Invalid coverage basis');
    const context = basis ? {basis:basis as CoveragePlan['basis'],base:values['coverage-base'] ?? null,run_id:Number(values['coverage-run-id']),
        attempt:Number(values['coverage-attempt']),workflow_sha:values['coverage-workflow-sha'] ?? ''} : undefined;
    const result = assessEvidenceDirectory(values.evidence, values.commit, candidate.sha256, candidate.sourceEntries, context);
    if (values.preview) assert.equal(candidate.source.channel, 'preview', 'Preview gate requires the public package');
    let approval = null;
    if (values.stable || values.candidate && candidate.source.channel === 'stable') {
        assert.equal(candidate.source.channel, 'stable', 'Stable gate requires the stable public package');
        approval = sourceStableApproval(candidate.sourceEntries, candidate.source.application_version);
    }
    const ready = candidate.language?.report.release_ready ?? true;
    const report = { ...result, ...(candidate.language ? { language: candidate.language } : {}), application_version: candidate.source.application_version, channel: candidate.source.channel ?? 'candidate',
        preview_ready: (values.preview === true || values.candidate === true && candidate.source.channel === 'preview') && ready,
        stable_ready: (values.stable === true || values.candidate === true) && approval !== null && ready,
        unverified_gates: UNVERIFIED_GATES, maintainer_approval: approval,
        deferred_to_stable: approval !== null ? [] : UNVERIFIED_GATES };
    fs.writeFileSync(resolve(values.report), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
}
