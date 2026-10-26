import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { artifactIdentity, newestArtifact, selectCompleteArtifacts, validateComplete, verifyRecordedFiles, digest, fileReceipts, type CompleteEvidence } from '../ci-evidence.js';
import { latestRun, verifyTagIdentity } from '../ci-promotion.js';
import { TARGETS, HOSTS, runtimeInputs } from '../runtime-inputs.js';
import { CI_REPOSITORY } from '../ci-watch.js';
const commit = 'a'.repeat(40), hash = 'b'.repeat(64), now = Date.now();
const run = { id: 12, run_attempt: 2, head_sha: commit, head_branch: 'main', event: 'push', repository: { full_name: CI_REPOSITORY }, head_repository: { full_name: CI_REPOSITORY }, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' };
function fixture() {
    const inputs = runtimeInputs([{ version: 'v22.23.4' }, { version: 'v24.21.0' }], '24.21.0');
    const names = ['ts06-candidate', 'ci-compiled-tests', ...TARGETS.map(target => `ts06-installed-${target.os}-${target.arch}`),
        ...HOSTS.map(host => `ts06-mods-${host.os}-${host.claude}`), ...inputs.matrix.include.map(row => `ts06-runtime-${row.target.os}-${row.target.arch}-${row.node}`)];
    const artifacts = names.map((name, index) => ({ id: 100 + index, name, digest: 'sha256:' + hash, expired: false, expires_at: new Date(now + 86400000).toISOString() }));
    const record: CompleteEvidence = { schema_version: 1, kind: 'complete', repository: CI_REPOSITORY, source_commit: commit, tree: commit, workflow_sha: commit,
        run_id: 12, attempt: 2, event: 'push', branch: 'main', workflow: '.github/workflows/ci.yml', pr: null, created_at: new Date(now).toISOString(), expires_at: new Date(now + 86400000).toISOString(),
        policy_sha256: hash, version: '3.9.1', toolchain: { node: 'v24.21.0', npm: '11.19.0', typescript: '5.9.3', lock_sha256: hash }, coverage: { installations: 8, runtime_installations: 32, hosts: 16, native_capacity_cases: 197 }, inputs,
        delivery: Object.fromEntries(['SHA256SUMS', 'build-manifest.json', 'fbincon-claude-code-statusline-3.9.1.tgz', 'claude-code-statusline-3.9.1-source.tar.gz'].map(name => [name, hash])),
        receipts: Object.fromEntries(Array.from({ length: 56 }, (_, index) => ['ts06-case-' + index + '/installed.json', hash])), artifacts: artifacts.map(value => artifactIdentity(value)), executions: [
            ...TARGETS.map(target => ({target:target.os+'-'+target.arch,node:'v24.21.0'})),
            ...TARGETS.flatMap(target => Object.entries(inputs.versions).map(([runtime_case,node])=>({target:target.os+'-'+target.arch,runtime_case,node:'v'+node}))),
            ...HOSTS.map(host=>({target:({'ubuntu-24.04':'linux','windows-2025':'win32','macos-15':'darwin'} as Record<string,string>)[host.os]+'-'+host.claude,host:host.claude,host_sha256:hash,node:'v24.21.0'}))
        ].map((value,index)=>({...value,job_id:index+1,node_sha256:hash,execution:{run_id:12,attempt:1,job:'fixture'}})) };
    return { record, artifacts };
}
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
        const receipt = join(root, 'installed.json'); fs.writeFileSync(receipt, '{"status":"pass"}');
        record.receipts = fileReceipts(root);
        assert.doesNotThrow(() => verifyRecordedFiles(record, root));
        fs.writeFileSync(receipt, '{"status":"fail"}');
        assert.throws(() => verifyRecordedFiles(record, root), /receipts changed/u);
        fs.writeFileSync(receipt, '{"status":"pass"}');
        fs.writeFileSync(join(root, 'runtime.json'), '{}');
        assert.throws(() => verifyRecordedFiles(record, root), /receipts changed/u);
        fs.rmSync(join(root, 'runtime.json'));
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
