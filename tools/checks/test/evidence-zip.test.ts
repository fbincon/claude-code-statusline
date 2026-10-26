import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import { envelopeBytes } from '../evidence-zip.js';
function zip(entries: { name: string; body: string; method: number }[]): Buffer {
    const files: Buffer[] = [], records: Buffer[] = []; let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name), body = Buffer.from(entry.body), compressed = entry.method === 8 ? deflateRawSync(body) : body;
        const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(entry.method, 8); local.writeUInt16LE(name.length, 26);
        const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(entry.method, 10);
        central.writeUInt32LE(crc32(body), 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(body.length, 24);
        central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
        files.push(local, name, compressed); records.push(central, name); offset += local.length + name.length + compressed.length;
    }
    const directory = Buffer.concat(records), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); return Buffer.concat([...files, directory, end]);
}
test('envelope reader supports stored and deflated artifacts without shell or extraction', () => {
    for (const method of [0, 8]) {
        const bytes = zip([{ name: 'ci-evidence.json', body: '{"schema_version":1}', method }, { name: 'candidate-acceptance.json', body: '{}', method }]);
        assert.equal(envelopeBytes(bytes, 'ci-evidence.json').toString(), '{"schema_version":1}');
        assert.throws(() => envelopeBytes(bytes, 'missing.json'));
        assert.throws(() => envelopeBytes(bytes.subarray(0, bytes.length - 1), 'ci-evidence.json'));
        bytes[31] = 0; assert.throws(() => envelopeBytes(bytes, 'ci-evidence.json'));
    }
    assert.throws(() => envelopeBytes(zip([{ name: 'x', body: '{}', method: 8 }, { name: 'x', body: '{}', method: 8 }]), 'x'), /duplicate/u);
    assert.throws(() => envelopeBytes(zip([{ name: 'x', body: 'x'.repeat(2 * 1024 * 1024 + 1), method: 8 }]), 'x'));
});
