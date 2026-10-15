import { oracle, referenceDirectory as exportReference } from '@fbincon/statusline-test-support/oracle';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../common.js';
import { readJson } from '@fbincon/statusline-core/json-read';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { join } from 'node:path';
test('JSON grammar and UTF-8 public diagnostics match Python on malformed boundaries', () => {
    const json = ['{', '[1,]', '{"中文":1,}', 'true false', '"\\x"', '"\\u123x"', '"abc', '{"a" 1}', '{"a":}', '[', '01', '-01', '1e+', '"\n"', '"\\', '\uFEFF{}', '{"😀":1}x'];
    const bytes = [[255], [0xc2], [0xe1, 0x80], [0xe1, 0x80, 65], [0xf0, 0x80, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xc0, 0x80], [0xf4, 0x90, 0x80, 0x80]];
    const source = 'import sys,json\nv=json.load(sys.stdin)\nr=[]\nfor raw in v["json"]:\n try:json.loads(raw);r.append(None)\n except Exception as e:r.append(str(e))\nfor raw in v["bytes"]:\n try:bytes(raw).decode("utf-8");r.append(None)\n except Exception as e:r.append(str(e))\nprint(json.dumps(r))';
    const expected = JSON.parse(oracle(['-c', source], { input: JSON.stringify({ json, bytes }), encoding: 'utf8' })) as string[];
    const actual = [...json.map(raw => { try {
            readJson(raw);
            return null;
        }
        catch (e) {
            return (e as Error).message;
        } }), ...bytes.map(raw => { try {
            decodeUtf8(Uint8Array.from(raw));
            return null;
        }
        catch (e) {
            return (e as Error).message;
        } })];
    assert.deepEqual(actual, expected);
});
test('invalid UTF-8 UI input stays inside a single JSON response without stderr output', () => {
    const result = spawnSync(process.execPath, [join(repoRoot, 'packages/cli/dist/src/entry.js'), 'ui'], { input: Buffer.from([255]), env: { ...process.env, CLAUDE_CONFIG_DIR: join(repoRoot, 'dist/validation/typescript-migration/ts-03/never-created-utf8') }, timeout: 10000 });
    assert.equal(result.status, 2);
    assert.equal(result.stderr.toString(), '');
    const response = JSON.parse(result.stdout.toString());
    assert.equal(response.error.code, 'invalid_request');
    assert.equal(response.error.localization, null);
    assert.equal(response.error.message, "'utf-8' codec can't decode byte 0xff in position 0: invalid start byte");
});
