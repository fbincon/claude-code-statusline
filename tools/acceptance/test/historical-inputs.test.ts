import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadHistorical, prepareHistorical, transientDownload, verifyHistorical } from '../historical-inputs.js';
import { sanitizeLog } from '../diagnostics.js';
const bytes = gzipSync('immutable fixture'), digest = createHash('sha256').update(bytes).digest('hex');
test('historical preparation retries only eligible failures and verifies downloaded bytes', async () => {
    const sleeps: number[] = [], records: any[] = []; let calls = 0;
    const result = await downloadHistorical('https://example.invalid/fixed.tgz', digest, {
        fetch: (async () => { calls++; if (calls === 1) throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect'), { code: 'UND_ERR_CONNECT_TIMEOUT' }) }); return calls === 2 ? new Response('', { status: 503 }) : new Response(bytes); }) as typeof fetch,
        sleep: async ms => { sleeps.push(ms); }, record: entry => records.push(entry),
    });
    assert.deepEqual(result, bytes); assert.deepEqual(sleeps, [1000, 2000]);
    assert.deepEqual(records.map(row => row.retry), [true, true, false]);
});
test('historical preparation rejects corruption and permanent failures without retry', async () => {
    for (const response of [new Response('', { status: 403 }), new Response('not gzip'), new Response(gzipSync('wrong bytes'))]) {
        let calls = 0;
        await assert.rejects(downloadHistorical('https://example.invalid/fixed.tgz', digest, { fetch: (async () => { calls++; return response; }) as typeof fetch }));
        assert.equal(calls, 1);
    }
    assert.throws(() => verifyHistorical(bytes, '0'.repeat(64)));
    assert.equal(transientDownload(Object.assign(new Error('certificate'), { code: 'CERT_HAS_EXPIRED' })), false);
});
test('historical transient exhaustion remains a failure after three attempts', async () => {
    let calls = 0;
    await assert.rejects(downloadHistorical('https://example.invalid/fixed.tgz', digest, { fetch: (async () => { calls++; return new Response('', { status: 429 }); }) as typeof fetch, sleep: async () => {} }));
    assert.equal(calls, 3);
});
test('restored historical cache and consumer inputs fail closed on corruption', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'historical-corruption-'));
    const key = 'TS06_LEGACY_370_ARTIFACT', previous = process.env[key];
    try {
        delete process.env[key];
        const archive = join(root, 'bad.tgz'); fs.writeFileSync(archive, bytes);
        await assert.rejects(prepareHistorical('3.7.0', archive), /SHA-256 mismatch/u);
        await assert.rejects(prepareHistorical('3.7.0', root), /Invalid cached/u);
        process.env[key] = archive;
        const output = join(root, 'output.tgz');
        await assert.rejects(prepareHistorical('3.7.0', output), /SHA-256 mismatch/u);
        assert.equal(fs.existsSync(output), false);
    } finally {
        if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('diagnostics redact supplied credentials, bearer values and URL credentials', () => {
    const result = sanitizeLog('secret-value Bearer abc.def https://user:pass@host/path?token=private&ok=1', { API_KEY: 'secret-value' });
    for (const secret of ['secret-value', 'abc.def', 'user:pass', 'private']) assert(!result.includes(secret));
    assert(result.includes('&ok=1'));
});
