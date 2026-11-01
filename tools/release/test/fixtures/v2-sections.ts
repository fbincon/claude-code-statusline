import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { VERSION } from '@fbincon/statusline-core/release';
import { HISTORICAL_RELEASES } from '../../../acceptance/historical-releases.js';
import { sha256 } from '../../../build/files.js';
import { SECTION_CHECKS, SECTION_INPUT_PATHS } from '../../../checks/ci-section-evidence.js';
import type { CoveragePlan, CoverageProducer } from '../../../checks/ci-coverage.js';
import type { PhysicalIdentity } from '../../../checks/ci-fragment.js';
import { repoRoot } from '../../../migration/ts-03/common.js';
import { receipts, transitions, sourceEntries, officialReceipt, capacityLog, capacityValidationLog, officialLog, schema } from './acceptance.js';

const base = receipts(), hash = (value: string) => sha256(value), prior = HISTORICAL_RELEASES['3.8.0'];
const scenario = 'changed host kinds and choices are refused per row while independent rows apply';
function stabilityLog(ms: number) {
    return 'tests/integration/advanced.test.ts:\n(pass) '+scenario+' ['+ms+'ms]\n\n1 pass\n0 fail\nRan 1 test across 1 file. [1s]\n';
}
export function sectionFixtureEntries(): Map<string, Buffer> {
    const rows = new Map<string,Buffer>(sourceEntries);
    for (const path of [...SECTION_INPUT_PATHS,'package.json','.node-version']) rows.set(path,readFileSync(join(repoRoot,path)));
    return rows;
}
export function sectionFixtureReport(producer: CoverageProducer, plan: CoveragePlan, entries: ReadonlyMap<string, Uint8Array>, id: PhysicalIdentity): Record<string, any> {
    const target = plan.obligations.find(row=>row.id===producer.obligations[0])!.target;
    const observed = structuredClone(base.find(row=>row.target===target));
    const out: Record<string,any> = {status:'pass'}, stage=producer.stage;
    const mods = !id.host ? [] : Number(id.host.split('.')[2]) >= 289 ? ['statusline-native','statusline-runtime'] : ['statusline-native'];
    if (!id.host && (stage==='complete' || stage==='installed')) {
        delete observed.i18n_workflow; delete observed.version_management;
        Object.assign(observed,{commit:id.commit,tarball_sha256:id.tarball_sha256,checks:Object.fromEntries(SECTION_CHECKS.map(name=>[name,true]))});
        out.installation=observed;
        out.source_tests={status:'pass',suite:producer.job_key==='installed'?'complete-platform-suite':'product-runtime-suite',
            commit:id.commit,node:id.node,node_sha256:id.node_sha256,platform:id.platform,arch:id.process_arch,run_id:id.run_id,attempt:id.attempt,
            job_key:id.job_key,runner_sha256:sha256(Buffer.from(entries.get('tools/typescript/test.mjs')!)),isolated_passed:true,serial_passed:true};
    }
    if (!id.host && (stage==='complete'||stage==='language')) out.language={
        workflow:{languages:LANGUAGES,combinations:LANGUAGES.length**2,effective_resources:true,readonly_preview:true,save_reopen:true,installed_modules:true,model_calls:0},
        pairs:LANGUAGES.flatMap(ui=>LANGUAGES.map(output=>({ui_language:ui,output_language:output,reopened_ui:ui,reopened_output:output,preview_sample:true,readonly_preview:true,render_sha256:hash(output)})))};
    if (stage==='complete'||stage==='history') {
        if(producer.depth==='full'){
            const sequence=transitions(!!id.host);
            for(const row of [sequence,sequence.previous_release])Object.assign(row,{host:id.host??'version-only-2.1.258',registry:'controlled-loopback'});
            out.history={depth:'full',sequence};
        }else {
            const entry='node_modules/@fbincon/statusline-cli/dist/src/entry.js', display=hash('historical-display'), profiles=hash('profiles');
            out.history={depth:'short',historical_version:'3.8.0',historical_sha256:prior,target_version:VERSION,host:id.host,registry:'controlled-loopback',
                real_npm:true,lifecycle_scripts:false,model_calls:0,observations:['historical','upgrade','rollback'].map(phase=>{
                    const current=phase==='upgrade';
                    return {phase,exit_code:0,package_version:current?VERSION:'3.8.0',backend_version:current?VERSION:'3.8.0',archive_sha256:current?id.tarball_sha256:prior,
                        entry,bound_entry:entry,bound_executable_sha256:id.node_sha256,display_schema:current?schema:13,display_sha256:current&&schema>13?hash('migrated-display'):display,
                        profiles_sha256:profiles,third_party_keep:'unchanged',elapsed_ms:1,bindings:mods.map(mod=>({mod,executable_sha256:id.node_sha256,entry}))};
                }),schema_restore:schema>13?{from:13,to:schema,refusal_exit_code:2,refusal_reason:'configuration-schema',retained_version:VERSION,restore_exit_code:0,display_sha256:display,profiles_sha256:profiles}:null,
                explicit_disable:{reinstall_exit_code:0,native_preference:false,runtime_preference:false,enabled_managed_mods:[],third_party_keep:'unchanged'}};
        }
    }
    if (id.host) {
        const o=observed;delete o.package_management; Object.assign(o,{commit:id.commit,tarball_sha256:id.tarball_sha256});
        for(const mod of Object.keys(o.mods)) {
            if (!mods.includes(mod)) {o.mods[mod]={status:'unsupported',reason:'Requires 2.1.289+'};continue;}
            o.mods[mod].official_test_batches=officialReceipt(mod,false,entries);
            for (const batch of o.mods[mod].official_test_batches.batches) batch.log=mod+'-'+batch.log;
            if(mod==='statusline-native')o.mods[mod].capacity.execution=officialReceipt(mod,true,entries);
            else delete o.mods[mod].capacity;
        }
        o.installed={status:'pass',source:{commit:id.commit},tarball_sha256:id.tarball_sha256,result:{host_version:id.host.split('.').map(Number),installed_mods:mods,
            idempotent:true,bindings:true,native_protocol_save:true,user_disabled_preserved:true,removed_owned_only:true,pending:0,model_calls:0}};
        out.official=o;
        if(id.platform==='win32'&&['2.1.289','2.1.294'].includes(id.host))out.stability={status:'pass',scenario,source_sha256:sha256(Buffer.from(entries.get('mods/statusline-native/tests/integration/advanced.test.ts')!)),
            selected_sha256:'cfb8a91b5879a251db987a166b9fc7040de8b25f92e7904ce2697b0a13e44e77',original_deadline_ms:20_000,host:id.host+' (Claude Code)',
            samples:Array.from({length:10},(_,i)=>({round:i+1,elapsed_ms:5,test_ms:1,deadline_margin_ms:19_999,status:0,log:'round-'+(i+1)+'.log',log_sha256:sha256(stabilityLog(1))}))};
    }
    return out;
}
export function writeSectionLogs(directory: string, report: Record<string,any>): void {
    if(!report.official)return;
    const logs=join(directory,'logs');mkdirSync(logs,{recursive:true});
    for(const m of Object.values(report.official.mods) as any[]){
        for(const b of m.official_test_batches?.batches??[])writeFileSync(join(logs,b.log),officialLog.replace('tests/fixture.test.ts',b.test_files[0]));
        if(m.capacity) {
            for(const b of m.capacity.execution.batches)writeFileSync(join(logs,b.log),capacityLog(b.test_files[0],b.tests));
            writeFileSync(join(logs,m.capacity.validation.log),capacityValidationLog);
        }
    }
    if(report.stability) {
        const dir=join(directory,'native-stability-logs');mkdirSync(dir,{recursive:true});
        for(const sample of report.stability.samples)writeFileSync(join(dir,sample.log),stabilityLog(sample.test_ms));
    }
}
