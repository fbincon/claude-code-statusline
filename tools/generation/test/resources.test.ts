import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { ROOT, outputs, languages, languageOutputs, languageCoverage, obsoleteOutputs, generateResources } from '../resources.js';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { nativeCapacityData } from '../native-capacity.js';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { readLanguageInputs } from '../../checks/i18n-evidence.js';
import { analyze, RESOURCE_ROOT } from '../i18n/analysis.js';
import { acceptValidation, validateSelection } from '../i18n/authoring.js';

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

test('capacity scenarios cover every registered language and render the selected output pack', () => {
  const { cases, values } = nativeCapacityData();
  assert.equal(cases.length, 313);
  assert.equal(new Set(cases.map(row => row.name)).size, cases.length);
  for (const language of LANGUAGES) {
    for (const prefix of ['appearance-adaptive-', 'appearance-row-colors-', 'appearance-quick-last-', 'i18n-long-narrow-', 'i18n-long-tall-']) {
      const row = cases.find(value => value.name === prefix + language);
      assert(row, prefix + language);
      const draft = values[row.editor.draft!] as { display: { statusline_language: string } };
      assert.equal(draft.display.statusline_language, language);
    }
    const row = cases.find(value => value.name === 'appearance-quick-last-' + language)!;
    const preview = values[row.preview] as { main: {text: string}[][] };
    const text = preview.main.flat().map(span => span.text).join('');
    assert(text.includes(t('statusline.scope.main', language)), text);
  }
});

test('one generation pass renders current accepted translations and pending fallback in capacity fixtures', async t => {
  const root = fs.mkdtempSync(join(tmpdir(), 'capacity-language-source-'));
  t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
  const inputs = readLanguageInputs(ROOT), packPath = RESOURCE_ROOT + 'locales/fr.json';
  const pack = JSON.parse(Buffer.from(inputs.get(packPath)!).toString()) as Record<string, string>;
  const key = 'statusline.scope.main', original = pack[key]!, updated = 'Session de contrôle';
  assert.notEqual(original, updated);
  pack[key] = updated; inputs.set(packPath, Buffer.from(JSON.stringify(pack)));
  const pending = analyze(inputs);
  assert.equal(pending.states.fr![key], 'pending_validation');
  const data = nativeCapacityData({ registry: pending.registry, data: pending.effective });
  const row = data.cases.find(value => value.name === 'appearance-quick-last-fr')!;
  const pendingPreview = data.values[row.preview] as { main: { text: string }[][] };
  assert(pendingPreview.main.flat().map(span => span.text).join('').includes(pending.effective.en![key]!));

  const validation = validateSelection(pending, ['fr'], [key], 'Synthetic test: reviewed the changed scope label in its current source contract.');
  for (const [path, bytes] of acceptValidation(inputs, validation)) inputs.set(path, bytes);
  for (const [path, bytes] of inputs) { fs.mkdirSync(dirname(join(root, path)), { recursive: true }); fs.writeFileSync(join(root, path), bytes); }
  for (const path of ['packages/core/src/editor', 'tools/unicode']) {
    fs.mkdirSync(dirname(join(root, path)), { recursive: true }); fs.cpSync(join(ROOT, path), join(root, path), { recursive: true });
  }
  for (const path of ['packages/core/src/contracts/ui.ts', 'packages/core/src/contracts/runtime.ts', 'packages/core/src/integration/binding.ts',
    'packages/core/src/unicode/index.ts', 'packages/core/src/i18n/messages.ts', 'packages/core/src/terminal/spans.ts',
    'tests/fixtures/editor-search.json', 'tests/fixtures/appearance.json', 'tests/fixtures/graphemes.json',
    'mods/statusline-native/.claude-plugin/plugin.json', 'mods/statusline-runtime/.claude-plugin/plugin.json']) {
    fs.mkdirSync(dirname(join(root, path)), { recursive: true }); fs.copyFileSync(join(ROOT, path), join(root, path));
  }
  generateResources(root);
  generateResources(root, { check: true });
  const runtime = join(root, 'capacity-runtime'); fs.mkdirSync(runtime); fs.writeFileSync(join(runtime, 'package.json'), '{"type":"module"}');
  const nativeTests = join(root, 'mods/statusline-native/tests');
  for (const name of fs.readdirSync(nativeTests).filter(name => /^generated-capacity-(?:fixtures|values-\d+)\.ts$/u.test(name))) {
    const source = fs.readFileSync(join(nativeTests, name), 'utf8').replaceAll('.ts\'', '.js\'');
    fs.writeFileSync(join(runtime, name.replace(/\.ts$/u, '.js')), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 } }).outputText);
  }
  const generated = await import(pathToFileURL(join(runtime, 'generated-capacity-fixtures.js')).href);
  assert.equal(generated.CAPACITY_CASES.length, 313);
  const translated = generated.CAPACITY_CASES.find((value: { name: string }) => value.name === 'appearance-quick-last-fr');
  const preview = generated.CAPACITY_VALUES[translated.preview] as { main: { text: string }[][] };
  const text = preview.main.flat().map(span => span.text).join('');
  assert(text.includes(updated), text); assert(!text.includes(original), text);
  assert(fs.readFileSync(join(root, 'packages/core/src/i18n/statusline/fr.ts'), 'utf8').includes(updated));
});

test('capacity generation refuses a registry that has not been rebuilt into the validating core', () => {
  const source = languages(join(ROOT, 'packages/core/resources/i18n'));
  assert.throws(() => nativeCapacityData({ registry: [...source.registry, { code: 'zz' }], data: { ...source.data, zz: source.data.en! } }),
    /--languages-only, then npm run generate/u);
});

test('language-only bootstrap adds and removes owned language files without touching capacity or contracts', t => {
  const run = fixture(); t.after(() => { removeTree(run.root); assert(!fs.existsSync(run.root)); });
  const untouched = ['mods/statusline-native/tests/generated-capacity-values-99.ts', 'mods/statusline-native/lib/generated-contracts.ts'];
  for (const path of untouched) { fs.mkdirSync(dirname(join(run.root, path)), { recursive: true }); fs.writeFileSync(join(run.root, path), 'Unrelated bootstrap sentinel\n'); }
  const registry = [...run.registry, { code: 'zz', name: 'Synthetic' }];
  fs.writeFileSync(join(run.directory, 'languages.json'), JSON.stringify(registry));
  fs.writeFileSync(join(run.directory, 'locales/zz.json'), JSON.stringify({ hello: 'Synthetic {name}', 'statusline.example': 'Synthetic {name}' }));
  generateResources(run.root, { languagesOnly: true });
  generateResources(run.root, { languagesOnly: true, check: true });
  assert(fs.readFileSync(join(run.root, 'packages/core/src/i18n/registry.ts'), 'utf8').includes('"zz"'));
  assert(fs.existsSync(join(run.root, 'mods/statusline-native/tests/integration/generated-language-zz.test.ts')));
  fs.writeFileSync(join(run.directory, 'languages.json'), JSON.stringify(registry.filter(row => row.code !== 'fr')));
  removeTree(join(run.directory, 'locales/fr.json')); assert(!fs.existsSync(join(run.directory, 'locales/fr.json')));
  assert.throws(() => generateResources(run.root, { languagesOnly: true, check: true }), /Obsolete generated resources/u);
  assert(fs.existsSync(join(run.root, 'mods/statusline-native/tests/integration/generated-language-fr.test.ts')));
  generateResources(run.root, { languagesOnly: true });
  for (const path of ['mods/statusline-native/lib/i18n/locales/fr.ts', 'packages/core/src/i18n/statusline/fr.ts', 'mods/statusline-native/tests/integration/generated-language-fr.test.ts']) assert(!fs.existsSync(join(run.root, path)), path);
  for (const path of untouched) assert.equal(fs.readFileSync(join(run.root, path), 'utf8'), 'Unrelated bootstrap sentinel\n');
});

test('tests.i18n.test_translation.TranslationTests.test_catalogue_translations_are_complete_and_generated', () => {
  const { registry, data } = languages(join(ROOT, 'packages/core/resources/i18n'));
  for (const item of ITEMS) for (const part of ['label', 'description'] as const) {
    const key = `items.${item.scope}.${item.id}.${part}`;
    assert.equal(data.en![key], item[part]);
    for (const { code } of registry) assert.ok(data[code]![key]);
  }
  for (const [name, content] of outputs()) { assert.equal(fs.readFileSync(join(ROOT, name), 'utf8').replaceAll('\r\n', '\n'), content, name);if(name.startsWith('mods/'))assert(Buffer.byteLength(content)<1024*1024,'Native imported module exceeds host limit: '+name); }
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
  assert.deepEqual(registry.map(entry => entry.code), ['en', 'zh-CN', 'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'ru', 'id']);
  assert.deepEqual(registry.map(entry => entry.name), ['English', '简体中文', '繁體中文（台灣）', '繁體中文（香港）', '日本語', '한국어', 'Español', 'Français', 'Deutsch', 'Português (Brasil)', 'Русский', 'Bahasa Indonesia']);
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
    assert.deepEqual(obsoleteOutputs(values, run.root).sort(), ['mods/statusline-native/lib/i18n/locales/fr.ts', 'mods/statusline-native/tests/integration/generated-language-fr.test.ts', 'packages/core/src/i18n/statusline/fr.ts'].sort());
    fs.writeFileSync(join(run.root, 'packages/core/src/i18n/statusline/private.ts'), '// handwritten');
    assert.throws(() => obsoleteOutputs(values, run.root), /Unowned/);
  } finally { run.close(); }
});
