import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAcceptanceProducers } from '../../checks/acceptance-producers.js';

test('repository acceptance producers are registered and documented', () => {
    assert.deepEqual(checkAcceptanceProducers(process.cwd()), []);
});
