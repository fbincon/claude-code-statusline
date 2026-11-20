import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../resources.js';

const pack = (code: string): Record<string, string> =>
  JSON.parse(readFileSync(join(ROOT, 'packages/core/resources/i18n/locales', code + '.json'), 'utf8'));

test('zh-HK applies the documented Hong Kong terminology consistently', () => {
  const hk = pack('zh-HK');
  for (const [key, value] of Object.entries(hk)) {
    assert.equal(typeof value, 'string', key);
    const text = value.replaceAll('資料夾', '');
    for (const term of ['使用者', '資料', '網路', '狀態列'])
      assert.equal(text.includes(term), false, `${key} contains ${term}`);
  }
  assert.match(hk['profiles.user']!, /用戶/);
  assert.match(hk['sources.error.network']!, /網絡/);
  assert.match(hk['setup.title']!, /狀態欄/);
  assert.match(hk['package.reason_metadata']!, /元數據/);
  assert.match(hk['task.controls.identity']!, /識別資訊/);
  assert.match(hk['sources.reason.no_consumers']!, /使用方/);
  assert.match(hk['sources.raw']!, /JSON 詳情/u);
  assert.match(hk['sources.reason.check_details_truncated']!, /檢查詳情/u);
});

test('zh-TW keeps its own regional terminology', () => {
  const tw = pack('zh-TW');
  for (const [key, expected] of [
    ['profiles.user', /使用者/],
    ['sources.error.network', /網路/],
    ['setup.title', /狀態列/],
    ['package.reason_metadata', /中繼資料/],
  ] as const)
    assert.match(tw[key]!, expected);
  for (const [key, value] of Object.entries(tw)) {
    assert.equal(typeof value, 'string', key);
    assert.equal(/用戶|網絡|狀態欄/.test(value), false, `${key} uses a Hong Kong variant`);
  }
});
