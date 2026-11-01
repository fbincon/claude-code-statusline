import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import { envelopeBytes } from '../evidence-zip.js';
import { artifactJson, digest } from '../ci-evidence.js';
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
test('original evidence reads recover temporary transfers from the pinned ID and keep credentials off object storage', async t => {
    const previous = process.env.GH_TOKEN; process.env.GH_TOKEN = 'isolated-test-token';
    t.after(() => { if (previous === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = previous; });
    const raw = zip([{name:'receipt.json',body:'{"status":"pass"}',method:8}]);
    const artifact = {id:42,name:'ci-scoped-linux',expired:false,expires_at:new Date(Date.now()+60_000).toISOString(),digest:'sha256:'+digest(raw)};
    let api = 0, storage = 0, denied = false;
    t.mock.method(globalThis,'fetch', async (input: string | URL | Request, options?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === 'api.github.com') {
            api++; assert(url.pathname.endsWith('/actions/artifacts/42/zip'));
            assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer isolated-test-token');
            if (denied) return new Response(null,{status:403});
            if (api === 1) return new Response(null,{status:429,headers:{'Retry-After':'0'}});
            return new Response(null,{status:302,headers:{location:'https://storage.invalid/original'}});
        }
        assert.equal(url.hostname,'storage.invalid'); assert.equal(options?.headers,undefined);
        return ++storage === 1 ? new Response(null,{status:503}) : new Response(new Uint8Array(raw));
    });
    assert.deepEqual(await artifactJson(artifact,'receipt.json'),{status:'pass'});
    assert.equal(api,3); assert.equal(storage,2);
    await assert.rejects(artifactJson({...artifact,digest:'sha256:'+'f'.repeat(64)},'receipt.json'),/digest mismatch/u);
    assert.equal(api,4); assert.equal(storage,3);
    denied = true; await assert.rejects(artifactJson(artifact,'receipt.json'));
    assert.equal(api,5); assert.equal(storage,3);
});
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
