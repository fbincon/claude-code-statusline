import test from 'node:test';
import { fresh, snapshot, failWriteOnce, assert, fs, join, doctor } from './install-support.js';
import { commandFor, splitCommand, detectClaudeVersion, expandUser } from '@fbincon/statusline-platform/commands';
import { atomicWrite } from '@fbincon/statusline-platform/files';
import { owns } from '@fbincon/statusline-cli/integration/ownership';
import { loadFeature, writeFeature } from '@fbincon/statusline-cli/config/backend-preferences';
import { FEATURE_FILENAME, parseFeature } from '@fbincon/statusline-core/config/backend-preferences';
import { CONFIG_FILENAME, defaultDisplay, SCHEMA_VERSION } from '@fbincon/statusline-core/config/display';
import { renderMessage } from '@fbincon/statusline-core/i18n/messages';
import { renderSkill } from '@fbincon/statusline-cli/integration/resources';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { main } from '@fbincon/statusline-cli/main';
const skill = 'skills/statusline-config/SKILL.md', external = 'skills/statusline-configure/SKILL.md';
const simple = { native: false, nativeTiming: false, liveMetrics: false };
test('tests.integration.test_installer.InstallTests.test_empty_config_is_created_with_private_permissions_and_backup', t => {
    const f = fresh(t), result = f.install();
    assert.equal(result.failed, false);
    assert.ok(result.backupDir);
    assert.equal(fs.existsSync(join(result.backupDir!, 'settings.json.absent')), true);
    assert.equal(JSON.parse(fs.readFileSync(join(result.backupDir!, 'metadata.json'), 'utf8')).settings_path, join(f.root, 'settings.json'));
    assert.deepEqual(f.json('settings.json').statusLine, { type: 'command', command: commandFor(f.launch, 'render'), refreshInterval: 1 });
    for (const path of ['settings.json', skill, external])
        if (process.platform !== 'win32')
            assert.equal(fs.statSync(join(f.root, path)).mode & 0o777, 0o600);
});
test('tests.integration.test_installer.InstallTests.test_install_is_idempotent_and_does_not_duplicate_hooks', t => {
    const f = fresh(t);
    f.install();
    const before = snapshot(f.root);
    assert.equal(f.install().changed, false);
    assert.deepEqual(snapshot(f.root), before);
    for (const event of ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd', 'SubagentStart', 'SubagentStop'])
        assert.equal(f.json('settings.json').hooks[event].length, 1);
});
test('tests.integration.test_installer.InstallTests.test_legacy_configuration_is_replaced_and_unrelated_values_survive', t => {
    const f = fresh(t);
    f.put('settings.json', { theme: 'dark', env: { KEEP: 'value' }, statusLine: { command: `"python3" "${join(f.root, 'statusline.py')}"` }, hooks: { SessionStart: [{ matcher: 'x', hooks: [{ command: `"python3" "${join(f.root, 'turn_state.py')}"` }, { command: 'other' }] }], PostToolUse: [{ hooks: [{ command: 'keep' }] }] } });
    f.install(simple);
    const value = f.json('settings.json');
    assert.equal(value.theme, 'dark');
    assert.equal(value.env.KEEP, 'value');
    assert.equal(value.hooks.SessionStart[0].hooks[0].command, 'other');
    assert.equal(value.hooks.SessionStart.length, 2);
    assert.equal(value.hooks.PostToolUse[0].hooks[0].command, 'keep');
    assert.deepEqual(splitCommand(value.statusLine.command), [f.launch.executable, ...f.launch.args, 'render']);
});
test('tests.integration.test_installer.InstallTests.test_unrelated_statusline_is_refused_without_force', t => { const f = fresh(t); f.put('settings.json', { statusLine: { command: 'other' } }); const before = snapshot(f.root); assert.throws(() => f.install()); assert.deepEqual(snapshot(f.root), before); assert.equal(fs.existsSync(join(f.root, 'backups')), false); });
test('tests.integration.test_installer.InstallTests.test_force_replaces_unrelated_statusline', t => { const f = fresh(t); f.put('settings.json', { statusLine: { command: 'other' }, theme: 'keep' }); const result = f.install({ ...simple, force: true }); assert.equal(f.json('settings.json').theme, 'keep'); assert.equal(JSON.parse(fs.readFileSync(join(result.backupDir!, 'settings.json.before'), 'utf8')).statusLine.command, 'other'); });
test('tests.integration.test_installer.InstallTests.test_invalid_json_is_rejected_without_rewrite', t => { const f = fresh(t); f.put('settings.json', Buffer.from('{broken')); const before = snapshot(f.root); assert.throws(() => f.install()); assert.deepEqual(snapshot(f.root), before); });
test('tests.integration.test_installer.InstallTests.test_dry_run_reports_change_without_creating_files', t => { const f = fresh(t); assert.equal(f.install({ dryRun: true }).changed, true); assert.equal(fs.existsSync(f.root), false); assert.equal(f.host.calls.length, 0); });
test('tests.integration.test_installer.InstallTests.test_install_rejects_invalid_display_before_any_mutation', t => { for (const raw of ['{broken', '{"schema_version":999}', JSON.stringify({ ...defaultDisplay(), palette: 'bad' })]) {
    const f = fresh(t);
    f.put(CONFIG_FILENAME, Buffer.from(raw));
    const before = snapshot(f.root);
    for (const force of [false, true])
        for (const dryRun of [false, true])
            assert.throws(() => f.install({ force, dryRun }));
    assert.deepEqual(snapshot(f.root), before);
    assert.equal(f.host.calls.length, 0);
} });
test('tests.integration.test_installer.InstallTests.test_existing_owned_host_options_survive_reinstall', t => { const f = fresh(t); f.put('settings.json', { statusLine: { type: 'command', command: 'claude-statusline render', padding: 4, hideVimModeIndicator: true } }); f.install(simple); const line = f.json('settings.json').statusLine; assert.equal(line.padding, 4); assert.equal(line.hideVimModeIndicator, true); assert.equal(Object.hasOwn(line, 'refreshInterval'), false); });
test('tests.integration.test_installer.InstallTests.test_old_claude_installs_skill_without_fast_hook', t => { const f = fresh(t, [2, 1, 200]); f.install(); assert.ok(f.read(skill)); assert.equal(f.json('settings.json').hooks.UserPromptExpansion, undefined); assert.equal(fs.existsSync(join(f.root, external)), false); assert.equal(f.host.calls.length, 0); });
test('tests.integration.test_installer.InstallTests.test_unrelated_skill_is_refused_unless_force_backs_it_up', t => { const f = fresh(t); f.put(skill, Buffer.from('foreign')); assert.throws(() => f.install()); const result = f.install({ ...simple, force: true }); assert.equal(fs.readFileSync(join(result.backupDir!, skill + '.before'), 'utf8'), 'foreign'); assert.notEqual(f.read(skill).toString(), 'foreign'); });
test('tests.integration.test_installer.InstallTests.test_atomic_write_removes_temp_files_and_fixes_mode', t => { const f = fresh(t); const path = f.put('atomic', Buffer.from('before')); fs.chmodSync(path, 0o644); atomicWrite(path, 'after'); assert.equal(f.read('atomic').toString(), 'after'); assert.deepEqual(fs.readdirSync(f.root), ['atomic']); if (process.platform !== 'win32')
    assert.equal(fs.statSync(path).mode & 0o777, 0o600); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_default_stable_install_enables_external_entry_without_preference_file', t => { const f = fresh(t); f.install(); assert.ok(f.read(external)); assert.equal(fs.existsSync(join(f.root, FEATURE_FILENAME)), false); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_enable_creates_feature_skill_owner_and_600_second_hook', t => { const f = fresh(t); f.install({ ...simple, external: true }); assert.equal(f.json(FEATURE_FILENAME).experimental_slash_tui, true); const group = f.json('settings.json').hooks.UserPromptExpansion.find((row: any) => row.matcher === 'statusline-configure'); assert.equal(group.hooks[0].timeout, 600); assert.equal(f.json('skills/statusline-configure/.claude-statusline-owner.json').owner, 'claude-code-statusline'); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_explicit_enable_dry_run_creates_nothing', t => { const f = fresh(t); f.install({ external: true, dryRun: true }); assert.equal(fs.existsSync(f.root), false); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_reinstall_preserves_enabled_preference_and_is_idempotent', t => { const f = fresh(t); f.install({ ...simple, external: true }); const before = f.read(FEATURE_FILENAME); assert.equal(f.install().changed, false); assert.deepEqual(f.read(FEATURE_FILENAME), before); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_explicit_enable_suspends_old_or_unknown_version_and_keeps_preference', t => { for (const version of [null, [2, 1, 257]]) {
    const f = fresh(t, version);
    f.install({ external: true });
    assert.equal(loadFeature(f.root), true);
    assert.equal(fs.existsSync(join(f.root, external)), false);
    assert.equal(f.host.calls.length, 0);
} });
test('tests.integration.test_installer.ExperimentalInstallTests.test_enabled_preference_suspends_on_downgrade_and_restores_on_upgrade', t => { const f = fresh(t); f.install({ ...simple, external: true }); f.context.version = [2, 1, 257]; f.install(); assert.equal(fs.existsSync(join(f.root, external)), false); assert.equal(loadFeature(f.root), true); f.context.version = [2, 1, 288]; f.install(); assert.ok(f.read(external)); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_explicit_disable_persists_false_and_removes_only_owned_active_artifacts', t => { const f = fresh(t); f.install({ ...simple, external: true }); f.put('skills/statusline-configure/user-note', Buffer.from('keep')); f.install({ external: false }); assert.equal(loadFeature(f.root), false); assert.equal(fs.existsSync(join(f.root, external)), false); assert.equal(f.read('skills/statusline-configure/user-note').toString(), 'keep'); assert.ok(f.read(skill)); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_corrupt_preference_requires_explicit_repair_or_disablement', t => { const f = fresh(t); f.put(FEATURE_FILENAME, Buffer.from('{broken')); const before = snapshot(f.root); assert.throws(() => f.install()); assert.deepEqual(snapshot(f.root), before); f.install({ ...simple, external: false }); assert.equal(loadFeature(f.root), false); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_plain_reinstall_repairs_feature_permissions', t => { const f = fresh(t); f.install({ ...simple, external: true }); fs.chmodSync(join(f.root, FEATURE_FILENAME), 0o644); f.install(); if (process.platform !== 'win32')
    assert.equal(fs.statSync(join(f.root, FEATURE_FILENAME)).mode & 0o777, 0o600); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_unrelated_experimental_skill_ownership_rules_and_force', t => { const f = fresh(t); f.put(external, Buffer.from('foreign')); assert.throws(() => f.install()); f.install({ ...simple, external: false }); assert.equal(f.read(external).toString(), 'foreign'); const result = f.install({ external: true, force: true }); assert.equal(fs.readFileSync(join(result.backupDir!, external + '.before'), 'utf8'), 'foreign'); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_skill_write_failure_rolls_back_settings_and_skill', t => { const f = fresh(t); f.put('settings.json', { env: { KEEP: 'yes' } }); const before = snapshot(f.root); failWriteOnce(f, external); assert.throws(() => f.install({ ...simple, external: true })); assert.deepEqual(snapshot(f.root), before); });
test('tests.integration.test_installer.ExperimentalInstallTests.test_disable_write_failure_rolls_back_every_changed_artifact', t => { const f = fresh(t); f.install({ ...simple, external: true }); const before = snapshot(f.root); failWriteOnce(f, FEATURE_FILENAME); assert.throws(() => f.install({ external: false })); assert.deepEqual(snapshot(f.root), before); });
test('tests.integration.test_installer.UninstallTests.test_uninstall_removes_only_owned_entries_and_preserves_state', t => { const f = fresh(t); f.install(simple); f.put(CONFIG_FILENAME, defaultDisplay()); f.put('statusline_runtime/task.json', { keep: true }); f.host.set('env', { KEEP: 'yes' }); f.uninstall(); assert.equal(f.json('settings.json').statusLine, undefined); assert.equal(f.json('settings.json').hooks, undefined); assert.equal(f.json('settings.json').env.KEEP, 'yes'); assert.ok(f.read(CONFIG_FILENAME)); assert.ok(f.read('statusline_runtime/task.json')); });
test('tests.integration.test_installer.UninstallTests.test_uninstall_does_not_remove_unrelated_statusline', t => { const f = fresh(t); f.put('settings.json', { statusLine: { command: 'foreign' }, hooks: { Stop: [{ hooks: [{ command: 'other' }] }] } }); f.uninstall(); assert.equal(f.json('settings.json').statusLine.command, 'foreign'); assert.equal(f.json('settings.json').hooks.Stop[0].hooks[0].command, 'other'); });
test('tests.integration.test_installer.UninstallTests.test_uninstall_removes_experimental_artifacts_but_keeps_preference', t => { const f = fresh(t); f.install({ ...simple, external: true }); const raw = f.read(FEATURE_FILENAME); f.uninstall(); assert.equal(fs.existsSync(join(f.root, external)), false); assert.deepEqual(f.read(FEATURE_FILENAME), raw); });
test('tests.integration.test_installer.UninstallTests.test_uninstall_still_preserves_unreadable_display_for_recovery', t => { const f = fresh(t); f.install(simple); f.put(CONFIG_FILENAME, Buffer.from('{future')); f.uninstall(); assert.equal(f.read(CONFIG_FILENAME).toString(), '{future'); });
test('tests.integration.test_installer.SubagentInstallTests.test_supported_default_installs_exact_setting_and_hooks', t => { const f = fresh(t, [2, 1, 205]); f.install(simple); assert.deepEqual(f.json('settings.json').subagentStatusLine, { type: 'command', command: commandFor(f.launch, 'render-subagents') }); for (const event of ['SubagentStart', 'SubagentStop'])
    assert.equal(f.json('settings.json').hooks[event].length, 1); });
test('tests.integration.test_installer.SubagentInstallTests.test_old_or_unknown_versions_suspend_and_upgrade_restores', t => { const f = fresh(t); f.install(simple); f.context.version = null; f.install(); assert.equal(f.json('settings.json').subagentStatusLine, undefined); assert.equal(f.json('settings.json').hooks.SubagentStart, undefined); f.context.version = [2, 1, 205]; f.install(); assert.ok(f.json('settings.json').subagentStatusLine); });
test('tests.integration.test_installer.SubagentInstallTests.test_foreign_conflict_fails_before_backup_and_force_takes_ownership', t => { const f = fresh(t); f.put('settings.json', { subagentStatusLine: { command: 'foreign' } }); assert.throws(() => f.install()); assert.equal(fs.existsSync(join(f.root, 'backups')), false); const result = f.install({ ...simple, force: true }); assert.equal(JSON.parse(fs.readFileSync(join(result.backupDir!, 'settings.json.before'), 'utf8')).subagentStatusLine.command, 'foreign'); });
test('tests.integration.test_installer.SubagentInstallTests.test_disabled_rows_keep_foreign_setting_but_install_lifecycle_hooks', t => { const f = fresh(t), display = defaultDisplay(); display.subagents.enabled = false; f.put(CONFIG_FILENAME, display); f.put('settings.json', { subagentStatusLine: { command: 'foreign' } }); f.install(simple); assert.equal(f.json('settings.json').subagentStatusLine.command, 'foreign'); assert.equal(f.json('settings.json').hooks.SubagentStart.length, 1); });
test('tests.integration.test_installer.SubagentInstallTests.test_uninstall_removes_owned_but_preserves_foreign', t => { const f = fresh(t); f.install(simple); f.host.set('subagentStatusLine', { command: 'foreign' }); f.uninstall(); assert.equal(f.json('settings.json').subagentStatusLine.command, 'foreign'); assert.equal(f.json('settings.json').statusLine, undefined); });
test('tests.integration.test_installer.SubagentInstallTests.test_dry_run_is_read_only_and_install_backs_up_the_v1_display_migration', t => { const f = fresh(t); const path = f.put(CONFIG_FILENAME, { schema_version: 1, items: ['model'], use_colors: true, palette: 'default', directory_style: 'home', separator_style: 'classic' }); const before = fs.readFileSync(path); f.install({ dryRun: true }); assert.deepEqual(fs.readFileSync(path), before); const result = f.install(simple); assert.equal(f.json(CONFIG_FILENAME).schema_version, SCHEMA_VERSION); assert.deepEqual(fs.readFileSync(join(result.backupDir!, CONFIG_FILENAME + '.before')), before); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_config_dir_precedence', async (t) => { const f = fresh(t); let out = ''; assert.equal(await main(['install', '--dry-run', '--config-dir', f.root], { configDir: join(f.temporary, 'wrong'), launch: f.launch, hostVersion: () => null, stdout: value => { out += value; } }), 0); assert.ok(out.includes(f.root)); assert.equal(fs.existsSync(f.root), false); assert.ok(expandUser('~/x').endsWith('/x') || expandUser('~/x').endsWith('\\x')); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_cross_platform_command_formats_and_ownership', t => { const f = fresh(t), launch = { executable: '/path/中文 $` &/node', args: ['/entry 中文 $` &.js'] }; const command = commandFor(launch, 'render'); assert.equal(splitCommand(command)!.length, 3); assert.equal(owns(command, 'render', launch), true); assert.equal(owns(command + ' extra', 'render', launch), false); assert.equal(owns('"/old/pipx/claude-statusline" render', 'render', f.launch), true); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_doctor_accepts_one_complete_configuration', t => { const f = fresh(t); f.install(); const before = snapshot(f.root), rows = doctor(f.context); assert.deepEqual(rows.filter(row => row.level === 'ERROR'), []); assert.ok(rows.some(row => renderMessage(row.message).includes('unverified'))); assert.deepEqual(snapshot(f.root), before); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_doctor_reports_invalid_display_config_and_missing_skill', t => { const f = fresh(t); f.install(simple); f.put(CONFIG_FILENAME, Buffer.from('{bad')); fs.unlinkSync(join(f.root, skill)); assert.ok(doctor(f.context).filter(row => row.level === 'ERROR').length >= 2); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_doctor_rejects_non_private_or_corrupt_feature_file', t => { const f = fresh(t); f.install({ ...simple, external: true }); fs.chmodSync(join(f.root, FEATURE_FILENAME), 0o644); if (process.platform !== 'win32')
    assert.ok(doctor(f.context).some(row => row.level === 'ERROR')); f.put(FEATURE_FILENAME, Buffer.from('{bad')); assert.ok(doctor(f.context).some(row => row.level === 'ERROR')); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_doctor_reports_enabled_disabled_suspended_and_broken_states', t => { const f = fresh(t); f.install({ ...simple, external: true }); assert.ok(doctor(f.context).some(row => renderMessage(row.message).includes('600s'))); f.install({ external: false }); assert.ok(doctor(f.context).some(row => renderMessage(row.message).includes('/statusline-configure: disabled'))); f.context.version = null; f.install({ external: true }); assert.ok(doctor(f.context).some(row => renderMessage(row.message).includes('suspended'))); f.context.version = [2, 1, 288]; assert.ok(doctor(f.context).some(row => row.level === 'ERROR')); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_rendered_skill_has_no_placeholders_and_lists_every_item', t => { const f = fresh(t), value = renderSkill(f.launch).toString(); assert.equal(value.includes('__CLAUDE_STATUSLINE_'), false); for (const item of ITEMS.filter(row => !['text', 'spacer'].includes(row.id)))
    assert.ok(value.includes('`' + item.id + '`')); assert.ok(value.includes('config apply --items')); });
test('tests.integration.test_installer.ResolutionAndDoctorTests.test_version_detection_parses_claude_output', () => { const version = detectClaudeVersion(); assert.ok(version === null || version.length === 3 && version.every(Number.isSafeInteger)); });
test('tests.config.test_feature_config.FeatureConfigTests.test_missing_file_follows_release_default_without_writes', t => { const f = fresh(t); assert.equal(loadFeature(f.root, '2.0.0'), true); assert.equal(loadFeature(f.root, '2.0.0a1'), false); assert.equal(fs.existsSync(f.root), false); });
test('tests.config.test_feature_config.FeatureConfigTests.test_explicit_false_boolean_is_valid_and_disabled', t => { const f = fresh(t); f.put(FEATURE_FILENAME, { schema_version: 1, experimental_slash_tui: false }); assert.equal(loadFeature(f.root), false); });
test('tests.config.test_feature_config.FeatureConfigTests.test_enabled_round_trip_is_canonical_private_and_atomic', t => { const f = fresh(t); writeFeature(f.root, true); assert.equal(loadFeature(f.root), true); assert.deepEqual(f.json(FEATURE_FILENAME), { schema_version: 1, experimental_slash_tui: true }); if (process.platform !== 'win32')
    assert.equal(fs.statSync(join(f.root, FEATURE_FILENAME)).mode & 0o777, 0o600); assert.deepEqual(fs.readdirSync(f.root), [FEATURE_FILENAME]); });
test('tests.config.test_feature_config.FeatureConfigTests.test_atomic_replace_failure_preserves_original', t => { const f = fresh(t); writeFeature(f.root, false); const before = f.read(FEATURE_FILENAME); assert.throws(() => atomicWrite(join(f.root, FEATURE_FILENAME), 'bad', stage => { if (stage === 'before-replace')
    throw new Error('injected'); })); assert.deepEqual(f.read(FEATURE_FILENAME), before); assert.deepEqual(fs.readdirSync(f.root), [FEATURE_FILENAME]); });
test('tests.config.test_feature_config.FeatureConfigTests.test_strict_schema_rejects_unknown_missing_duplicate_and_types', () => { for (const raw of ['[]', '{}', '{"schema_version":true,"experimental_slash_tui":true}', '{"schema_version":1,"experimental_slash_tui":1}', '{"schema_version":1,"experimental_slash_tui":true,"experimental_slash_tui":false}', '{"schema_version":1,"experimental_slash_tui":true,"extra":0}'])
    assert.throws(() => parseFeature(raw)); });
