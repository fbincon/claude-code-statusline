import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeInputs } from '../runtime-inputs.js';
test('runtime selectors resolve once and only identical development versions share execution', () => {
    const index = ['v24.0.0', 'v22.0.0', 'v22.10.0', 'v22.9.0', 'v24.21.0', 'v26.0.0'].map(version => ({ version }));
    const shared = runtimeInputs(index, '24.21.0'); assert.deepEqual(shared.shared, ['24.x']);
    assert.equal(shared.versions['22.x'], '22.10.0'); assert.equal(shared.matrix.include.length, 24);
    const separate = runtimeInputs(index, '24.20.0'); assert.equal(separate.matrix.include.length, 32);
    assert.throws(() => runtimeInputs([], '24.21.0'));
});
