import test from 'node:test';
import { fresh, snapshot, assert, fs, join, doctor } from './install-support.js';
import { main } from '@fbincon/statusline-cli/main';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { configCommand, parseSlashArguments, executeConfig } from '@fbincon/statusline-cli/config/commands';
import { setLanguage, readPreferences } from '@fbincon/statusline-cli/config/preferences';
import { exportFile, importFile } from '@fbincon/statusline-cli/config/transfer';
import { wizardGroups, renderSkill } from '@fbincon/statusline-cli/integration/resources';
import { schemaDiagnostic } from '@fbincon/statusline-cli/integration/doctor';
import { parseAdministration } from '@fbincon/statusline-cli/integration/arguments';
import { claudeLaunch, commandFor, quoteArgument } from '@fbincon/statusline-platform/commands';
import { CONFIG_FILENAME, SCHEMA_VERSION, defaultDisplay } from '@fbincon/statusline-core/config/display';
import { LANGUAGES, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/registry';
import { renderMessage } from '@fbincon/statusline-core/i18n/messages';
import { conflicts } from '@fbincon/statusline-core/config/catalog';
const simple = { native: false, nativeTiming: false, liveMetrics: false };
test('skill templates preserve literal replacement syntax and placeholder-looking launch paths', () => {
    const launch = { executable: '/tmp/node $& $` $$', args: ["/tmp/entry $' __CLAUDE_STATUSLINE_LANGUAGES__.js"] };
    const bash = [launch.executable, ...launch.args].map(quoteArgument).join(' ');
    const powershell = '& ' + [launch.executable, ...launch.args].map(value => "'" + value.replaceAll("'", "''") + "'").join(' ');
    const rendered = renderSkill(launch).toString();
    const rules = rendered.split('\n---\n')[0]!.split('\n').filter(line => line.startsWith('  - "')).map(line => JSON.parse(line.slice(4)));
    assert.ok(rules.includes(`Bash(${bash} config *)`));
    if (process.platform === 'win32') assert.ok(rules.includes(`PowerShell(${powershell} config *)`));
    assert.ok(rendered.includes('Use only `' + (process.platform === 'win32' ? powershell : bash) + ' config ...`.'));
});
function service(f: ReturnType<typeof fresh>) { return new ConfigurationService({ configDir: f.root, launch: f.launch, hostVersion: () => f.context.version }, f.io); }
function legacy(version: number) {
    const d = defaultDisplay(), { instances: _instances, ...subagents } = d.subagents;
    return { schema_version: version, items: ['model'], use_colors: true, palette: 'default', directory_style: 'home', separator_style: 'classic', ...(version >= 2 ? { scope_labels: d.scope_labels, subagents: version === 2 ? { enabled: true, items: ['name'] } : { ...subagents, items: ['name'], item_options: {} } } : {}), ...(version >= 3 ? { formatting: d.formatting, item_options: {}, layout: d.layout } : {}), ...(version >= 4 ? { metrics: d.metrics } : {}) };
}
test('tests.config.test_catalog.CatalogTests.test_wizard_uses_generated_groups_and_constraints', t => { const f = fresh(t); f.install(simple); const value = f.read('skills/statusline-config/SKILL.md').toString(); assert.ok(value.includes(wizardGroups())); assert.equal(wizardGroups().includes('`spacer`'), false); assert.ok(value.includes('Do not collapse copies')); assert.equal(conflicts('subagent', ['status-elapsed', 'elapsed']), true); assert.equal(conflicts('subagent', ['status', 'elapsed']), false); });
test('tests.config.test_catalog.LanguageWizardContractTests.test_legacy_wizard_reads_interface_language_and_saves_output_language_atomically', t => { const f = fresh(t); f.install(simple); const value = f.read('skills/statusline-config/SKILL.md').toString(); for (const text of ['config language show --json', 'ui_language', 'Do not write anything if the user cancels', '--statusline-language ' + LANGUAGES.join('|')])
    assert.ok(value.includes(text)); for (const language of LANGUAGES)
    assert.ok(value.includes(`${language} (${LANGUAGE_NAMES[language]})`)); assert.equal(value.split(' config apply ').length, 2); });
test('tests.config.test_statusline_language.StatuslineLanguageConfigTests.test_cli_and_legacy_parser_share_language_option', async (t) => { const f = fresh(t); f.install(simple); const s = service(f); executeConfig(parseSlashArguments('set statusline-language zh-CN'), s, 'en'); assert.equal(s.read().display.statusline_language, 'zh-CN'); assert.equal(await main(['config', '--config-dir', f.root, 'set', 'statusline-language', 'ja'], { launch: f.launch, hostVersion: () => f.context.version, stdout: () => { } }), 0); assert.equal(s.read().display.statusline_language, 'ja'); assert.ok(renderSkill(f.launch).toString().includes('--statusline-language ' + LANGUAGES.join('|'))); });
test('tests.integration.test_cli.CliTests.test_administration_uses_the_invoked_console_entry_instead_of_another_path_install', async (t) => { const f = fresh(t); assert.equal(await main(['install', '--config-dir', f.root, '--no-native-editor', '--no-native-timing'], { launch: f.launch, hostVersion: () => null, stdout: () => { } }), 0); assert.equal(f.json('settings.json').statusLine.command, commandFor(f.launch, 'render')); assert.deepEqual(f.json('statusline_runtime/installation.json').launch, f.launch); });
test('tests.integration.test_cli.CliTests.test_help_lists_public_commands', async () => { let output = ''; assert.equal(await main(['--help'], { stdout: value => { output += value; } }), 0); for (const command of ['install', 'uninstall', 'doctor', 'configure', 'config', 'ui', 'runtime', 'render', 'render-subagents', 'hook', 'slash-hook'])
    assert.ok(output.includes(command)); });
test('tests.integration.test_cli.CliTests.test_install_experimental_flags_are_mutually_exclusive', () => { for (const name of ['experimental-slash-tui', 'native-editor', 'live-metrics', 'native-timing'])
    for (const pair of [[`--${name}`, `--no-${name}`], [`--no-${name}`, `--${name}`]])
        assert.throws(() => parseAdministration('install', pair)); assert.throws(() => parseAdministration('doctor', ['--force'])); assert.throws(() => parseAdministration('uninstall', ['--native-editor'])); });
test('tests.integration.test_installer.DisplaySchemaDoctorTests.test_current_schema_reports_its_actual_version_without_writes', t => { const f = fresh(t); f.put(CONFIG_FILENAME, defaultDisplay()); const before = snapshot(f.root), rows = doctor(f.context); assert.ok(rows.some(row => renderMessage(row.message) === `display config schema: v${SCHEMA_VERSION}`)); assert.deepEqual(snapshot(f.root), before); });
test('tests.integration.test_installer.DisplaySchemaDoctorTests.test_all_supported_legacy_schemas_report_current_migration_target', t => { for (const version of [1, 2, 3, 4]) {
    const f = fresh(t);
    f.put(CONFIG_FILENAME, legacy(version));
    const before = snapshot(f.root);
    assert.ok(doctor(f.context).some(row => row.level === 'WARN' && renderMessage(row.message).includes(`schema v${version} is valid and will migrate to v${SCHEMA_VERSION}`)));
    assert.deepEqual(snapshot(f.root), before);
} });
test('tests.integration.test_installer.DisplaySchemaDoctorTests.test_schema_messages_follow_a_changed_supported_version', () => { const future = SCHEMA_VERSION + 1; assert.equal(renderMessage(schemaDiagnostic(future, future).message), `display config schema: v${future}`); assert.ok(renderMessage(schemaDiagnostic(4, future).message).includes(`migrate to v${future}`)); assert.equal(schemaDiagnostic(4, future).level, 'WARN'); });
test('tests.integration.test_installer.DisplaySchemaDoctorTests.test_missing_display_uses_defaults_without_creating_files', t => { const f = fresh(t); assert.ok(doctor(f.context).some(row => renderMessage(row.message) === 'display config: built-in defaults')); assert.equal(fs.existsSync(f.root), false); });
test('tests.integration.test_installer.DisplaySchemaDoctorTests.test_invalid_and_newer_schemas_report_errors_without_writes', t => { for (const raw of ['{broken', '{"schema_version":0}', JSON.stringify({ schema_version: SCHEMA_VERSION + 1 })]) {
    const f = fresh(t);
    f.put(CONFIG_FILENAME, Buffer.from(raw));
    const before = snapshot(f.root), rows = doctor(f.context);
    assert.ok(rows.some(row => row.level === 'ERROR' && /(?:schema|JSON)/u.test(renderMessage(row.message))));
    assert.deepEqual(snapshot(f.root), before);
} });
test('tests.integration.test_language_cli.LanguageCliTests.test_every_output_language_survives_portable_roundtrip_without_ui_changes', t => { const f = fresh(t); f.install(simple); const s = service(f); setLanguage(f.root, 'zh-CN', f.io); for (const language of LANGUAGES) {
    configCommand(['set', 'statusline-language', language], s);
    const saved = s.read(), value = { display: saved.display, host: saved.host }, path = join(f.temporary, 'portable.json');
    exportFile(path, value, f.root, true);
    const imported = importFile(path, value);
    s.apply(imported);
    assert.equal(s.read().display.statusline_language, language);
    assert.equal(readPreferences(f.root, f.io).ui_language, 'zh-CN');
} });
test('tests.integration.test_language_cli.LanguageCliTests.test_help_and_parser_errors_are_localized_including_groups', async (t) => { const f = fresh(t); for (const language of LANGUAGES) {
    let output = '', error = '';
    const environment = { configDir: f.root, stdout: (value: string) => { output += value; }, stderr: (value: string) => { error += value; } };
    assert.equal(await main(['--language', language, 'install', '--help'], environment), 0);
    assert.ok(output.includes('--no-experimental-slash-tui'));
    assert.equal(await main(['--language', language, 'install', '--native-editor', '--no-native-editor'], environment), 2);
    assert.ok(error.includes('--native-editor'));
    if (language !== 'en')
        assert.equal(error.includes('not allowed with argument'), false);
} });
test('tests.integration.test_native_installer.NativeInstallerTests.test_windows_batch_host_is_invoked_through_node_without_cmd_interpolation', t => {
    const f = fresh(t), shim = f.put('npm/node_modules/.bin/claude.cmd', Buffer.from('shim')), script = f.put('npm/node_modules/@anthropic-ai/claude-code/cli.js', Buffer.from('script'));
    f.put('npm/node_modules/@anthropic-ai/claude-code/package.json', { bin: { claude: 'cli.js' } });
    const expected = { executable: fs.realpathSync.native(process.execPath), args: [fs.realpathSync.native(script)] };
    assert.deepEqual(claudeLaunch('claude', true, name => name === 'claude' ? shim : process.execPath), expected);
    const posixShim = f.put('npm/node_modules/.bin/claude', Buffer.from('#!/bin/sh\n'));
    assert.deepEqual(claudeLaunch('claude', true, name => name === 'claude' ? posixShim : name === posixShim + '.cmd' ? shim : process.execPath), expected);
});
test('tests.integration.test_native_installer.NativeInstallerTests.test_windows_npm_native_binary_is_resolved_from_package_bin_metadata', t => { const f = fresh(t), shim = f.put('npm/node_modules/.bin/claude.cmd', Buffer.from('shim')), binary = f.put('npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe', Buffer.from('MZ')); f.put('npm/node_modules/@anthropic-ai/claude-code/package.json', { bin: { claude: 'bin/claude.exe' } }); assert.deepEqual(claudeLaunch('claude', true, () => shim), { executable: fs.realpathSync.native(binary), args: [] }); f.put('npm/node_modules/@anthropic-ai/claude-code/package.json', { bin: { claude: '../outside.cmd' } }); assert.throws(() => claudeLaunch('claude', true, () => shim)); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_windows_stripped_console_name_resolves_its_adjacent_executable', t => { const f = fresh(t); f.install(simple); const argv = f.json('statusline_runtime/installation.json').launch; assert.equal(argv.executable, process.execPath); assert.deepEqual(argv.args, f.launch.args); assert.equal(f.json('settings.json').statusLine.command.includes('claude-statusline.exe'), false); });
