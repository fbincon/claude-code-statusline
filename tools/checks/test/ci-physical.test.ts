import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COVERAGE_ACTIVATION, COVERAGE_ACTIVATION_PATH, createCoveragePlan } from '../ci-coverage.js';
import { digest, validateComplete, verifyRecordedFiles, type CompleteEvidenceV2 } from '../ci-evidence.js';
import { completeSource, verifyExecutionJobs } from '../ci-sources.js';
import { collectPhysical, eventBasis, probeMode, probePlan, selectPhysicalArtifacts } from '../ci-physical-workflow.js';
import { exportBaseVerifiers } from '../ci-trust.js';
import { CI_REPOSITORY } from '../ci-watch.js';
import { sectionFixtureEntries, sectionFixtureReport, writeSectionLogs } from '../../release/test/fixtures/v2-sections.js';
import { fixture as languageFixture } from '../../generation/test/i18n-fixture.js';
import { fixture, now, run as originalRun } from './fixtures/ci-evidence.js';
import { v2Fixture } from './fixtures/ci-evidence-v2.js';
import { writeDelivery } from '../../build/test/fixtures/delivery.js';
import { assessEvidenceDirectory } from '../../release/prepare.js';

function source(t: TestContext, packageDelivery = false) {
    const original = process.cwd(), root = fs.mkdtempSync(join(tmpdir(), 'physical-evidence-'));
    t.after(() => { process.chdir(original); fs.rmSync(root, { recursive:true, force:true, maxRetries:5,retryDelay:50 }); });
    const write = (path:string, bytes: Uint8Array|string) => { fs.mkdirSync(dirname(join(root,path)),{recursive:true}); fs.writeFileSync(join(root,path),bytes); };
    const git = (...args:string[]) => execFileSync('git',['-C', root, '-c','user.name=Fixture','-c','user.email=ci@example.invalid',
        '-c','commit.gpgsign=false','-c','core.autocrlf=false',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git('init','--initial-branch=main');
    for (const path of ['tools/checks','tools/generation/i18n']) {
        for (const name of fs.readdirSync(join(original,path)).filter(file=>file.endsWith('.ts'))) write(path+'/'+name,fs.readFileSync(join(original,path,name)));
    }
    write('tools/release/approval.ts',fs.readFileSync(join(original,'tools/release/approval.ts')));
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
    const delivery = packageDelivery ? writeDelivery(root, join(directory, 'ts06-candidate'), head,
        new Map(git('ls-files', '-z').split('\0').filter(Boolean).map(path => [path, fs.readFileSync(join(root, path))]))) : undefined;
    const all=v2Fixture(plan,{run,inputs,directory,delivery,prNumber:23,reportFor:(p,i)=>sectionFixtureReport(p,plan,entries,i),writeLogs:writeSectionLogs});
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

test('issuing a retry joins one new shard to retained original artifacts and jobs under the accepted reader', async t => {
    const { record, run, directory, root, base, plan, jobs, artifacts } = source(t);
    const env = { GH_TOKEN: 'fixture-only', GITHUB_RUN_ID: String(run.id), GITHUB_RUN_ATTEMPT: '2', GITHUB_WORKFLOW_SHA: plan.head,
        CI_CANDIDATE_ID: String(artifacts[0]!.id), CI_COMPILED_ID: String(artifacts[1]!.id) };
    for (const [key, value] of Object.entries(env)) {
        const prior = process.env[key]; process.env[key] = value;
        t.after(() => { if (prior === undefined) delete process.env[key]; else process.env[key] = prior; });
    }
    const index = plan.producers.findIndex(spec => spec.os === 'windows-11-arm' && spec.stage === 'history');
    const spec = plan.producers[index]!, oldJob = jobs[index], oldArtifact = artifacts[index + 2]!;
    const start = new Date(now + 10_000).toISOString(), end = new Date(now + 15_000).toISOString();
    const next = { ...oldJob, id: 733, run_attempt: 2, created_at: start, started_at: start, completed_at: end };
    const clone = { ...jobs[0], id: 734, run_attempt: 2, created_at: end };
    const newest = { ...oldArtifact, id: 409, digest: 'sha256:' + digest('new upload'), created_at: end };
    const raw = [...artifacts, newest, { ...newest, name: 'ci-diagnostic-tiered-' + spec.artifact, id: 408 }];
    const selection = { run_id: run.id, commit: plan.head, artifacts: selectPhysicalArtifacts(plan, raw, false, artifacts[0]!.id, artifacts[1]!.id) };
    const retries = [next, clone];
    t.mock.method(globalThis, 'fetch', async (input: any) => {
        const url = new URL(String(input)); assert.match(url.pathname, /\/attempts\/[12]\/jobs$/u);
        const rows = url.pathname.endsWith('/attempts/1/jobs') ? jobs : retries;
        return Response.json({ jobs: rows, total_count: rows.length });
    });
    const tarball = record.delivery['fbincon-claude-code-statusline-' + record.version + '.tgz']!;
    await assert.rejects(collectPhysical(directory, plan, selection, raw, tarball, false), /supersedes/u);
    const path = join(directory, spec.receipt), fragment = JSON.parse(fs.readFileSync(path, 'utf8'));
    fragment.identity.attempt = 2; fragment.report = sectionFixtureReport(spec, plan, sectionFixtureEntries(), fragment.identity);
    const bytes = JSON.stringify(fragment) + '\n'; fs.writeFileSync(path, bytes);
    record.receipts[spec.receipt] = digest(bytes); record.attempt = run.run_attempt = 2;
    record.artifacts = selection.artifacts;
    record.executions = await collectPhysical(directory, plan, selection, raw, tarball, false);
    const retried = record.executions[index]!;
    assert.equal(retried.job_id, next.id); assert.equal(retried.artifact_id, newest.id); assert.equal(retried.identity.attempt, 2);
    assert.equal(retried.job_created_at, start); assert.equal(retried.artifact_created_at, end);
    assert.equal(record.executions[0]!.job_id, jobs[0].id); assert.equal(record.executions[0]!.identity.attempt, 1);
    const frozen = join(root, 'issuing-base'); exportBaseVerifiers(base, frozen);
    const accepted = await import(pathToFileURL(join(frozen, 'tools/checks/ci-evidence.ts')).href);
    accepted.validateComplete(record, run, raw); accepted.verifyRecordedFiles(record, directory);
    const frozenJobs = await import(pathToFileURL(join(frozen, 'tools/checks/ci-sources.ts')).href);
    await frozenJobs.verifyExecutionJobs(record);
    assert.throws(() => selectPhysicalArtifacts(plan, raw, false, newest.id, artifacts[1]!.id), /Candidate job output/u);
    assert.throws(() => selectPhysicalArtifacts(plan, raw.filter(a => a.id !== artifacts[1]!.id), false, artifacts[0]!.id, artifacts[1]!.id), /Missing artifact/u);
    next.conclusion = 'failure'; await assert.rejects(collectPhysical(directory, plan, selection, raw, tarball, false), /did not pass/u);
});

test('manual baseline schedules seven real producers and cannot be accepted as a complete or upgraded envelope', t => {
    const { plan, record, run, head, artifacts } = source(t);
    const full = createCoveragePlan(null, head, record.inputs), probe = probePlan(full, record.inputs);
    assert.equal(probe.diagnostic, 'tiered-probe'); assert.equal(probe.producers.length, 7);
    const arm = probe.producers.filter(p => p.os === 'windows-11-arm');
    assert.deepEqual(arm.map(p => p.stage), ['installed', 'language', 'history']); assert(arm.every(p => p.node === '22.0.0' && p.depth === 'full'));
    assert.deepEqual(probe.producers.filter(p => p.host).map(p => [p.host,p.depth]), [['2.1.296','short'],['2.1.310','full']]);
    assert.deepEqual(probe.producers.filter(p => p.job_key === 'installed').map(p => p.depth).sort(), ['full','short']);
    record.coverage_plan = probe; assert.throws(() => validateComplete(record, run, artifacts));
    assert.throws(() => selectPhysicalArtifacts(probe, artifacts, true, artifacts[0]!.id, artifacts[1]!.id), /Missing artifact/u);
    assert(plan.producers.length > probe.producers.length);
});

test('candidate and collector use the event PR or an independently gated push first parent; all-full remains safe when a gate appears late', async t => {
    const { root, head, base, run } = source(t), path = join(root, 'original-event.json');
    for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: CI_REPOSITORY, GITHUB_REF_TYPE:'branch', GITHUB_REF_NAME:'main',
        GITHUB_EVENT_NAME:'pull_request', GITHUB_SHA:head, GITHUB_EVENT_PATH:path, GH_TOKEN:'fixture-only', CI_VALIDATION:'' })) {
        const old = process.env[key]; process.env[key] = value;
        t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
    }
    const repository = { full_name: CI_REPOSITORY };
    const pull = { head:{sha:head,repo:repository},base:{sha:base,ref:'main',repo:repository},draft:false };
    fs.writeFileSync(path, JSON.stringify({repository, number:23, pull_request:pull}));
    assert.deepEqual(await eventBasis(head), {base,basis:'pull_request'});
    fs.writeFileSync(path, JSON.stringify({repository, number:23, pull_request:{...pull,draft:true}})); await assert.rejects(eventBasis(head));
    process.env.GITHUB_EVENT_NAME = 'push';
    const push = { repository, ref:'refs/heads/main',before:base,after:head };
    fs.writeFileSync(path, JSON.stringify(push));
    const prior = {...run, id:19, head_sha:base,head_branch:'main',event:'push',run_attempt:1};
    let runs: any[] = [], gate = 'success', calls = 0;
    t.mock.method(globalThis,'fetch',async(input:any)=>{
        calls++;
        const url = new URL(String(input));
        if(url.pathname.endsWith('/workflows/ci.yml/runs'))return Response.json({workflow_runs:runs});
        if(url.pathname.endsWith('/attempts/1/jobs'))return Response.json({jobs:[{name:'Complete candidate evidence',conclusion:gate}],total_count:1});
        assert(url.pathname.endsWith('/runs/19'));return Response.json(prior);
    });
    const conservative = {base:null,basis:'conservative'};
    assert.deepEqual(await eventBasis(head),conservative);
    runs=[prior];assert.deepEqual(await eventBasis(head),{base,basis:'accepted-main'});
    gate='failure';await assert.rejects(eventBasis(head),/aggregate did not pass/u);
    const before=calls;assert.deepEqual(await eventBasis(head,true),conservative);assert.equal(calls,before);
    fs.writeFileSync(path,JSON.stringify({...push,before:'c'.repeat(40)}));assert.deepEqual(await eventBasis(head),conservative);assert.equal(calls,before);
    process.env.CI_VALIDATION='tiered-probe'; assert.throws(probeMode);
    process.env.GITHUB_EVENT_NAME='workflow_dispatch';fs.writeFileSync(path,JSON.stringify({repository,inputs:{validation:'full'}}));assert.throws(probeMode);
    fs.writeFileSync(path,JSON.stringify({repository,inputs:{validation:'tiered-probe'}}));assert(probeMode());
    process.env.GITHUB_REF_TYPE='tag';assert.throws(probeMode);
});

test('compiled record CLI issues complete evidence and rejects changed acceptance after loading its collectors', t => {
    const { root, head, base, directory, artifacts, jobs, record, run, plan, git } = source(t, true);
    const cli = fileURLToPath(new URL('../ci-evidence.js', import.meta.url));
    const repo = { full_name: CI_REPOSITORY };
    const save = (name: string, value: unknown) => {
        const path = join(root, name); fs.writeFileSync(path, JSON.stringify(value)); return path;
    };
    const event = save('event.json', { number: 23, repository: repo, pull_request: { draft: false,
        head: { sha: head, ref: run.head_branch, repo }, base: { sha: base, ref: 'main', repo } } });
    const selection = save('selection.json', { run_id: run.id, commit: head, artifacts: record.artifacts });
    const filename = 'fbincon-claude-code-statusline-' + record.version + '.tgz';
    const sourceEntries = sectionFixtureEntries();
    sourceEntries.set(COVERAGE_ACTIVATION_PATH, Buffer.from(COVERAGE_ACTIVATION));
    const assessment = assessEvidenceDirectory(directory, head, record.delivery[filename]!, sourceEntries,
        { basis: 'pull_request', base, run_id: run.id, attempt: 1, workflow_sha: head });
    const accepted = { ...assessment, application_version: record.version };
    const acceptance = save('acceptance.json', accepted);
    const prefix = 'https://api.github.com/repos/' + CI_REPOSITORY;
    const path = '/actions/runs/' + run.id;
    const responses = save('actions.json', {
        [prefix + path + '/artifacts?per_page=100&page=1']: { artifacts, total_count: artifacts.length },
        [prefix + path + '/attempts/1/jobs?per_page=100&page=1']: { jobs, total_count: jobs.length },
        [prefix + path]: { ...run, status: 'in_progress', conclusion: null },
        [prefix + '/contents/.github/workflows/ci.yml?ref=' + head]: { type: 'file', sha: git('rev-parse', head + ':.github/workflows/ci.yml') },
    });
    // Only the GitHub transport is substituted. Both archives, local policy, logs and every fragment are verified by the CLI.
    const preload = join(root, 'actions.mjs');
    fs.writeFileSync(preload, `import { readFileSync } from 'node:fs';
const responses = JSON.parse(readFileSync(${JSON.stringify(responses)}, 'utf8'));
globalThis.fetch = async url => {
    if (!Object.hasOwn(responses, url)) throw new Error('Unexpected fixture request: ' + url);
    return Response.json(responses[url]);
};`);
    const issue = (output: string) => spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, cli, 'record',
        '--evidence', directory, '--selection', selection, '--acceptance', acceptance, '--output', output], {
        cwd: root, encoding: 'utf8', timeout: 60_000,
        env: { ...process.env, GH_TOKEN: 'offline-fixture', GITHUB_TOKEN: 'offline-fixture', CI_VALIDATION: '',
            GITHUB_SHA: head, GITHUB_REF_NAME: run.head_branch, GITHUB_REF_TYPE: 'branch', GITHUB_OUTPUT: join(root, 'github-output'),
            GITHUB_JOB: 'acceptance', GITHUB_EVENT_NAME: 'pull_request',
            GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: CI_REPOSITORY, GITHUB_RUN_ID: String(run.id),
            GITHUB_WORKFLOW_SHA: head, GITHUB_RUN_ATTEMPT: '1', CI_CANDIDATE_ID: String(artifacts[0]!.id),
            CI_COMPILED_ID: String(artifacts[1]!.id) },
    });
    const output = join(root, 'issued.json'), success = issue(output);
    assert.equal(success.status, 0, success.error?.message ?? success.stderr);
    const issued: CompleteEvidenceV2 = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(issued.source_commit, head);
    assert.equal(issued.acceptance_sha256, digest(fs.readFileSync(acceptance)));
    assert.deepEqual(issued.delivery, record.delivery);
    assert.equal(issued.executions.length, plan.producers.length);
    validateComplete(issued, run, artifacts);

    save('acceptance.json', { ...accepted, installations: 0 });
    const rejected = join(root, 'rejected.json'), invalid = issue(rejected);
    assert.equal(invalid.status, 1, invalid.error?.message ?? invalid.stderr);
    assert.match(invalid.stderr, /Acceptance report differs from source receipts: installations/u);
    assert(!fs.existsSync(rejected));
});
