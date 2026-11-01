/** Branch-dispatch diagnostics, with no release or promotion record writer. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256, verifyChecksums } from '../build/files.ts';

const json = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const full = 'ci-diagnostic-transfer-candidate', light = 'ci-diagnostic-transfer-worker';
function output(key: string, value: string) { fs.appendFileSync(process.env.GITHUB_OUTPUT!, key + '=' + value + '\n'); }
function delivery(directory: string) {
    const manifest = json(join(directory, 'build-manifest.json'));
    assert.equal(manifest.commit, process.env.GITHUB_SHA);
    const filename: string = manifest.candidate.file, source: string = manifest.source.file;
    assert.match(filename, /^fbincon-claude-code-statusline-[0-9A-Za-z.-]+\.tgz$/u);
    assert.match(source, /^claude-code-statusline-[0-9A-Za-z.-]+-source\.tar\.gz$/u);
    const files = verifyChecksums(directory, [filename, source, 'build-manifest.json']);
    assert.equal(files[filename], manifest.candidate.sha256); assert.equal(files[source], manifest.source.sha256);
    files.SHA256SUMS = sha256(fs.readFileSync(join(directory, 'SHA256SUMS')));
    return { filename, files };
}
interface ObjectId { id: number; name: string; digest: string }
function success(key: string, operation: 'upload' | 'download', recovery: string | undefined, attempts: number, name: string): ObjectId {
    const r = json(process.env[key]!); assert.equal(r.schema_version, 1); assert.equal(r.status, 'pass');
    assert.equal(r.operation, operation);
    if (recovery) { assert.equal(r.recovery, recovery); assert.equal(r.attempts, attempts); }
    else assert((r.recovery === 'none' && r.attempts === 1) || (r.recovery === 'retried' && r.attempts === 2));
    assert(r.elapsed_ms >= 0 && Number.isFinite(r.elapsed_ms)); assert.equal(r.artifacts.length, 1);
    const object = r.artifacts[0];
    assert(Number.isSafeInteger(object.id) && object.id > 0); assert.equal(object.name, name); assert.match(object.digest, /^sha256:[a-f0-9]{64}$/u);
    return { id: object.id, name: object.name, digest: object.digest };
}
function rejected(key: string, operation: string, attempts: number, error: RegExp, destination?: string) {
    assert.equal(process.env[key + '_OUTCOME'], 'failure');
    const r = json(process.env[key + '_RECEIPT']!);
    assert.equal(r.status, 'fail'); assert.equal(r.operation, operation); assert.equal(r.attempts, attempts); assert.match(r.error, error);
    if (destination) assert(!fs.existsSync(join(process.env.RUNNER_TEMP!, destination)), 'Failed download published a directory');
    return { operation, attempts, status: r.status };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [mode, directory] = process.argv.slice(2); assert(directory);
    const event = json(process.env.GITHUB_EVENT_PATH!);
    assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch'); assert.equal(process.env.GITHUB_REF_TYPE, 'branch');
    assert.equal(event.inputs.validation, 'artifact-transfer-probe');
    if (mode === 'identify') {
        const d = delivery(directory); output('filename', d.filename); output('delivery', JSON.stringify(d.files));
    } else if (mode === 'producer') {
        const original = success('FULL_RECEIPT', 'upload', 'reconciled', 1, full);
        const worker = success('LIGHT_RECEIPT', 'upload', 'retried', 2, light); assert.notEqual(original.id, worker.id);
        output('identities', JSON.stringify({ original, worker }));
    } else {
        assert.equal(mode, 'readback'); const d = delivery(directory);
        assert.deepEqual(d.files, JSON.parse(process.env.EXPECTED_DELIVERY!));
        const original = success('FULL_RECEIPT', 'download', undefined, 1, full);
        const worker = success('LIGHT_RECEIPT', 'download', 'retried', 2, light);
        assert.deepEqual({ original, worker }, JSON.parse(process.env.EXPECTED_IDENTITIES!));
        const restored = join(process.env.RUNNER_TEMP!, 'restored');
        for (const name of [d.filename, 'SHA256SUMS', 'runtime-inputs.json', 'coverage-plan.json'])
            assert(fs.readFileSync(join(restored, name)).equals(fs.readFileSync(join(directory, name))), 'Restored input differs: ' + name);
        const rejectedFaults = { digest: rejected('DIGEST', 'download', 1, /digest/iu, 'reject-digest'),
            permission: rejected('PERMISSION', 'download', 1, /403/u, 'reject-permission'),
            ambiguity: rejected('AMBIGUITY', 'upload', 1, /ambiguous/iu), exhausted: rejected('EXHAUSTED', 'download', 2, /503/u, 'reject-exhausted') };
        const result = { schema_version: 1, kind: 'artifact-transfer-diagnostic', promotable: false, commit: process.env.GITHUB_SHA,
            run_id: Number(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT), producer_attempt: Number(process.env.PRODUCER_ATTEMPT),
            original, worker, delivery: d.files, uploads: { confirmed_after_lost_ack: 1, transient_before_commit: 2 }, download_attempts: 2, rejected: rejectedFaults };
        const path = join(process.env.RUNNER_TEMP!, 'transfer-diagnostic.json');
        fs.writeFileSync(path, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify(result)); fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY!, '\n```json\n' + JSON.stringify(result, null, 2) + '\n```\n');
    }
}
