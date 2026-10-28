import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, compatibility, runtimeCompatibility, PACKAGE_COMPATIBILITY } from '../src/management/compatibility.js';
import { exactVersion } from '../src/management/package.js';
test('package ordering is exact SemVer, including prerelease numeric identifiers', () => {
    for (const [before, after] of [['3.7.0', '3.8.0'], ['3.8.0-beta.2', '3.8.0-beta.10'], ['3.8.0-beta.1', '3.8.0'], ['3.8.0-2', '3.8.0-alpha']]) {
        assert.equal(compareVersions(before!, after!), -1);
        assert.equal(compareVersions(after!, before!), 1);
    }
    for (const value of ['latest', 'v3.8.0', '03.8.0', '3.8.0-beta.01', '3.8.0;echo', '3.8'])
        assert(!exactVersion(value));
    assert.equal(compareVersions('3.8.0', '3.8.0'), 0);
});
test('compatibility is explicit, bounded and independent of display/editor schema changes', () => {
    const historical = compatibility(undefined, '3.7.0');
    assert.equal(historical.editor_protocol, 21);
    assert.equal(PACKAGE_COMPATIBILITY.editor_protocol, 26);
    assert.deepEqual(historical.read.display, [1, 13]);
    assert.throws(() => compatibility(undefined, '3.6.0'));
    assert.throws(() => compatibility(undefined, '3.8.0'));
    for (const patch of [{ schema_version: 2 }, { node: { '24': '22.0.0' } }, { read: { display: [1, 13] } }, { targets: ['linux-unknown'] }, { editor_protocol: 0 }])
        assert.throws(() => compatibility({ ...PACKAGE_COMPATIBILITY, ...patch }, '3.8.0'));
    assert.deepEqual(runtimeCompatibility(PACKAGE_COMPATIBILITY, '24.0.0', 'win32-x64', '2.1.205', true), []);
    assert.deepEqual(runtimeCompatibility(PACKAGE_COMPATIBILITY, '26.0.0', 'linux-arm64', null, true), ['runtime', 'platform', 'host']);
    assert.deepEqual(runtimeCompatibility(PACKAGE_COMPATIBILITY, '22.0.0', 'darwin-arm64', null, false), []);
});
