import { regionalLanguageDifference } from '../compare.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../compare.js';
import { inventory } from '../inventory.js';
import { decode } from '@fbincon/statusline-core/json';
import { VERSION } from '@fbincon/statusline-core/release';
import { releaseMetadataDifference } from '../compare.js';
import { runtimeDefaultDifference } from '../compare.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtures } from '../common.js';

test('approved default-collection difference is bound to one frozen stdout and rejects other changes', () => {
  const before = JSON.parse(readFileSync(join(fixtures, 'expected.json'), 'utf8'))['runtime-null-prompt'].value[0].stdout as string;
  const value = JSON.parse(before);
  Object.assign(value.result, { backend_version: VERSION, native_timing: false, enabled: false, reason: 'runtime_disabled' });
  value.result.metrics['task-active-timer'].reason = 'native_timing_disabled';
  // Preserve the oracle's exact serialization; normalizing JSON would hide unrelated byte changes.
  const after = before.replace('"native_timing": true', '"native_timing": false').replace('"backend_version": "2.0.0"', '"backend_version": ' + JSON.stringify(VERSION))
    .replace('"enabled": true, "fresh": false, "reason": "not_observed"', '"enabled": false, "fresh": false, "reason": "runtime_disabled"')
    .replace('"task-active-timer": {"value": null, "reason": "not_observed"', '"task-active-timer": {"value": null, "reason": "native_timing_disabled"');
  assert.deepEqual(JSON.parse(after), value);
  assert(runtimeDefaultDifference('runtime-null-prompt', '/value/0/stdout', before, after));
  for (const changed of [after.trim(), after.replace('"observed_at_ms": null', '"observed_at_ms": 0'), after.replace('"live_metrics": false', '"live_metrics": true')])
    assert(!runtimeDefaultDifference('runtime-null-prompt', '/value/0/stdout', before, changed));
  assert(!runtimeDefaultDifference('other', '/value/0/stdout', before, after));
  assert(!runtimeDefaultDifference('runtime-null-prompt', '/value/0/stdout', before.trim(), after));
});

test('release metadata exemptions cannot hide unrelated fields, versions or stdout changes', () => {
  assert(releaseMetadataDifference('ui-read', '/value/response/result/backend_version', '2.0.0', VERSION));
  assert(!releaseMetadataDifference('ui-read', '/value/response/result/backend_version', '2.0.0', '9.0.0'));
  assert(!releaseMetadataDifference('other', '/value/response/result/backend_version', '2.0.0', VERSION));
  const before = '{"result":{"backend_version":"2.0.0","accepted":1}}\n';
  const after = before.replace('2.0.0', VERSION);
  assert(releaseMetadataDifference('runtime-v1-dedup-order', '/value/0/stdout', before, after));
  assert(!releaseMetadataDifference('runtime-v1-dedup-order', '/value/0/stdout', before, after.replace('"accepted":1', '"accepted":2')));
  assert(!releaseMetadataDifference('runtime-v1-dedup-order', '/value/0/stdout', before, after.trim()));
});

test('comparison preserves numeric kinds, missing values, order and encoded file bytes', () => {
  assert.deepEqual(compare(decode('{"a":{"x":1,"y":2}}'), decode('{"a":{"y":2,"x":1}}')), []);
  for (const [a, b] of [['1', '1.0'], ['9007199254740993', '9007199254740992'], ['null', '0'], ['[1,2]', '[2,1]'], ['{}', '{"x":null}'], ['"{ \\"x\\": 1}"', '"{\\"x\\":1}"']]) {
    assert.ok(compare({ a: decode(a!) }, { a: decode(b!) }).length);
  }
  assert.ok(compare({ a: 1 }, {}).length);
  assert.ok(compare({}, { a: 1 }).length);
});

test('coverage accounts for every frozen test while unfinished stage cannot pass', () => {
  const state = inventory(); assert.equal(state.total, 516);
  if (state.pending) assert.throws(() => inventory(true), /still pending/);
});

test('broad and stale comparison exemptions are rejected', () => {
  assert.throws(() => compare({}, {}, [{ case: 'anything', path: '/', before_sha256: '0'.repeat(64), after_sha256: '0'.repeat(64), reason: 'ignore' }]));
});

test('regional comparison exceptions are restricted to known protocol and language-choice fields', () => {
  assert(regionalLanguageDifference('ui-read', '/value/response/protocol_version', 11, 12));
  assert(!regionalLanguageDifference('ui-unknown-case', '/value/response/protocol_version', 11, 12));
  assert(!regionalLanguageDifference('ui-read', '/value/response/protocol_version', 11, 13));
  assert(!regionalLanguageDifference('ui-read', '/value/response/result/value', 11, 12));
  const before = ['en', 'zh-CN', 'zh-Hant', 'ja', 'ko'], after = ['en', 'zh-CN', 'zh-TW', 'zh-HK', 'ja', 'ko'];
  assert(regionalLanguageDifference('ui-describe', '/value/response/result/options/statusline-language/choices', before, after));
  assert(!regionalLanguageDifference('ui-describe', '/value/response/result/options/statusline-language/choices', before, [...after, 'fr']));
});
