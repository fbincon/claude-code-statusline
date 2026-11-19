import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { verifyGitSource } from '../build/candidate.js';
import { verifyDelivery } from '../build/verify.js';
import { digest } from '../checks/ci-evidence.js';
import { verifyLanguageEvidence } from '../checks/i18n-evidence.js';
import { releaseFilenames, requireReleasePolicyInArchive, sourceVersion } from '../checks/release-ci-policy.js';
import { sourceStableApproval } from './approval.js';

export function deliveryHashes(directory: string, version: string) {
    return Object.fromEntries(Object.values(releaseFilenames(version)).map(file => [file, digest(fs.readFileSync(join(directory, file)))]));
}

export function verifyReleaseDelivery(directory: string, commit: string) {
    const version = sourceVersion(commit);
    const delivery = verifyDelivery(join(directory, releaseFilenames(version).package), commit);
    requireReleasePolicyInArchive(delivery.sourceEntries, commit);
    const source = new Map(delivery.sourceEntries);
    source.delete('.candidate-source.json');
    const tree = execFileSync('git', ['--no-replace-objects', 'ls-tree', '-rz', '--full-tree', commit],
        { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    verifyGitSource(source, tree);
    assert.equal(delivery.source.application_version, version);
    assert(delivery.language, 'Release requires source-bound language readiness');
    verifyLanguageEvidence(delivery.language, delivery.sourceEntries, commit, true);
    const channel = delivery.source.channel;
    assert(channel === 'stable' || channel === 'preview');
    const approval = channel === 'stable' ? sourceStableApproval(delivery.sourceEntries, version) : null;
    return { ...delivery, channel, approval };
}
