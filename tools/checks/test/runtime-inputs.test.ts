import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeInputs, readRuntimeIndex } from '../runtime-inputs.js';
test('runtime selectors resolve once and only identical development versions share execution', () => {
    const index = ['v24.0.0', 'v22.0.0', 'v22.10.0', 'v22.9.0', 'v24.21.0', 'v26.0.0'].map(version => ({ version }));
    const shared = runtimeInputs(index, '24.21.0'); assert.deepEqual(shared.shared, ['24.x']);
    assert.equal(shared.versions['22.x'], '22.10.0'); assert.equal(shared.matrix.include.length, 24);
    const separate = runtimeInputs(index, '24.20.0'); assert.equal(separate.matrix.include.length, 32);
    assert.throws(() => runtimeInputs([], '24.21.0'));
});
test('runtime input preparation retries transient HTTP failures but never accepts malformed input', async () => {
    let attempts = 0;
    const value = await readRuntimeIndex((async () => ++attempts < 3 ? new Response('', {status:503}) : Response.json([{version:'v24.21.0'}])) as typeof fetch, async () => {});
    assert.equal(attempts,3); assert.match(value.index_sha256,/^[a-f0-9]{64}$/u);
    attempts=0;
    await assert.rejects(readRuntimeIndex((async () => {attempts++;return Response.json({wrong:true});}) as typeof fetch,async()=>{}));
    assert.equal(attempts,1);
});
