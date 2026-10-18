import test from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, isPrerelease, editorsEnabledByDefault } from '../src/release.js';

test('TS preview channel and editor defaults are independent; legacy defaults remain readable', () => {
    assert.equal(isPrerelease(VERSION), true);
    assert.equal(editorsEnabledByDefault(VERSION), true);
    for (const version of ['2.0.0a1', '2.0.0rc1', '2.0.0-beta.1']) {
        assert.equal(isPrerelease(version), true);
        assert.equal(editorsEnabledByDefault(version), false);
    }
    assert.equal(isPrerelease('3.0.0'), false);
    assert.equal(editorsEnabledByDefault('3.0.0'), true);
});
