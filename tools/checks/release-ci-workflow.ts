import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { git } from './ci-evidence.ts';
import {
    currentExecution, mainCandidate, mergeSource, pullSource, recordCandidate, recordMain, recordTag, selectReleaseTag,
    verifyDeliveryBytes, verifyMainPackage, type AcceptedCandidate, type TagInput,
} from './release-ci-evidence.ts';
import { buildChecks, candidateCases, integrationCases, releaseFilenames, releasePolicyAt, sourceVersion } from './release-ci-policy.ts';

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { directory: { type: 'string' }, file: { type: 'string' }, selection: { type: 'string' } },
});
assert.equal(positionals.length, 1);
const commit = git('rev-parse', 'HEAD');
const eventName = process.env.GITHUB_EVENT_NAME;

function write(file: string | undefined, value: unknown) {
    assert(file);
    fs.mkdirSync(dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

function json(file: string | undefined) {
    assert(file);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function outputs(values: Record<string, string | number>) {
    assert(process.env.GITHUB_OUTPUT);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

function candidatePull() {
    const event = json(process.env.GITHUB_EVENT_PATH);
    if (eventName === 'workflow_dispatch') {
        assert.equal(process.env.GITHUB_REF_TYPE, 'branch');
        return undefined;
    }
    assert.equal(eventName, 'pull_request');
    assert(['opened', 'reopened', 'synchronize', 'ready_for_review'].includes(event.action));
    const pull = pullSource(event.pull_request);
    assert.equal(pull.head, commit, 'Checkout differs from the release PR head');
    return pull;
}

async function currentMerge() {
    assert.equal(eventName, 'pull_request');
    const event = json(process.env.GITHUB_EVENT_PATH);
    assert.equal(event.action, 'closed'); assert.equal(event.pull_request.merged, true);
    const merge = await mergeSource(event.pull_request);
    assert.equal(merge.commit, commit);
    return merge;
}

async function currentTag() {
    assert.equal(eventName, 'push'); assert.equal(process.env.GITHUB_REF_TYPE, 'tag');
    assert.equal(json(process.env.GITHUB_EVENT_PATH).deleted, false);
    return selectReleaseTag(process.env.GITHUB_REF_NAME!, commit);
}

function selectionOutputs(input: AcceptedCandidate) {
    const { candidate, candidate_ref, merge } = input;
    outputs({ source: merge.head, version: candidate.version, filename: releaseFilenames(candidate.version).package,
        run_id: candidate_ref.run_id, package_id: candidate.package.id, delivery: JSON.stringify(candidate.delivery) });
}

switch (positionals[0]) {
    case 'build': {
        const pull = candidatePull();
        assert(releasePolicyAt(commit)); assert(values.directory);
        if (pull) git('diff', '--check', pull.base, pull.head, '--');
        const directory = resolve(values.directory), version = sourceVersion(commit);
        const { buildCandidate } = await import('../build/candidate.js');
        const { publicChannel } = await import('../build/model.js');
        const { deliveryHashes, verifyReleaseDelivery } = await import('../release/ci-delivery.js');
        const channel = publicChannel(version);
        await buildCandidate(commit, directory, undefined, channel);
        verifyReleaseDelivery(directory, commit);
        const temporary = fs.mkdtempSync(join(tmpdir(), 'statusline-release-rebuild-'));
        try {
            const rebuilt = join(temporary, 'rebuilt'), files = releaseFilenames(version);
            await buildCandidate(commit, rebuilt, join(directory, files.source), channel);
            const delivery = deliveryHashes(directory, version);
            verifyDeliveryBytes(rebuilt, version, delivery);
            outputs({ version, filename: files.package, source_archive: files.source, delivery: JSON.stringify(delivery),
                matrix: JSON.stringify({ include: candidateCases(commit) }) });
        } finally {
            fs.rmSync(temporary, { recursive: true, force: true });
        }
        break;
    }
    case 'build-receipt': {
        const execution = currentExecution();
        assert.equal(process.env.GITHUB_JOB, 'build');
        assert(process.env.DELIVERY_HASHES && process.env.PACKAGE_DIGEST);
        write(values.file, { schema_version: 1, kind: 'release-build', status: 'pass', commit, version: sourceVersion(commit),
            execution: { ...execution, job: process.env.GITHUB_JOB }, workflow_sha: execution.workflow_sha,
            checks: buildChecks, delivery: JSON.parse(process.env.DELIVERY_HASHES),
            package_id: Number(process.env.PACKAGE_ID), package_digest: 'sha256:' + process.env.PACKAGE_DIGEST.replace(/^sha256:/u, '') });
        break;
    }
    case 'candidate':
        write(values.file, await recordCandidate(candidatePull(), commit));
        break;
    case 'main-select': {
        const input = await mainCandidate(await currentMerge());
        write(values.file, input);
        selectionOutputs(input);
        outputs({ matrix: JSON.stringify({ include: integrationCases(commit) }) });
        break;
    }
    case 'main-preflight': {
        const input: AcceptedCandidate = json(values.selection);
        assert.deepEqual(input.merge, await currentMerge()); assert(values.directory);
        write(values.file, await verifyMainPackage(input, values.directory));
        break;
    }
    case 'main-accept':
        write(values.file, await recordMain(await mainCandidate(await currentMerge())));
        break;
    case 'tag-select': {
        const input = await currentTag();
        selectionOutputs(input);
        write(values.file, input);
        break;
    }
    case 'tag-accept': {
        const input: TagInput = json(values.selection);
        assert(values.directory);
        const { verifyReleaseDelivery } = await import('../release/ci-delivery.js');
        verifyDeliveryBytes(values.directory, input.candidate.version, input.candidate.delivery);
        verifyReleaseDelivery(values.directory, commit);
        assert.deepEqual(input, await currentTag(), 'Release evidence changed during tag verification');
        write(values.file, await recordTag(input));
        break;
    }
    case 'verify-files':
        assert(values.directory && process.env.RELEASE_VERSION && process.env.DELIVERY_HASHES);
        verifyDeliveryBytes(values.directory, process.env.RELEASE_VERSION, JSON.parse(process.env.DELIVERY_HASHES));
        break;
    default:
        throw new Error('Unknown release CI command');
}
