import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { artifactIdentity, newestArtifact, selectCompleteArtifacts, validateComplete, verifyRecordedFiles, digest, fileReceipts, type CompleteEvidence } from '../ci-evidence.js';
import { latestRun, verifyTagIdentity } from '../ci-promotion.js';
import { commit, hash, now, run, fixture } from './fixtures/ci-evidence.js';
test('complete evidence retains exact source, coverage and immutable original artifact identities', () => {
    const { record, artifacts } = fixture(); assert.doesNotThrow(() => validateComplete(record, run, artifacts));
    assert.equal(selectCompleteArtifacts(artifacts).length, 50);
    // A prior failed-attempt artifact with the same name cannot override the selected one.
    assert.equal(newestArtifact([{ ...artifacts[0], id: 1 }, ...artifacts], 'ts06-candidate').id, 100);
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
    ]) { const { record, artifacts } = fixture(); mutate(record); assert.throws(() => validateComplete(record, run, artifacts)); }
    for (const change of [{ expired: true }, { digest: 'sha256:' + 'c'.repeat(64) }, { expires_at: new Date(now - 1).toISOString() }]) {
        const { record, artifacts } = fixture(); Object.assign(artifacts[0]!, change); assert.throws(() => validateComplete(record, run, artifacts));
    }
    const { record, artifacts } = fixture(); artifacts.push({ ...artifacts[0]!, id: 999 }); assert.throws(() => validateComplete(record, run, artifacts), /Newer/);
});
test('latest failed exact source run cannot fall back to older green or unrelated runs', () => {
    assert.equal(latestRun([run], commit, 'main').id, run.id);
    assert.equal(latestRun([run], 'c'.repeat(40), 'main'), undefined);
    assert.throws(() => latestRun([run, { ...run, id: 13, conclusion: 'failure' }], commit, 'main'));
    assert.throws(() => latestRun([run, { ...run, id: 13, status: 'in_progress' }], commit, 'main'));
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
        fs.writeFileSync(join(root, 'ts06-candidate/runtime-inputs.json'), '{}'); record.input_file_sha256 = digest('{}');
        fs.mkdirSync(join(root, 'ts06-acceptance')); fs.writeFileSync(join(root, 'ts06-acceptance/candidate-acceptance.json'), '{}'); record.acceptance_sha256 = digest('{}');
        fs.mkdirSync(join(root, 'ci-compiled-tests'));
        for (const name of Object.keys(record.compiled)) { fs.writeFileSync(join(root, 'ci-compiled-tests', name), name); record.compiled[name] = digest(name); }
        const receipt = join(root, 'installed.json'); fs.writeFileSync(receipt, '{"status":"pass"}');
        record.receipts = fileReceipts(root);
        assert.doesNotThrow(() => verifyRecordedFiles(record, root));
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
