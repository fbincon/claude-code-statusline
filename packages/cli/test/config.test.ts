import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { clone, ConfigError } from '@fbincon/statusline-core/config/validation';
import type { Draft } from '@fbincon/statusline-core/contracts/ui';
import { commandFor, ownedCommand } from '@fbincon/statusline-platform/commands';
import { ConfigurationService, draft } from '../src/config/service.js';
import { ConfigurationProtocol } from '../src/ui/protocol.js';
import { createStorage, jsonBytes, type Storage } from '../src/config/storage.js';
import { readPreferences, setLanguage } from '../src/config/preferences.js';
import { configCommand, itemListing, parseSlashArguments } from '../src/config/commands.js';
import { selection, setOption } from '../src/config/operations.js';
import { importFile, exportFile } from '../src/config/transfer.js';
type Reply = {
    result: {
        draft: Draft;
        revision: string;
        installed: boolean;
        installation: Record<string, {
            state: string;
        }>;
        changed: boolean;
        backup_dir: string | null;
        ui_language: string;
        warning: unknown;
    };
    error: {
        code: string;
        message: string;
        localization: {
            key: string;
        };
    };
};
function setup(t: TestContext, installed = true) {
    const root = fs.mkdtempSync(join(tmpdir(), "TS03 配置 ' $` "));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const launch = { executable: join(root, 'bin with spaces', 'claude-statusline'), args: [] as string[] };
    const context = { configDir: root, launch, hostVersion: () => [2, 1, 294] };
    const io = createStorage(() => new Date('2033-05-18T03:33:20Z'));
    const settingsPath = join(root, 'settings.json'), displayPath = join(root, 'claude-statusline.json');
    if (installed)
        fs.writeFileSync(settingsPath, jsonBytes({ statusLine: { type: 'command', command: commandFor(launch, 'render'), refreshInterval: 1 }, subagentStatusLine: { type: 'command', command: commandFor(launch, 'render-subagents') }, permissions: { allow: ['Read'] } }));
    const service = new ConfigurationService(context, io), protocol = new ConfigurationProtocol(service);
    function call(operation: string, payload: unknown = {}, custom = protocol) { const reply = custom.handle(JSON.stringify({ protocol_version: 26, operation, payload }), error => assert.fail(String(error))); return { status: reply.status, response: reply.response as Reply }; }
    const read = () => { const reply = call('read'); assert.equal(reply.status, 0, JSON.stringify(reply.response)); return reply.response.result; };
    const save = (current: ReturnType<typeof read>) => call('apply', { draft: current.draft, expected_revision: current.revision });
    return { root, context, io, service, protocol, call, read, save, settingsPath, displayPath, launch };
}
function backups(root: string): string[] { const path = join(root, 'backups/statusline'); return fs.existsSync(path) ? fs.readdirSync(path).sort() : []; }
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_two_editors_noop_and_unrelated_settings_preserved', t => {
    const f = setup(t), first = f.read(), second = f.read();
    const settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.permissions.allow.push('Glob');
    settings.theme = 'dark';
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings, null, 4));
    const originalSettings = fs.readFileSync(f.settingsPath);
    first.draft.display.use_colors = false;
    const saved = f.save(first);
    assert.equal(saved.status, 0);
    assert.equal(saved.response.result.changed, true);
    assert.deepEqual(fs.readFileSync(f.settingsPath), originalSettings);
    const original = fs.readFileSync(f.displayPath), prior = backups(f.root);
    const stale = f.save(second);
    assert.equal(stale.status, 2);
    assert.equal(stale.response.error.code, 'configuration_conflict');
    assert.deepEqual(backups(f.root), prior);
    assert.deepEqual(fs.readFileSync(f.displayPath), original);
    const repeated = f.save(saved.response.result);
    assert.equal(repeated.status, 0);
    assert.equal(repeated.response.result.changed, false);
    assert.equal(repeated.response.result.backup_dir, null);
    assert.deepEqual(backups(f.root), prior);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_main_subagent_and_type_ownership_changes_conflict', t => {
    const f = setup(t), original = fs.readFileSync(f.settingsPath);
    for (const key of ['statusLine', 'subagentStatusLine'])
        for (const field of ['command', 'type']) {
            fs.writeFileSync(f.settingsPath, original);
            const baseline = f.read();
            const settings = JSON.parse(original.toString());
            settings[key][field] = field === 'command' ? 'foreign-renderer' : 'prompt';
            fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
            const before = fs.readFileSync(f.settingsPath), result = f.save(baseline);
            assert.equal(result.response.error.code, 'configuration_conflict');
            assert.deepEqual(fs.readFileSync(f.settingsPath), before);
            assert.equal(fs.existsSync(f.displayPath), false);
            assert.deepEqual(backups(f.root), []);
        }
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_revision_is_checked_after_lock_acquisition', t => {
    const f = setup(t), current = f.read();
    const io: Storage = { ...f.io, lock(directory, action) { return f.io.lock(directory, () => { const data = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8')); data.statusLine.padding = 4; fs.writeFileSync(f.settingsPath, JSON.stringify(data)); return action(); }); } };
    const p = new ConfigurationProtocol(new ConfigurationService(f.context, io));
    const result = f.call('apply', { draft: current.draft, expected_revision: current.revision }, p);
    assert.equal(result.response.error.code, 'configuration_conflict');
    assert.equal(JSON.parse(fs.readFileSync(f.settingsPath, 'utf8')).statusLine.padding, 4);
    assert.deepEqual(backups(f.root), []);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_rollback_after_settings_write_and_missing_installation', t => {
    const f = setup(t), current = f.read(), before = fs.readFileSync(f.settingsPath);
    current.draft.host.padding = 3;
    const io: Storage = { ...f.io, write(path, raw) { if (path === f.displayPath)
            throw new Error('injected late failure'); f.io.write(path, raw); } };
    const result = f.call('apply', { draft: current.draft, expected_revision: current.revision }, new ConfigurationProtocol(new ConfigurationService(f.context, io)));
    assert.equal(result.response.error.code, 'io_error');
    assert.deepEqual(fs.readFileSync(f.settingsPath), before);
    assert.equal(fs.existsSync(f.displayPath), false);
    fs.unlinkSync(f.settingsPath);
    const uninstalled = f.read(), count = backups(f.root).length;
    assert.equal(f.save(uninstalled).response.error.code, 'not_installed');
    assert.equal(fs.existsSync(f.settingsPath), false);
    assert.equal(backups(f.root).length, count);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_invalid_apply_never_locks_or_backs_up', t => {
    const f = setup(t), current = f.read();
    const io: Storage = { ...f.io, lock() { assert.fail('invalid draft acquired lock'); }, backup() { assert.fail('invalid draft created backup'); } };
    const p = new ConfigurationProtocol(new ConfigurationService(f.context, io));
    for (const expected_revision of [null, '', 'x'.repeat(64), true])
        assert.equal(f.call('apply', { draft: current.draft, expected_revision }, p).status, 2);
    const invalid = clone(current.draft);
    invalid.display.instances.push(clone(invalid.display.instances[0]!));
    assert.equal(f.call('apply', { draft: invalid, expected_revision: current.revision }, p).status, 2);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_apply_requires_every_draft_field_before_locking', t => {
    const f = setup(t), current = f.read();
    const p = new ConfigurationProtocol(new ConfigurationService(f.context, { ...f.io, lock() { assert.fail('incomplete draft acquired lock'); } }));
    for (const section of ['display', 'host'] as const)
        for (const key of Object.keys(current.draft[section])) {
            const invalid = clone(current.draft);
            delete (invalid[section] as unknown as Record<string, unknown>)[key];
            assert.equal(f.call('apply', { draft: invalid, expected_revision: current.revision }, p).status, 2);
        }
    for (const key of ['enabled', 'instances']) {
        const invalid = clone(current.draft);
        delete (invalid.display.subagents as unknown as Record<string, unknown>)[key];
        assert.equal(f.call('apply', { draft: invalid, expected_revision: current.revision }, p).status, 2);
    }
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_legacy_file_is_read_without_writes_and_migrated_on_apply', t => {
    const f = setup(t);
    const legacy = { schema_version: 1, items: ['git'], use_colors: false, palette: 'ansi', directory_style: 'basename', separator_style: 'compact' };
    const raw = Buffer.from(JSON.stringify(legacy, null, 4));
    fs.writeFileSync(f.displayPath, raw);
    const current = f.read();
    assert.equal(current.draft.display.schema_version, 16);
    assert.deepEqual(fs.readFileSync(f.displayPath), raw);
    const saved = f.save(current);
    assert.equal(saved.status, 0);
    assert.deepEqual(fs.readFileSync(join(saved.response.result.backup_dir!, 'claude-statusline.json.before')), raw);
    assert.equal(JSON.parse(fs.readFileSync(f.displayPath, 'utf8')).schema_version, 16);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_fresh_snapshot_cannot_save_foreign_installation', t => {
    const f = setup(t), original = fs.readFileSync(f.settingsPath);
    for (const key of ['statusLine', 'subagentStatusLine'])
        for (const field of ['command', 'type']) {
            const settings = JSON.parse(original.toString());
            settings[key][field] = field === 'command' ? 'foreign-renderer' : 'prompt';
            fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
            const current = f.read();
            assert.equal(current.installation[key]!.state, 'foreign');
            current.draft.host.padding = 5;
            const before = fs.readFileSync(f.settingsPath);
            assert.equal(f.save(current).response.error.code, 'ownership_mismatch');
            assert.deepEqual(fs.readFileSync(f.settingsPath), before);
            assert.deepEqual(backups(f.root), []);
        }
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_owned_command_whitespace_is_semantically_equivalent', t => {
    const f = setup(t), current = f.read();
    const settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.statusLine.command += '  ';
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings, null, 3));
    assert.equal(f.read().revision, current.revision);
    assert.equal(f.read().installed, true);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_symbolic_backend_aliases_with_shell_characters_share_owned_identity', { skip: process.platform === 'win32' }, t => {
    const f = setup(t), real = join(f.root, 'real backend'), alias = join(f.root, 'alias backend');
    fs.writeFileSync(real, 'backend');
    fs.symlinkSync(real, alias);
    const bound = { executable: real, args: [] }, settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.statusLine.command = commandFor({ executable: alias, args: [] }, 'render');
    settings.subagentStatusLine.command = commandFor({ executable: alias, args: [] }, 'render-subagents');
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
    const service = new ConfigurationService({ ...f.context, launch: bound }, f.io), current = service.read();
    assert.equal(current.installed, true);
    current.display.use_colors = false;
    assert.equal(service.apply(draft(current), current.revision).changed, true);
});
test('Node LaunchSpec matches its complete executable/argument prefix and refuses shell suffixes', t => {
    const f = setup(t), launch = { executable: process.execPath, args: [join(f.root, 'entry.js')] };
    assert.equal(ownedCommand(commandFor(launch, 'render'), 'render', launch), true);
    for (const command of [`${commandFor(launch, 'render')} && other`, commandFor({ ...launch, args: ['other.js'] }, 'render'), 'claude-statusline render'])
        assert.equal(ownedCommand(command, 'render', launch), false);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_actual_cli_read_apply_and_stale_request_are_json_only', t => {
    const f = setup(t), entry = fileURLToPath(new URL('../src/entry.js', import.meta.url));
    const launch = { executable: process.execPath, args: [entry] }, settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.statusLine.command = commandFor(launch, 'render');
    settings.subagentStatusLine.command = commandFor(launch, 'render-subagents');
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
    function invoke(operation: string, payload: unknown) {
        const result = spawnSync(process.execPath, [entry, 'ui', '--config-dir', f.root], { input: JSON.stringify({ protocol_version: 26, operation, payload }), encoding: 'utf8', timeout: 30000, env: { ...process.env, PATH: '' } });
        assert.equal(result.stderr, '');
        return { status: result.status, response: JSON.parse(result.stdout) as Reply };
    }
    const initial = invoke('read', {});
    assert.equal(initial.status, 0);
    assert.equal(initial.response.result.installed, true);
    const current = initial.response.result;
    current.draft.display.use_colors = false;
    const payload = { draft: current.draft, expected_revision: current.revision };
    assert.equal(invoke('apply', payload).status, 0);
    assert.equal(invoke('apply', payload).response.error.code, 'configuration_conflict');
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_missing_read_creates_nothing', t => {
    const f = setup(t, false), absent = join(f.root, 'absent');
    assert.equal(readPreferences(absent).ui_language, 'en');
    assert.equal(fs.existsSync(absent), false);
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_save_reopen_idempotence_and_unrelated_files', t => {
    const f = setup(t), original = fs.readFileSync(f.settingsPath);
    for (const language of ['zh-CN', 'en']) {
        setLanguage(f.root, language, f.io);
        const raw = fs.readFileSync(join(f.root, 'statusline-ui.json')), prior = backups(f.root);
        assert.equal(readPreferences(f.root).ui_language, language);
        setLanguage(f.root, language, f.io);
        assert.deepEqual(fs.readFileSync(join(f.root, 'statusline-ui.json')), raw);
        assert.deepEqual(backups(f.root), prior);
    }
    assert.deepEqual(fs.readFileSync(f.settingsPath), original);
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_invalid_preferences_are_read_only_and_explicitly_repaired', t => {
    const f = setup(t, false), path = join(f.root, 'statusline-ui.json');
    for (const raw of [Buffer.from('broken'), Buffer.from([255]), Buffer.from('[]'), Buffer.from('{"schema_version":true,"ui_language":"zh-CN"}'), Buffer.from('{"schema_version":1,"ui_language":"xx"}'), Buffer.from('{"schema_version":1,"schema_version":1,"ui_language":"en"}')]) {
        fs.writeFileSync(path, raw);
        const value = readPreferences(f.root);
        assert.equal(value.ui_language, 'en');
        assert.notEqual(value.warning, null);
        assert.deepEqual(fs.readFileSync(path), raw);
        setLanguage(f.root, 'zh-CN', f.io);
        assert.equal(readPreferences(f.root).ui_language, 'zh-CN');
        assert.ok(backups(f.root).some(name => fs.readFileSync(join(f.root, 'backups/statusline', name, 'statusline-ui.json.before')).equals(raw)));
    }
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_future_schema_and_unknown_languages_are_never_written', t => {
    const f = setup(t, false), absent = join(f.root, 'absent');
    assert.throws(() => setLanguage(absent, 'xx'), ConfigError);
    assert.equal(fs.existsSync(absent), false);
    const raw = Buffer.from('{"schema_version":2,"ui_language":"zh-CN","future":true}'), path = join(f.root, 'statusline-ui.json');
    fs.writeFileSync(path, raw);
    assert.throws(() => setLanguage(f.root, 'en', f.io), (error: unknown) => error instanceof ConfigError && error.key === 'preferences.future_schema');
    assert.deepEqual(fs.readFileSync(path), raw);
    assert.deepEqual(backups(f.root), []);
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_write_failure_after_replace_restores_last_choice', t => {
    const f = setup(t, false);
    setLanguage(f.root, 'en', f.io);
    const path = join(f.root, 'statusline-ui.json'), before = fs.readFileSync(path);
    let writes = 0;
    const io: Storage = { ...f.io, write(path, raw) { f.io.write(path, raw); if (++writes === 1)
            throw new Error('directory sync failed after replace'); } };
    assert.throws(() => setLanguage(f.root, 'zh-CN', io), ConfigError);
    assert.deepEqual(fs.readFileSync(path), before);
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_protocol_preferences_work_without_renderer_and_errors_keep_metadata', t => {
    const f = setup(t, false);
    assert.equal(f.call('read_ui_preferences').response.result.ui_language, 'en');
    assert.equal(fs.existsSync(join(f.root, 'statusline_runtime')), false);
    assert.equal(f.call('set_ui_language', { ui_language: 'zh-CN' }).status, 0);
    const result = f.call('set_ui_language', { ui_language: 'unknown' });
    assert.equal(result.status, 2);
    assert.equal(result.response.error.localization.key, 'preferences.unsupported_language');
});
test('tests.config.test_transfer.TransferTests.test_existing_file_and_live_config_are_protected', t => {
    const f = setup(t), value = draft(f.service.read()), target = join(f.root, 'portable.json');
    exportFile(target, value, f.root);
    const raw = fs.readFileSync(target);
    assert.throws(() => exportFile(target, value, f.root));
    assert.deepEqual(fs.readFileSync(target), raw);
    for (const name of ['settings.json', 'claude-statusline.json', 'claude-statusline-native.json', 'claude-statusline-runtime.json', 'claude-statusline-features.json', 'statusline-ui.json', 'statusline_runtime/private.json', 'statusline-native/binding.json', 'statusline-runtime/binding.json'])
        assert.throws(() => exportFile(join(f.root, name), value, f.root, true), ConfigError);
});
test('tests.config.test_transfer.TransferTests.test_export_import_roundtrip_contains_only_draft', t => {
    const f = setup(t), value = draft(f.service.read()), target = join(f.root, 'portable.json');
    exportFile(target, value, f.root);
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(target, 'utf8'))), ['format', 'version', 'draft']);
    assert.deepEqual(importFile(target, value), value);
});
test('read, dry-run, export and import review preserve display bytes and backups', t => {
    const f = setup(t), value = { display: defaultDisplay(), host: clone(DEFAULT_HOST) };
    fs.writeFileSync(f.displayPath, jsonBytes(value.display));
    const before = fs.readFileSync(f.displayPath), prior = backups(f.root);
    assert.match(configCommand(['preset', 'minimal', '--dry-run'], f.service), /schema_version/);
    const path = join(f.root, 'portable.json');
    configCommand(['export', path], f.service);
    configCommand(['import', path, '--dry-run'], f.service);
    assert.equal(f.call('review_import', { draft: value, path }).status, 0);
    assert.deepEqual(fs.readFileSync(f.displayPath), before);
    assert.deepEqual(backups(f.root), prior);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_set_enable_disable_and_order', t => {
    const f = setup(t, false), ids = () => f.service.read().display.instances.filter(n => n.enabled).map(n => n.id);
    selection(f.service, 'main', 'set-items', ['git', 'tokens']);
    assert.deepEqual(ids(), ['git', 'tokens']);
    selection(f.service, 'main', 'enable', ['context-remaining', 'model-with-effort']);
    assert.deepEqual(ids(), ['git', 'tokens', 'context-remaining', 'model-with-effort']);
    selection(f.service, 'main', 'disable', ['tokens']);
    assert.deepEqual(ids(), ['git', 'context-remaining', 'model-with-effort']);
    selection(f.service, 'main', 'order', ['model-with-effort', 'git', 'context-remaining']);
    assert.deepEqual(ids(), ['model-with-effort', 'git', 'context-remaining']);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_order_must_match_enabled_set_without_writing', t => {
    const f = setup(t, false);
    selection(f.service, 'main', 'set-items', ['git', 'tokens']);
    const before = fs.readFileSync(f.displayPath), prior = backups(f.root);
    assert.throws(() => selection(f.service, 'main', 'order', ['git']), ConfigError);
    assert.deepEqual(fs.readFileSync(f.displayPath), before);
    assert.deepEqual(backups(f.root), prior);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_empty_set_items_disables_everything', t => {
    const f = setup(t, false);
    selection(f.service, 'main', 'set-items', []);
    assert.deepEqual(f.service.read().display.instances.filter(n => n.enabled), []);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_display_options_work_before_statusline_is_installed', t => {
    const f = setup(t, false);
    for (const [option, value] of [['colors', 'off'], ['palette', 'ansi'], ['directory-style', 'basename']])
        setOption(f.service, option!, value);
    const display = f.service.read().display;
    assert.equal(display.use_colors, false);
    assert.equal(display.palette, 'ansi');
    assert.equal(display.directory_style, 'basename');
    assert.equal(fs.existsSync(f.settingsPath), false);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_unknown_or_duplicate_items_are_rejected', t => {
    const f = setup(t, false);
    for (const items of [['clock'], ['git', 'git']])
        assert.throws(() => selection(f.service, 'main', 'set-items', items), ConfigError);
    assert.equal(fs.existsSync(f.displayPath), false);
    assert.deepEqual(backups(f.root), []);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_subagent_set_enable_disable_and_order', t => {
    const f = setup(t, false);
    selection(f.service, 'subagent', 'set-items', ['name', 'status']);
    selection(f.service, 'subagent', 'enable', ['elapsed', 'tokens']);
    selection(f.service, 'subagent', 'disable', ['status']);
    selection(f.service, 'subagent', 'order', ['tokens', 'elapsed', 'name']);
    assert.deepEqual(f.service.read().display.subagents.instances.filter(n => n.enabled).map(n => n.id), ['tokens', 'elapsed', 'name']);
    assert.throws(() => selection(f.service, 'subagent', 'order', ['tokens', 'name']), ConfigError);
    for (const items of [['status-elapsed', 'status'], ['elapsed', 'status-elapsed']])
        assert.throws(() => selection(f.service, 'subagent', 'set-items', items), ConfigError);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_subagent_context_remaining_selectable_via_config_commands', t => {
    const f = setup(t, false), defaults = itemListing('subagent', f.service.read());
    assert.equal(defaults.find(x => x.id === 'context-remaining')!.default_enabled, true);
    assert.equal(defaults.find(x => x.id === 'context-used')!.default_enabled, false);
    assert.equal(defaults.find(x => x.id === 'context-used')!.position, null);
    const result = selection(f.service, 'subagent', 'set-items', ['status', 'name', 'context-remaining', 'context-used']);
    assert.equal(result.changed, true);
    assert.deepEqual(result.effective.display.subagents.instances.filter(n => n.enabled).map(n => n.id), ['status', 'name', 'context-remaining', 'context-used']);
});
test('tests.config.test_config_commands.DisplayMutationTests.test_scope_and_subagent_statusline_options', t => {
    const f = setup(t, false);
    setOption(f.service, 'scope-labels', 'always');
    setOption(f.service, 'subagent-statusline', 'off');
    const config = f.service.read().display;
    assert.equal(config.scope_labels, 'always');
    assert.equal(config.subagents.enabled, false);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_host_option_requires_owned_statusline', t => {
    const f = setup(t, false);
    assert.throws(() => setOption(f.service, 'padding', '2'), (error: unknown) => error instanceof ConfigError && error.code === 'not_installed');
    assert.equal(fs.existsSync(f.settingsPath), false);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_host_options_update_only_owned_statusline_fields', t => {
    const f = setup(t), settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.statusLine.custom = 'kept';
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
    setOption(f.service, 'padding', '2');
    setOption(f.service, 'refresh-interval', 'event');
    setOption(f.service, 'hide-vim-mode-indicator', 'on');
    const changed = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    assert.deepEqual(changed.permissions, settings.permissions);
    assert.equal(changed.statusLine.custom, 'kept');
    assert.equal(changed.statusLine.padding, 2);
    assert.equal(Object.hasOwn(changed.statusLine, 'refreshInterval'), false);
    assert.equal(changed.statusLine.hideVimModeIndicator, true);
});
const applyArguments = ['apply', '--items', 'git', 'context-remaining', '--colors', 'off', '--palette', 'ansi', '--directory-style', 'home', '--separator-style', 'compact', '--padding', '4', '--refresh-interval', '5', '--hide-vim-mode-indicator', 'on'];
test('tests.config.test_config_commands.HostAndTransactionTests.test_complete_apply_updates_both_files_and_creates_one_backup', t => {
    const f = setup(t);
    configCommand(applyArguments, f.service);
    const dirs = backups(f.root);
    assert.equal(dirs.length, 1);
    for (const name of ['settings.json.before', 'claude-statusline.json.absent'])
        assert.ok(fs.existsSync(join(f.root, 'backups/statusline', dirs[0]!, name)));
    const effective = f.service.read();
    assert.deepEqual(effective.display.instances.filter(n => n.enabled).map(n => n.id), ['git', 'context-remaining']);
    assert.equal(effective.display.use_colors, false);
    assert.deepEqual(effective.host, { padding: 4, refresh_interval: 5, hide_vim_mode_indicator: true });
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_expected_conflict_fails_before_backup_without_changing_bytes', t => {
    const f = setup(t), initial = f.service.read();
    setOption(f.service, 'padding', '3');
    const before = fs.readFileSync(f.settingsPath), prior = backups(f.root);
    assert.throws(() => f.service.apply(draft(initial), initial.revision), (e: unknown) => e instanceof ConfigError && e.code === 'configuration_conflict');
    assert.deepEqual(fs.readFileSync(f.settingsPath), before);
    assert.deepEqual(backups(f.root), prior);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_expected_ignores_unrelated_settings_and_merges_latest_fields', t => {
    const f = setup(t), initial = f.service.read(), settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.permissions.allow.push('Glob');
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
    initial.host.padding = 2;
    f.service.apply(draft(initial), initial.revision);
    const result = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    assert.deepEqual(result.permissions.allow, ['Read', 'Glob']);
    assert.equal(result.statusLine.padding, 2);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_late_display_write_failure_rolls_back_settings', t => {
    const f = setup(t), before = fs.readFileSync(f.settingsPath), io: Storage = { ...f.io, write(path, raw) { if (path === f.displayPath)
            throw new Error('boom'); f.io.write(path, raw); } };
    assert.throws(() => configCommand(applyArguments, new ConfigurationService(f.context, io)), ConfigError);
    assert.deepEqual(fs.readFileSync(f.settingsPath), before);
    assert.equal(fs.existsSync(f.displayPath), false);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_reset_repairs_invalid_display_and_restores_host_defaults', t => {
    const f = setup(t);
    configCommand(applyArguments, f.service);
    fs.writeFileSync(f.displayPath, '{broken');
    f.service.reset();
    assert.equal(fs.existsSync(f.displayPath), false);
    const line = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8')).statusLine;
    assert.equal(line.refreshInterval, 1);
    assert.equal(Object.hasOwn(line, 'padding'), false);
    assert.equal(Object.hasOwn(line, 'hideVimModeIndicator'), false);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_bounds_are_enforced', t => {
    const f = setup(t), before = fs.readFileSync(f.settingsPath);
    for (const [option, value] of [['padding', '33'], ['padding', '-1'], ['refresh-interval', '0'], ['refresh-interval', '3601']])
        assert.throws(() => setOption(f.service, option!, value), ConfigError);
    assert.deepEqual(fs.readFileSync(f.settingsPath), before);
    assert.deepEqual(backups(f.root), []);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_v1_is_read_only_until_first_save_then_backed_up_as_raw_bytes', t => {
    const f = setup(t), raw = Buffer.from('{"schema_version":1,"items":["git"],"use_colors":true,"palette":"default","directory_style":"full","separator_style":"classic"}\n');
    fs.writeFileSync(f.displayPath, raw);
    f.service.read();
    assert.deepEqual(fs.readFileSync(f.displayPath), raw);
    const result = setOption(f.service, 'scope-labels', 'always');
    assert.deepEqual(fs.readFileSync(join(result.backup_dir!, 'claude-statusline.json.before')), raw);
    assert.equal(result.effective.display.schema_version, 16);
    assert.equal(result.effective.display.scope_labels, 'always');
    assert.deepEqual(result.effective.display.instances.filter(n => n.enabled).map(n => n.id), ['git']);
});
test('tests.config.test_config_commands.HostAndTransactionTests.test_old_apply_shape_preserves_v2_subagent_values', t => {
    const f = setup(t);
    setOption(f.service, 'scope-labels', 'always');
    setOption(f.service, 'subagent-statusline', 'off');
    selection(f.service, 'subagent', 'set-items', ['name', 'elapsed']);
    configCommand(applyArguments, f.service);
    const display = f.service.read().display;
    assert.equal(display.scope_labels, 'always');
    assert.equal(display.subagents.enabled, false);
    assert.deepEqual(display.subagents.instances.filter(n => n.enabled).map(n => n.id), ['name', 'elapsed']);
});
test('tests.config.test_config_commands.ParserAndFormattingTests.test_slash_parser_accepts_documented_commands_and_rejects_unknown', () => {
    const parsed = parseSlashArguments('set colors off');
    assert.equal(parsed.action, 'set');
    assert.equal(parsed.option, 'colors');
    assert.equal(parsed.value, 'off');
    assert.throws(() => parseSlashArguments('unknown'));
    assert.throws(() => parseSlashArguments("set colors 'off"));
});
test('tests.config.test_config_commands.ParserAndFormattingTests.test_show_and_list_json_are_machine_readable', t => {
    const f = setup(t, false), shown = JSON.parse(configCommand(['show', '--json'], f.service));
    assert.equal(shown.display.schema_version, 16);
    assert.deepEqual(Object.keys(shown.subagent_statusline), ['enabled', 'installed', 'state']);
    for (const [args, count] of [[['list-items', '--json'], 67], [['subagents', 'list-items', '--json'], 17]] as const)
        assert.equal(JSON.parse(configCommand(args, f.service)).length, count);
});
test('tests.config.test_config_commands.ParserAndFormattingTests.test_slash_parser_accepts_all_subagent_commands', () => {
    for (const [raw, action] of [['subagents set-items', 'set-items'], ['subagents enable tokens', 'enable'], ['subagents disable task', 'disable'], ['subagents order', 'order']]) {
        const parsed = parseSlashArguments(raw!);
        assert.equal(parsed.action, 'subagents');
        assert.equal(parsed.subaction, action);
    }
});
test('tests.config.test_config_commands.ParserAndFormattingTests.test_show_classifies_all_subagent_statusline_states', t => {
    const f = setup(t), original = fs.readFileSync(f.settingsPath);
    for (const [command, version, state, installed] of [[null, [2, 1, 205], 'absent', false], [commandFor(f.launch, 'render-subagents'), [2, 1, 205], 'owned', true], ['third-party', [2, 1, 205], 'foreign', false], [commandFor(f.launch, 'render-subagents'), [2, 1, 204], 'unsupported', false]] as const) {
        const settings = JSON.parse(original.toString());
        if (command === null)
            delete settings.subagentStatusLine;
        else
            settings.subagentStatusLine.command = command;
        fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
        const effective = new ConfigurationService({ ...f.context, hostVersion: () => version }, f.io).read();
        assert.equal(effective.subagent_statusline.state, state);
        assert.equal(effective.subagent_statusline.installed, installed);
    }
});
test('tests.config.test_instance_commands.InstanceCommandTests.test_copy_options_and_roundtrip_keep_identity', t => {
    const f = setup(t, false), first = configCommand(['instance', 'main', 'add', 'model'], f.service).split('\n').at(-1)!, second = configCommand(['instance', 'main', 'copy', first], f.service).split('\n').at(-1)!;
    configCommand(['instance', 'main', 'set', second, 'label', '副本 中文'], f.service);
    assert.throws(() => configCommand(['instance', 'main', 'set', second, 'number-format', 'full'], f.service), ConfigError);
    configCommand(['instance', 'main', 'set', second, 'model-name', 'short'], f.service);
    const nodes = f.service.read().display.instances;
    assert.equal(nodes.find(n => n.id === second)!.options.label, '副本 中文');
    assert.equal(nodes.find(n => n.id === first)!.options.label, null);
    const path = join(f.root, 'portable.json');
    configCommand(['export', path], f.service);
    assert.deepEqual(JSON.parse(fs.readFileSync(path, 'utf8')).draft.display.instances, nodes);
    const before = fs.readFileSync(f.displayPath);
    configCommand(['import', path, '--dry-run'], f.service);
    assert.deepEqual(fs.readFileSync(f.displayPath), before);
});
test('tests.config.test_instance_commands.InstanceCommandTests.test_legacy_ambiguity_and_invalid_edit_never_write_or_backup', t => {
    const f = setup(t, false);
    configCommand(['instance', 'main', 'copy', 'model-with-effort'], f.service);
    const before = fs.readFileSync(f.displayPath), prior = backups(f.root);
    for (const args of [['item', 'main', 'model-with-effort', 'label', 'bad'], ['set-items', 'model-with-effort'], ['layout', 'explicit', 'model-with-effort'], ['instance', 'main', 'set', 'missing', 'label', 'bad']]) {
        assert.throws(() => configCommand(args, f.service), ConfigError);
        assert.deepEqual(fs.readFileSync(f.displayPath), before);
        assert.deepEqual(backups(f.root), prior);
    }
});
test('tests.config.test_instance_commands.InstanceCommandTests.test_unique_type_command_resolves_a_generated_id', t => {
    const f = setup(t, false), id = configCommand(['instance', 'main', 'add', 'hostname'], f.service).split('\n').at(-1)!;
    configCommand(['item', 'main', 'hostname', 'label', 'Host'], f.service);
    configCommand(['disable', 'hostname'], f.service);
    const node = f.service.read().display.instances.find(n => n.id === id)!;
    assert.equal(node.options.label, 'Host');
    assert.equal(node.enabled, false);
    configCommand(['enable', 'hostname'], f.service);
    assert.ok(f.service.read().display.instances.some(n => n.id === id && n.enabled));
});
test('tests.config.test_instance_commands.InstanceCommandTests.test_presets_spacers_literal_text_and_instance_rows', t => {
    const f = setup(t);
    configCommand(['preset', 'left-right'], f.service);
    configCommand(['layout', '--by-instance', 'explicit', 'model-with-effort,git,spacer,context-remaining'], f.service);
    const id = configCommand(['instance', 'main', 'add', 'text', '--text', 'inherit'], f.service).split('\n').at(-1)!;
    assert.equal(f.service.read().display.instances.find(n => n.id === id)!.text, 'inherit');
    const before = fs.readFileSync(f.displayPath);
    assert.throws(() => configCommand(['instance', 'main', 'copy', 'spacer'], f.service), ConfigError);
    assert.deepEqual(fs.readFileSync(f.displayPath), before);
    configCommand(['instance', 'main', 'move', id, '--before', 'git'], f.service);
    configCommand(['instance', 'main', 'disable', id], f.service);
    assert.equal(f.service.read().display.layout.rows[0]![1], id);
    configCommand(['instance', 'main', 'remove', id], f.service);
    assert.equal(f.service.read().display.layout.rows[0]!.includes(id), false);
});
test('tests.config.test_instance_commands.InstanceCommandTests.test_legacy_unique_toggle_preserves_composition_positions', t => {
    const f = setup(t);
    configCommand(['preset', 'left-right'], f.service);
    configCommand(['instance', 'main', 'copy', 'context-remaining'], f.service);
    const original = f.service.read().display;
    for (const action of ['disable', 'enable']) {
        configCommand([action, 'git'], f.service);
        const current = f.service.read().display;
        assert.deepEqual(current.instances.map(n => n.id), original.instances.map(n => n.id));
        assert.deepEqual(current.layout, original.layout);
        assert.equal(current.instances.find(n => n.id === 'git')!.enabled, action === 'enable');
    }
    assert.deepEqual(f.service.read().display, original);
});
test('tests.config.test_instance_commands.InstanceCommandTests.test_legacy_subagent_toggle_retains_the_spacer_side', t => {
    const f = setup(t);
    configCommand(['preset', 'left-right'], f.service);
    const original = f.service.read().display.subagents;
    configCommand(['subagents', 'disable', 'name'], f.service);
    configCommand(['subagents', 'enable', 'name'], f.service);
    assert.deepEqual(f.service.read().display.subagents, original);
});
test('tests.config.test_transfer.TransferTests.test_display_only_v1_v2_import_keeps_current_host', t => {
    const f = setup(t), current = draft(f.service.read());
    current.host.padding = 7;
    for (const version of [1, 2]) {
        const value = { schema_version: version, items: ['git'], use_colors: true, palette: 'default', directory_style: 'full', separator_style: 'classic', ...(version === 2 ? { scope_labels: 'always', subagents: { enabled: false, items: ['name'] } } : {}) };
        const path = join(f.root, 'legacy.json'), raw = jsonBytes(value);
        fs.writeFileSync(path, raw);
        const imported = importFile(path, current);
        assert.equal(imported.display.schema_version, 16);
        assert.deepEqual(imported.host, current.host);
        assert.deepEqual(fs.readFileSync(path), raw);
    }
});
test('tests.config.test_transfer.TransferTests.test_invalid_imports_are_rejected_without_configuration_writes', t => {
    const f = setup(t, false), current = { display: defaultDisplay(), host: clone(DEFAULT_HOST) }, path = join(f.root, 'bad.json');
    for (const raw of ['{"version":1,"version":1}', '{"format":"claude-code-statusline","version":true,"draft":{}}', '{"format":"claude-code-statusline","version":2,"draft":{}}', '{"x":NaN}', '{bad', '[]']) {
        fs.writeFileSync(path, raw);
        assert.equal(f.call('import', { draft: current, path }).status, 2);
        assert.equal(fs.existsSync(f.displayPath), false);
        assert.equal(fs.existsSync(join(f.root, 'statusline_runtime')), false);
    }
    fs.writeFileSync(path, Buffer.alloc(1048577, 32));
    assert.throws(() => importFile(path, current), ConfigError);
});
test('tests.ui.test_protocol.ProtocolTests.test_invalid_envelopes_and_json_do_not_create_paths', t => {
    const f = setup(t, false), absent = join(f.root, 'absent'), p = new ConfigurationProtocol(new ConfigurationService({ ...f.context, configDir: absent }, f.io));
    for (const raw of ['', '[]', '{', '{"x":1,"x":2}', '{"x":NaN}', '{"protocol_version":15,"operation":"unknown","payload":{}}', '{"protocol_version":true,"operation":"read","payload":{}}', '{"protocol_version":15,"operation":"read","payload":{},"extra":1}'])
        assert.equal(p.handle(raw).status, 2);
    assert.equal(fs.existsSync(absent), false);
});
test('tests.ui.test_protocol.ProtocolTests.test_describe_and_missing_observations_are_not_host_support', t => {
    const f = setup(t, false), absent = join(f.root, 'absent'), p = new ConfigurationProtocol(new ConfigurationService({ ...f.context, configDir: absent, hostVersion: () => null }, f.io));
    const result = p.dispatch({ protocol_version: 26, operation: 'describe', payload: {} }) as {
        catalog: unknown[];
        capabilities: Record<string, unknown>;
    };
    assert.equal(result.catalog.length, 84);
    assert.equal(result.capabilities.native_mod, 'unknown');
    assert.equal(result.capabilities.data_observation, 'not_observed');
    assert.equal(result.capabilities.native_mod_loaded, null);
    assert.equal(fs.existsSync(absent), false);
});
test('tests.ui.test_protocol.ProtocolTests.test_read_revision_ignores_unrelated_settings_and_json_formatting', t => {
    const f = setup(t), first = f.read(), settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.permissions.allow.push('Glob');
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings, null, 4));
    assert.equal(f.read().revision, first.revision);
    settings.statusLine.command = '"/a new path/claude-statusline" render';
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
    assert.notEqual(f.read().revision, first.revision);
});
