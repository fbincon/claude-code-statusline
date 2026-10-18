import test from 'node:test';
import { fresh, snapshot, failWriteOnce, assert, fs, join, NATIVE, RUNTIME, doctor } from './install-support.js';
import { owner } from '@fbincon/statusline-cli/integration/mod-ownership';
import { digest, bundledFiles } from '@fbincon/statusline-cli/integration/resources';
import { loadNative, loadRuntime } from '@fbincon/statusline-cli/config/backend-preferences';
import { parseNative, enabledByDefault } from '@fbincon/statusline-core/config/backend-preferences';
import { PluginHost, UnconfirmedOperation } from '@fbincon/statusline-platform/plugin-host';
import { binding } from '@fbincon/statusline-core/integration/binding';
import { renderMessage } from '@fbincon/statusline-core/i18n/messages';
const markerPath = NATIVE.name + '/.claude-statusline-owner.json', external = 'skills/statusline-configure/SKILL.md';
function oldResources(f: ReturnType<typeof fresh>, extra = false) {
    const marker = f.json(markerPath), name = extra ? 'lib/obsolete/deep/old.ts' : 'hooks/register.ts';
    const raw = Buffer.from('// historical owned runtime\n');
    f.put(NATIVE.name + '/plugins/' + NATIVE.name + '/' + name, raw);
    const cache = f.host.plugins[0]!.installPath as string;
    fs.mkdirSync(join(cache, name, '..'), { recursive: true });
    fs.writeFileSync(join(cache, name), raw);
    marker.files['plugins/' + NATIVE.name + '/' + name] = digest(raw);
    f.put(markerPath, marker);
}
test('tests.integration.test_native_installer.NativeInstallerTests.test_both_entries_coexist_and_repeat_is_idempotent', t => { const f = fresh(t); f.install({ native: true, external: true }); assert.ok(f.read(external)); assert.equal(f.host.inputs.backendExecutable, f.launch.executable); assert.deepEqual(binding(f.host.inputs).args, f.launch.args); assert.equal(f.install().changed, false); assert.equal(f.host.calls.filter(call => call.args[0] === 'install').length, 1); assert.deepEqual(doctor(f.context).filter(row => row.level === 'ERROR'), []); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_four_install_combinations_and_independent_disablement', t => { for (const externalFlag of [true, false])
    for (const native of [true, false]) {
        const f = fresh(t);
        assert.equal(f.install({ external: externalFlag, native }).failed, false);
        assert.equal(fs.existsSync(join(f.root, external)), externalFlag);
        assert.equal(!!f.host.plugins.length, native);
        assert.equal(f.install().changed, false);
        f.install({ external: false });
        assert.equal(!!f.host.plugins.length, native);
        f.install({ external: true, native: false });
        assert.ok(f.read(external));
        assert.equal(f.host.plugins.length, 0);
    } });
test('tests.integration.test_native_installer.NativeInstallerTests.test_default_and_explicit_enable_follow_each_host_threshold', t => { for (const version of [null, [2, 1, 257], [2, 1, 258], [2, 1, 286], [2, 1, 287], [2, 1, 288]])
    for (const explicit of [false, true]) {
        const f = fresh(t, version), options = explicit ? { native: true, external: true } : {};
        f.install({ ...options, dryRun: true });
        assert.equal(fs.existsSync(f.root), false);
        const result = f.install(options);
        assert.equal(result.failed, false);
        assert.equal(result.nativeState, version && version[2]! >= 287 ? 'installed' : 'suspended');
        assert.equal(fs.existsSync(join(f.root, external)), !!version && version[2]! >= 258);
        assert.equal(f.install().changed, false);
    } });
test('tests.integration.test_native_installer.NativeInstallerTests.test_downgrade_and_unknown_host_suspend_without_new_host_apis', t => { const f = fresh(t); f.install(); const count = f.host.calls.length; f.host.set('unrelated', { keep: true }); for (const version of [[2, 1, 286], [2, 1, 258], [2, 1, 257], null]) {
    f.context.version = version;
    assert.equal(f.install().nativeState, 'suspended');
    assert.equal(f.host.calls.length, count);
    assert.equal(f.json(markerPath).suspended, true);
    assert.equal(f.json('settings.json').enabledPlugins[NATIVE.plugin], false);
    assert.deepEqual(f.json('settings.json').unrelated, { keep: true });
    assert.equal(f.install().changed, false);
} });
test('tests.integration.test_native_installer.NativeInstallerTests.test_downgrade_suspends_then_upgrade_restores_tool_suspension', t => { const f = fresh(t); f.install(); f.context.version = [2, 1, 258]; f.install(); assert.equal(f.json(markerPath).suspended, true); f.context.version = [2, 1, 288]; assert.equal(f.install().nativeState, 'installed'); assert.equal(f.json(markerPath).suspended, false); assert.equal(f.host.listing()[1][0]!.enabled, true); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_host_disable_survives_downgrade_and_upgrade', t => { const f = fresh(t); f.install(); f.host.enabled(false); f.context.version = null; f.install(); assert.equal(f.json(markerPath).suspended, false); f.context.version = [2, 1, 288]; assert.equal(f.install().nativeState, 'plugin-disabled'); assert.equal(f.host.listing()[1][0]!.enabled, false); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_explicit_plugin_disable_is_preserved_and_native_disable_restores_legacy', t => { const f = fresh(t); f.install(); f.host.enabled(false); assert.equal(f.install().nativeState, 'plugin-disabled'); assert.ok(f.read(external)); assert.equal(f.host.calls.some(call => call.args[0] === 'enable'), false); f.install({ native: false }); assert.equal(f.host.plugins.length, 0); assert.equal(fs.existsSync(join(f.root, NATIVE.name)), false); assert.equal(loadNative(f.root), false); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_dry_run_calls_no_official_commands_and_creates_no_files', t => { const f = fresh(t); f.install({ native: true, dryRun: true }); assert.equal(f.host.calls.length, 0); assert.equal(fs.existsSync(f.root), false); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_external_false_does_not_disable_stable_native_default', t => { const f = fresh(t); f.put('claude-statusline-features.json', { schema_version: 1, experimental_slash_tui: false }); assert.equal(f.install().nativeState, 'installed'); assert.equal(fs.existsSync(join(f.root, external)), false); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_external_command_collision_is_checked_only_when_external_is_enabled', t => { const f = fresh(t); f.put('commands/statusline-configure.md', Buffer.from('foreign')); assert.throws(() => f.install({ force: true })); assert.equal(f.install({ external: false }).failed, false); assert.equal(f.read('commands/statusline-configure.md').toString(), 'foreign'); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_foreign_command_is_refused_before_writes_even_with_force', t => { const f = fresh(t); f.put('skills/statusline-configure-native/SKILL.md', Buffer.from('foreign')); const before = snapshot(f.root); assert.throws(() => f.install({ force: true })); assert.deepEqual(snapshot(f.root), before); assert.equal(f.host.calls.length, 0); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_foreign_external_skill_does_not_block_native_only_install', t => { const f = fresh(t); f.put(external, Buffer.from('foreign')); assert.equal(f.install({ external: false }).failed, false); assert.equal(f.read(external).toString(), 'foreign'); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_foreign_marketplace_and_unowned_directory_are_not_adopted', t => { const f = fresh(t); f.host.markets = [{ name: NATIVE.marketplace, source: 'directory', path: '/foreign' }]; assert.equal(f.install().failed, true); assert.equal(fs.existsSync(join(f.root, NATIVE.name)), false); f.host.markets = []; f.put(NATIVE.name + '/note', Buffer.from('keep')); assert.equal(f.install().failed, true); assert.equal(f.read(NATIVE.name + '/note').toString(), 'keep'); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_failure_keeps_compatibility_and_retry_reads_the_actual_inventory', t => { const f = fresh(t); f.host.refused = 'install'; assert.equal(f.install({ native: true }).failed, true); assert.ok(f.read(external)); assert.equal(loadNative(f.root), true); f.host.refused = null; assert.equal(f.install().nativeState, 'installed'); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_cached_and_source_foreign_edits_block_update_and_uninstall', t => { for (const cache of [false, true]) {
    const f = fresh(t);
    f.install();
    const path = cache ? join(f.host.plugins[0]!.installPath as string, 'hooks/register.ts') : join(f.root, NATIVE.name, 'plugins', NATIVE.name, 'hooks/register.ts');
    fs.appendFileSync(path, '\n// foreign edit');
    const raw = fs.readFileSync(path);
    assert.equal(f.install().failed, true);
    assert.equal(f.uninstall().failed, true);
    assert.deepEqual(fs.readFileSync(path), raw);
} });
test('tests.integration.test_native_installer.NativeInstallerTests.test_same_version_resource_upgrade_uses_verified_official_reinstall', t => { const f = fresh(t); f.install(); oldResources(f); const before = f.host.calls.length; assert.equal(f.install().failed, false); const calls = f.host.calls.slice(before).map(call => call.args[0]); assert.ok(calls.includes('uninstall')); assert.ok(calls.includes('install')); assert.ok(!calls.includes('update')); assert.equal(f.json(markerPath).cache_inventories.length, 1); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_user_disabled_upgrade_refreshes_resources_and_binding', t => { const f = fresh(t); f.install(); oldResources(f); f.host.enabled(false); f.host.inputs.backendExecutable = 'old'; assert.equal(f.install().nativeState, 'plugin-disabled'); assert.equal(f.host.inputs.backendExecutable, f.launch.executable); assert.equal(f.host.listing()[1][0]!.enabled, false); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_upgrade_prunes_old_empty_directories_and_disable_reenable_works', t => { const f = fresh(t); f.install(); oldResources(f, true); assert.equal(f.install().failed, false); assert.equal(fs.existsSync(join(f.root, NATIVE.name, 'plugins', NATIVE.name, 'lib/obsolete')), false); assert.equal(f.install({ native: false }).failed, false); assert.equal(f.install({ native: true }).nativeState, 'installed'); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_historical_directory_cleanup_preserves_unknown_files', t => { const f = fresh(t); f.install(); oldResources(f, true); f.put(NATIVE.name + '/plugins/' + NATIVE.name + '/lib/obsolete/note', Buffer.from('keep')); f.install(); f.install({ native: false }); assert.equal(f.read(NATIVE.name + '/plugins/' + NATIVE.name + '/lib/obsolete/note').toString(), 'keep'); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_missing_owned_file_is_repaired_and_uninstall_retains_preferences', t => { const f = fresh(t); f.install({ native: true }); fs.unlinkSync(join(f.root, NATIVE.name, 'plugins', NATIVE.name, 'hooks/register.ts')); assert.equal(f.install().failed, false); assert.ok(f.read(NATIVE.name + '/plugins/' + NATIVE.name + '/hooks/register.ts')); f.uninstall(); assert.equal(loadNative(f.root), true); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_nested_runtime_modules_reach_staging_and_official_cache', t => { const f = fresh(t); f.install(); const bundle = bundledFiles(NATIVE); for (const path of ['lib/editor/draft.ts', 'lib/editor/forms.ts', 'ui/client/surface.ts', 'ui/components/section.ts']) {
    assert.deepEqual(f.read(NATIVE.name + '/plugins/' + NATIVE.name + '/' + path), bundle.files.get(path));
    assert.deepEqual(fs.readFileSync(join(f.host.plugins[0]!.installPath as string, path)), bundle.files.get(path));
} });
test('tests.integration.test_native_installer.NativeInstallerTests.test_reinstall_restores_external_resources_removed_by_old_native_migration', t => { const f = fresh(t); f.install(); fs.unlinkSync(join(f.root, external)); fs.unlinkSync(join(f.root, 'skills/statusline-configure/.claude-statusline-owner.json')); f.host.inputs.primaryCommand = 'true'; f.host.set('hooks', {}); f.install(); assert.ok(f.read(external)); assert.equal(f.install().changed, false); assert.deepEqual(doctor(f.context).filter(row => row.level === 'ERROR'), []); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_invalid_owner_protocol_is_not_used_to_remove_resources', t => { const f = fresh(t); f.install(); const marker = f.json(markerPath); marker.protocol_version = true; f.put(markerPath, marker); assert.equal(f.uninstall().failed, true); assert.ok(f.read(NATIVE.name + '/plugins/' + NATIVE.name + '/hooks/register.ts')); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_version_suspension_rolls_back_settings_if_owner_write_fails', t => { const f = fresh(t); f.install(); const before = f.read('settings.json'), marker = f.read(markerPath); f.context.version = [2, 1, 286]; failWriteOnce(f, markerPath); assert.equal(f.install().failed, true); assert.deepEqual(f.read('settings.json'), before); assert.deepEqual(f.read(markerPath), marker); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_restricted_and_unsupported_fresh_hosts_preserve_preference', t => { const f = fresh(t, [2, 1, 200]); assert.equal(f.install({ native: true }).nativeState, 'suspended'); f.host.set('disableAllHooks', true); f.context.version = [2, 1, 288]; assert.equal(f.install().nativeState, 'suspended'); assert.equal(loadNative(f.root), true); assert.equal(f.host.calls.length, 0); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_old_host_disable_and_uninstall_use_supported_cli_options', t => { const f = fresh(t); f.install(); const before = f.host.calls.length; f.context.version = [2, 1, 258]; assert.equal(f.uninstall().failed, false); for (const call of f.host.calls.slice(before))
    assert.equal(call.args.includes('--json'), false); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_preference_is_strict_and_preview_stable_defaults_preserve_false', t => { const f = fresh(t); assert.equal(loadNative(f.root, undefined, '2.0.0a1'), false); assert.equal(loadNative(f.root), true); f.put('claude-statusline-native.json', { schema_version: 1, native_editor: false }); assert.equal(loadNative(f.root), false); for (const raw of ['[]', '{"schema_version":true,"native_editor":true}', '{"schema_version":1,"native_editor":1}', '{"schema_version":1,"native_editor":true,"native_editor":false}'])
    assert.throws(() => parseNative(raw)); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_release_default_activates_native_only_for_stable_versions', t => { const f = fresh(t); assert.equal(enabledByDefault('2.0.0'), true); assert.equal(enabledByDefault('2.0.0rc1'), false); assert.equal(f.install().nativeState, 'installed'); assert.equal(fs.existsSync(join(f.root, 'claude-statusline-native.json')), false); });
test('tests.integration.test_native_installer.NativeInstallerTests.test_host_transport_uses_argv_and_does_not_retry_an_uncertain_write', t => { const f = fresh(t); let calls = 0; const execute: any = (program: string, args: string[], options: any) => { calls++; assert.equal(program, '/host with spaces/node'); assert.deepEqual(args, ['/host.js', 'plugin', 'configure', NATIVE.plugin, '--values-stdin']); assert.equal(options.shell, false); assert.equal(options.timeout, 45000); assert.deepEqual(JSON.parse(options.input), { configDir: f.root }); return { error: new Error('timed out'), status: null }; }; const host = new PluginHost(f.root, { executable: '/host with spaces/node', args: ['/host.js'] }, execute); assert.throws(() => host.run(['configure', NATIVE.plugin, '--values-stdin'], { configDir: f.root }), UnconfirmedOperation); assert.equal(calls, 1); });
test('tests.integration.test_runtime_installer.RuntimeInstallerTests.test_opt_in_is_independent_and_reinstall_retains_preference', t => { const f = fresh(t, [2, 1, 296]); f.install({ native: false }); assert.equal(loadRuntime(f.root).live_metrics, false); assert.equal(f.runtime.plugins.length, 0); assert.equal(f.runtime.calls.length, 0); assert.equal(loadRuntime(f.root).native_timing, false); f.install({ liveMetrics: true }); assert.equal(owner(f.root, RUNTIME, f.io)!.protocol_version, 2); assert.equal(f.install().changed, false); f.install({ liveMetrics: false }); assert.equal(f.runtime.plugins.length, 0); assert.equal(loadRuntime(f.root).native_timing, false); });
test('saved runtime combinations survive reinstall and explicit flags still override them', t => {
    for (const timing of [false, true]) for (const metrics of [false, true]) {
        const f = fresh(t, [2, 1, 296]);
        f.put('claude-statusline-runtime.json', { schema_version: 2, native_timing: timing, live_metrics: metrics });
        f.install({ native: false });
        assert.deepEqual(loadRuntime(f.root), { schema_version: 2, native_timing: timing, live_metrics: metrics });
        assert.equal(f.runtime.plugins.length, Number(timing || metrics));
        assert.equal(f.install().changed, false);
        f.install({ liveMetrics: false, nativeTiming: true });
        assert.deepEqual(loadRuntime(f.root), { schema_version: 2, native_timing: true, live_metrics: false });
        assert.equal(f.runtime.plugins.length, 1);
    }
});
test('tests.integration.test_runtime_installer.RuntimeInstallerTests.test_explicit_modes_override_the_legacy_all_off_switch_and_doctor_agrees', t => { const f = fresh(t, [2, 1, 296]); f.install({ native: false, liveMetrics: false, nativeTiming: true }); assert.deepEqual(loadRuntime(f.root), { schema_version: 2, native_timing: true, live_metrics: false }); assert.equal(f.install().changed, false); assert.deepEqual(doctor(f.context).filter(row => row.level === 'ERROR'), []); f.install({ liveMetrics: true, nativeTiming: false }); assert.equal(f.runtime.inputs.nativeTiming, 'false'); assert.equal(f.runtime.inputs.liveMetrics, 'true'); });
test('tests.integration.test_runtime_installer.RuntimeInstallerTests.test_install_migrates_old_preferences_only_in_a_backed_up_transaction', t => { const f = fresh(t, [2, 1, 296]), path = 'claude-statusline-runtime.json', raw = Buffer.from('{"schema_version":1,"live_metrics":false}'); f.put(path, raw); f.install({ dryRun: true }); assert.deepEqual(f.read(path), raw); const result = f.install({ native: false }); assert.deepEqual(fs.readFileSync(join(result.backupDir!, path + '.before')), raw); assert.deepEqual(loadRuntime(f.root), { schema_version: 2, native_timing: false, live_metrics: false }); });
test('tests.integration.test_runtime_installer.RuntimeInstallerTests.test_dry_run_and_old_host_never_call_new_plugin_operations', t => { const f = fresh(t); f.install({ native: false, liveMetrics: true, dryRun: true }); assert.equal(fs.existsSync(f.root), false); f.install({ native: false, liveMetrics: true }); assert.equal(f.runtime.calls.length, 0); f.context.version = [2, 1, 296]; f.install(); const count = f.runtime.calls.length; f.context.version = [2, 1, 288]; f.install(); assert.equal(f.runtime.calls.length, count); assert.equal(owner(f.root, RUNTIME, f.io)!.suspended, true); });
test('tests.integration.test_runtime_installer.RuntimeInstallerTests.test_foreign_runtime_directory_and_changed_resources_are_retained', t => { const f = fresh(t, [2, 1, 296]); f.put(RUNTIME.name + '/note', Buffer.from('keep')); assert.equal(f.install({ native: false, liveMetrics: true }).failed, true); assert.equal(f.read(RUNTIME.name + '/note').toString(), 'keep'); });
test('tests.integration.test_runtime_installer.RuntimeInstallerTests.test_user_plugin_disable_is_not_automatically_reenabled', t => { const f = fresh(t, [2, 1, 296]); f.install({ native: false, nativeTiming: true }); f.runtime.enabled(false); f.install(); assert.equal(f.runtime.listing()[1][0]!.enabled, false); assert.equal(owner(f.root, RUNTIME, f.io)!.suspended, false); });
test('tests.integration.test_runtime_installer.RuntimeInstallerTests.test_uninstall_removes_only_owned_runtime_resources_and_retains_choice', t => { const f = fresh(t, [2, 1, 296]); f.install({ native: false, liveMetrics: true }); assert.equal(f.uninstall().failed, false); assert.equal(fs.existsSync(join(f.root, RUNTIME.name)), false); assert.equal(loadRuntime(f.root).live_metrics, true); });
test('tests.runtime.test_task_timing.TaskTimingTests.test_invalid_preferences_hide_derived_timers_and_remain_diagnosable', t => { const f = fresh(t); f.install({ native: false }); f.put('claude-statusline-runtime.json', Buffer.from('{broken')); const rows = doctor(f.context).filter(row => row.level === 'ERROR'); assert.ok(rows.some(row => renderMessage(row.message, 'zh-CN').includes('claude-statusline-runtime.json'))); assert.ok(rows.some(row => /[\u4e00-\u9fff]/u.test(renderMessage(row.message, 'zh-CN')))); });
