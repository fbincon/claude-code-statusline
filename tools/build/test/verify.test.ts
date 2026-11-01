import { VERSION } from '@fbincon/statusline-core/release';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import { readTar, sha256, sums, verifyChecksums } from '../files.js';
import { verifyCandidate, verifyContents } from '../verify.js';
import { PACKAGE, version, identity, publicChannel, channel } from '../model.js';
import { candidateEntries as fixture } from './fixtures/delivery.js';
const commit = 'a'.repeat(40);
test('tests.integration.test_publish_package.DistributionTests.test_accepts_only_the_expected_packages_and_entry_point', () => { assert.equal(verifyContents(fixture(), commit).source.commit, commit); });
test('tests.integration.test_publish_package.DistributionTests.test_wrong_distribution_names_versions_and_entry_points_fail', () => {
    for (const mutate of [(p: any) => p.name = 'other', (p: any) => p.version = '1.0.0', (p: any) => p.bin.other = 'a.js', (p: any) => p.dependencies.koffi = '3.3.2']) {
        const entries = fixture(), manifest = JSON.parse(entries.get('package.json')!.toString()); mutate(manifest); entries.set('package.json', Buffer.from(JSON.stringify(manifest))); assert.throws(() => verifyContents(entries, commit));
    }
});
test('tests.integration.test_publish_package.DistributionTests.test_checksum_manifest_rejects_paths_duplicates_and_missing_entries', () => {
    for (const raw of ['abc  file.tgz', 'a'.repeat(64) + '  ../file.tgz', 'a'.repeat(64) + '  file.tgz\n' + 'a'.repeat(64) + '  file.tgz']) assert.throws(() => sums(raw));
    assert.deepEqual(sums('a'.repeat(64) + '  file.tgz\n'), { 'file.tgz': 'a'.repeat(64) });
});
test('tests.integration.test_publish_package.DistributionTests.test_missing_extra_and_corrupt_assets_fail', t => {
    const directory = fs.mkdtempSync(join(tmpdir(), 'candidate-corruption-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const artifact = join(directory, 'candidate.tgz'); fs.writeFileSync(artifact, 'damaged tgz'); fs.writeFileSync(join(directory, 'SHA256SUMS'), '0'.repeat(64) + '  candidate.tgz\n');
    assert.throws(() => verifyCandidate(artifact, commit), /checksum/);
    for (const name of ['node_modules/@koromix/koffi-win32-x64/koffi.node', 'node_modules/@fbincon/statusline-cli/resources/statusline-config/SKILL.md', 'node_modules/@fbincon/statusline-core/resources/i18n/locales/ja.json']) {
        const entries = fixture(); entries.delete(name); assert.throws(() => verifyContents(entries, commit));
    }
    const extra = fixture(); extra.set('private-validation.json', Buffer.from('secret fixture')); assert.throws(() => verifyContents(extra, commit));
});
test('tests.integration.test_publish_package.AcceptanceTests.test_read_only_preparation_rejects_a_receipt_from_another_commit', () => { assert.throws(() => verifyContents(fixture(), 'b'.repeat(40)), /source commit/); });
test('tests.integration.test_native_resources.NativeResourceTests.test_linked_runtime_directory_is_not_packaged', { skip: process.platform === 'win32' }, t => {
    const directory = fs.mkdtempSync(join(tmpdir(), 'candidate-link-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(join(directory, 'package')); fs.writeFileSync(join(directory, 'outside'), 'private'); fs.symlinkSync('../outside', join(directory, 'package/link'));
    const artifact = join(directory, 'link.tgz'); tar.c({ cwd: directory, file: artifact, sync: true, gzip: true }, ['package']);
    assert.throws(() => readTar(artifact), /Unsafe/);
});
test('delivery preparation rejects missing, extra and corrupt source/checksum assets', t => {
    const directory = fs.mkdtempSync(join(tmpdir(), 'candidate-delivery-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.writeFileSync(join(directory, 'source.tgz'), 'source'); fs.writeFileSync(join(directory, 'SHA256SUMS'), sha256('source') + '  source.tgz\n');
    assert.equal(verifyChecksums(directory, ['source.tgz'])['source.tgz'], sha256('source'));
    assert.throws(() => verifyChecksums(directory, ['source.tgz', 'candidate.tgz']), /Incomplete/);
    assert.throws(() => verifyChecksums(directory, []), /unexpected/);
    fs.writeFileSync(join(directory, 'source.tgz'), 'corrupt'); assert.throws(() => verifyChecksums(directory, ['source.tgz']), /mismatch/);
});

test('public release package identity, publishing metadata and Mod versions are enforced', () => {
    assert.equal(verifyContents(fixture(publicChannel()), commit).source.version, VERSION);
    for (const [path, mutate] of [
        ['package.json', (p: any) => p.publishConfig.tag = publicChannel() === 'stable' ? 'beta' : 'latest'],
        ['package.json', (p: any) => p.private = true],
        ['candidate.json', (p: any) => p.application_version = '2.0.0'],
        ['node_modules/@fbincon/statusline-cli/resources/statusline-native/resource-manifest.json', (p: any) => p.backend_version = '2.0.0'],
    ] as const) {
        const entries = fixture(publicChannel()), value = JSON.parse(entries.get(path)!.toString()); mutate(value);
        entries.set(path, Buffer.from(JSON.stringify(value))); assert.throws(() => verifyContents(entries, commit));
    }
    assert.throws(() => identity(commit, publicChannel() === 'stable' ? 'preview' : 'stable'));
    assert.equal(channel('public'), publicChannel());
    assert.equal(publicChannel('3.1.0-beta.1'), 'preview');
    assert.equal(publicChannel('3.1.0'), 'stable');
    assert.throws(() => publicChannel('bad'));
    assert.throws(() => channel('invalid'));
});
