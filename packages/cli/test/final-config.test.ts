import test from 'node:test';
import { chmodSync, statSync } from 'node:fs';
import { setup, assert, join, writeFileSync, readFileSync, existsSync, readdirSync, jsonBytes, readDisplay, selected, legacy } from './final-support.js';
import { config, env, rendered, updateDisplay } from './render-support.js';
import { defaultDisplay, defaultItem, validateDisplay, validateItems } from '@fbincon/statusline-core/config/display';
import { DEFAULT_FORMATTING } from '@fbincon/statusline-core/config/defaults';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { itemOptions } from '@fbincon/statusline-core/config/formatting';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { setField } from '@fbincon/statusline-core/config/editor-fields';
import { modelName, number, resetTime } from '@fbincon/statusline-core/rendering/preferences';
import { countdown } from '@fbincon/statusline-core/rendering/metrics';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { directory, formatDate } from '@fbincon/statusline-platform/presentation';
import { atomicWrite } from '@fbincon/statusline-platform/files';
import { setOption } from '@fbincon/statusline-cli/config/operations';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { importFile, exportFile } from '@fbincon/statusline-cli/config/transfer';
test('tests.config.test_display_config.DisplayConfigTests.test_missing_file_uses_legacy_compatible_defaults', t => {
    const f = setup(t), [value, raw] = readDisplay(f.root, f.io);
    assert.equal(raw, null);
    assert.deepEqual(value, defaultDisplay());
    assert.equal(value.scope_labels, 'when-subagents');
    assert.equal(value.subagents.enabled, true);
    assert.deepEqual(readdirSync(f.root), []);
});
test('tests.config.test_display_config.DisplayConfigTests.test_round_trip_preserves_empty_ordered_items_and_private_mode', t => {
    const f = setup(t), value = config([], { palette: 'ansi', directory_style: 'basename', separator_style: 'compact' });
    if (process.platform !== 'win32')
        chmodSync(f.root, 0o775);
    f.io.write(f.displayPath, jsonBytes(value));
    assert.deepEqual(f.display(), value);
    if (process.platform !== 'win32') {
        assert.equal(statSync(f.displayPath).mode & 0o777, 0o600);
        assert.equal(statSync(f.root).mode & 0o777, 0o775);
    }
    assert.ok(!readdirSync(f.root).some(name => name.endsWith('.tmp')));
});
test('tests.config.test_display_config.DisplayConfigTests.test_strict_schema_rejects_missing_unknown_duplicate_and_invalid_values', () => {
    const missing: any = defaultDisplay();
    delete missing.palette;
    const invalid: unknown[] = [missing, { ...defaultDisplay(), extra: true }, { ...defaultDisplay(), schema_version: 11 }, { ...defaultDisplay(), use_colors: 1 }, { ...defaultDisplay(), palette: 'theme' }, { ...defaultDisplay(), scope_labels: 'sometimes' }];
    for (const ids of [['git', 'git'], ['clock']])
        invalid.push({ ...defaultDisplay(), items: ids });
    for (const subagents of [{ enabled: true }, { enabled: true, items: ['status', 'status'] }, { enabled: true, items: ['history'] }, { enabled: true, items: ['status-elapsed', 'status'] }, { enabled: true, items: ['elapsed', 'status-elapsed', 'name'] }])
        invalid.push({ ...defaultDisplay(), subagents });
    for (const value of invalid)
        assert.throws(() => validateDisplay(value));
});
test('tests.config.test_display_config.DisplayConfigTests.test_subagent_status_elapsed_accepts_alone_rejects_legacy_pairs', () => {
    assert.deepEqual(validateItems(['status-elapsed', 'name'], 'subagent'), ['status-elapsed', 'name']);
    for (const ids of [['status-elapsed', 'status'], ['status-elapsed', 'elapsed'], ['status', 'status-elapsed', 'elapsed']])
        assert.throws(() => validateItems(ids, 'subagent'));
});
test('tests.config.test_display_config.DisplayConfigTests.test_schema_one_loads_as_current_schema_without_rewriting', t => {
    const f = setup(t), data = { ...legacy(1), items: ['git', 'model-with-effort'], use_colors: false, palette: 'ansi', directory_style: 'home', separator_style: 'compact' }, raw = jsonBytes(data);
    writeFileSync(f.displayPath, raw);
    const cfg = f.display();
    assert.equal(cfg.schema_version, 10);
    assert.deepEqual(selected(cfg), ['git', 'model-with-effort']);
    assert.equal(cfg.use_colors, false);
    assert.equal(cfg.scope_labels, 'when-subagents');
    assert.deepEqual(selected(cfg.subagents), selected(defaultDisplay().subagents));
    assert.deepEqual(readFileSync(f.displayPath), raw);
});
test('tests.config.test_display_config.DisplayConfigTests.test_duplicate_json_fields_are_rejected', t => {
    const f = setup(t);
    writeFileSync(f.displayPath, '{"schema_version":2,"schema_version":2}\n');
    assert.throws(() => f.display(), error => error instanceof ConfigError && error.key === 'errors.display.invalid_json_in' && String(error.params.exc).includes('duplicate JSON field: schema_version'));
});
test('tests.config.test_display_config.DisplayConfigTests.test_invalid_json_is_reported_without_rewrite', t => {
    const f = setup(t);
    writeFileSync(f.displayPath, '{broken');
    const raw = readFileSync(f.displayPath);
    assert.throws(() => f.display());
    assert.deepEqual(readFileSync(f.displayPath), raw);
});
test('tests.config.test_display_config.DisplayConfigTests.test_atomic_write_failure_preserves_previous_file', t => {
    const f = setup(t);
    f.io.write(f.displayPath, jsonBytes(defaultDisplay()));
    const before = readFileSync(f.displayPath);
    assert.throws(() => atomicWrite(f.displayPath, jsonBytes(config([])), stage => { if (stage === 'synced')
        throw Error('no'); }));
    assert.deepEqual(readFileSync(f.displayPath), before);
    assert.ok(!readdirSync(f.root).some(name => name.endsWith('.tmp')));
});
test('tests.config.test_display_config.DirectoryStyleTests.test_directory_styles', () => {
    const show = (path: string, style: string, project?: string) => directory(path, style, project, '/home/u', false);
    assert.equal(show('/home/u/code/repo', 'full'), '/home/u/code/repo');
    assert.equal(show('/home/u/code/repo', 'home'), '~/code/repo');
    assert.equal(show('/home/u', 'home'), '~');
    assert.equal(show('/code/repo', 'basename'), 'repo');
    assert.equal(show('/code/repo/src', 'project-relative', '/code/repo'), 'src');
    assert.equal(show('/other/src', 'project-relative', '/code/repo'), '/other/src');
    assert.equal(show('/home/u/a/../b', 'home'), '~/a/../b');
    assert.equal(show('//server/share', 'basename'), 'share');
    assert.equal(show('/home/USER/a', 'home'), '/home/USER/a');
});
test('tests.config.test_display_config.DirectoryStyleTests.test_windows_drive_unc_unicode_case_and_long_paths', () => {
    const show = (path: string, style: string, project?: string) => directory(path, style, project, String.raw `C:\Users\测试 User`, true);
    assert.equal(show(String.raw `c:\users\测试 User\项目\src`, 'home'), '~/项目/src');
    assert.equal(show(String.raw `c:\WORK\项目\src\包`, 'project-relative', String.raw `C:\work\项目`), 'src/包');
    assert.equal(show(String.raw `\\SERVER\Share\项目\src`, 'project-relative', String.raw `\\server\share\项目`), 'src');
    const raw = String.raw `C:\mixed/原始\separators` + '\\' + '很长'.repeat(100);
    assert.equal(show(raw, 'full'), raw);
    assert.equal(show(String.raw `\\server\share\项目`, 'basename'), '项目');
});
test('tests.config.test_formatting.FormattingTests.test_v2_normalizes_without_touching_file', t => {
    const f = setup(t), data = legacy(2);
    data.subagents = { enabled: false, items: ['name'] };
    const raw = jsonBytes(data);
    writeFileSync(f.displayPath, raw);
    const cfg = f.display();
    assert.equal(cfg.schema_version, 10);
    assert.deepEqual(cfg.formatting, DEFAULT_FORMATTING);
    assert.equal(cfg.subagents.enabled, false);
    assert.deepEqual(readFileSync(f.displayPath), raw);
});
test('tests.config.test_formatting.FormattingTests.test_invalid_advanced_options_are_rejected', () => {
    for (const change of [{ warning: true }, { critical: 60 }, { enabled: 1 }]) {
        const data = defaultDisplay();
        Object.assign(data.formatting.thresholds, change);
        assert.throws(() => validateDisplay(data));
    }
    for (const patch of [{ label: 'bad\x1b[0m' }, { priority: -1 }, { max_width: true }, { formatting: { model_name: 'made-up' } }])
        assert.throws(() => itemOptions({ ...defaultItem(), ...patch }));
});
test('tests.config.test_formatting.FormattingTests.test_known_model_versions_and_unknown_names', () => {
    assert.equal(modelName('claude-sonnet-4-5-20250929', { ...DEFAULT_FORMATTING, model_name: 'short' }), 'Sonnet 4.5');
    assert.equal(modelName('custom-20260101', { ...DEFAULT_FORMATTING, model_name: 'short' }), 'custom-20260101');
    assert.equal(modelName('claude-opus', DEFAULT_FORMATTING), 'claude-opus');
});
test('tests.config.test_formatting.FormattingTests.test_numbers_use_raw_integers_and_preserve_absence', () => {
    for (const [mode, expected] of [['compact', '1.2M'], ['full', '1200345'], ['grouped', '1,200,345']] as const) {
        const fmt = { ...DEFAULT_FORMATTING, number_format: mode };
        assert.equal(number(1200345, fmt), expected);
        assert.equal(number(0, fmt), '0');
        assert.equal(number(null, fmt), null);
        assert.equal(number(true, fmt), null);
    }
});
test('tests.config.test_formatting.FormattingTests.test_explicit_icons_replace_or_hide_legacy_glyphs', () => {
    for (const [icon, expected] of [['FAST', 'FAST fast'], ['', 'fast']]) {
        const cfg = updateDisplay(config(['fast-mode']), { item_options: { 'fast-mode': { ...defaultItem(), icon: icon! } } });
        assert.equal(rendered({ fast_mode: true }, cfg), expected);
    }
});
test('tests.config.test_formatting.FormattingTests.test_reset_absolute_format_has_fixed_clock_and_expiry', () => {
    const fmt = { ...DEFAULT_FORMATTING, reset_format: 'datetime', reset_timezone: 'UTC' } as const;
    assert.equal(resetTime(3600, 0, fmt, countdown, formatDate), '1970-01-01 01:00 UTC');
    assert.equal(resetTime(3600, 3600, fmt, countdown, formatDate), null);
});
test('tests.config.test_formatting.FormattingTests.test_remaining_allowance_uses_used_risk_and_scoped_overrides', () => {
    const cfg = updateDisplay(config(['five-hour-limit', 'model'], { use_colors: true, formatting: { ...DEFAULT_FORMATTING, thresholds: { enabled: true, warning: 70, critical: 90 } } }), { item_options: { model: { ...defaultItem(), label: 'Engine', formatting: { model_name: 'short' } } } }), data = { model: { id: 'claude-sonnet-4-5' }, rate_limits: { five_hour: { used_percentage: 95 } } };
    const raw = configuredRows(data, cfg, 500, env).join('\n');
    assert.ok(raw.includes('242;134;134'));
    assert.ok(rendered(data, cfg).includes('5% left'));
    assert.ok(rendered(data, cfg).includes('Engine Sonnet 4.5'));
    const used = updateDisplay(cfg, { use_colors: false, formatting: { ...cfg.formatting, allowance: 'used' } });
    const plain = configuredRows(data, used, 500, env).join('\n');
    assert.ok(plain.includes('95% used'));
    assert.ok(!plain.includes('\x1b'));
});
test('tests.config.test_formatting.FormattingTests.test_protocol_one_is_refused_before_reading_settings', t => {
    const f = setup(t), result = f.protocol.handle('{"protocol_version":1,"operation":"read","payload":{}}');
    assert.equal(result.status, 2);
    assert.equal((result.response as any).error.code, 'unsupported_protocol');
    assert.deepEqual(readdirSync(f.root), []);
});
test('tests.config.test_metrics.MetricsConfigTests.test_v3_read_preserves_source_and_formats_until_actual_save', t => {
    const f = setup(t), data = legacy(3);
    data.formatting.number_format = 'grouped';
    const raw = jsonBytes(data);
    writeFileSync(f.displayPath, raw);
    const cfg = f.display();
    assert.equal(cfg.schema_version, 10);
    assert.equal(cfg.metrics.branch_diff_base_ref, null);
    assert.equal(cfg.formatting.number_format, 'grouped');
    assert.deepEqual(readFileSync(f.displayPath), raw);
});
test('tests.config.test_metrics.MetricsConfigTests.test_base_field_and_complete_roundtrip_agree', () => {
    const cfg = setField(defaultDisplay(), 'metrics.branch_diff_base_ref', 'refs/heads/main');
    assert.equal(cfg.metrics.branch_diff_base_ref, 'refs/heads/main');
    assert.deepEqual(validateDisplay(cfg), cfg);
    assert.equal(setField(cfg, 'metrics.branch_diff_base_ref', 'inherit').metrics.branch_diff_base_ref, null);
    for (const value of ['', '--upload-pack=bad', 'bad\nref', 'a b', '\ud800', 1])
        assert.throws(() => validateDisplay({ ...cfg, metrics: { branch_diff_base_ref: value } }));
});
test('tests.config.test_appearance.AppearanceConfigTests.test_v6_read_migrate_backup_and_restore', t => {
    const f = setup(t), data = legacy(6), option = { label: '我的模型', icon: null, priority: 50, max_width: null, formatting: {} };
    data.item_options.model = option;
    data.subagents.item_options.name = { ...option };
    const raw = jsonBytes(data);
    writeFileSync(f.displayPath, raw);
    const cfg = f.display();
    assert.equal(cfg.schema_version, 10);
    assert.equal(cfg.instances.find(n => n.id === 'model')!.options.visibility, 'always');
    assert.deepEqual(readFileSync(f.displayPath), raw);
    assert.deepEqual(readdirSync(f.root), ['claude-statusline.json']);
    const changed = setOption(f.service, 'theme', 'light');
    assert.equal(changed.effective.display.instances.find(n => n.id === 'model')!.options.label, '我的模型');
    assert.deepEqual(readFileSync(join(changed.backup_dir!, 'claude-statusline.json.before')), raw);
    f.io.write(f.displayPath, raw);
    assert.deepEqual(readFileSync(f.displayPath), raw);
    data.item_options.model.foreground = '#ffffff';
    assert.throws(() => validateDisplay(data));
});
test('tests.config.test_appearance.AppearanceConfigTests.test_theme_preserves_overrides_and_failed_write_preserves_bytes', t => {
    const f = setup(t), cfg = updateDisplay(defaultDisplay(), { item_options: { model: { ...defaultItem(), background: '#abcdef' } } });
    f.io.write(f.displayPath, jsonBytes(cfg));
    const before = readFileSync(f.displayPath);
    const io = { ...f.io, write(path: string, bytes: Buffer) { if (path === f.displayPath)
            throw Error('failed'); f.io.write(path, bytes); } };
    assert.throws(() => setOption(new ConfigurationService(f.context, io), 'theme', 'dark'));
    assert.deepEqual(readFileSync(f.displayPath), before);
    const changed = setOption(f.service, 'theme', 'light').effective.display;
    assert.deepEqual(changed.instances, cfg.instances);
    assert.deepEqual(changed.layout, cfg.layout);
    const draft = { display: changed, host: { ...DEFAULT_HOST } }, path = join(f.root, 'portable.json');
    exportFile(path, draft, f.root);
    assert.deepEqual(importFile(path, draft), draft);
});
