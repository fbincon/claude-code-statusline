import test from 'node:test';
import { setup, assert, join, writeFileSync, readFileSync, jsonBytes, legacy, selected } from './final-support.js';
import { defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { BY_SCOPE, defaultItems } from '@fbincon/statusline-core/config/catalog';
import { applyPreset, ROWS } from '@fbincon/statusline-core/config/presets';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { setOption, selection } from '@fbincon/statusline-cli/config/operations';
import { configCommand, parseSlashArguments, executeConfig, itemListing } from '@fbincon/statusline-cli/config/commands';
import { setLanguage, readPreferences } from '@fbincon/statusline-cli/config/preferences';
import { importFile, exportFile } from '@fbincon/statusline-cli/config/transfer';
import { configurationOptions } from '@fbincon/statusline-cli/ui/protocol';
const applyArgs = ['apply', '--items', 'model', '--colors', 'off', '--palette', 'ansi', '--directory-style', 'basename', '--separator-style', 'compact', '--padding', '0', '--refresh-interval', '1', '--hide-vim-mode-indicator', 'off'];
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_old_schemas_read_as_english_without_rewriting', t => {
    const f = setup(t);
    for (const version of [1, 2, 3, 4, 5]) {
        const raw = jsonBytes(legacy(version));
        writeFileSync(f.displayPath, raw);
        const cfg = f.display();
        assert.equal(cfg.statusline_language, 'en');
        assert.equal(cfg.schema_version, 10);
        assert.deepEqual(readFileSync(f.displayPath), raw);
    }
    const result = setOption(f.service, 'statusline-language', 'zh-CN');
    assert.equal(result.changed, true);
    assert.equal(f.display().statusline_language, 'zh-CN');
    assert.ok(result.backup_dir);
});
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_v6_requires_supported_language_and_refuses_future_versions', () => {
    for (const statusline_language of [null, [], {}, true, 'zh', 'auto', ''])
        assert.throws(() => validateDisplay({ ...defaultDisplay(), statusline_language }));
    const value: any = defaultDisplay();
    delete value.statusline_language;
    assert.throws(() => validateDisplay(value));
    assert.throws(() => validateDisplay({ ...defaultDisplay(), schema_version: 11 }));
});
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_language_changes_revision_but_ui_language_does_not', t => {
    const f = setup(t), before = f.service.read().revision;
    setLanguage(f.root, 'zh-CN', f.io);
    assert.equal(f.service.read().revision, before);
    setOption(f.service, 'statusline-language', 'zh-CN');
    assert.notEqual(f.service.read().revision, before);
    setLanguage(f.root, 'en', f.io);
    assert.equal(f.display().statusline_language, 'zh-CN');
});
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_apply_omission_preserves_language_and_explicit_value_changes_it', t => {
    const f = setup(t, true);
    setOption(f.service, 'statusline-language', 'zh-CN');
    configCommand(applyArgs, f.service);
    assert.equal(f.display().statusline_language, 'zh-CN');
    configCommand([...applyArgs, '--statusline-language', 'en'], f.service);
    assert.equal(f.display().statusline_language, 'en');
    const raw = readFileSync(f.displayPath);
    assert.throws(() => configCommand([...applyArgs, '--statusline-language', 'auto'], f.service));
    assert.deepEqual(readFileSync(f.displayPath), raw);
});
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_failed_write_retains_prior_language_and_future_schema_is_not_overwritten', t => {
    const f = setup(t);
    setOption(f.service, 'statusline-language', 'zh-CN');
    const raw = readFileSync(f.displayPath), io = { ...f.io, write(path: string, bytes: Buffer) { if (path === f.displayPath)
            throw Error('refused'); f.io.write(path, bytes); } };
    assert.throws(() => setOption(new ConfigurationService(f.context, io), 'statusline-language', 'en'));
    assert.deepEqual(readFileSync(f.displayPath), raw);
    const future = jsonBytes({ ...defaultDisplay(), schema_version: 11 });
    writeFileSync(f.displayPath, future);
    assert.throws(() => setOption(f.service, 'statusline-language', 'en'));
    assert.deepEqual(readFileSync(f.displayPath), future);
});
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_export_import_presets_and_reset_have_explicit_language_semantics', t => {
    const f = setup(t), display = { ...defaultDisplay(), statusline_language: 'zh-CN' } as const, draft = { display, host: { ...DEFAULT_HOST } }, path = join(f.root, 'portable.json');
    exportFile(path, draft, f.root);
    assert.equal(importFile(path, draft).display.statusline_language, 'zh-CN');
    for (const name of Object.keys(ROWS))
        assert.equal(applyPreset(display, name, () => 'component').statusline_language, 'zh-CN');
    writeFileSync(path, jsonBytes(legacy(5)));
    assert.equal(importFile(path, draft).display.statusline_language, 'en');
    setLanguage(f.root, 'zh-CN', f.io);
    setOption(f.service, 'statusline-language', 'zh-CN');
    configCommand(['reset'], f.service);
    assert.equal(f.display().statusline_language, 'en');
    assert.equal(readPreferences(f.root, f.io).ui_language, 'zh-CN');
});
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_stale_editor_cannot_overwrite_language_changes', t => {
    const f = setup(t, true), current = f.read();
    setOption(f.service, 'statusline-language', 'zh-CN');
    const response = f.save(current);
    assert.equal(response.status, 2);
    assert.equal(response.response.error.code, 'configuration_conflict');
    assert.equal(f.display().statusline_language, 'zh-CN');
});
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_cli_and_legacy_parser_share_language_option', t => {
    const f = setup(t);
    executeConfig(parseSlashArguments('set statusline-language zh-CN'), f.service, 'en');
    assert.equal(JSON.parse(executeConfig(parseSlashArguments('show --json'), f.service)).display.statusline_language, 'zh-CN');
    assert.deepEqual(configurationOptions()['statusline-language'].choices, LANGUAGES);
});
const NEW = ['project-name', 'hostname', 'context-used', 'version', 'session', 'cost', 'prompt-cache', 'fast-mode', 'agent', 'vim-mode', 'thinking', 'pr', 'worktree', 'repo'];
test('tests.rendering.test_statusline_new_items.NewItemConfigCommandTests.test_list_items_json_marks_new_items_default_disabled', t => {
    const f = setup(t), rows = JSON.parse(configCommand(['list-items', '--json'], f.service)), byId = new Map<string, any>(rows.map((r: any) => [r.id, r]));
    assert.deepEqual(new Set(byId.keys()), new Set(BY_SCOPE.main.keys()));
    for (const id of NEW) {
        const row = byId.get(id);
        assert.equal(row.default_enabled, false);
        assert.equal(row.enabled, false);
        assert.equal(row.position, null);
    }
    for (const id of defaultItems('main'))
        assert.equal(byId.get(id).default_enabled, true);
});
test('tests.rendering.test_statusline_new_items.NewItemConfigCommandTests.test_enable_new_item_roundtrip', t => {
    const f = setup(t), result = selection(f.service, 'main', 'enable', ['cost']);
    assert.equal(result.changed, true);
    assert.deepEqual(selected(f.display()), [...defaultItems('main'), 'cost']);
    assert.equal(selection(f.service, 'main', 'enable', ['cost']).changed, false);
});
test('tests.rendering.test_statusline_new_items.NewItemConfigCommandTests.test_new_main_items_support_set_enable_disable_and_order', t => {
    const f = setup(t);
    selection(f.service, 'main', 'set-items', ['project-name', 'hostname', 'context-used']);
    selection(f.service, 'main', 'disable', ['hostname']);
    assert.deepEqual(selected(f.display()), ['project-name', 'context-used']);
    selection(f.service, 'main', 'enable', ['hostname']);
    selection(f.service, 'main', 'order', ['context-used', 'hostname', 'project-name']);
    assert.deepEqual(selected(f.display()), ['context-used', 'hostname', 'project-name']);
});
test('tests.rendering.test_statusline_new_items.NewItemConfigCommandTests.test_order_rejects_new_item_not_enabled', t => {
    const f = setup(t);
    selection(f.service, 'main', 'enable', ['cost']);
    assert.throws(() => selection(f.service, 'main', 'order', [...defaultItems('main'), 'cost', 'session']));
});
