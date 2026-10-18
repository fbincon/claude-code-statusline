/** Bind operator observations to verified source and an actual installed package. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { verifyDelivery } from '../build/verify.js';
import { sha256 } from '../build/files.js';
import { sourceHashes } from '../migration/ts-03/common.js';
import { TARGETS } from '../build/model.js';

export const artifactOptions = { artifact: { type: 'string' }, commit: { type: 'string' }, 'installed-root': { type: 'string' } } as const;
export function artifactEvidence(values: { artifact?: string; commit?: string; 'installed-root'?: string }) {
    if (!values.artifact && !values.commit && !values['installed-root']) return null;
    if (!values.artifact || !values.commit || !values['installed-root']) throw new Error('Supply --artifact, --commit and --installed-root together');
    const product = verifyDelivery(resolve(values.artifact), values.commit), root = fs.realpathSync(values['installed-root']);
    assert.deepEqual(product.source.source_hashes, sourceHashes(), 'Collector checkout differs from the artifact source');
    assert.deepEqual(JSON.parse(fs.readFileSync(join(root, 'candidate.json'), 'utf8')), product.source, 'Installed identity differs');
    const otherNative = TARGETS.filter(target => target !== process.platform + '-' + process.arch).map(target => 'node_modules/@koromix/koffi-' + target + '/');
    for (const [name, hash] of Object.entries(product.source.files)) {
        const path = join(root, name);
        if (!fs.existsSync(path) && otherNative.some(prefix => name.startsWith(prefix))) continue;
        assert.equal(sha256(fs.readFileSync(path)), hash, 'Installed file differs: ' + name);
    }
    return { commit: product.source.commit, version: product.source.application_version, package: product.source.name, tarball_sha256: product.sha256, installed_root: root };
}
