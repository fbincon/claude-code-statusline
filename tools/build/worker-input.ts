/** Physical workers consume the frozen package and plan, independently of the complete release artifact. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical } from '../checks/impact-lock.ts';

const manifestName = 'worker-input.json';
const metadata = ['SHA256SUMS', 'coverage-plan.json', 'runtime-inputs.json'] as const;
type MetadataName = typeof metadata[number];
const MiB = 1024 * 1024;
const limits: Record<MetadataName, number> = { SHA256SUMS: 16 * 1024, 'coverage-plan.json': 4 * MiB, 'runtime-inputs.json': MiB };
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const json = (bytes: Buffer) => JSON.parse(bytes.toString('utf8'));
const hashPattern = /^[a-f0-9]{64}$/u;
const filesFor = <T>(get: (name: MetadataName) => T): Record<MetadataName, T> => ({
    SHA256SUMS: get('SHA256SUMS'), 'coverage-plan.json': get('coverage-plan.json'), 'runtime-inputs.json': get('runtime-inputs.json'),
});

export interface WorkerOrigin {
    commit: string; filename: string; run_id: number; producer_attempt: number; candidate_name: string;
}
export interface CandidateObject { candidate_id: number; candidate_digest: string; input_sha256: string }
function positive(value: number): void { assert(Number.isSafeInteger(value) && value > 0, 'Invalid Actions identity'); }
function sourceFile(origin: WorkerOrigin): string {
    assert.match(origin.commit, /^[a-f0-9]{40}$/u);
    positive(origin.run_id); positive(origin.producer_attempt);
    assert(['ts06-candidate', 'ci-diagnostic-transfer-candidate'].includes(origin.candidate_name), 'Unexpected original candidate artifact name');
    const match = /^fbincon-claude-code-statusline-(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)\.tgz$/u.exec(origin.filename);
    assert(match, 'Unexpected public candidate filename');
    return 'claude-code-statusline-' + match[1] + '-source.tar.gz';
}
function originalObject(expected: CandidateObject) {
    positive(expected.candidate_id); assert.match(expected.input_sha256, hashPattern);
    const zip_sha256 = expected.candidate_digest.replace(/^sha256:/u, ''); assert.match(zip_sha256, hashPattern);
    return { id: expected.candidate_id, zip_sha256 };
}

function read(root: string, name: string, limit: number): Buffer {
    const path = join(root, name), entry = fs.lstatSync(path);
    assert(entry.isFile() && entry.size > 0 && entry.size <= limit, 'Invalid worker input: ' + name);
    const fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    try {
        const before = fs.fstatSync(fd);
        assert(before.isFile() && before.dev === entry.dev && before.ino === entry.ino && before.size === entry.size, 'Worker input changed: ' + name);
        const bytes = Buffer.alloc(before.size);
        let offset = 0;
        while (offset < bytes.length) {
            const n = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
            assert(n > 0, 'Truncated worker input: ' + name); offset += n;
        }
        const after = fs.fstatSync(fd);
        assert(after.size === before.size && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, 'Worker input changed: ' + name);
        return bytes;
    } finally { fs.closeSync(fd); }
}

function snapshot(origin: WorkerOrigin, pkg: Buffer, files: Record<MetadataName, Buffer>) {
    const source = sourceFile(origin), checksums = new Map<string, string>();
    for (const line of files.SHA256SUMS.toString('utf8').trimEnd().split('\n')) {
        const match = /^([a-f0-9]{64})  (\S+)$/u.exec(line);
        assert(match && !checksums.has(match[2]!), 'Invalid or duplicate original delivery checksum');
        checksums.set(match[2]!, match[1]!);
    }
    assert.deepEqual([...checksums.keys()].sort(), [origin.filename, source, 'build-manifest.json'].sort(), 'Original delivery inventory differs');
    const pkgIdentity = { file: origin.filename, bytes: pkg.length, sha256: digest(pkg) };
    assert.equal(checksums.get(origin.filename), pkgIdentity.sha256, 'Candidate tarball differs from original SHA256SUMS');
    const plan = json(files['coverage-plan.json']), runtime = json(files['runtime-inputs.json']);
    assert.equal(plan.schema_version, 2); assert.equal(plan.kind, 'coverage-plan'); assert.equal(plan.head, origin.commit);
    assert.equal(runtime.schema_version, 1); assert.equal(plan.runtime_inputs_sha256, digest(canonical(runtime)), 'Coverage plan uses different runtime inputs');
    const fileHashes = filesFor(name => digest(files[name]));
    const input_sha256 = digest(canonical({ origin, package: pkgIdentity, files: fileHashes }));
    return { source, checksums, pkgIdentity, fileHashes, input_sha256 };
}

function candidateFiles(directory: string, origin: WorkerOrigin) {
    sourceFile(origin); assert(fs.lstatSync(directory).isDirectory());
    const pkg = read(directory, origin.filename, 256 * MiB), files = filesFor(name => read(directory, name, limits[name]));
    const frozen = snapshot(origin, pkg, files);
    const buildBytes = read(directory, 'build-manifest.json', MiB), build = json(buildBytes);
    assert.equal(digest(buildBytes), frozen.checksums.get('build-manifest.json'));
    assert.equal(build.schema_version, 1); assert.equal(build.commit, origin.commit); assert.equal(build.byte_identical, true);
    assert.equal(origin.filename, `fbincon-claude-code-statusline-${build.candidate_version}.tgz`);
    assert.equal(build.channel, build.candidate_version.includes('-') ? 'preview' : 'stable');
    assert.deepEqual(build.candidate, { file: origin.filename, sha256: frozen.pkgIdentity.sha256 });
    assert.deepEqual(build.source, { file: frozen.source, sha256: frozen.checksums.get(frozen.source) });
    assert.equal(digest(read(directory, frozen.source, 512 * MiB)), build.source.sha256, 'Original source archive differs');
    assert(Array.isArray(build.builds) && build.builds.length === 2);
    for (const [index, round] of build.builds.entries()) {
        assert.equal(round.round, index + 1); assert.equal(round.sha256, frozen.pkgIdentity.sha256);
        assert.equal(round.bytes, pkg.length); assert.match(round.node_sha256, hashPattern);
    }
    return { pkg, files, ...frozen };
}

/** Build privately and publish all files together. Existing directories, including empty ones, are never reused. */
function publish(directory: string, entries: Record<string, Buffer>): void {
    const target = resolve(directory), parent = dirname(target);
    fs.mkdirSync(parent, { recursive: true });
    const lock = target + '.worker-input-lock'; fs.mkdirSync(lock);
    try {
        assert(!fs.lstatSync(target, { throwIfNoEntry: false }), 'Worker input destination already exists');
        const staging = fs.mkdtempSync(join(parent, '.worker-input-'));
        try {
            for (const [name, bytes] of Object.entries(entries)) fs.writeFileSync(join(staging, name), bytes, { flag: 'wx' });
            fs.renameSync(staging, target);
        } finally { fs.rmSync(staging, { recursive: true, force: true }); }
    } finally { fs.rmdirSync(lock); }
}

export function fingerprintWorkerInput(directory: string, origin: WorkerOrigin) {
    const { input_sha256, pkgIdentity } = candidateFiles(directory, origin);
    return { input_sha256, package_sha256: pkgIdentity.sha256, producer_attempt: origin.producer_attempt };
}
export function createWorkerInput(directory: string, output: string, origin: WorkerOrigin, expected: CandidateObject) {
    const candidate = originalObject(expected), input = candidateFiles(directory, origin);
    assert.equal(input.input_sha256, expected.input_sha256, 'Candidate inputs changed since the original upload was frozen');
    const manifest = Buffer.from(JSON.stringify({ schema_version: 1, kind: 'ci-worker-input', origin, candidate, input_sha256: input.input_sha256,
        package: input.pkgIdentity, files: filesFor(name => ({ sha256: input.fileHashes[name], base64: input.files[name].toString('base64') })),
    }, null, 2) + '\n');
    publish(output, { [origin.filename]: input.pkg, [manifestName]: manifest });
    return { manifest_sha256: digest(manifest), input_sha256: input.input_sha256, package_sha256: input.pkgIdentity.sha256, producer_attempt: origin.producer_attempt };
}
export function restoreWorkerInput(directory: string, output: string, origin: WorkerOrigin, expected: CandidateObject, manifestSha: string) {
    sourceFile(origin); const candidate = originalObject(expected); assert.match(manifestSha, hashPattern);
    assert(fs.lstatSync(directory).isDirectory());
    assert.deepEqual(fs.readdirSync(directory).sort(), [origin.filename, manifestName].sort(), 'Unexpected worker artifact inventory');
    const raw = read(directory, manifestName, 8 * MiB); assert.equal(digest(raw), manifestSha, 'Worker manifest digest differs');
    const manifest = json(raw); assert.equal(manifest.schema_version, 1); assert.equal(manifest.kind, 'ci-worker-input');
    assert.deepEqual(manifest.origin, origin, 'Worker source or Actions execution differs');
    assert.deepEqual(manifest.candidate, candidate, 'Original candidate artifact identity differs');
    assert.equal(manifest.input_sha256, expected.input_sha256, 'Frozen candidate input digest differs');
    assert.deepEqual(Object.keys(manifest.files).sort(), [...metadata].sort());
    const files = filesFor(name => {
        const entry = manifest.files[name]; assert(typeof entry.base64 === 'string' && entry.base64.length <= 4 * Math.ceil(limits[name] / 3));
        const bytes = Buffer.from(entry.base64, 'base64'); assert(bytes.length > 0 && bytes.length <= limits[name]);
        assert.equal(bytes.toString('base64'), entry.base64, 'Invalid worker metadata encoding');
        assert.equal(digest(bytes), entry.sha256, 'Worker metadata digest differs: ' + name); return bytes;
    });
    const pkg = read(directory, origin.filename, 256 * MiB), frozen = snapshot(origin, pkg, files);
    assert.deepEqual(manifest.package, frozen.pkgIdentity, 'Worker package identity differs');
    assert.equal(frozen.input_sha256, expected.input_sha256, 'Worker bytes differ from frozen candidate inputs');
    publish(output, { [origin.filename]: pkg, ...files });
    return { manifest_sha256: manifestSha, input_sha256: frozen.input_sha256, package_sha256: frozen.pkgIdentity.sha256, producer_attempt: origin.producer_attempt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals: [command, directory, output, ...extra] } = parseArgs({ allowPositionals: true, options: {
        commit: { type: 'string' }, filename: { type: 'string' }, 'run-id': { type: 'string' }, attempt: { type: 'string' },
        'candidate-name': { type: 'string', default: 'ts06-candidate' }, 'candidate-id': { type: 'string' },
        'candidate-digest': { type: 'string' }, 'input-sha256': { type: 'string' }, 'manifest-sha256': { type: 'string' },
    } });
    assert(directory && !extra.length && (command === 'fingerprint' ? !output : output));
    assert(values.commit && values.filename && basename(values.filename) === values.filename);
    const origin = { commit: values.commit, filename: values.filename, run_id: Number(values['run-id']), producer_attempt: Number(values.attempt), candidate_name: values['candidate-name'] };
    if (process.env.GITHUB_ACTIONS === 'true') {
        assert.equal(origin.run_id, Number(process.env.GITHUB_RUN_ID), 'Different workflow run');
        const current = Number(process.env.GITHUB_RUN_ATTEMPT);
        assert(command === 'restore' ? origin.producer_attempt <= current : origin.producer_attempt === current, 'Different producer attempt');
    }
    let result;
    if (command === 'fingerprint') result = fingerprintWorkerInput(directory, origin);
    else {
        assert(output && values['candidate-digest'] && values['input-sha256']);
        const expected = { candidate_id: Number(values['candidate-id']), candidate_digest: values['candidate-digest'], input_sha256: values['input-sha256'] };
        if (command === 'create') result = createWorkerInput(directory, output, origin, expected);
        else { assert(command === 'restore' && values['manifest-sha256']); result = restoreWorkerInput(directory, output, origin, expected, values['manifest-sha256']); }
    }
    if (process.env.GITHUB_OUTPUT) for (const [name, value] of Object.entries(result)) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
    console.log(JSON.stringify(result));
}
