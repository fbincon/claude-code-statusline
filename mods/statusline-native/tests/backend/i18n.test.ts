import { expect, test } from 'claude-code/testing';
import { parseResponse, BackendError } from '../../lib/backend.ts';
import { LANGUAGES, messageOrigin, t, text, renderMessage } from '../../lib/i18n/index.ts';
import { FALLBACK_KEYS, LOCALES } from '../../lib/i18n/generated-locales.ts';
import { output, reply } from '../fixtures.ts';

test('shared resources have matching keys, placeholders, fallbacks and nested messages', () => {
  for (const language of LANGUAGES) {
    expect(Object.keys(LOCALES.en).sort()).toEqual(Object.keys(LOCALES[language]).sort());
    for (const key of Object.keys(LOCALES.en) as (keyof typeof LOCALES.en)[]) {
      const placeholders = (value: string) => [...new Set([...value.matchAll(/\{([A-Za-z_]\w*)\}/g)].map(match => match[1]))].sort();
      expect(placeholders(LOCALES[language][key])).toEqual(placeholders(LOCALES.en[key]));
      expect(messageOrigin(key, language)).toBe((FALLBACK_KEYS[language] as readonly string[]).includes(key) ? 'en' : language);
    }
  }
  const value = text('cli.error', { detail: text('errors.host.padding_must_be_an_integer_from_0') });
  expect(renderMessage(value, 'en')).toBe('error: padding must be an integer from 0 through 32');
  expect(renderMessage(value, 'zh-CN')).toBe('错误：padding 必须为 0 至 32 的整数');
  expect(t('unknown.key', 'zh-CN', {}, 'external text')).toBe('external text');
  expect(messageOrigin('unknown.key', 'zh-CN')).toBe('en');
  expect(t('cli.language', 'zh-CN', { language: 'en' })).toBe('界面语言：en');
});

test('preference protocol is strict and carries language-neutral error metadata', () => {
  for (const operation of ['read_ui_preferences', 'set_ui_language'] as const) {
    for (const language of LANGUAGES) {
      expect(parseResponse(operation, reply({schema_version: 1, ui_language: language, warning: null})).ui_language).toBe(language);
    }
    for (const result of [
      {schema_version: 2, ui_language: 'en', warning: null},
      {schema_version: 1, ui_language: 'xx', warning: null},
      {schema_version: 1, ui_language: 'en', warning: {}},
    ]) expect(() => parseResponse(operation, reply(result))).toThrow();
  }
  const localization = text('preferences.unsupported_language', { language: 'ja' });
  try {
    parseResponse('set_ui_language', output(JSON.stringify({protocol_version: 30, error: {code: 'invalid_configuration', message: localization.fallback, localization}}), 2));
    throw new Error('expected rejection');
  } catch (error) {
    expect(error instanceof BackendError).toBe(true);
    expect((error as BackendError).code).toBe('invalid_configuration');
    expect(renderMessage((error as BackendError).localization!, 'zh-CN')).toContain('不支持界面语言');
  }
});
