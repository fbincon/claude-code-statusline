import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { canonical } from '../../checks/impact-lock.ts';
import { createWorkerInput, fingerprintWorkerInput, restoreWorkerInput, type WorkerOrigin } from '../worker-input.ts';

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const origin: WorkerOrigin = { commit: 'a'.repeat(40), filename: 'fbincon-claude-code-statusline-3.9.0-beta.2.tgz',
    run_id: 102, producer_attempt: 2, candidate_name: 'ts06-candidate' };
function fixture(t: TestContext, identity = origin) {
    const root = fs.mkdtempSync(join(tmpdir(), 'worker-input-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const original = join(root, 'original'), light = join(root, 'light'), output = join(root, 'restored'); fs.mkdirSync(original);
    const write = (name: string, data: string) => fs.writeFileSync(join(original, name), data);
    const pkg = 'original npm package bytes', source = 'original source bytes', sourceName = 'claude-code-statusline-3.9.0-beta.2-source.tar.gz';
    write(identity.filename, pkg); write(sourceName, source); write('build-1.log', 'independent build log');
    const build = { schema_version: 1, commit: identity.commit, channel: 'preview', candidate_version: '3.9.0-beta.2', byte_identical: true,
        candidate: { file: identity.filename, sha256: sha(pkg) }, source: { file: sourceName, sha256: sha(source) },
        builds: [1, 2].map(round => ({ round, bytes: pkg.length, sha256: sha(pkg), node_sha256: sha('binary') })) };
    const setBuild = () => {
        write('build-manifest.json', JSON.stringify(build));
        write('SHA256SUMS', [identity.filename, sourceName, 'build-manifest.json'].map(name => `${sha(fs.readFileSync(join(original, name)))}  ${name}\n`).join(''));
    };
    setBuild();
    const runtime = { schema_version: 1, development: '24.21.0' }, plan = { schema_version: 2, kind: 'coverage-plan', head: identity.commit, runtime_inputs_sha256: sha(canonical(runtime)) };
    write('runtime-inputs.json', JSON.stringify(runtime, null, 3) + '\n'); write('coverage-plan.json', JSON.stringify(plan, null, 2) + '\n');
    const frozen = fingerprintWorkerInput(original, identity), expected = { input_sha256: frozen.input_sha256, candidate_id: 240, candidate_digest: 'sha256:' + sha('original ZIP') };
    const create = () => createWorkerInput(original, light, identity, expected);
    return { root, original, light, output, frozen, expected, write, setBuild, build, plan, runtime, sourceName, create };
}

test('two-file worker transport restores exactly the original package and three byte-identical physical inputs', t => {
    for (const candidate_name of ['ts06-candidate', 'ci-diagnostic-transfer-candidate']) {
        const identity = { ...origin, candidate_name }, f = fixture(t, identity);
        const before = fs.readdirSync(f.original).map(name => [name, fs.readFileSync(join(f.original, name))]);
        const created = f.create();
        assert.deepEqual(fs.readdirSync(f.light).sort(), [origin.filename, 'worker-input.json'].sort());
        assert.equal(sha(fs.readFileSync(join(f.light, 'worker-input.json'))), created.manifest_sha256);
        const restored = restoreWorkerInput(f.light, f.output, identity, { ...f.expected, candidate_digest: f.expected.candidate_digest.slice(7) }, created.manifest_sha256);
        assert.deepEqual(restored, created); assert.equal(created.package_sha256, f.frozen.package_sha256);
        assert.deepEqual(fs.readdirSync(f.output).sort(), ['SHA256SUMS', 'coverage-plan.json', 'runtime-inputs.json', origin.filename].sort());
        for (const name of fs.readdirSync(f.output)) assert.deepEqual(fs.readFileSync(join(f.output, name)), fs.readFileSync(join(f.original, name)));
        assert.deepEqual(fs.readdirSync(f.original).map(name => [name, fs.readFileSync(join(f.original, name))]), before);
        assert.throws(() => f.create(), /already exists/);
        assert.throws(() => restoreWorkerInput(f.light, f.output, identity, f.expected, created.manifest_sha256), /already exists/);
    }
});

test('producer rejects a mutation between original and light uploads, even for equivalent runtime JSON', t => {
    const f = fixture(t);
    f.write('runtime-inputs.json', JSON.stringify(f.runtime)); assert.throws(f.create, /inputs changed/);
    f.write('runtime-inputs.json', JSON.stringify({ ...f.runtime, development: '24.0.0' })); assert.throws(f.create, /different runtime/);
    f.write('runtime-inputs.json', JSON.stringify(f.runtime, null, 3) + '\n');
    f.write('coverage-plan.json', JSON.stringify({ ...f.plan, producers: [] })); assert.throws(f.create, /inputs changed/);
    f.write('coverage-plan.json', JSON.stringify({ ...f.plan, head: 'b'.repeat(40) })); assert.throws(f.create);
    f.write('coverage-plan.json', JSON.stringify(f.plan, null, 2) + '\n');
    f.build.builds[1]!.sha256 = sha('other build'); f.setBuild(); assert.throws(f.create);
    f.build.builds[1]!.sha256 = f.build.candidate.sha256; f.setBuild(); f.write(f.sourceName, 'another source'); assert.throws(f.create, /source archive differs/);
    f.write('SHA256SUMS', fs.readFileSync(join(f.original, 'SHA256SUMS'), 'utf8') + sha('x') + '  ../outside\n'); assert.throws(f.create, /inventory differs/);
    assert(!fs.existsSync(f.light));
});

test('worker checks independently supplied manifest, original immutable ID, ZIP digest, run, attempt, source, and artifact name', t => {
    const f = fixture(t), { manifest_sha256 } = f.create();
    for (const change of [{ candidate_id: f.expected.candidate_id + 1 }, { candidate_digest: sha('changed ZIP') }, { input_sha256: sha('changed plan') }]) {
        assert.throws(() => restoreWorkerInput(f.light, f.output, origin, { ...f.expected, ...change }, manifest_sha256));
    }
    for (const change of [{ run_id: origin.run_id + 1 }, { producer_attempt: 1 }, { commit: 'c'.repeat(40) }, { candidate_name: 'ci-diagnostic-transfer-candidate' }, { filename: '../outside.tgz' }]) {
        assert.throws(() => restoreWorkerInput(f.light, f.output, { ...origin, ...change }, f.expected, manifest_sha256));
    }
    assert.throws(() => restoreWorkerInput(f.light, f.output, origin, f.expected, sha('other manifest')), /manifest digest differs/);
    fs.writeFileSync(join(f.light, 'source.tar.gz'), 'unexpected');
    assert.throws(() => restoreWorkerInput(f.light, f.output, origin, f.expected, manifest_sha256), /inventory/);
    fs.unlinkSync(join(f.light, 'source.tar.gz')); fs.writeFileSync(join(f.light, origin.filename), 'wrong bytes');
    assert.throws(() => restoreWorkerInput(f.light, f.output, origin, f.expected, manifest_sha256), /tarball differs/);
    assert(!fs.existsSync(f.output));
});

test('substituting a self-consistent weaker plan cannot change the pre-upload snapshot on restore', t => {
    const f = fixture(t); f.create();
    const manifestPath = join(f.light, 'worker-input.json'), manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const bytes = Buffer.from(JSON.stringify({ ...f.plan, depth: 'short' }));
    manifest.files['coverage-plan.json'] = { sha256: sha(bytes), base64: bytes.toString('base64') };
    const edited = JSON.stringify(manifest); fs.writeFileSync(manifestPath, edited);
    assert.throws(() => restoreWorkerInput(f.light, f.output, origin, f.expected, sha(edited)), /differ from frozen/);
    assert(!fs.existsSync(f.output));
});

test('linked inputs and preexisting destinations cannot publish a partial or mixed candidate', t => {
    const f = fixture(t), { manifest_sha256 } = f.create();
    const linked = join(f.root, 'redirect'); fs.symlinkSync(f.light, linked, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => restoreWorkerInput(linked, f.output, origin, f.expected, manifest_sha256));
    assert(!fs.existsSync(f.output));
    fs.mkdirSync(f.output); fs.writeFileSync(join(f.output, 'prior.txt'), 'prior');
    assert.throws(() => restoreWorkerInput(f.light, f.output, origin, f.expected, manifest_sha256), /already exists/);
    assert.deepEqual(fs.readdirSync(f.output), ['prior.txt']);
    assert.equal(fs.readFileSync(join(f.output, 'prior.txt'), 'utf8'), 'prior');
    fs.unlinkSync(join(f.light, origin.filename)); fs.mkdirSync(join(f.light, origin.filename));
    assert.throws(() => restoreWorkerInput(f.light, join(f.root, 'other'), origin, f.expected, manifest_sha256), /Invalid worker input/);
    assert(!fs.existsSync(join(f.root, 'other')));
});

test('raw pinned Node CLI restores a prior successful producer on rerun, rejecting another run and future producer attempts', t => {
    const f = fixture(t), script = resolve('tools/build/worker-input.ts');
    const args = ['--commit', origin.commit, '--filename', origin.filename, '--run-id', String(origin.run_id), '--attempt', String(origin.producer_attempt)];
    const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: String(origin.run_id), GITHUB_RUN_ATTEMPT: '2', GITHUB_OUTPUT: join(f.root, 'actions-output') };
    const call = (argv: string[], overrides = {}) => execFileSync(process.execPath, [script, ...argv], { cwd: f.root, env: { ...env, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    assert.deepEqual(JSON.parse(call(['fingerprint', f.original, ...args])), f.frozen);
    const ref = ['--candidate-id', String(f.expected.candidate_id), '--candidate-digest', f.expected.candidate_digest, '--input-sha256', f.expected.input_sha256];
    const created = JSON.parse(call(['create', f.original, f.light, ...args, ...ref]));
    const restore = ['restore', f.light, f.output, ...args, ...ref, '--manifest-sha256', created.manifest_sha256];
    assert.throws(() => call(restore, { GITHUB_RUN_ID: '987' }), /Different workflow run/);
    assert.throws(() => call(restore, { GITHUB_RUN_ATTEMPT: '1' }), /Different producer attempt/);
    assert.deepEqual(JSON.parse(call(restore, { GITHUB_RUN_ATTEMPT: '3' })), created);
    assert(fs.readFileSync(env.GITHUB_OUTPUT, 'utf8').includes(`manifest_sha256=${created.manifest_sha256}\n`));
});
