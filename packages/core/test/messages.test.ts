import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, text, renderMessage, LocalizedError } from '../src/i18n/messages.js';
import { LOCALES, LANGUAGES, LANGUAGE_NAMES, type Language } from '../src/i18n/generated-locales.js';
import { fixed } from '../src/numbers.js';

test('tests.i18n.test_translation.TranslationTests.test_language_and_key_fallback_are_explicit', () => {
  assert.equal(t('cli.language', 'unknown' as Language, { language: 'zh-CN' }), 'UI language: zh-CN');
  assert.equal(t('missing.key', 'zh-CN'), 'missing.key');
  assert.equal(t('toString', 'constructor' as Language), 'toString');
  const original = LOCALES['zh-CN']['cli.language'];
  try {
    (LOCALES['zh-CN'] as Record<string, string>)['cli.language'] = LOCALES.en['cli.language'];
    assert.equal(t('cli.language', 'zh-CN', { language: 'en' }), 'UI language: en');
  } finally { (LOCALES['zh-CN'] as Record<string, string>)['cli.language'] = original; }
});
test('tests.i18n.test_translation.TranslationTests.test_nested_error_metadata_preserves_english_and_translates_details', () => {
  const inner = text('errors.host.padding_must_be_an_integer_from_0');
  const error = new LocalizedError(text('cli.error', { detail: inner }));
  assert.equal(error.message, 'error: padding must be an integer from 0 through 32');
  assert.equal(renderMessage(error.localization, 'zh-CN'), '错误：padding 必须为 0 至 32 的整数');
  assert.equal((error.localization.params.detail as { key: string }).key, inner.key);
  assert.equal(renderMessage('external detail', 'zh-CN'), 'external detail');
});
test('tests.i18n.test_translation.TranslationTests.test_resources_are_json_strings_only', () => {
  for (const language of LANGUAGES) assert.ok(Object.values(LOCALES[language]).every(value => typeof value === 'string'));
  assert.equal(JSON.parse(JSON.stringify(text('cli.language', { language: 'en' }).fallback)), 'UI language: en');
});
test('registered language autonyms and real translations retain their order', () => {
  assert.deepEqual([...LANGUAGES], ['en', 'zh-CN', 'zh-TW', 'zh-HK', 'ja', 'ko']);
  assert.deepEqual(LANGUAGES.map(code => LANGUAGE_NAMES[code]), ['English', '简体中文', '繁體中文（台灣）', '繁體中文（香港）', '日本語', '한국어']);
  for (const [language, expected] of [['zh-TW', '介面語言：日本語'], ['ja', 'UI 言語: 日本語'], ['ko', 'UI 언어: 日本語']] as const) assert.equal(t('cli.language', language, { language: '日本語' }), expected);
});
test('fixed decimal formatting uses binary64 ties-to-even and preserves negative zero', () => {
  assert.equal(fixed(2.675, 2), '2.67'); assert.equal(fixed(3.125, 2), '3.12'); assert.equal(fixed(3.135, 2), '3.13');
  assert.equal(fixed(-0, 2), '-0.00'); assert.equal(fixed(0.5, 0), '0'); assert.equal(fixed(1.5, 0), '2');
});
