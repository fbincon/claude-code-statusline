import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { COVERAGE_ACTIVATION, COVERAGE_ACTIVATION_PATH, createCoveragePlan } from '../ci-coverage.js';
import { digest, validateComplete, verifyRecordedFiles, type CompleteEvidenceV2 } from '../ci-evidence.js';
import { completeSource, verifyExecutionJobs } from '../ci-sources.js';
import { exportBaseVerifiers } from '../ci-trust.js';
import { CI_REPOSITORY } from '../ci-watch.js';
import { sectionFixtureEntries, sectionFixtureReport, writeSectionLogs } from '../../release/test/fixtures/v2-sections.js';
import { fixture as languageFixture } from '../../generation/test/i18n-fixture.js';
import { fixture, now, run as originalRun } from './fixtures/ci-evidence.js';
import { v2Fixture } from './fixtures/ci-evidence-v2.js';

function source(t: TestContext) {
    const original = process.cwd(), root = fs.mkdtempSync(join(tmpdir(), 'physical-evidence-'));
    t.after(() => { process.chdir(original); fs.rmSync(root, { recursive:true, force:true, maxRetries:5,retryDelay:50 }); });
    const write = (path:string, bytes: Uint8Array|string) => { fs.mkdirSync(dirname(join(root,path)),{recursive:true}); fs.writeFileSync(join(root,path),bytes); };
    const git = (...args:string[]) => execFileSync('git',['-C', root, '-c','user.name=Fixture','-c','user.email=ci@example.invalid',
        '-c','commit.gpgsign=false','-c','core.autocrlf=false',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git('init','--initial-branch=main');
    for (const path of ['tools/checks','tools/generation/i18n']) {
        for (const name of fs.readdirSync(join(original,path)).filter(file=>file.endsWith('.ts'))) write(path+'/'+name,fs.readFileSync(join(original,path,name)));
    }
    write('.github/workflows/ci.yml','name: CI\n'); write('.node-version','24.21.0\n'); write('package-lock.json','{}\n');
    git('add','.');git('commit','-m','accepted reader');const base=git('rev-parse','HEAD');
    git('switch','-c','physical');
    for(const [path,bytes] of languageFixture())write(path,bytes);
    const entries=sectionFixtureEntries();
    for(const [path,bytes] of entries)write(path,bytes);
    write(COVERAGE_ACTIVATION_PATH,COVERAGE_ACTIVATION);
    // The candidate cannot replace the verifier used by its already accepted first parent.
    write('tools/checks/ci-section-evidence.ts','export const validateSectionEvidence = () => {};\n');
    git('add','.');git('commit','-m','activate real fixture');const head=git('rev-parse','HEAD');
    process.chdir(root);
    const inputs=fixture().record.inputs, plan=createCoveragePlan(base,head,inputs);
    const run={ ...originalRun, head_sha:head, head_branch:'physical', event:'pull_request', run_attempt:1 };
    const directory=join(root,'downloaded');
    const all=v2Fixture(plan,{run,inputs,directory,prNumber:23,version:'3.16.1',reportFor:(p,i)=>sectionFixtureReport(p,plan,entries,i),writeLogs:writeSectionLogs});
    return {...all, root,base,head,git,plan,run,directory};
}
test('physical evidence requires the exact verified plan, all original stages and the source-bound per-host capacity', async t=>{
    const {record,artifacts,run,plan,base,root,directory,fragments}=source(t);
    assert.doesNotThrow(()=>validateComplete(record,run,artifacts));verifyRecordedFiles(record,directory);
    const shared=plan.producers.filter(p=>p.os==='windows-11-arm'&&p.obligations.length>1);assert.equal(shared.length,3);
    const copy=()=>structuredClone(record);
    const bad=(edit:(r:CompleteEvidenceV2)=>void)=>{ const r=copy();edit(r);assert.throws(()=>validateComplete(r,run,artifacts)); };
    bad(r=>{r.coverage.native_capacity_cases=197;});
    bad(r=>{r.toolchain.npm='1.0.0';for(const e of r.executions)e.identity.npm='1.0.0';});
    bad(r=>{r.toolchain.lock_sha256='f'.repeat(64);});
    bad(r=>{r.executions.pop();});bad(r=>{r.executions[0]=r.executions[1]!;});
    bad(r=>{r.executions[0]!.identity.commit=base;});bad(r=>{r.executions[0]!.identity.tarball_sha256='a'.repeat(64);});
    bad(r=>{r.executions[0]!.job_name='Unrelated';});bad(r=>{r.executions[0]!.artifact_id=r.artifacts[0]!.id;});
    bad(r=>{r.executions[0]!.started_at=new Date(now+10000).toISOString();});
    bad(r=>{r.executions.find(x=>x.identity.producer_id===shared[1]!.id)!.identity.node_sha256='0'.repeat(64);});
    bad(r=>{r.executions.find(x=>x.identity.producer_id===shared[0]!.id)!.identity.npm_sha256='0'.repeat(64);});
    bad(r=>{r.executions.find(x=>x.identity.host!==null)!.identity.host_sha256=null;});
    bad(r=>{r.coverage_plan.producers.pop();});
    const frozen=join(root,'frozen');exportBaseVerifiers(base,frozen);
    const accepted=await import(pathToFileURL(join(frozen,'tools/checks/ci-evidence.ts')).href);
    accepted.verifyRecordedFiles(record,directory);
    const spec=plan.producers.find(p=>p.stage==='language')!, row=record.executions.find(e=>e.identity.producer_id===spec.id)!;
    const path=join(directory,spec.receipt),raw=fs.readFileSync(path),original=JSON.parse(raw.toString());
    fs.appendFileSync(path,'x');assert.throws(()=>accepted.verifyRecordedFiles(record,directory),/receipts changed/u);
    const mutate=(edit:(f:any)=>void)=>{
        const fragment=structuredClone(original);edit(fragment);fs.writeFileSync(path,JSON.stringify(fragment));
        const forged=copy(),execution=forged.executions.find(e=>e.identity.producer_id===spec.id)!;
        forged.receipts[spec.receipt]=execution.receipt_sha256=digest(fs.readFileSync(path));
        assert.throws(()=>accepted.verifyRecordedFiles(forged,directory));
    };
    mutate(f=>{f.identity.job_key='mods';});mutate(f=>{f.report.language.workflow.combinations=0;});mutate(f=>{delete f.report.language;});
    fs.writeFileSync(path,raw);assert.equal(row.receipt_sha256,digest(raw));
    const official = fragments.find(fragment => fragment.identity.host)!;
    const payload = official.report.official as any;
    const originalLog = join(directory, official.identity.producer_id, 'logs', payload.mods['statusline-native'].official_test_batches.batches[0].log);
    const logBytes = fs.readFileSync(originalLog);
    fs.appendFileSync(originalLog, 'changed'); assert.throws(() => accepted.verifyRecordedFiles(record,directory), /log bytes/u);
    fs.writeFileSync(originalLog, logBytes);
    fs.appendFileSync(join(directory,'ts06-candidate/coverage-plan.json'),' ');assert.throws(()=>accepted.verifyRecordedFiles(record,directory),/plan bytes/);
});
test('latest real physical execution wins even without a new artifact; cloned successes preserve the original job',async t=>{
    const {record,jobs}=source(t);record.attempt=2;
    const token=process.env.GH_TOKEN;process.env.GH_TOKEN='fixture-only';t.after(()=>{if(token===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=token;});
    const original=jobs[0]!;
    const cloned={...original,id:original.id+10000,run_attempt:2,created_at:new Date(now+3000).toISOString()};
    let retry=[cloned];
    t.mock.method(globalThis,'fetch',async (input:any)=>{
        const url=new URL(String(input));const rows=url.pathname.endsWith('/attempts/1/jobs')?jobs:retry;
        assert.match(url.pathname,/\/attempts\/[12]\/jobs$/u);return Response.json({jobs:rows,total_count:rows.length});
    });
    await verifyExecutionJobs(record);
    const newer={...cloned,started_at:new Date(now+4000).toISOString(),completed_at:new Date(now+5000).toISOString()};
    for(const conclusion of ['failure','cancelled','timed_out','skipped',null]){retry=[{...newer,conclusion}];await assert.rejects(verifyExecutionJobs(record),/did not pass/u);}
    retry=[newer];await assert.rejects(verifyExecutionJobs(record),/supersedes/u);
    retry=[cloned];record.executions[0]!.job_id=cloned.id;record.executions[0]!.identity.attempt=2;
    await assert.rejects(verifyExecutionJobs(record),/supersedes/u);
    record.executions[0]!.job_id=original.id;record.executions[0]!.identity.attempt=1;
    retry=[];const labels=original.labels;original.labels=['ubuntu-unrelated'];await assert.rejects(verifyExecutionJobs(record),/runner/u);original.labels=labels;
});
test('source activation rejects a v1 envelope before selecting legacy coverage',async t=>{
    const {head,run,root}=source(t);
    const legacy={...fixture().record,source_commit:head};const bundle=join(root,'zip');fs.mkdirSync(bundle);fs.writeFileSync(join(bundle,'ci-evidence.json'),JSON.stringify(legacy));
    execFileSync('git',['-C',bundle,'init','-q']);execFileSync('git',['-C',bundle,'add','ci-evidence.json']);
    const tree=execFileSync('git',['-C',bundle,'write-tree'],{encoding:'utf8'}).trim(),zip=execFileSync('git',['-C',bundle,'archive','--format=zip',tree]);
    const artifact={id:19,name:'ts06-acceptance',expired:false,expires_at:new Date(now+86400000).toISOString(),digest:'sha256:'+digest(zip)};
    const old=process.env.GH_TOKEN;process.env.GH_TOKEN='fixture-only';t.after(()=>{if(old===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=old;});
    t.mock.method(globalThis,'fetch',async(input:any)=>{
        const url=new URL(String(input));if(url.hostname==='archive.fixture.invalid')return new Response(new Uint8Array(zip));
        if(url.pathname===`/repos/${CI_REPOSITORY}/actions/artifacts/19/zip`)return new Response(null,{status:302,headers:{location:'https://archive.fixture.invalid/download'}});
        assert.equal(url.pathname,`/repos/${CI_REPOSITORY}/actions/runs/${run.id}/artifacts`);return Response.json({artifacts:[artifact],total_count:1});
    });
    await assert.rejects(completeSource(run),/schema differs from immutable source activation/u);
});
