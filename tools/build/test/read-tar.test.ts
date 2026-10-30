import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { readTar, sha256 } from '../files.js';

const READ_BOUNDARY = 16 * 1024 * 1024;
function deterministicBytes(length: number, seed: number): Buffer {
    const bytes = Buffer.allocUnsafe(length);
    let state = seed >>> 0;
    for (let offset = 0; offset < length; offset++) {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        bytes[offset] = state >>> 24;
    }
    return bytes;
}
function archive(t: test.TestContext, original: Map<string, Buffer>, gzip: boolean) {
    const directory = fs.mkdtempSync(join(tmpdir(), 'read-tar-bytes-')), source = join(directory, 'source'), artifact = join(directory, gzip ? 'source.tar.gz' : 'source.tar');
    t.after(() => { removeTree(directory); assert(!fs.existsSync(directory)); });
    fs.mkdirSync(source);
    for (const [name, bytes] of original) {
        const target = join(source, name); fs.mkdirSync(dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    }
    tar.c({ cwd: source, file: artifact, sync: true, gzip, portable: true, noMtime: true, prefix: 'package', noDirRecurse: true }, [...original.keys()]);
    return artifact;
}
function assertContents(artifact: string, original: Map<string, Buffer>) {
    const actual = readTar(artifact);
    assert.deepEqual([...actual.keys()].sort(), [...original.keys()].sort(), 'Archive path inventory differs');
    for (const [name, bytes] of original) {
        const received = actual.get(name)!;
        assert.equal(received.length, bytes.length, 'Archive entry length differs: ' + name);
        assert(received.equals(bytes), 'Archive entry bytes differ: ' + name + '; expected ' + sha256(bytes) + ', received ' + sha256(received));
    }
}

test('tar reader preserves the paths, lengths and bytes of compact archive entries', t => {
    const original = new Map([
        ['nested/control.ts', Buffer.from('export const message = "Français 中文";\n')],
        ['empty.bin', Buffer.alloc(0)],
        ['binary.bin', Buffer.from([0, 255, 13, 10, 128, 1])],
    ]);
    assertContents(archive(t, original, false), original);
});

for (const gzip of [false, true]) test(`tar reader owns entry bytes across the 16 MiB input boundary (${gzip ? 'gzip control' : 'raw archive'})`, t => {
    // Two ordinary 512-byte headers put the short source entry 512 bytes before
    // the boundary. A distinct following payload fills the next reused buffer.
    // Low-compression deterministic bytes also exercise gzip without exceeding
    // the archive reader's unchanged decompression-ratio safety limit.
    const padding = deterministicBytes(READ_BOUNDARY - 1536, 0x4c8f0b25);
    const crossing = Buffer.from('export const bridge = "original payload";\n'.repeat(250)).subarray(0, 8192);
    const original = new Map([
        ['00-padding.bin', padding],
        ['01-crossing.ts', crossing],
        ['02-after.bin', deterministicBytes(READ_BOUNDARY + 1024, 0x89abcdef)],
    ]);
    assert.equal(crossing.length, 8192);
    const artifact = archive(t, original, gzip);
    if (!gzip) {
        assert(fs.statSync(artifact).size > 2 * READ_BOUNDARY, 'Fixture must force reuse of the complete input buffer');
        const header = Buffer.alloc(512), descriptor = fs.openSync(artifact, 'r');
        try { assert.equal(fs.readSync(descriptor, header, 0, header.length, 512 + padding.length), header.length); }
        finally { fs.closeSync(descriptor); }
        assert.equal(header.subarray(0, 100).toString('utf8').split('\0')[0], 'package/01-crossing.ts');
        assert.equal(512 + padding.length + 512, READ_BOUNDARY - 512);
    }
    assertContents(artifact, original);
});
