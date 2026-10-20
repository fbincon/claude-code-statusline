import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { projectPaths } from '../src/project-paths.js';

test('unknown volume IDs cannot alias unrelated project roots with colliding file IDs', t => {
    t.mock.method(fs, 'statSync', () => ({ dev: 0n, ino: 7n }));
    syncBuiltinESMExports();
    try {
        assert.equal(projectPaths.contains('/registered', '/unrelated'), false);
        assert.equal(projectPaths.contains('/registered', '/registered/child'), true);
    } finally {
        t.mock.restoreAll();
        syncBuiltinESMExports();
    }
});
