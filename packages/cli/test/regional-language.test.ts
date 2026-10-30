import test from 'node:test';
import { setup, assert, join, writeFileSync, readFileSync, jsonBytes, draft, legacy } from './final-support.js';
import { invoke } from './final-cli-support.js';
import { defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { importText, exportText } from '@fbincon/statusline-core/config/transfer';
import { readPreferences, setLanguage } from '../src/config/preferences.js';
import { LANGUAGES, resolveLanguage } from '@fbincon/statusline-core/i18n/registry';
import { t as message } from '@fbincon/statusline-core/i18n/messages';

test('legacy Traditional preferences and display schemas normalize without rewriting', t => {
  const f = setup(t), preferences = join(f.root, 'statusline-ui.json');
  const ui = jsonBytes({ schema_version: 1, ui_language: 'zh-Hant' }); writeFileSync(preferences, ui);
  assert.equal(readPreferences(f.root).ui_language, 'zh-TW'); assert.equal(readPreferences(f.root).warning, null);
  assert.deepEqual(readFileSync(preferences), ui);
  for (const schema of [6, 7, 8]) {
    const display = schema === 8 ? defaultDisplay() : legacy(schema);
    const raw = jsonBytes({ ...display, statusline_language: 'zh-Hant' }); writeFileSync(f.displayPath, raw);
    assert.equal(f.display().statusline_language, 'zh-TW');
    assert.equal(f.service.read().display.statusline_language, 'zh-TW');
    assert.deepEqual(readFileSync(f.displayPath), raw);
  }
  setLanguage(f.root, 'zh-Hant');
  assert.equal(JSON.parse(readFileSync(preferences, 'utf8')).ui_language, 'zh-TW');
  assert.equal(resolveLanguage('zh-Hant'), 'zh-TW');
  for (const unknown of ['zh', 'zh-tw', 'zh-Hant-HK', 'constructor', '__proto__']) assert.equal(resolveLanguage(unknown), null);
  assert.deepEqual([...LANGUAGES], ['en', 'zh-CN', 'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'ru', 'id']);
});

test('legacy CLI arguments and portable imports save canonical Taiwan without changing other language settings', async t => {
  const f = setup(t, true), run = (...args: string[]) => invoke(args, f.context);
  assert.equal((await run('--language', 'zh-Hant', '--help')).status, 0);
  assert.equal((await run('config', 'language', 'set', 'zh-Hant')).status, 0);
  for (const args of [['config', 'set', 'statusline-language', 'zh-Hant'], ['config', 'apply', '--items', 'model', '--colors', 'off', '--palette', 'ansi', '--directory-style', 'basename', '--separator-style', 'compact', '--padding', '0', '--refresh-interval', '1', '--hide-vim-mode-indicator', 'off', '--statusline-language', 'zh-Hant']]) {
    const result = await run(...args); assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(f.displayPath, 'utf8')).statusline_language, 'zh-TW');
    assert.equal(readPreferences(f.root).ui_language, 'zh-TW');
  }
  const current = draft(f.service.read());
  const imported = importText(JSON.stringify({ format: 'claude-code-statusline', version: 1, draft: { ...current, display: { ...current.display, statusline_language: 'zh-Hant' } } }), current);
  assert.equal(imported.display.statusline_language, 'zh-TW');
  assert.equal(JSON.parse(exportText(imported)).draft.display.statusline_language, 'zh-TW');
  assert.equal(validateDisplay({ ...defaultDisplay(), statusline_language: 'zh-HK' }).statusline_language, 'zh-HK');
  const old = f.protocol.handle('{"protocol_version":11,"operation":"read","payload":{}}');
  assert.equal(old.status, 2); assert.equal((old.response as any).error.code, 'unsupported_protocol');
});

test('Taiwan and Hong Kong use distinct regional terminology and preserve technical commands', () => {
  const key = 'errors.capabilities.cannot_safely_resolve_claude_batch_wrapper_use';
  assert.match(message(key, 'zh-TW'), /軟體/u);
  assert.match(message(key, 'zh-HK'), /軟件/u);
  assert.match(message('cli.language', 'zh-TW', { language: 'English' }), /介面語言/u);
});

test('expanded language preferences and displays read without rewriting and old frontends require reinstall', t => {
  const f = setup(t), path = join(f.root, 'statusline-ui.json');
  for (const language of ['es', 'fr', 'de', 'pt-BR', 'ru', 'id'] as const) {
    const preferences = jsonBytes({ schema_version: 1, ui_language: language });
    const display = jsonBytes({ ...defaultDisplay(), statusline_language: language });
    writeFileSync(path, preferences); writeFileSync(f.displayPath, display);
    assert.equal(readPreferences(f.root).ui_language, language);
    assert.equal(f.service.read().display.statusline_language, language);
    assert.deepEqual(readFileSync(path), preferences);
    assert.deepEqual(readFileSync(f.displayPath), display);
  }
  const before = readFileSync(f.displayPath);
  const stale = f.protocol.handle('{"protocol_version":30,"operation":"read","payload":{}}');
  assert.equal(stale.status, 2);
  assert.equal((stale.response as any).protocol_version, 31);
  assert.equal((stale.response as any).error.code, 'unsupported_protocol');
  assert.deepEqual(readFileSync(f.displayPath), before);
  for (const unknown of ['es-ES', 'fr-FR', 'de-DE', 'pt', 'pt-br', 'ru-RU', 'id-ID']) {
    assert.equal(resolveLanguage(unknown), null);
  }
});
