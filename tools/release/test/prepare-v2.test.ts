import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { createCoveragePlan, historyCounts, COVERAGE_ACTIVATION, COVERAGE_ACTIVATION_PATH } from '../../checks/ci-coverage.js';
import type { PhysicalIdentity } from '../../checks/ci-fragment.js';
import { runtimeInputs } from '../../checks/runtime-inputs.js';
import { assessEvidence, assessEvidenceDirectory } from '../prepare.js';
import { sectionFixtureReport, sectionFixtureEntries, writeSectionLogs } from './fixtures/v2-sections.js';
import { repoRoot } from '../../migration/ts-03/common.js';
const archive = 'b'.repeat(64);
function scenario(t: TestContext) {
    const root=mkdtempSync(join(tmpdir(),'prepare-v2-')),original=process.cwd(),repository=join(root,'repository'),directory=join(root,'evidence');
    t.after(()=>{process.chdir(original);removeTree(root);assert(!existsSync(root));});
    mkdirSync(repository);mkdirSync(directory);
    const git=(...args:string[])=>execFileSync('git',['-C',repository,'-c','user.name=CI Fixture','-c','user.email=fixture@example.invalid','-c','core.autocrlf=false',...args],{encoding:'utf8'}).trim();
    git('init','-q','--initial-branch=main');
    const entries=sectionFixtureEntries();entries.set(COVERAGE_ACTIVATION_PATH,Buffer.from(COVERAGE_ACTIVATION));
    for(const path of ['tools/checks/ci-coverage.ts','tools/checks/runtime-inputs.ts','tools/checks/impact-lock.ts'])entries.set(path,readFileSync(join(repoRoot,path)));
    for(const [path,bytes] of entries){mkdirSync(dirname(join(repository,path)),{recursive:true});writeFileSync(join(repository,path),bytes);}
    git('add','.');git('commit','-qm','initial approved policy');const base=git('rev-parse','HEAD');
    writeFileSync(join(repository,'README.md'),'candidate\n');git('add','.');git('commit','-qm','candidate');const head=git('rev-parse','HEAD');
    process.chdir(repository);
    const inputs=runtimeInputs([{version:'22.23.4'},{version:'24.22.2'}],'24.21.0'),plan=createCoveragePlan(base,head,inputs);
    const context={basis:'pull_request' as const,base,run_id:101,attempt:2,workflow_sha:head};
    const candidate=join(directory,'ts06-candidate');mkdirSync(candidate);
    writeFileSync(join(candidate,'coverage-plan.json'),JSON.stringify(plan));writeFileSync(join(candidate,'runtime-inputs.json'),JSON.stringify(inputs));
    let index=0;
    for(const p of plan.producers) {
        const dir=join(directory,p.artifact);mkdirSync(dir);
        const id:PhysicalIdentity={producer_id:p.id,commit:head,tree:plan.tree,policy_sha256:plan.policy_sha256,tarball_sha256:archive,workflow_sha:head,
            os:p.os,platform:p.os.startsWith('windows')?'win32':p.os.startsWith('macos')?'darwin':'linux',process_arch:p.arch,host_arch:p.host_arch,
            node:p.node,node_sha256:'c'.repeat(64),npm:'11.19.0',npm_sha256:'d'.repeat(64),host:p.host,host_sha256:p.host?'e'.repeat(64):null,
            stage:p.stage,depth:p.depth,obligations:p.obligations,run_id:101,attempt:index++%2+1,job:p.job,job_key:p.job_key};
        const report=sectionFixtureReport(p,plan,entries,id);writeSectionLogs(dir,report);
        writeFileSync(join(directory,p.receipt),JSON.stringify({schema_version:2,kind:'acceptance-fragment',status:'pass',identity:id,report}));
    }
    const assess=(ctx=context)=>assessEvidenceDirectory(directory,head,archive,entries,ctx);
    return {directory,head,plan,context,entries,assess};
}
test('release reads a complete v2 directory with actual F/S history and independent original ARM producers', t=>{
    const {assess,plan,head,entries,directory}=scenario(t);
    const result=assess();assert('physical_producers' in result);assert.equal(result.coverage_version,2);
    assert.deepEqual([result.installations,result.runtime_installations,result.hosts],[8,32,16]);
    assert.deepEqual(result.history_coverage,historyCounts(plan.obligations));assert.equal(result.type_declarations_unavailable.length,6);
    assert.deepEqual(new Set(result.physical_producers.map(p=>p.attempt)),new Set([1,2]));
    const arm=result.physical_producers.filter(p=>p.obligations.includes('windows-11-arm-x64@22.0.0'));
    assert.deepEqual(arm.map(p=>p.stage),['installed','language','history']);
    assert.equal(new Set(arm.map(p=>p.job)).size,3);assert.equal(new Set(arm.map(p=>p.receipt_sha256)).size,3);
    assert.throws(()=>assessEvidenceDirectory(directory,head,archive,entries),/context/);
    assert.throws(()=>assessEvidence([],head,archive,entries),/Activated/);
    const downgraded=new Map(entries);downgraded.delete(COVERAGE_ACTIVATION_PATH);
    assert.throws(()=>assessEvidenceDirectory(directory,head,archive,downgraded),/activation disagree/);
});
test('physical readiness rejects section substitution, incomplete short transitions, wrong actors and stale evidence', t=>{
    const {plan,assess,context,directory}=scenario(t);
    assert.equal(assess().status,'pass');
    const short=plan.producers.find(p=>p.host && p.depth==='short')!;
    const full=plan.producers.find(p=>p.stage==='history'&&p.depth==='full')!;
    const lang=plan.producers.find(p=>p.stage==='language')!;
    const main=plan.producers.find(p=>p.stage==='installed')!;
    const stable=plan.producers.find(p=>p.os==='windows-2025'&&p.host==='2.1.289')!;
    function rejects(p:typeof short,mutate:(v:any)=>void) {
        const path=join(directory,p.receipt),original=readFileSync(path);
        const v=JSON.parse(original.toString());mutate(v);writeFileSync(path,JSON.stringify(v));
        try {assert.throws(()=>assess());} finally {writeFileSync(path,original);}
    }
    rejects(lang,v=>v.report.language.pairs.pop());
    rejects(main,v=>{v.report.history={depth:'full'};});
    rejects(main,v=>{v.report.installation.commit='0'.repeat(40);});
    rejects(main,v=>{v.report.source_tests.suite='product-runtime-suite';});
    rejects(full,v=>{delete v.report.history.sequence.previous_release.editor_execution;});
    rejects(short,v=>{v.report.history.depth='full';});
    rejects(short,v=>{v.report.history.observations[2].package_version=v.report.history.target_version;});
    rejects(short,v=>{v.report.history.observations[1].bindings=[];});
    rejects(short,v=>{v.report.history.observations[2].third_party_keep='lost';});
    rejects(short,v=>{v.report.history.schema_restore.restore_exit_code=2;});
    rejects(short,v=>{v.report.history.explicit_disable.native_preference=true;});
    rejects(short,v=>{v.identity.npm_sha256='a'.repeat(64);});
    rejects(short,v=>{v.identity.attempt=3;});
    rejects(short,v=>{v.report.official.mods['statusline-native'].capacity.total_cases=197;});
    rejects(short,v=>{delete v.report.official.mods['statusline-native'].official_test_batches.source_files['tests/integration/advanced.test.ts'];});
    rejects(stable,v=>{v.report.stability.samples.pop();});
    rejects(stable,v=>{v.report.stability.selected_sha256='a'.repeat(64);});
    const sample=join(directory,stable.artifact,'native-stability-logs/round-1.log'),original=readFileSync(sample);writeFileSync(sample,'changed');assert.throws(()=>assess());writeFileSync(sample,original);
    assert.throws(()=>assess({...context,base:plan.head}));assert.throws(()=>assess({...context,run_id:202}));
    const fragment=join(directory,main.receipt),misplaced=join(directory,lang.artifact,'duplicate','fragment.json');
    mkdirSync(dirname(misplaced));renameSync(fragment,misplaced);assert.throws(()=>assess(),/physical receipts/);renameSync(misplaced,fragment);
    writeFileSync(join(directory,'installed.json'),'{}');assert.throws(()=>assess(),/Mixed/);
});
