import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { artifactIdentity, newestArtifact, selectCompleteArtifacts, validateComplete, verifyRecordedFiles, digest, fileReceipts, type CompleteEvidence } from '../ci-evidence.js';
import { latestRun, verifyTagIdentity } from '../ci-promotion.js';
import { commit, hash, now, run, fixture } from './fixtures/ci-evidence.js';
import { requireGate, verifyExecutionJobs } from '../ci-sources.js';
test('complete evidence retains exact source, coverage and immutable original artifact identities', () => {
    const { record, artifacts } = fixture(); assert.doesNotThrow(() => validateComplete(record, run, artifacts));
    assert.equal(selectCompleteArtifacts(artifacts).length, 50);
    // A prior failed-attempt artifact with the same name cannot override the selected one.
    assert.equal(newestArtifact([{ ...artifacts[0], id: 999, created_at: new Date(now - 1000).toISOString() }, ...artifacts], 'ts06-candidate').id, 100);
});
test('artifact chronology uses creation time, rejects ambiguity and never hides a bad latest retry', () => {
    const { artifacts } = fixture(), name = artifacts[0]!.name;
    // Observed IDs from PR #168: the successful retry had the smaller ID.
    const old = { ...artifacts[0], id: 12776825299, created_at: new Date(now - 2000).toISOString() };
    const retry = { ...artifacts[0], id: 12776328589, created_at: new Date(now - 1000).toISOString() };
    assert.equal(newestArtifact([old, retry], name).id, retry.id);
    assert.equal(newestArtifact([retry, old], name).id, retry.id);
    for (const patch of [{ expired: true }, { digest: 'invalid' }, { expires_at: new Date(now - 1).toISOString() },
        { created_at: undefined }, { created_at: 'invalid' }, { created_at: old.created_at }])
        assert.throws(() => newestArtifact([old, { ...retry, ...patch }], name));
});
test('failed, cancelled, expired, corrupt, ambiguous and incomplete evidence fails closed', () => {
    for (const change of [{ status: 'in_progress' }, { conclusion: 'failure' }, { conclusion: 'cancelled' }, { head_sha: 'c'.repeat(40) }, { event: 'workflow_dispatch' }, { head_repository: { full_name: 'foreign/repo' } }]) {
        const { record, artifacts } = fixture(); assert.throws(() => validateComplete(record, { ...run, ...change }, artifacts));
    }
    for (const mutate of [
        (record: CompleteEvidence) => { record.attempt = 1; },
        (record: CompleteEvidence) => { record.coverage.hosts = 13; },
        (record: CompleteEvidence) => { record.expires_at = new Date(now - 1).toISOString(); },
        (record: CompleteEvidence) => { record.artifacts.pop(); },
        (record: CompleteEvidence) => { record.artifacts.push(record.artifacts[0]!); },
        (record: CompleteEvidence) => { record.delivery['../escape'] = hash; },
        (record: CompleteEvidence) => { (record.inputs as any).shared = ['22.x']; },
        (record: CompleteEvidence) => { record.executions.find(value => value.runtime_case === '24.x')!.job_id = 999; },
        (record: CompleteEvidence) => { record.executions.find(value => value.runtime_case === '24.x')!.node_sha256 = 'c'.repeat(64); },
        (record: CompleteEvidence) => { record.executions.find(value => value.runtime_case === '22.x')!.execution.reused_installed = true; },
    ]) { const { record, artifacts } = fixture(); mutate(record); assert.throws(() => validateComplete(record, run, artifacts)); }
    for (const change of [{ expired: true }, { digest: 'sha256:' + 'c'.repeat(64) }, { expires_at: new Date(now - 1).toISOString() }]) {
        const { record, artifacts } = fixture(); Object.assign(artifacts[0]!, change); assert.throws(() => validateComplete(record, run, artifacts));
    }
    const { record, artifacts } = fixture(); artifacts.push({ ...artifacts[0]!, id: 99, created_at: new Date(now + 1000).toISOString() }); assert.throws(() => validateComplete(record, run, artifacts), /Newer/);
});
test('latest failed exact source run cannot fall back to older green or unrelated runs', () => {
    assert.equal(latestRun([run], commit, 'main').id, run.id);
    assert.equal(latestRun([run], 'c'.repeat(40), 'main'), undefined);
    assert.throws(() => latestRun([run, { ...run, id: 13, conclusion: 'failure' }], commit, 'main'));
    assert.throws(() => latestRun([run, { ...run, id: 13, status: 'in_progress' }], commit, 'main'));
});
test('successful workflow status cannot replace the required aggregate or original job provenance', async t => {
    const previous = process.env.GH_TOKEN; process.env.GH_TOKEN = 'fixture-only';
    t.after(() => { if (previous === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = previous; });
    const { record } = fixture();
    let freshRun = { ...run };
    let gates: any[] = [{ name: 'Complete candidate evidence', conclusion: 'success' }];
    let jobs = [...new Map(record.executions.map(row => [row.job_id, { id: row.job_id, name: row.job_name,
        started_at: row.started_at, completed_at: row.completed_at, conclusion: 'success' }])).values()];
    t.mock.method(globalThis, 'fetch', async (input: any) => {
        const url = new URL(String(input));
        assert.equal(url.hostname, 'api.github.com');
        if (url.pathname.endsWith('/actions/runs/12')) return Response.json(freshRun);
        assert.match(url.pathname, /\/actions\/runs\/12\/attempts\/[12]\/jobs$/u, 'Never use the mutable latest-jobs alias');
        const result = url.pathname.includes('/attempts/1/jobs') ? jobs : gates;
        return Response.json({ jobs: result, total_count: result.length });
    });
    await requireGate(run); await verifyExecutionJobs(record);
    freshRun = { ...run, run_attempt: 3 }; await assert.rejects(requireGate(run), /attempt changed/u);
    freshRun = { ...run, status: 'in_progress' }; await assert.rejects(requireGate(run), /has not completed/u); freshRun = { ...run };
    for (const conclusion of ['failure', 'skipped', 'cancelled', null]) {
        gates = [{ name: 'Complete candidate evidence', conclusion }]; await assert.rejects(requireGate(run));
    }
    for (const invalid of [[], [{ name: 'Manual validation (not PR evidence)', conclusion: 'success' }]]) {
        gates = invalid; await assert.rejects(requireGate(run));
    }
    const original = jobs;
    for (const patch of [{ id: 999 }, { name: 'Unrelated successful job' }, { conclusion: 'failure' }, { started_at: 'different execution' }, { completed_at: null }]) {
        jobs = [{ ...original[0]!, ...patch }, ...original.slice(1)]; await assert.rejects(verifyExecutionJobs(record));
    }
});
test('original package bytes and every receipt are checked again before promotion', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'evidence-bytes-'));
    try {
        const { record } = fixture();
        fs.mkdirSync(join(root, 'ts06-candidate'));
        for (const name of Object.keys(record.delivery)) {
            fs.writeFileSync(join(root, 'ts06-candidate', name), name);
            record.delivery[name] = digest(name);
        }
        const inputs = JSON.stringify(record.inputs);
        fs.writeFileSync(join(root, 'ts06-candidate/runtime-inputs.json'), inputs); record.input_file_sha256 = digest(inputs);
        fs.mkdirSync(join(root, 'ts06-acceptance')); fs.writeFileSync(join(root, 'ts06-acceptance/candidate-acceptance.json'), '{}'); record.acceptance_sha256 = digest('{}');
        fs.mkdirSync(join(root, 'ci-compiled-tests'));
        for (const name of Object.keys(record.compiled)) { fs.writeFileSync(join(root, 'ci-compiled-tests', name), name); record.compiled[name] = digest(name); }
        const receipt = join(root, 'installed.json'); fs.writeFileSync(receipt, '{"status":"pass"}');
        record.receipts = fileReceipts(root);
        assert.doesNotThrow(() => verifyRecordedFiles(record, root));
        const originalInputs = record.inputs; record.inputs = {};
        assert.throws(() => verifyRecordedFiles(record, root), /Recorded runtime inputs/u); record.inputs = originalInputs;
        fs.writeFileSync(receipt, '{"status":"fail"}');
        assert.throws(() => verifyRecordedFiles(record, root), /receipts changed/u);
        fs.writeFileSync(receipt, '{"status":"pass"}');
        fs.writeFileSync(join(root, 'runtime.json'), '{}');
        assert.throws(() => verifyRecordedFiles(record, root), /receipts changed/u);
        fs.rmSync(join(root, 'runtime.json'));
        for (const name of ['ts06-candidate/runtime-inputs.json', 'ts06-acceptance/candidate-acceptance.json', 'ci-compiled-tests/compiled-tests.tar']) {
            const path = join(root, name), before = fs.readFileSync(path);
            fs.appendFileSync(path, 'changed'); assert.throws(() => verifyRecordedFiles(record, root), /bytes changed/u); fs.writeFileSync(path, before);
        }
        fs.appendFileSync(join(root, 'ts06-candidate', 'SHA256SUMS'), 'different bytes for same source');
        assert.throws(() => verifyRecordedFiles(record, root), /Delivery bytes changed/u);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('annotated tag identity and reachability are checked against real Git objects', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'evidence-refs-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=CI fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    try {
        git('init'); git('commit', '--allow-empty', '-m', 'source'); const source = git('rev-parse', 'HEAD');
        git('update-ref', 'refs/remotes/origin/main', source); git('tag', '-a', 'v0.0.1', '-m', 'isolated fixture');
        assert.equal(verifyTagIdentity('v0.0.1', source, git), git('rev-parse', 'v0.0.1'));
        git('tag', 'v0.0.2'); assert.throws(() => verifyTagIdentity('v0.0.2', source, git), /Annotated/u);
        git('commit', '--allow-empty', '-m', 'different commit'); const newer = git('rev-parse', 'HEAD');
        git('tag', '-fa', 'v0.0.1', '-m', 'moved');
        assert.throws(() => verifyTagIdentity('v0.0.1', source, git), /Tag moved/u);
        assert.throws(() => verifyTagIdentity('v0.0.1', newer, git));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
