import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
for (const platform of ['darwin', 'win32']) for (const operation of ['clock', 'process', 'files']) test(`compiled ${platform} ${operation} rejects native API failure and preserves exact fallback semantics`, () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./native-fault-driver.js', import.meta.url)), platform, operation], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, 'pass');
});
