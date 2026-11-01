/** Executable by an accepted first parent with only Node and immutable source blobs. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoveragePlan } from './ci-coverage.ts';
import type { PhysicalFragment, PhysicalIdentity } from './ci-fragment.ts';

type Producer = CoveragePlan['producers'][number];
type Entries = ReadonlyMap<string, Uint8Array>;
const HASH = /^[a-f0-9]{64}$/u;
const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const SECTION_INPUT_PATHS = ['packages/core/src/release.ts', 'packages/core/src/config/display.ts', 'packages/core/src/i18n/registry.ts',
    'mods/statusline-native/tests/integration/advanced.test.ts', 'tools/typescript/test.mjs'] as const;
const [releasePath, displayPath, languagePath, stabilityPath, runnerPath] = SECTION_INPUT_PATHS;
export function sectionInputsAt(commit: string): ReadonlyMap<string, Uint8Array> {
    assert.match(commit, /^[a-f0-9]{40}$/u);
    const inventory = execFileSync('git',['--no-replace-objects','ls-tree','-rz',commit,'--',...SECTION_INPUT_PATHS,'mods/statusline-native','mods/statusline-runtime'],
        {encoding:'utf8',maxBuffer:4*1024*1024}).split('\0').filter(Boolean).map(row=>{
        const match=/^100(?:644|755) blob ([a-f0-9]{40})\t(.+)$/u.exec(row); assert(match,'Unexpected section source object');
        return {oid:match[1]!,path:match[2]!};
    });
    const data=execFileSync('git',['--no-replace-objects','cat-file','--batch'],{input:inventory.map(r=>r.oid+'\n').join(''),maxBuffer:64*1024*1024});
    let at=0;
    const result=new Map<string,Uint8Array>();
    for(const {oid,path} of inventory) {
        const end=data.indexOf(10,at); assert(end>at);
        const [object,type,length]=data.subarray(at,end).toString().split(' ');
        assert.equal(object,oid);assert.equal(type,'blob');const size=Number(length);assert(Number.isSafeInteger(size)&&size>=0);
        at=end+1;result.set(path,data.subarray(at,at+size));at+=size;assert.equal(data[at++],10);
    }
    assert.equal(at,data.length);for(const path of SECTION_INPUT_PATHS)assert(result.has(path),'Missing section source '+path);
    return result;
}
export const SECTION_CHECKS = ['package','modules','rendering','entry','relocation','shell','native_protocol','external_editor','recovery',
    'python_upgrade','setup','extensions','indicators','groups','automatic_refresh','cost_rates','git_policy','terminal_colors','first_entry',
    'selective_import','gradients','alignments','task_viewer','appearance_scenarios','draft_reuse'] as const;
// These immutable registry archives identify the two supported historical journeys.
const old370 = 'b1afec4a234368ab0ef2e23f728b8204122c86e17213af32738b6f3d84363e95';
const old380 = 'c11ebea864a0d472c779f87401fe2e96bfcd3d16120db0cf2661d50fd6339dbc';
const packageEntry = 'node_modules/@fbincon/statusline-cli/dist/src/entry.js';
// Original 20s Windows test and imports, retained on .289/.294. Changing
// this exact historical regression requires an explicit coverage-policy review.
const stabilitySelection = 'cfb8a91b5879a251db987a166b9fc7040de8b25f92e7904ce2697b0a13e44e77';
function bytes(entries: Entries, path: string): Uint8Array {
    const value = entries.get(path); assert(value, 'Missing section source ' + path); return value;
}
function captured(entries: Entries, path: string, pattern: RegExp): string {
    const matches = [...Buffer.from(bytes(entries, path)).toString('utf8').matchAll(pattern)];
    assert.equal(matches.length, 1, 'Expected unique literal in ' + path); return matches[0]![1]!;
}
export function sourceContract(entries: Entries) {
    const version = captured(entries, releasePath, /^export const VERSION = '([0-9]+\.[0-9]+\.[0-9]+(?:-[\w.-]+)?)';$/gmu);
    const schema = Number(captured(entries, displayPath, /^export const SCHEMA_VERSION = (\d+);$/gmu));
    const languages: string[] = JSON.parse(captured(entries, languagePath, /^export const LANGUAGES = (\[.*\]) as const;$/gmu));
    assert(Number.isSafeInteger(schema) && schema >= 13 && Array.isArray(languages) && languages.length > 0 &&
        languages.every(name => typeof name === 'string' && name.length) && new Set(languages).size === languages.length);
    return { version, schema, languages };
}
type Contract = ReturnType<typeof sourceContract>;
const capacityCount = (languages: number) => 197 + 56 + 5 * languages;
export function sourceCapacityCount(entries: Entries): number { return capacityCount(sourceContract(entries).languages.length); }
const required = (value: any, keys: readonly string[]) => { for (const key of keys) assert.equal(value?.[key], true, 'Missing completed assertion ' + key); };
function exactKeys(value: any, keys: readonly string[]) {
    assert(value && typeof value === 'object' && !Array.isArray(value));
    assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Unexpected section inventory');
}
function timings(rows: any, count: number, exact = false) {
    assert(Array.isArray(rows) && (exact ? rows.length === count : rows.length >= count), 'Incomplete historical operation timings');
    for (const row of rows) assert(typeof row.command === 'string' && row.command.length && Number.isFinite(row.elapsed_ms) && row.elapsed_ms >= 0);
}
function fullHistory(value: any, identity: PhysicalIdentity, source: Contract, previous = false): void {
    assert.equal(value.cases, 7); assert.equal(value.historical_version, previous ? '3.8.0' : '3.7.0');
    assert.equal(value.historical_sha256, previous ? old380 : old370); assert.equal(value.target_version, source.version);
    assert.equal(value.host_mode, identity.host ? 'official' : 'version-only'); assert.equal(value.host, identity.host ?? 'version-only-2.1.258');
    assert.equal(value.model_calls, 0); assert.equal(value.registry, 'controlled-loopback');
    required(value, ['roundtrip','independent_runner','crash_recovery','configuration_restore','real_npm']);
    const phases = previous ? ['baseline','editor_execution'] : ['baseline'];
    assert.deepEqual(value.acceptance_phases.map((r: any) => r.phase), phases);
    for (const r of value.acceptance_phases) {
        assert.equal(r.budget_ms, identity.host ? 1_200_000 : 900_000); assert.equal(r.status, 'pass');
        assert(Number.isFinite(r.elapsed_ms) && r.elapsed_ms >= 0 && r.elapsed_ms <= r.budget_ms);
    }
    const schema = source.schema;
    assert.deepEqual(value.schema_migration, schema > 13 ? { from: 13, to: schema, old_version_refused: true, backup_restored: true } : null);
    timings(value.operation_timings, (identity.host ? 20 : 19) + (schema > 13 ? 3 : 0), true);
    required(value.editor_review, ['local_reads_no_network','metadata_unverified','verified_dry_run','rollback_review','restore_review','cancellation','configuration_unchanged','package_unchanged']);
    timings(value.editor_review.operation_timings, 15);
    if (!previous) { fullHistory(value.previous_release, identity, source, true); return; }
    assert(!value.previous_release);
    required(value.editor_execution,['verified_execution','retained_control','downgrade_roundtrip','old_protocol_rejected','detach_continues','progress_complete',
        'package_recovery','separate_configuration_restore','protected_cleanup','configuration_preserved','real_npm']);
    assert.equal(value.editor_execution.model_calls, 0); timings(value.editor_execution.operation_timings, 30);
}
function modsFor(host: string | null): string[] {
    return host === null ? [] : Number(host.split('.')[2]) < 289 ? ['statusline-native'] : ['statusline-native','statusline-runtime'];
}
function verifyOfficialInventory(receipt: any, original: Record<string,string>, capacity: number | null) {
    const ordered=(rows: Record<string,string>)=>Object.fromEntries(Object.keys(rows).sort().map(path=>[path,rows[path]!]));
    const isTest=(path:string)=>/\.test\.[cm]?[jt]sx?$/u.test(path);
    let files=original;
    if(capacity!==null) {
        files=Object.fromEntries(Object.entries(original).filter(([path])=>!path.split('/').some(part=>part==='node_modules'||part==='types') && !(path.startsWith('tests/')&&/\.test\.tsx?$/u.test(path))));
        files['hooks/hooks.json']=digest('{"modules":["../tests/capacity-register.ts"]}\n');
        for(let start=0;start<capacity;start+=50)files['tests/capacity-'+start+'.test.ts']=digest("import {registerCapacityCases} from './integration/capacity-cases.ts';\nregisterCapacityCases("+start+','+Math.min(start+50,capacity)+');\n');
    }
    const paths=Object.keys(files).filter(isTest).sort(), limit=capacity===null?180_000:300_000;
    assert(paths.length>0);assert.deepEqual(receipt.source_files,files);assert.deepEqual(receipt.test_files,paths);
    assert.equal(receipt.status,'pass');assert.equal(receipt.timeout_ms,limit);assert.equal(receipt.source_sha256,digest(JSON.stringify(ordered(files))));
    assert.equal(receipt.host_sha256,digest(JSON.stringify(ordered(receipt.host_files))));
    assert.equal(receipt.batches.length,paths.length);
    for(const [i,path] of paths.entries()) {
        const b=receipt.batches[i]; assert.equal(b.index,i);assert.deepEqual(b.test_files,[path]);assert.deepEqual(b.test_hashes,{[path]:files[path]});
        assert.equal(b.host_sha256,receipt.host_sha256);assert.equal(b.timeout_ms,limit);assert(Number.isFinite(b.elapsed_ms)&&b.elapsed_ms>=0&&b.elapsed_ms<=limit);
        const selected=Object.fromEntries(Object.entries(files).filter(([name])=>!isTest(name)||name===path));
        assert.equal(b.copied_source_sha256,digest(JSON.stringify(ordered(selected))));
        if(capacity!==null) {
            const start=Number(/^tests\/capacity-(\d+)\.test\.ts$/u.exec(path)![1]);
            assert.equal(b.tests,Math.min(50,capacity-start));
        }
    }
}
function shortHistory(h: any, identity: PhysicalIdentity, source: Contract): void {
    exactKeys(h, ['depth','historical_version','historical_sha256','target_version','host','registry','real_npm','lifecycle_scripts','model_calls','observations','schema_restore','explicit_disable']);
    assert.equal(h.historical_version, '3.8.0'); assert.equal(h.historical_sha256, old380); assert.equal(h.target_version, source.version);
    assert.equal(h.host, identity.host); assert.equal(h.registry, 'controlled-loopback'); assert.equal(h.real_npm, true);
    assert.equal(h.lifecycle_scripts, false); assert.equal(h.model_calls, 0);
    assert.deepEqual(h.observations.map((r: any) => r.phase), ['historical','upgrade','rollback']);
    const [before, upgraded, rolledBack] = h.observations;
    for (const row of h.observations) {
        const current = row.phase === 'upgrade';
        assert.equal(row.exit_code, 0); assert.equal(row.package_version, current ? source.version : '3.8.0');
        assert.equal(row.backend_version, row.package_version); assert.equal(row.archive_sha256, current ? identity.tarball_sha256 : old380);
        assert.equal(row.entry, packageEntry); assert.equal(row.bound_entry, row.entry); assert.equal(row.bound_executable_sha256,identity.node_sha256);
        assert.equal(row.display_schema, current ? source.schema : 13); assert.match(row.display_sha256, HASH);
        assert.match(row.profiles_sha256, HASH); assert.equal(row.profiles_sha256, before.profiles_sha256);
        assert.equal(row.third_party_keep, 'unchanged');
        assert.deepEqual(row.bindings, modsFor(identity.host).map(mod => ({ mod, executable_sha256: identity.node_sha256, entry: packageEntry })));
        assert(Number.isFinite(row.elapsed_ms) && row.elapsed_ms >= 0 && row.elapsed_ms <= 360_000);
    }
    assert.equal(rolledBack.display_sha256, before.display_sha256);
    if (source.schema > 13) {
        assert.notEqual(upgraded.display_sha256, before.display_sha256);
        assert.deepEqual(h.schema_restore, { from:13, to:source.schema, refusal_exit_code:2, refusal_reason:'configuration-schema',
            retained_version:source.version, restore_exit_code:0, display_sha256:before.display_sha256, profiles_sha256:before.profiles_sha256 });
    } else { assert.equal(h.schema_restore, null); assert.equal(upgraded.display_sha256, before.display_sha256); }
    assert.deepEqual(h.explicit_disable, { reinstall_exit_code:0, native_preference:false, runtime_preference:false,
        enabled_managed_mods:[], third_party_keep:'unchanged' });
}
export function validateInstalledDetails(report: any, languages: readonly string[], appearancePreview: boolean): void {
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
    assert(report.source_operations&&typeof report.source_operations==='object');
    for(const key of ['separate_approval','interval_300','ttl_independent','non_git','manual_consumer_preserved','last_success_after_failure','execution_summary','bindings_reused','drafts_protected','reviewed_cleanup','settings_unchanged'])assert.equal(report.source_operations[key],true);assert.equal(report.source_operations.model_calls,0);
    assert.equal(report.checks.appearance_scenarios,true);
    assert.deepEqual(report.appearance_scenarios,{languages:languages,widths:[40,80,120],schemes:['powerline-daily','agent-workbench','quota-cost','narrow-terminal','light-readable'],semantic_fitting:true,scenario_previews:true,round_trip:true,save_reopen:true,installed_modules:true,model_calls:0});
    assert.equal(report.checks.draft_reuse,true);
    assert.deepEqual(report.draft_reuse,{languages:languages,widths:[40,80,120],history:true,atomic_repairs:true,style_fields:true,group_closure:true,unbound_sources:true,conflict_retry:true,unknown_reconciliation:true,save_reopen:true,installed_modules:true,model_calls:0});
    assert.equal(report.checks.selective_import, true); assert.equal(report.selective_import_cases, 4);
    assert.equal(report.checks.gradients, true); assert.equal(report.gradient_cases, 6);
    if(appearancePreview)assert.deepEqual(report.appearance_preview_diagnosis,{theme:'ocean',gradient:'glacier',scenarios:6,readonly_file:true,input_only:true,unsaved_draft:true});
    assert.equal(report.checks.task_viewer,true);assert.deepEqual(report.task_viewer,{languages:languages.length,views:languages.length*3,standalone_non_tty:true,readonly:true,installed_modules:true});
    assert.equal(report.checks.alignments, true); assert.equal(report.alignment_cases, 4);
    assert.deepEqual(report.alignment_matrix, {languages:languages,widths:[40,80,120],cases:languages.length*3,installed_modules:true,saved_reopened:true,preview_matches:true});
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
}
export function validateSectionEvidence(fragment: PhysicalFragment, producer: Producer, plan: CoveragePlan, entries: Entries): void {
    const r: Record<string, any> = fragment.report, id = fragment.identity, contract = sourceContract(entries);
    const obligations = plan.obligations.filter(row => producer.obligations.includes(row.id));
    assert(obligations.length && obligations.length === producer.obligations.length);
    const host = producer.host !== null, stage = producer.stage;
    const stable = producer.os === 'windows-2025' && ['2.1.289','2.1.294'].includes(producer.host ?? '');
    const keys = host ? ['official','history', ...(stable ? ['stability'] : [])] :
        stage === 'complete' ? ['installation','source_tests','language','history'] : stage === 'installed' ? ['installation','source_tests'] : [stage];
    exactKeys(r, ['status', ...keys]); assert.equal(r.status, 'pass');
    // Sections may retain original worker metadata. It must agree with the
    // physical actor; a wrapper cannot relabel another attempt or candidate.
    for (const observed of [r.installation,r.official].filter(Boolean)) {
        assert(!observed.diagnostic_only && observed.promotable!==false);
        for (const [name,expected] of Object.entries({status:'pass',commit:id.commit,tarball_sha256:id.tarball_sha256,
            platform:id.platform,process_arch:id.process_arch,node_sha256:id.node_sha256,host:id.host,host_sha256:id.host_sha256}))
            if (Object.hasOwn(observed,name)) assert.equal(observed[name],expected,'Contradictory section '+name);
        if ('node' in observed) assert.equal(observed.node,'v'+id.node);
        if ('execution' in observed) {
            assert.equal(Number(observed.execution.run_id),id.run_id); assert.equal(Number(observed.execution.attempt),id.attempt);
            assert.equal(observed.execution.job,id.job_key);
        }
    }
    if (keys.includes('installation')) {
        const a = r.installation;
        assert.equal(a.target, obligations[0]!.target); assert(!('i18n_workflow' in a || 'version_management' in a || 'diagnostic_only' in a));
        exactKeys(a.checks, SECTION_CHECKS); required(a.checks, SECTION_CHECKS);
        validateInstalledDetails(a,contract.languages,true);
        const source = r.source_tests, suite = obligations.some(row => row.kind === 'installed') ? 'complete-platform-suite' : 'product-runtime-suite';
        assert.deepEqual(source, {status:'pass',suite,commit:id.commit,node:id.node,node_sha256:id.node_sha256,platform:id.platform,arch:id.process_arch,
            run_id:id.run_id,attempt:id.attempt,job_key:id.job_key,runner_sha256:digest(bytes(entries,runnerPath)),isolated_passed:true,serial_passed:true});
    }
    if (keys.includes('language')) {
        const l = r.language, languages = contract.languages;
        assert.deepEqual(l.workflow, {languages,combinations:languages.length ** 2,effective_resources:true,readonly_preview:true,save_reopen:true,installed_modules:true,model_calls:0});
        assert.deepEqual(l.pairs.map((p: any) => [p.ui_language,p.output_language]), languages.flatMap(ui => languages.map(output => [ui,output])));
        const rendered = new Map<string,string>();
        for (const pair of l.pairs) {
            required(pair, ['preview_sample','readonly_preview']); assert.equal(pair.reopened_ui,pair.ui_language); assert.equal(pair.reopened_output,pair.output_language);
            assert.match(pair.render_sha256,HASH);
            if (rendered.has(pair.output_language)) assert.equal(rendered.get(pair.output_language),pair.render_sha256);
            else rendered.set(pair.output_language,pair.render_sha256);
        }
    }
    if (keys.includes('history')) {
        assert.equal(r.history.depth, producer.depth, 'Wrong observed history depth');
        if (producer.depth === 'full') { exactKeys(r.history, ['depth','sequence']); fullHistory(r.history.sequence,id,contract); }
        else shortHistory(r.history,id,contract);
    }
    if (host) {
        const o = r.official, mods = modsFor(producer.host);
        assert.equal(o.target,obligations[0]!.target); assert.equal(o.host,id.host); assert.equal(o.platform,id.platform);
        assert.equal(o.model_calls,0); assert(!('package_management' in o));
        assert.equal(o.installed.status,'pass'); assert.equal(o.installed.tarball_sha256,id.tarball_sha256); assert.equal(o.installed.source.commit,id.commit);
        assert.deepEqual(o.installed.result.host_version, producer.host!.split('.').map(Number));
        assert.deepEqual(o.installed.result.installed_mods, mods); assert.equal(o.installed.result.pending,0); assert.equal(o.installed.result.model_calls,0);
        exactKeys(o.mods,['statusline-native','statusline-runtime']);
        required(o.installed.result,['idempotent','bindings','native_protocol_save','user_disabled_preserved','removed_owned_only']);
        for (const mod of mods) {
            const m = o.mods[mod]; assert.equal(m.validation,'pass'); assert.equal(m.official_tests,'pass');
            const prefix='mods/'+mod+'/', files=Object.fromEntries([...entries].filter(([name])=>name.startsWith(prefix)).map(([name,raw])=>[name.slice(prefix.length),digest(raw)]));
            verifyOfficialInventory(m.official_test_batches,files,null);
            if(mod==='statusline-native')verifyOfficialInventory(m.capacity.execution,files,capacityCount(contract.languages.length));
            assert.equal(m.official_test_batches.status,'pass'); assert(m.official_test_batches.totals.tests > 0);
            assert.equal(m.official_test_batches.totals.tests,m.official_test_batches.totals.pass); assert.equal(m.official_test_batches.totals.fail,0); assert.equal(m.official_test_batches.totals.skip,0);
            if (id.host === '2.1.296') { assert.equal(m.types.status,'unavailable'); assert(m.types.reason); }
            else { assert.equal(m.types.status,'pass'); assert.equal(m.types.host,id.host); }
        }
        if (!mods.includes('statusline-runtime')) {
            const unsupported = o.mods['statusline-runtime'];
            exactKeys(unsupported,['status','reason']); assert.equal(unsupported.status,'unsupported');
            assert(typeof unsupported.reason==='string' && unsupported.reason.length>0);
        }
        const c = o.mods['statusline-native'].capacity;
        assert.equal(c.status,'pass'); required(c,['actual_host','shared_execution']); assert.equal(c.model_calls,0);
        assert.match(c.baseline_names_sha256,HASH); assert.match(c.additional_names_sha256,HASH);
        assert.equal(c.validation.status,'pass'); assert.equal(c.validation.timeout_ms,300_000);
        assert(Number.isFinite(c.validation.elapsed_ms)&&c.validation.elapsed_ms>=0&&c.validation.elapsed_ms<=300_000);
        assert.equal(c.test_files,c.execution.batches.length);
        assert.equal(c.original_cases,197); assert.equal(c.cases,197); assert.equal(c.additional_cases,capacityCount(contract.languages.length)-197);
        assert.equal(c.total_cases,capacityCount(contract.languages.length)); assert.equal(c.execution.totals.tests,c.total_cases); assert.equal(c.execution.totals.pass,c.total_cases);
    }
    if (stable) {
        const s = r.stability; assert.equal(s.status,'pass'); assert.equal(s.host.split(' ')[0],id.host); assert.equal(s.original_deadline_ms,20_000);
        assert.equal(s.source_sha256,digest(bytes(entries,stabilityPath))); assert.equal(s.selected_sha256,stabilitySelection);
        assert.equal(s.scenario,'changed host kinds and choices are refused per row while independent rows apply');
        assert.deepEqual(s.samples.map((x:any)=>x.round),Array.from({length:10},(_,i)=>i+1));
        for (const x of s.samples) {
            assert.equal(x.status,0); assert(Number.isFinite(x.test_ms)&&x.test_ms>=0&&x.test_ms<=20_000);assert(Number.isFinite(x.elapsed_ms)&&x.elapsed_ms>=x.test_ms);
            assert.equal(x.deadline_margin_ms,20_000-x.test_ms);assert.equal(x.log,'round-'+x.round+'.log'); assert.match(x.log_sha256,HASH);
        }
    }
}
/** Resolve only bounded regular files directly below a known log directory. A
 * compiled release checker may additionally parse the complete official format. */
export function verifySectionLogBytes(directory: string, report: Record<string, any>,
    checkBatch?: (output: string, batch: any) => void): void {
    if (!report.official) return;
    assert(lstatSync(directory).isDirectory());
    function read(subdir: string, name: string, expected: string): string {
        assert(/^[a-z0-9.-]+\.log$/u.test(name) && lstatSync(join(directory,subdir)).isDirectory(), 'Invalid physical log location');
        const file=join(directory,subdir,name),stat=lstatSync(file);
        assert(stat.isFile() && stat.size > 0 && stat.size <= 4*1024*1024,'Invalid physical log');
        const raw=readFileSync(file); assert.equal(raw.length,stat.size); assert.equal(digest(raw),expected,'Physical log bytes changed');
        return raw.toString('utf8');
    }
    for (const mod of Object.values(report.official.mods) as any[]) {
        for (const receipt of [mod.official_test_batches,mod.capacity?.execution].filter(Boolean)) {
            assert(Array.isArray(receipt.batches) && receipt.batches.length>0);
            let tests=0;
            for (const batch of receipt.batches) {
                const output=read('logs',batch.log,batch.log_sha256), text=output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu,'').replaceAll('\\','/');
                assert.deepEqual([...text.matchAll(/^([^\r\n]+\.test\.[cm]?[jt]sx?):\s*$/gmu)].map(m=>m[1]!.replace(/^\.\//u,'')),batch.test_files);
                assert.equal(batch.test_files.length,1); assert.equal(batch.files,1); assert.equal(batch.fail,0);assert.equal(batch.skip,0);
                assert.equal(batch.tests,batch.pass);assert(Number.isSafeInteger(batch.tests)&&batch.tests>0);
                assert.equal([...text.matchAll(/^\(pass\) /gmu)].length,batch.tests);
                assert.deepEqual([...text.matchAll(/^\s*(\d+) pass\s*$/gmu)].map(m=>Number(m[1])),[batch.tests]);
                assert.deepEqual([...text.matchAll(/^\s*(\d+) fail\s*$/gmu)].map(m=>Number(m[1])),[0]);
                assert(!/^\s*\((?:fail|skip|todo)\)|^\s*[1-9]\d* (?:skip|error|todo)/mu.test(text));
                assert.deepEqual([...text.matchAll(/^Ran (\d+) tests? across (\d+) files?\.\s*\[[^\]\r\n]+\]\s*$/gmu)].map(m=>[Number(m[1]),Number(m[2])]),[[batch.tests,1]]);
                tests+=batch.tests;checkBatch?.(output,batch);
            }
            assert.deepEqual(receipt.totals,{files:receipt.batches.length,tests,pass:tests,fail:0,skip:0});
        }
        if(mod.capacity?.validation)read('logs',mod.capacity.validation.log,mod.capacity.validation.log_sha256);
    }
    if(report.stability)for(const sample of report.stability.samples) {
        const output=read('native-stability-logs',sample.log,sample.log_sha256).replaceAll('\\','/');
        const lines=output.split(/\r?\n/u).filter(line=>line.includes(report.stability.scenario));
        assert.equal(lines.length,1);assert(lines[0]!.startsWith('(pass) '));
        const duration=/\[([\d,.]+)ms\]/u.exec(lines[0]!)?.[1]; assert(duration);assert.equal(Number(duration.replaceAll(',','')),sample.test_ms);
        checkBatch?.(output,{test_files:['tests/integration/advanced.test.ts'],tests:1,files:1,pass:1,fail:0,skip:0});
    }
}
