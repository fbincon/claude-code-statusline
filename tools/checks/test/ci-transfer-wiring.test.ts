import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { acceptedTransfer } from '../ci-transfer-trust.js';

const transfer = './.github/actions/transfer-artifact';
const workflow = () => parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
const stepIndex = (steps: any[], match: (step: any) => boolean) => { const i = steps.findIndex(match); assert(i >= 0); return i; };

test('the worker verifies the small artifact against the original producer before restoring compiled tests', () => {
    const { jobs } = workflow(), candidate: any[] = jobs.candidate.steps;
    const fingerprint = stepIndex(candidate, s => s.id === 'fingerprint'), full = stepIndex(candidate, s => s.id === 'candidate_upload');
    const create = stepIndex(candidate, s => s.id === 'worker'), light = stepIndex(candidate, s => s.id === 'worker_upload');
    assert(fingerprint < full && full < create && create < light); assert.equal(candidate[full].with.name, 'ts06-candidate');
    assert.equal(candidate[light].with.name, 'ci-worker-input'); assert.equal(candidate[create].env.ORIGINAL_ID, '${{ steps.candidate_upload.outputs.artifact-id }}');
    for (const key of ['installed','runtime','mods']) {
        const steps = jobs[key].steps, inputs = steps.filter((s: any) => s.uses === transfer && s.with.operation === 'download');
        assert.equal(inputs.length, 3); assert.equal(inputs[0].with.name, 'ci-worker-input');
        assert.equal(inputs[0].with['artifact-ids'], '${{ needs.candidate.outputs.worker_id }}');
        assert.equal(inputs[1].if, "matrix.history != 'none'"); assert(inputs[1].with.name.includes('ci-historical-380'));
        assert(inputs.every((s: any) => s.with['expected-digest']));
        const prepare = steps.find((s: any) => s.run?.includes('worker-input.ts restore'));
        assert(prepare.run.indexOf('worker-input.ts restore') < prepare.run.indexOf('test-bundle.ts restore'));
        assert.equal(prepare.env.PRODUCER_ATTEMPT, '${{ needs.candidate.outputs.producer_attempt }}');
    }
    for (const key of ['acceptance','tiered-results']) {
        const steps = jobs[key].steps, candidate = stepIndex(steps, s => s.with?.name === 'ts06-candidate');
        const select = stepIndex(steps, s => s.run?.includes('ci-physical-workflow.ts select'));
        const download = stepIndex(steps, s => s.with?.['artifact-ids']?.includes('outputs.artifact_ids'));
        const assemble = stepIndex(steps, s => s.run?.startsWith('mv ')); assert(candidate < select && select < download && download < assemble);
    }
});

test('only proven source code can transport original artifacts before frozen verification, with pinned fallback', () => {
    const { jobs } = workflow(), selector = jobs.scope.steps.find((s: any) => s.id === 'transfer_source');
    assert(selector.run.includes('selection.release.verifier_commit')); assert(selector.run.includes('selection.integration.base'));
    assert(!selector.if.includes("route == 'tag'"));
    for (const key of ['integration','promotion','release-binding','maintenance']) {
        const steps = jobs[key].steps, check = stepIndex(steps, s => s.id === 'transport');
        assert(steps[check].run.includes('git --no-replace-objects cat-file blob')); assert(steps[check].run.includes('node "$RUNNER_TEMP/accepted-transfer-check.mts"'));
        const protectedReads = steps.filter((s: any) => s.uses === transfer && s.with.operation === 'download' && s.with['run-id']?.includes('needs.scope.outputs.'));
        assert(protectedReads.length);
        for (const read of protectedReads) {
            assert(steps.indexOf(read) > check); assert(read.if.includes("steps.transport.outputs.verified == 'true'"));
            const fallback = steps.find((s: any) => s.uses?.startsWith('actions/download-artifact@') && s.with['artifact-ids'] === read.with['artifact-ids']);
            assert(fallback && fallback.if.includes("steps.transport.outputs.verified != 'true'"));
            assert.equal(fallback.with['run-id'], read.with['run-id']); assert.equal(fallback.with.path, read.with.path);
        }
    }
});

test('transfer probe crosses runners, binds real IDs and never joins an automatic gate', () => {
    const w=workflow(), p=w.jobs['artifact-transfer-probe'], r=w.jobs['artifact-transfer-readback'];
    assert(w.on.workflow_dispatch.inputs.validation.options.includes('artifact-transfer-probe'));
    assert.equal(p.if, "github.event_name == 'workflow_dispatch' && github.ref_type == 'branch' && inputs.validation == 'artifact-transfer-probe'");
    assert.equal(r.if,p.if); assert.equal(r.needs,'artifact-transfer-probe');assert.notEqual(p['runs-on'],r['runs-on']);
    assert(w.jobs.scope.if.includes("inputs.validation != 'artifact-transfer-probe'"));
    assert(w.jobs.acceptance.if.includes("inputs.validation != 'artifact-transfer-probe'"));
    assert(!w.jobs.acceptance.needs.includes('artifact-transfer-probe') && !w.jobs.acceptance.needs.includes('artifact-transfer-readback'));
    const steps = [...p.steps,...r.steps]; assert(steps.some(s=>s.run?.includes('npm run release:build')));
    assert(steps.some(s=>s.run?.includes('worker-input.ts restore')));
    assert.deepEqual(steps.flatMap(s=>s.with?.['diagnostic-fault']?[s.with['diagnostic-fault']]:[]),
        ['upload-lost-ack','upload-reset','download-reset','digest-mismatch','forbidden','ambiguous','persistent-503']);
    for(const s of steps.filter(s=>s.with?.operation==='upload'))assert(s.with.name.startsWith('ci-diagnostic-transfer-'));
});

test('the frozen transport checker rejects changed code, lock, shared inputs and untracked dependencies', t=>{
    const root=fs.mkdtempSync(join(tmpdir(),'transfer-first-parent-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:3}));
    const write=(path:string,value:string)=>{fs.mkdirSync(dirname(join(root,path)),{recursive:true});fs.writeFileSync(join(root,path),value);};
    const git=(...args:string[])=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false',...args],{cwd:root,encoding:'utf8'}).trim();
    const files=['tools/checks/ci-transfer.ts','tools/checks/ci-transfer-policy.ts',...['action.yml','entry.mjs','worker.mjs','package.json','package-lock.json'].map(n=>'.github/actions/transfer-artifact/'+n)];
    git('init','--quiet');git('config','core.autocrlf','false');for(const file of files)write(file,'original\n');git('add','.');git('commit','--quiet','-m','accepted');
    const base=git('rev-parse','HEAD');assert(acceptedTransfer(base,root));
    for(const file of files){write(file,'changed\n');assert.equal(acceptedTransfer(base,root),false);write(file,'original\n');}
    write('.github/actions/transfer-artifact/node_modules/injected/index.js','side effect');assert.equal(acceptedTransfer(base,root),false);
});

test('the actual Action and shared verification sources retain accepted Git bytes with autocrlf enabled', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'transport-autocrlf-')), repo = join(root, 'repository'), checkout = join(root, 'checkout');
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 }));
    fs.mkdirSync(join(repo, '.github/actions'), { recursive: true }); fs.mkdirSync(join(repo, 'tools/checks'), { recursive: true });
    fs.cpSync('.github/actions/transfer-artifact', join(repo, '.github/actions/transfer-artifact'), { recursive: true, filter: path => basename(path) !== 'node_modules' });
    for (const file of ['.gitattributes', 'tools/checks/ci-transfer.ts', 'tools/checks/ci-transfer-policy.ts']) fs.copyFileSync(file, join(repo, file));
    const git = (...args: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '--quiet'); git('add', '.'); git('commit', '--quiet', '-m', 'accepted');
    git('-c', 'core.autocrlf=true', 'clone', '--quiet', '--no-local', repo, checkout);
    assert(acceptedTransfer(git('rev-parse', 'HEAD'), checkout));
});
