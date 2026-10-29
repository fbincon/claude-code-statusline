import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { decode, canonical } from '../src/json.js';
import { pythonJson } from '../src/json-text.js';
import { defaultDisplay, defaultItem, validateDisplay } from '../src/config/display.js';
import { updateDisplay, updateSubagents, edit, find, legacyId } from '../src/config/instances.js';
import { applyPreset, ROWS } from '../src/config/presets.js';
import { differences } from '../src/config/import-review.js';
import { exportText, importText } from '../src/config/transfer.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import { ITEMS } from '../src/config/catalog.js';
import { itemFields, editItem, setField } from '../src/config/editor-fields.js';
import { VISIBILITY_ITEMS } from '../src/config/formatting.js';
import type { Scope } from '../src/contracts/ui.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const fixtures = join(root, 'tests/fixtures/migration/ts-01');
const corpus = JSON.parse(readFileSync(join(fixtures, 'cases.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(fixtures, 'expected.json'), 'utf8'));
let serial = 0;
const id = () => 'i-test-' + ++serial;

test('all eight frozen schemas and 84 render configurations normalize without altering input', () => {
  for (const fixture of corpus.cases.filter((value: { kind: string }) => value.kind === 'display')) {
    const raw = fixture.files['config/claude-statusline.json'];
    const input = decode(raw), before = canonical(input);
    const actual = validateDisplay(input);
    assert.equal(canonical(actual), canonical({ ...expected[fixture.id].value.effective, schema_version: 17, groups: [], subagents: { ...expected[fixture.id].value.effective.subagents, groups: [] }, powerline: { padding: 'both', separator: 'arrow', start_cap: false, end_cap: true, color_mode: 'semantic' } }), fixture.id);
    assert.equal(canonical(input), before);
  }
  for (const value of Object.values(corpus.configs)) assert.deepEqual(validateDisplay(validateDisplay(value)), validateDisplay(value));
});

test('tests.config.test_instances.InstanceTests.test_legacy_identity_and_disabled_options_roundtrip', () => {
  const fixture = corpus.cases.find((value: { kind: string; files?: Record<string, string> }) => value.kind === 'display' && JSON.parse(value.files!['config/claude-statusline.json']!).schema_version === 7);
  const config = validateDisplay(decode(fixture.files['config/claude-statusline.json']));
  assert.deepEqual(validateDisplay(config), config);
  const cfg = updateDisplay(defaultDisplay(), { items: ['model'], item_options: { tokens: { ...defaultItem(), label: 'Saved' } } });
  const saved = find(cfg, 'main', 'tokens')!;
  assert.equal(saved.enabled, false); assert.equal(saved.options.label, 'Saved');
  assert.equal(Object.hasOwn(cfg, 'items'), false);
  assert.deepEqual(validateDisplay(cfg), cfg);
});

test('tests.config.test_instances.InstanceTests.test_copy_edit_toggle_and_remove_are_independent', () => {
  let cfg = updateDisplay(defaultDisplay(), { items: ['model'] });
  const copied = edit(cfg, 'main', { action: 'copy', id: 'model' }, id); cfg = copied.config;
  assert.notEqual(copied.selected, 'model');
  cfg = edit(cfg, 'main', { action: 'set', id: copied.selected!, option: 'label', value: 'Second' }, id).config;
  assert.equal(find(cfg, 'main', 'model')!.options.label, null);
  cfg = edit(cfg, 'main', { action: 'disable', id: copied.selected! }, id).config;
  assert.equal(find(cfg, 'main', copied.selected!)!.enabled, false);
  assert.throws(() => legacyId(cfg, 'main', 'model'));
  assert.deepEqual(validateDisplay(cfg), cfg);
  cfg = edit(cfg, 'main', { action: 'remove', id: copied.selected! }, id).config;
  assert.equal(find(cfg, 'main', copied.selected!), undefined);
});

test('tests.config.test_instances.InstanceTests.test_identity_and_literal_validation', () => {
  const cfg = defaultDisplay(); cfg.instances.push(cfg.instances[0]!);
  assert.throws(() => validateDisplay(cfg));
  for (const text of ['line\nnext', '\x1b[31m', 'x'.repeat(257)]) assert.throws(() => edit(defaultDisplay(), 'main', { action: 'add', type_id: 'text', text }, id));
  const literal = '$HOME ${model} 中文 👩🏽‍💻';
  const added = edit(defaultDisplay(), 'main', { action: 'add', type_id: 'text', text: literal }, id);
  assert.equal(find(added.config, 'main', added.selected!)!.text, literal);
});

test('tests.config.test_instances.InstanceTests.test_spacers_and_type_exclusions', () => {
  assert.throws(() => edit(defaultDisplay(), 'main', { action: 'add', type_id: 'spacer' }, id));
  let cfg = defaultDisplay(); cfg = updateDisplay(cfg, { layout: { mode: 'explicit', rows: [cfg.instances.map(node => node.id)] } });
  const spacer = edit(cfg, 'main', { action: 'add', type_id: 'spacer' }, id);
  assert.throws(() => edit(spacer.config, 'main', { action: 'copy', id: spacer.selected! }, id));
  cfg = updateDisplay(defaultDisplay(), { subagents: updateSubagents(defaultDisplay().subagents, { items: ['status-elapsed'] }) });
  assert.throws(() => edit(cfg, 'subagent', { action: 'add', type_id: 'status' }, id));
});

test('tests.config.test_instances.InstanceTests.test_disabling_keeps_explicit_row_and_identity', () => {
  let cfg = updateDisplay(defaultDisplay(), { instances: ['model', 'git'].map(type_id => ({ id: type_id, type_id, enabled: true, options: defaultItem(), text: null })), layout: { mode: 'explicit', rows: [['model'], ['git']] } });
  cfg = edit(cfg, 'main', { action: 'disable', id: 'model' }, id).config;
  assert.deepEqual(cfg.layout.rows, [['model'], ['git']]);
  cfg = edit(cfg, 'main', { action: 'enable', id: 'model' }, id).config;
  assert.deepEqual(cfg.instances.filter(node => node.enabled).map(node => node.id), ['model', 'git']);
});

test('tests.config.test_instances.InstanceTests.test_insertions_grow_the_current_row_and_copy_ids_survive_roundtrip', () => {
  let cfg = updateDisplay(defaultDisplay(), { instances: ['model', 'context-used'].map(type_id => ({ id: type_id, type_id, enabled: true, options: defaultItem(), text: null })), layout: { mode: 'explicit', rows: [['model'], ['context-used']] } });
  const spacer = edit(cfg, 'main', { action: 'add', type_id: 'spacer', after: 'model' }, id); cfg = spacer.config;
  assert.deepEqual(cfg.layout.rows, [['model', spacer.selected], ['context-used']]);
  const copied = edit(cfg, 'main', { action: 'copy', id: 'context-used' }, id); cfg = copied.config;
  assert.deepEqual(cfg.layout.rows[1], ['context-used', copied.selected]);
  assert.deepEqual(validateDisplay(cfg), cfg);
  for (const schema_version of [decode('12.0'), true, defaultDisplay().schema_version + 1]) assert.throws(() => validateDisplay({ ...cfg, schema_version }));
});

test('tests.config.test_instances.InstanceTests.test_type_resolution_cannot_confuse_imported_ids_with_type_names', () => {
  const cfg = updateDisplay(defaultDisplay(), { instances: [{ id: 'hostname', type_id: 'model', enabled: true, options: defaultItem(), text: null }] });
  assert.throws(() => legacyId(cfg, 'main', 'hostname', true));
  const custom = updateDisplay(cfg, { instances: [{ ...cfg.instances[0]!, id: 'prompt-timer' }] });
  const changed = edit(custom, 'main', { action: 'set', id: 'prompt-timer', option: 'label', value: 'Model copy' }, id).config;
  assert.equal(changed.instances[0]!.options.label, 'Model copy'); assert.equal(changed.instances.length, 1);
  assert.throws(() => edit(cfg, 'main', { action: 'add', type_id: 'model', text: 'ignored' }, id));
});

test('tests.config.test_appearance.AppearanceConfigTests.test_shared_validation_cases', () => {
  const cases = JSON.parse(readFileSync(join(root, 'tests/fixtures/appearance.json'), 'utf8'));
  for (const fixture of cases) {
    const cfg = defaultDisplay(), scope = fixture.scope as Scope, target = scope === 'main' ? cfg : cfg.subagents;
    target.instances = [...target.instances.filter(node => node.id !== fixture.item), { id: fixture.item, type_id: fixture.item, enabled: false, text: null, options: { ...defaultItem(), ...fixture.patch } }];
    if (fixture.valid) assert.deepEqual(validateDisplay(validateDisplay(cfg)), validateDisplay(cfg));
    else assert.throws(() => validateDisplay(cfg), JSON.stringify(fixture));
  }
});

test('tests.config.test_appearance.AppearanceConfigTests.test_theme_and_glyph_are_strict', () => {
  for (const [key, values] of [['theme', ['auto', '', null, []]], ['powerline_glyph', ['custom', '\x1b', 1]]] as const) {
    for (const value of values) assert.throws(() => validateDisplay({ ...defaultDisplay(), [key]: value }));
  }
});

test('tests.config.test_appearance.AppearanceConfigTests.test_scoped_fields_and_cli_edits_share_validation', () => {
  for (const definition of ITEMS.filter(item => !['text', 'spacer'].includes(item.id))) {
    const { scope, id } = definition, fields = itemFields(scope, id), rule = VISIBILITY_ITEMS[scope][id];
    assert.equal(fields.some(field => field.key === 'visibility'), rule !== undefined);
    assert.equal(fields.some(field => field.key === 'visibility_threshold'), rule === 'used-at-least');
    for (const value of ['#AABBCC', 'ansi:001', 'default', 'inherit']) {
      assert.deepEqual(editItem(defaultDisplay(), scope, id, 'foreground', value), setField(defaultDisplay(), 'foreground', value, scope, id));
    }
  }
});

test('tests.config.test_catalog.CatalogTests.test_bilingual_reference_covers_every_selectable_id', () => {
  for (const suffix of ['', '.zh-CN']) {
    const contents = readFileSync(join(root, `docs/DISPLAY_ITEMS${suffix}.md`), 'utf8') + readFileSync(join(root, `docs/USER_GUIDE${suffix}.md`), 'utf8');
    for (const item of ITEMS) assert.ok(contents.includes('`' + item.id + '`'), item.id);
  }
});

test('presets expand into validated editable drafts and portable roundtrips retain complete options', () => {
  for (const name of Object.keys(ROWS)) {
    const display = applyPreset(defaultDisplay(), name, id), draft = { display, host: { ...DEFAULT_HOST } };
    assert.deepEqual(validateDisplay(display), display);
    assert.deepEqual(importText(exportText(draft), draft), draft);
  }
  const before = { display: defaultDisplay(), host: { ...DEFAULT_HOST } };
  const after = { display: updateDisplay(before.display, { statusline_language: 'zh-CN' }), host: { ...DEFAULT_HOST, padding: 4 } };
  assert.deepEqual(differences(before, before), []);
  assert.deepEqual(differences(before, after).map(change => change.section), ['language', 'host']);
  assert.equal(before.display.statusline_language, 'en');
});
