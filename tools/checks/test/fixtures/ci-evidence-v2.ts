/** Original physical execution/Actions fixture. Section semantics come from the selected scenario fixture. */
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import type { CoveragePlan } from '../../ci-coverage.js';
import { artifactIdentity, digest, policyDigest, type CompleteEvidenceV2, type PhysicalFragment, type PhysicalIdentity } from '../../ci-evidence.js';
import { languageEvidence, languageInputsAt } from '../../i18n-evidence.js';
import { sectionInputsAt, sourceCapacityCount, sourceContract } from '../../ci-section-evidence.js';
import { fixture, hash, now, run as defaultRun } from './ci-evidence.js';

type Producer = CoveragePlan['producers'][number];
export function v2Fixture(plan: CoveragePlan, options: {
    run?: any; inputs?: any; directory?: string; prNumber?: number; prBase?: string; version?: string;
    writeLogs?: (directory: string, report: Record<string, unknown>) => void;
    reportFor?: (producer: Producer, identity: PhysicalIdentity, plan: CoveragePlan) => Record<string, unknown>;
} = {}) {
    const legacy = fixture().record, run = options.run ?? { ...defaultRun, head_sha: plan.head, run_attempt: 1 };
    const entries = sectionInputsAt(plan.head), inputs = options.inputs ?? legacy.inputs, version = options.version ?? sourceContract(entries).version;
    const started = new Date(now - 2_000).toISOString(), ended = new Date(now).toISOString();
    const names = ['ts06-candidate', 'ci-compiled-tests', ...plan.producers.map(p => p.artifact)];
    const artifacts = names.map((name,index) => ({ id: 2000 + index, name, digest: 'sha256:' + digest(name),
        expired: false, created_at: ended, expires_at: new Date(now + 86400000).toISOString() }));
    const filename = `fbincon-claude-code-statusline-${version}.tgz`;
    const delivery = Object.fromEntries(['SHA256SUMS', 'build-manifest.json', filename, `claude-code-statusline-${version}-source.tar.gz`].map(name => [name, digest(name)]));
    const language = languageEvidence(languageInputsAt(plan.head),plan.head);
    const blob = (path: string) => execFileSync('git',['--no-replace-objects','cat-file','blob',plan.head+':'+path]);
    const manifest = JSON.parse(blob('package.json').toString('utf8'));
    const toolchain = {...legacy.toolchain,npm:manifest.packageManager.slice(4),typescript:manifest.devDependencies.typescript,lock_sha256:digest(blob('package-lock.json'))};
    const record: CompleteEvidenceV2 = { ...legacy, ...(language ? {language} : {}), schema_version: 2, source_commit:plan.head, tree:plan.tree, inputs, version, toolchain,
        run_id:run.id, attempt:run.run_attempt, event:run.event, branch:run.head_branch, workflow_sha:plan.head, policy_sha256:policyDigest(plan.head),
        pr:run.event==='pull_request'?{number:options.prNumber??23,head:plan.head,base:options.prBase??plan.base!,base_ref:'main',draft:false}:null,
        coverage: { ...legacy.coverage, native_capacity_cases: sourceCapacityCount(entries) },
        coverage_plan:plan, coverage_plan_sha256:digest(JSON.stringify(plan)+'\n'), input_file_sha256:digest(JSON.stringify(inputs)+'\n'),
        delivery, compiled: {'compiled-tests.json':digest('compiled-tests.json'),'compiled-tests.tar':digest('compiled-tests.tar')},
        acceptance_sha256:digest('{}'), receipts:{}, artifacts:artifacts.map(a=>artifactIdentity(a)), executions:[] };
    const write = (path: string, contents: string) => {
        if(!options.directory)return; const file=join(options.directory,path); fs.mkdirSync(dirname(file),{recursive:true});fs.writeFileSync(file,contents);
    };
    for(const name of Object.keys(delivery))write('ts06-candidate/'+name,name);
    for(const name of Object.keys(record.compiled))write('ci-compiled-tests/'+name,name);
    write('ts06-candidate/runtime-inputs.json',JSON.stringify(inputs)+'\n');write('ts06-candidate/coverage-plan.json',JSON.stringify(plan)+'\n');
    write('ts06-acceptance/candidate-acceptance.json','{}');
    const fragments: PhysicalFragment[] = [], jobs: any[] = [];
    for (const [i,p] of plan.producers.entries()) {
        const platform = p.os.startsWith('macos-')?'darwin':p.os.startsWith('windows-')?'win32':'linux';
        const identity: PhysicalIdentity = { producer_id:p.id, commit:plan.head, tree:plan.tree, policy_sha256:plan.policy_sha256,
            tarball_sha256:delivery[filename]!, workflow_sha:plan.head, os:p.os, platform,process_arch:p.arch,host_arch:p.host_arch,
            node:p.node,node_sha256:digest([platform,p.arch,p.node].join('/')),npm:record.toolchain.npm,npm_sha256:hash,
            host:p.host,host_sha256:p.host===null?null:digest([platform,p.host].join('/')),stage:p.stage,depth:p.depth,obligations:p.obligations,
            run_id:run.id,attempt:run.run_attempt,job:p.job,job_key:p.job_key };
        const fragment:PhysicalFragment={schema_version:2,kind:'acceptance-fragment',status:'pass',identity,
            report: options.reportFor?.(p, identity, plan) ?? {status:'pass', fixture_only:true}};
        const raw=JSON.stringify(fragment)+'\n'; fragments.push(fragment); write(p.receipt,raw);
        if (options.directory) options.writeLogs?.(join(options.directory,p.artifact),fragment.report);
        record.receipts[p.receipt]=digest(raw);
        const row={identity,receipt_sha256:digest(raw),artifact_id:artifacts[i+2]!.id,job_id:3000+i,job_name:p.job,started_at:started,completed_at:ended};
        record.executions.push(row); jobs.push({id:row.job_id,name:row.job_name,status:'completed',conclusion:'success',created_at:started,
            started_at:started,completed_at:ended,run_id:run.id,run_attempt:identity.attempt,head_sha:plan.head,labels:[p.os]});
    }
    return {record,artifacts,jobs,fragments};
}
