/** Read one bounded JSON envelope in memory; no archive entry reaches the filesystem. */
import assert from 'node:assert/strict';
import { inflateRawSync, crc32 } from 'node:zlib';
export function envelopeBytes(zip: Buffer, filename: string): Buffer {
    assert(zip.length >= 22 && zip.length <= 4 * 1024 * 1024);
    let end = zip.length - 22;
    for (; end >= Math.max(0, zip.length - 65557); end--)
        if (zip.readUInt32LE(end) === 0x06054b50 && end + 22 + zip.readUInt16LE(end + 20) === zip.length) break;
    assert(end >= 0 && zip.readUInt32LE(end) === 0x06054b50 && end + 22 + zip.readUInt16LE(end + 20) === zip.length, 'Missing envelope ZIP directory');
    assert.equal(zip.readUInt16LE(end + 4), 0); assert.equal(zip.readUInt16LE(end + 6), 0);
    const count = zip.readUInt16LE(end + 10); assert(count > 0 && count <= 64); assert.equal(zip.readUInt16LE(end + 8), count);
    let offset = zip.readUInt32LE(end + 16); assert(offset + zip.readUInt32LE(end + 12) === end);
    const matches: Buffer[] = [];
    for (let index = 0; index < count; index++) {
        assert(offset + 46 <= end); assert.equal(zip.readUInt32LE(offset), 0x02014b50);
        const flags = zip.readUInt16LE(offset + 8), method = zip.readUInt16LE(offset + 10), crc = zip.readUInt32LE(offset + 16);
        const compressed = zip.readUInt32LE(offset + 20), size = zip.readUInt32LE(offset + 24), nameSize = zip.readUInt16LE(offset + 28);
        const next = offset + 46 + nameSize + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32); assert(next <= end);
        const name = zip.subarray(offset + 46, offset + 46 + nameSize).toString('utf8');
        if (name === filename) {
            assert.equal(flags & 1, 0, 'Encrypted envelope'); assert([0, 8].includes(method)); assert(size > 0 && size <= 2 * 1024 * 1024);
            const local = zip.readUInt32LE(offset + 42); assert(local + 30 <= offset); assert.equal(zip.readUInt32LE(local), 0x04034b50);
            const localNameSize = zip.readUInt16LE(local + 26), data = local + 30 + localNameSize + zip.readUInt16LE(local + 28);
            assert.equal(zip.subarray(local + 30, local + 30 + localNameSize).toString('utf8'), filename); assert(data + compressed <= offset);
            const input = zip.subarray(data, data + compressed), bytes = method === 0 ? input : inflateRawSync(input, { maxOutputLength: 2 * 1024 * 1024 });
            assert.equal(bytes.length, size); assert.equal(crc32(bytes), crc); matches.push(bytes);
        }
        offset = next;
    }
    assert.equal(offset, end); assert.equal(matches.length, 1, 'Missing or duplicate envelope'); return matches[0]!;
}
