import test from 'node:test';
import assert from 'node:assert/strict';
import { testResponsibility } from '../test-responsibilities.js';
test('responsibilities preserve sensitive serial suites and include unknown tests', () => {
    assert.deepEqual(testResponsibility('packages/core/dist/test/math.test.js'), { responsibility: 'pure-core', serial: false });
    for (const file of ['packages/platform/dist/test/source-process.test.js', 'packages/tui/dist/test/state.test.js', 'dist/typescript/tools/build/test/verify.test.js', 'packages/cli/dist/test/git.test.js', 'packages/cli/dist/test/git-policy.test.js']) assert.equal(testResponsibility(file).serial, true);
    assert.deepEqual(testResponsibility('unknown.test.js'), { responsibility: 'unclassified-full', serial: true });
    assert.equal(testResponsibility('packages\\platform\\dist\\test\\storage.test.js').serial, true);
});
