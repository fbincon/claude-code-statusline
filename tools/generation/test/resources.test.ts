import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { ROOT, outputs, languages, languageOutputs, languageCoverage, obsoleteOutputs } from '../resources.js';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';

function fixture() {
  const root = fs.mkdtempSync(join(tmpdir(), 'ts03-language-'));
  const directory = join(root, 'packages/core/resources/i18n');
  fs.mkdirSync(join(directory, 'locales'), { recursive: true });
  const registry = [{ code: 'en', name: 'English' }, { code: 'fr', name: 'Français' }];
  fs.writeFileSync(join(directory, 'languages.json'), JSON.stringify(registry));
  fs.writeFileSync(join(directory, 'locales/en.json'), JSON.stringify({ hello: 'Hello {name}', 'statusline.example': 'Example {name}' }));
  fs.writeFileSync(join(directory, 'locales/fr.json'), JSON.stringify({ hello: 'Bonjour {name}', 'statusline.example': 'Exemple {name}' }));
  return { root, directory, registry, close: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('tests.i18n.test_translation.TranslationTests.test_catalogue_translations_are_complete_and_generated', () => {
  const { registry, data } = languages(join(ROOT, 'packages/core/resources/i18n'));
  for (const item of ITEMS) for (const part of ['label', 'description'] as const) {
    const key = `items.${item.scope}.${item.id}.${part}`;
    assert.equal(data.en![key], item[part]);
    for (const { code } of registry) assert.ok(data[code]![key]);
  }
  for (const [name, content] of outputs()) assert.equal(fs.readFileSync(join(ROOT, name), 'utf8').replaceAll('\r\n', '\n'), content, name);
});

test('tests.config.test_catalog.CatalogTests.test_wire_display_fields_and_generated_frontend_are_current', () => {
  const source = fs.readFileSync(join(ROOT, 'packages/core/src/contracts/ui.ts'), 'utf8');
  for (const [name, value] of [['DisplayDraft', defaultDisplay()], ['SubagentDraft', defaultDisplay().subagents]] as const) {
    const body = source.match(new RegExp('export interface ' + name + ' \\{([^}]+)\\}'))![1]!;
    const keys = [...body.matchAll(/^\s+(\w+):/gm)].map(match => match[1]).sort();
    assert.deepEqual(keys, Object.keys(value).sort());
  }
  const expected = outputs().get('mods/statusline-native/lib/generated-contracts.ts');
  assert.equal(fs.readFileSync(join(ROOT, 'mods/statusline-native/lib/generated-contracts.ts'), 'utf8').replaceAll('\r\n', '\n'), expected);
});

test('tests.i18n.test_registry.LanguageRegistryTests.test_order_autonyms_coverage_and_real_translations', () => {
  const directory = join(ROOT, 'packages/core/resources/i18n'), { registry } = languages(directory);
  assert.deepEqual(registry.map(entry => entry.code), ['en', 'zh-CN', 'zh-Hant', 'ja', 'ko']);
  assert.deepEqual(registry.map(entry => entry.name), ['English', '简体中文', '繁體中文', '日本語', '한국어']);
  const report = languageCoverage(directory);
  for (const value of Object.values(report)) {
    assert.equal(value.percent, 100); assert.deepEqual(value.missing, []);
    assert.equal(value.statusline_messages, report.en!.statusline_messages);
  }
});

test('tests.i18n.test_registry.LanguageRegistryTests.test_new_registered_pack_generates_and_runs_without_business_code_edits', async () => {
  const run = fixture();
  try {
    const generated = languageOutputs(run.root), folder = join(run.root, 'runtime'); fs.mkdirSync(folder);
    fs.writeFileSync(join(folder, 'package.json'), '{"type":"module"}');
    const localeSource = generated.get('packages/core/src/i18n/generated-locales.ts')!;
    const source = fs.readFileSync(join(ROOT, 'packages/core/src/i18n/messages.ts'), 'utf8');
    for (const [name, input] of [['generated-locales.js', localeSource], ['messages.js', source]]) fs.writeFileSync(join(folder, name!), ts.transpileModule(input!, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 } }).outputText);
    const runtime = await import(pathToFileURL(join(folder, 'messages.js')).href);
    assert.deepEqual(runtime.LANGUAGES, ['en', 'fr']);
    assert.equal(runtime.t('hello', 'fr', { name: 'Ada' }), 'Bonjour Ada');
    assert.equal(runtime.t('statusline.example', 'fr', { name: 'Ada' }), 'Exemple Ada');
    assert.equal(runtime.t('statusline.example', 'unknown', { name: 'Ada' }), 'Example Ada');
  } finally { run.close(); }
});

test('tests.i18n.test_registry.LanguageRegistryTests.test_partial_coverage_is_reported_but_cannot_generate_a_shipped_language', () => {
  const run = fixture();
  try {
    fs.writeFileSync(join(run.directory, 'locales/fr.json'), '{"hello":"Bonjour {name}"}');
    assert.deepEqual(languageCoverage(run.directory).fr!.missing, ['statusline.example']);
    assert.throws(() => languageOutputs(run.root), /Translation keys differ/);
  } finally { run.close(); }
});

test('tests.i18n.test_registry.LanguageRegistryTests.test_registry_rejects_duplicates_unsafe_names_missing_and_unregistered_packs', () => {
  const run = fixture();
  try {
    for (const entries of [
      [{ code: 'en', name: 'English' }, { code: 'en', name: 'Duplicate' }], [{ code: '../en', name: 'English' }],
      [{ code: 'fr', name: 'Français' }, { code: 'en', name: 'English' }], [{ code: 'en', name: 'English\n' }],
      [{ code: 'en', name: '' }], [{ code: 'en', name: 'English', unknown: true }],
    ]) {
      fs.writeFileSync(join(run.directory, 'languages.json'), JSON.stringify(entries)); assert.throws(() => languages(run.directory));
    }
    fs.writeFileSync(join(run.directory, 'languages.json'), JSON.stringify(run.registry));
    fs.writeFileSync(join(run.directory, 'locales/extra.json'), '{}'); assert.throws(() => languages(run.directory));
    fs.unlinkSync(join(run.directory, 'locales/extra.json')); fs.unlinkSync(join(run.directory, 'locales/fr.json')); assert.throws(() => languages(run.directory));
  } finally { run.close(); }
});

test('tests.i18n.test_translation.TranslationTests.test_invalid_keys_placeholders_duplicates_and_controls_are_rejected', () => {
  const run = fixture();
  try {
    for (const [en, fr] of [
      ['{"k":"{value}"}', '{"k":"{other}"}'], ['{"k":"ok"}', '{"different":"Oui"}'],
      ['{"k":"ok"}', '{"k":"un","k":"deux"}'], ['{"k":"ok"}', '{"k":"\\u001b"}'],
      ['{"k":"ok"}', '{"k":"\\u0085"}'], ['{"k":"ok"}', '{"k":"\\ud800"}'],
      ['{"k":"{value.foo}"}', '{"k":"{value.foo}"}'], ['{"statusline.k":"ok"}', '{"statusline.k":"bad\\nrow"}'],
      ['{"statusline.k":"ok"}', '{"statusline.k":"bad\\u2028row"}'], ['{"statusline.prefix.main.model":"{value}"}', '{"statusline.prefix.main.model":"{value}"}'],
      ['{"0":"x"}', '"x"'],
    ]) {
      fs.writeFileSync(join(run.directory, 'locales/en.json'), en!); fs.writeFileSync(join(run.directory, 'locales/fr.json'), fr!);
      assert.throws(() => languages(run.directory), en + ' / ' + fr);
    }
  } finally { run.close(); }
});

test('language removal identifies only active generator-owned modules', () => {
  const run = fixture();
  try {
    for (const [name, body] of languageOutputs(run.root)) { const path = join(run.root, name); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, body); }
    fs.writeFileSync(join(run.directory, 'languages.json'), JSON.stringify([run.registry[0]]));
    fs.unlinkSync(join(run.directory, 'locales/fr.json'));
    const values = languageOutputs(run.root);
    assert.deepEqual(obsoleteOutputs(values, run.root).sort(), ['packages/core/src/i18n/statusline/fr.ts'].sort());
    fs.writeFileSync(join(run.root, 'packages/core/src/i18n/statusline/private.ts'), '// handwritten');
    assert.throws(() => obsoleteOutputs(values, run.root), /Unowned/);
  } finally { run.close(); }
});
