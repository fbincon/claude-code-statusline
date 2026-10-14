import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFeature, loadNative, loadRuntime, writeFeature } from '../src/config/backend-preferences.js';
import { createStorage } from '../src/config/storage.js';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { parseRuntime, parseNative, parseFeature } from '@fbincon/statusline-core/config/backend-preferences';
import { localizedError } from '../src/errors.js';
test('independent runtime preferences retain v1 opt-outs and reject numeric boolean or duplicate fields', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ts03-preferences-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const directory = join(root, 'absent');
    assert.deepEqual(loadRuntime(directory), { schema_version: 2, native_timing: true, live_metrics: false });
    assert.equal(fs.existsSync(directory), false);
    for (const enabled of [true, false])
        assert.deepEqual(parseRuntime(JSON.stringify({ schema_version: 1, live_metrics: enabled })), { schema_version: 2, native_timing: enabled, live_metrics: enabled });
    assert.deepEqual(parseRuntime('{"schema_version":2,"native_timing":false,"live_metrics":true}'), { schema_version: 2, native_timing: false, live_metrics: true });
    for (const raw of ['[]', '{"schema_version":true,"live_metrics":false}', '{"schema_version":1.0,"live_metrics":false}', '{"schema_version":1,"live_metrics":0}', '{"schema_version":1,"live_metrics":true,"live_metrics":false}', '{"schema_version":2,"native_timing":1,"live_metrics":false}', '{"schema_version":3,"live_metrics":false}'])
        assert.throws(() => parseRuntime(raw), (error: unknown) => error instanceof ConfigError && localizedError(error).fallback.startsWith('Invalid'));
    assert.deepEqual(loadRuntime(directory, createStorage(), false, true), { schema_version: 2, native_timing: true, live_metrics: false });
});
test('native and external editor preferences remain independent, strict, private and read only until an explicit write', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ts03-editor-preferences-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const directory = join(root, 'absent');
    for (const version of ['1.3.0', '1.3.0a2', '1.3.0b1', '1.3.0rc1', '1.3.0.dev1']) {
        assert.equal(loadFeature(directory, version), version === '1.3.0');
        assert.equal(loadNative(directory, undefined, version), version === '1.3.0');
    }
    assert.equal(fs.existsSync(directory), false);
    const path = writeFeature(directory, false);
    assert.equal(loadFeature(directory), false);
    assert.equal(loadNative(directory), true);
    if (process.platform !== 'win32')
        assert.equal(fs.statSync(path).mode & 0o777, 0o600);
    for (const raw of ['[]', '{"schema_version":1}', '{"schema_version":1,"experimental_slash_tui":true,"extra":1}', '{"schema_version":true,"experimental_slash_tui":true}', '{"schema_version":2,"experimental_slash_tui":true}', '{"schema_version":1,"experimental_slash_tui":"true"}', '{"schema_version":1,"experimental_slash_tui":0}', '{"schema_version":1,"schema_version":1,"experimental_slash_tui":true}'])
        assert.throws(() => parseFeature(raw), ConfigError);
    for (const raw of ['{"schema_version":true,"native_editor":true}', '{"schema_version":1,"native_editor":1}', '{"schema_version":1,"native_editor":true,"native_editor":false}'])
        assert.throws(() => parseNative(raw), ConfigError);
    assert.equal(parseNative('{"schema_version":1,"native_editor":false}'), false);
});
