import { automaticRequested } from '../sources/automatic-state.js';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { which, ownedCommand, resolvedPath, sameLaunchEntry } from '@fbincon/statusline-platform/commands';
import { chooseLauncher } from '@fbincon/statusline-platform/terminal/launchers';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { ConfigError, object } from '@fbincon/statusline-core/config/validation';
import { safeInteger } from '@fbincon/statusline-core/json';
import { supportedNode, NODE_RUNTIME_RANGE } from '@fbincon/statusline-core/node-runtime';
import { readJson } from '@fbincon/statusline-core/json-read';
import { CONFIG_FILENAME, SCHEMA_VERSION } from '@fbincon/statusline-core/config/display';
import { FEATURE_FILENAME } from '@fbincon/statusline-core/config/backend-preferences';
import { atLeast } from '../config/service.js';
import { hostFromSettings } from '../config/host.js';
import { safeTarget } from './paths.js';
import { readDisplay, readSettings, decodeUtf8 } from '../config/storage.js';
import { loadFeature, loadNative, loadRuntime } from '../config/backend-preferences.js';
import { localizedError } from '../errors.js';
import { SKILL, EXTERNAL, OWNER_FILE, HOOKS, SUBAGENT_HOOKS, NATIVE, RUNTIME, VERSION, type InstallContext, type Diagnostic, type ModSpec } from './model.js';
import { skillOwned } from './ownership.js';
import { owner, registered, cacheOwned } from './mod-ownership.js';
import { bundledFiles, renderSkill } from './resources.js';
import { bindingValues, bindingMatches, commandPreflight } from './mods.js';
import { pending, readJournal, refreshIntents } from '../recovery/journal.js';
import { GitInvocation, GitPolicyError } from '@fbincon/statusline-platform/git';
import { colorCapability } from '@fbincon/statusline-platform/terminal/capabilities';
import { captureWindowsModes } from '@fbincon/statusline-platform/terminal/windows-modes';
export function pathCollisions(context: InstallContext, environment: NodeJS.ProcessEnv = process.env): Diagnostic[] {
    const path = which('claude-statusline', environment);
    if (!path || sameLaunchEntry(path, context.launch))
        return [];
    let python = false;
    try {
        const fd = fs.openSync(path, 'r'), bytes = Buffer.alloc(1024);
        try {
            const size = fs.readSync(fd, bytes, 0, bytes.length, 0);
            python = /(?:python|pipx)/iu.test(bytes.subarray(0, size).toString('utf8')) || /pipx/iu.test(resolvedPath(path));
        }
        finally {
            fs.closeSync(fd);
        }
    }
    catch { /* The path is still a collision even if unreadable. */ }
    return [{ level: 'WARN', message: `PATH selects another ${python ? 'Python/pipx ' : ''}entry: ${path}. Integration uses the explicit Node/JS binding. Keep the Python environment available for rollback.` }];
}
export function schemaDiagnostic(source: number, supported = SCHEMA_VERSION): Diagnostic {
    return { level: source < supported ? 'WARN' : 'OK', message: text(source < supported ? 'doctor.doctor.display_config_schema_v_is_valid_and' : 'doctor.doctor.display_config_schema_v', { display_source_schema: source, SCHEMA_VERSION: supported }) };
}
export function doctor(context: InstallContext): Diagnostic[] {
    const { configDir, launch, version, io } = context, rows: Diagnostic[] = [];
    const add = (level: Diagnostic['level'], key: string, params: Record<string, unknown> = {}) => rows.push({ level, message: text(key, params) });
    const capture = (action: () => void) => { try {
        action();
    }
    catch (error) {
        rows.push({ level: 'ERROR', message: error instanceof ConfigError ? localizedError(error) : String(error) });
    } };
    capture(() => {
        for (const id of refreshIntents(configDir)) add('ERROR', 'recovery.pending', { id, phase: 'restore-disabled' });
        for (const path of pending(configDir)) {
            const journal = readJournal(configDir, path);
            add('ERROR', 'recovery.pending', { id: journal.id, phase: journal.phase });
        }
    });
    rows.push({ level: supportedNode(process.versions.node) ? 'OK' : 'ERROR', message: `Node runtime: ${process.versions.node}; supported ${NODE_RUNTIME_RANGE}; ${process.platform}/${process.arch}` }, ...pathCollisions(context));
    capture(() => {
        const restore = captureWindowsModes(!!process.stdin.isTTY, !!process.stdout.isTTY, true);
        try {
            const capability = colorCapability({environment:process.env,platform:process.platform,tty:!!process.stdout.isTTY,windowsVT:restore.vt});
            add('OK', 'doctor.terminal_colors', {colors:capability.colors,reason:capability.reason});
        } finally { restore(); }
    });
    try { new GitInvocation(process.cwd(), 2000).worktreePolicy(); }
    catch (error) { if (error instanceof GitPolicyError && error.reason !== 'not_repo') add('WARN', 'doctor.git_policy', { reason: error.reason }); }
    capture(() => { fs.accessSync(launch.executable, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); add('OK', 'doctor.doctor.executable', { executable: launch.executable }); });
    let settings: Record<string, unknown> = {};
    capture(() => { [settings] = readSettings(configDir, io); });
    capture(() => {
        const { installed } = hostFromSettings(settings, launch);
        add(installed ? 'OK' : 'ERROR', installed ? 'doctor.doctor.statusline_command_and_host_options' : 'doctor.doctor.statusline_is_not_configured_for_this_executable');
    });
    capture(() => {
        const runtime = join(configDir, 'statusline_runtime'), probe = join(runtime, '.doctor-' + randomUUID());
        let created = false;
        try {
            safeTarget(configDir, probe);
            if (!fs.lstatSync(runtime).isDirectory()) throw new Error('Not a directory');
            const fd = fs.openSync(probe, 'wx', 0o600);
            created = true;
            try { fs.writeFileSync(fd, ''); } finally { fs.closeSync(fd); }
            add('OK', 'doctor.doctor.runtime_directory', { runtime_dir: runtime });
        } catch {
            add('ERROR', 'doctor.doctor.runtime_directory_is_not_writable', { runtime_dir: runtime });
        } finally { if (created) fs.unlinkSync(probe); }
    });
    function actions(event: string): Record<string, unknown>[] {
        const groups = object(settings.hooks) ? settings.hooks[event] : [];
        return Array.isArray(groups) ? groups.flatMap(group => object(group) && Array.isArray(group.hooks) ? group.hooks.filter(object) : []) : [];
    }
    for (const event of [...HOOKS, ...SUBAGENT_HOOKS]) {
        const count = actions(event).filter(action => ownedCommand(action.command, 'hook', launch)).length, supported = (HOOKS as readonly string[]).includes(event) || atLeast(version, [2, 1, 205]);
        add(count === Number(supported) ? 'OK' : 'ERROR', supported ? count === 1 ? 'doctor.doctor.hook_exactly_one' : 'doctor.doctor.hook_expected_one_found' : count ? 'doctor.doctor.hook_is_unsupported_but_owned_hook_s' : 'doctor.doctor.hook_suspended', { event, count });
    }
    capture(() => {
        const [display, raw] = readDisplay(configDir, io);
        if (raw === null)
            add('OK', 'doctor.doctor.display_config_built_in_defaults');
        else {
            const schema = safeInteger((readJson(decodeUtf8(raw)) as Record<string, unknown>).schema_version);
            rows.push(schemaDiagnostic(schema));
        }
        const current = settings.subagentStatusLine, owned = object(current) && ownedCommand(current.command, 'render-subagents', launch);
        if (display.subagents.enabled && atLeast(version, [2, 1, 205]))
            add(owned ? 'OK' : 'ERROR', owned ? 'doctor.doctor.subagentstatusline_enabled_and_owned' : 'doctor.doctor.subagentstatusline_is_enabled_but_its_state_is', { state: current == null ? 'absent' : 'foreign' });
        else
            add(owned ? 'ERROR' : 'OK', owned ? 'doctor.doctor.subagentstatusline_is_disabled_but_an_owned_setting' : 'doctor.doctor.subagentstatusline_disabled', { value0: '' });
    });
    const primary = join(configDir, 'skills', SKILL);
    capture(() => { const valid = io.read(join(primary, 'SKILL.md'))?.equals(renderSkill(launch)) === true && skillOwned(io.read(join(primary, OWNER_FILE))); add(valid ? 'OK' : 'ERROR', valid ? 'doctor.doctor.skill' : 'doctor.doctor.skill_is_missing_or_not_owned', { SLASH_COMMAND_NAME: SKILL }); });
    capture(() => {
        const enabled = loadFeature(configDir, VERSION, io), supported = atLeast(version, [2, 1, 258]), preferencePath = join(configDir, FEATURE_FILENAME), raw = io.read(preferencePath);
        if (raw !== null && process.platform !== 'win32' && (fs.statSync(preferencePath).mode & 0o777) !== 0o600)
            add('ERROR', 'doctor.doctor.experimental_feature_preferences_permissions_expected_0600_found', { preference_mode: (fs.statSync(preferencePath).mode & 0o777).toString(8) });
        const root = join(configDir, 'skills', EXTERNAL), owned = skillOwned(io.read(join(root, OWNER_FILE)));
        const groups = object(settings.hooks) && Array.isArray(settings.hooks.UserPromptExpansion) ? settings.hooks.UserPromptExpansion.filter(object) : [];
        const matching = groups.filter(group => group.matcher === EXTERNAL), hooks = matching.flatMap(group => Array.isArray(group.hooks) ? group.hooks.filter(object) : []), count = hooks.filter(action => ownedCommand(action.command, 'slash-hook', launch) && (() => { try {
            return safeInteger(action.timeout) === 600;
        }
        catch {
            return false;
        } })()).length;
        if (!enabled || !supported)
            add(owned || count ? 'ERROR' : enabled ? 'WARN' : 'OK', owned || count ? enabled ? 'doctor.doctor.is_suspended_but_owned_artifacts_remain_rerun' : 'doctor.doctor.is_disabled_but_owned_artifacts_remain_rerun' : enabled ? 'doctor.doctor.suspended_on_claude_code_requires_2_1' : 'doctor.doctor.disabled', { EXPERIMENTAL_SLASH_COMMAND_NAME: EXTERNAL, version_text: version?.join('.') ?? 'unknown' });
        else {
            const valid = owned && io.read(join(root, 'SKILL.md'))?.equals(renderSkill(launch, true)) === true;
            add(valid ? 'OK' : 'ERROR', valid ? 'doctor.doctor.skill_and_owner_marker' : 'doctor.doctor.skill_is_missing_or_not_owned_2', { EXPERIMENTAL_SLASH_COMMAND_NAME: EXTERNAL });
            add(count === 1 && matching.length === 1 ? 'OK' : 'ERROR', count === 1 && matching.length === 1 ? 'doctor.doctor.hook_exactly_one_600s' : 'doctor.doctor.hook_expected_one_600s_hook_in_exactly', { EXPERIMENTAL_SLASH_COMMAND_NAME: EXTERNAL });
            if (!chooseLauncher(process.env))
                add('WARN', 'doctor.doctor.no_supported_interactive_launcher_is_installed_install');
        }
    });
    for (const spec of [NATIVE, RUNTIME])
        capture(() => modDiagnostics(context, spec, rows));
    return rows;
}
function modDiagnostics(context: InstallContext, spec: ModSpec, rows: Diagnostic[]): void {
    const { configDir, version, io } = context, modes = spec === RUNTIME ? loadRuntime(configDir, io) : null, requested = modes ? modes.native_timing || modes.live_metrics || automaticRequested(configDir) : loadNative(configDir, undefined, VERSION, io), prefix = spec === RUNTIME ? 'runtime.' : '';
    const add = (level: Diagnostic['level'], key: string, params: Record<string, unknown> = {}) => rows.push({ level, message: text(prefix + 'doctor.native.' + key, params) });
    add('OK', 'native_editor_preference', { value0: requested ? 'enabled' : 'disabled' });
    const marker = owner(configDir, spec, io), compatible = atLeast(version, spec.minimum);
    if (!compatible && requested)
        add('WARN', 'native_editor_suspended_preference_retained_rerun_install');
    if (!marker) {
        add(requested && compatible ? 'WARN' : 'OK', 'native_plugin_on_disk_absent', { value0: '' });
        return;
    }
    const [settings] = readSettings(configDir, io);
    if (!compatible) {
        if (object(settings.enabledPlugins) && settings.enabledPlugins[spec.plugin] === true)
            add('ERROR', 'native_plugin_is_still_enabled_on_an');
        return;
    }
    const manifest = bundledFiles(spec).inventory;
    if (marker.backend_version !== manifest.backend_version || marker.mod_version !== manifest.mod_version || marker.protocol_version !== manifest.protocol_version)
        add('ERROR', 'native_mod_backend_version_or_protocol_differs');
    const host = context.host(spec), [markets, plugins] = host.listing(), [registration, row] = registered(configDir, spec, markets, plugins, marker);
    add(registration ? 'OK' : 'ERROR', 'native_marketplace_on_disk', { value0: registration ? 'registered' : 'missing' });
    if (row) {
        cacheOwned(configDir, spec, row, marker, io, true);
        add(row.enabled ? 'OK' : 'WARN', 'native_plugin_on_disk_installed_enabled_tool', { value0: row.enabled, value1: marker.suspended });
        const matches = bindingMatches(host.run(['configure', spec.plugin, '--json'], undefined, true), bindingValues(context, spec));
        add(matches ? 'OK' : 'ERROR', 'native_backend_binding', { value0: matches ? 'matches' : 'differs; rerun install' });
    }
    else
        add('ERROR', 'native_plugin_on_disk_missing_rerun_install');
    commandPreflight(configDir, spec);
    if (settings.disableAllHooks === true)
        add('WARN', 'native_loading_restricted_by_disableallhooks_rerun_install');
    add('WARN', 'native_session_loading_unverified_restart_in_a');
}
