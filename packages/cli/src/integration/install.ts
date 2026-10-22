import * as fs from 'node:fs';
import { join } from 'node:path';
import { PluginHost } from '@fbincon/statusline-platform/plugin-host';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { readJson } from '@fbincon/statusline-core/json-read';
import { CONFIG_FILENAME, SCHEMA_VERSION, isSchema } from '@fbincon/statusline-core/config/display';
import { FEATURE_FILENAME, NATIVE_FILENAME, RUNTIME_FILENAME } from '@fbincon/statusline-core/config/backend-preferences';
import { fail } from '@fbincon/statusline-core/config/validation';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { atLeast } from '../config/service.js';
import { createStorage, decodeUtf8, jsonBytes, readSettings, readDisplay, type Storage } from '../config/storage.js';
import { loadFeature, loadNative, loadRuntime } from '../config/backend-preferences.js';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { OWNER, OWNER_FILE, SKILL, EXTERNAL, NATIVE, RUNTIME, VERSION, type InstallContext, type InstallOptions, type ChangeResult, type Host, type ModSpec } from './model.js';
import { BINDING_FILE, previousBinding, bindingRecord, skillOwned } from './ownership.js';
import { renderSkill } from './resources.js';
import { settingsPlan } from './plan.js';
import { commandPreflight, integrate } from './mods.js';
import { commit, safeTarget, type Change } from './transaction.js';
import { administration } from '../recovery/service.js';
import { readProfiles } from '../rendering/configuration.js';
export function installContext(configDir: string, launch: LaunchSpec, version: readonly number[] | null, io: Storage = createStorage(), host: (spec: ModSpec) => Host = () => new PluginHost(configDir)): InstallContext {
    return { configDir, launch, version, io, host };
}
function prepare(context: InstallContext, options: InstallOptions, uninstall: boolean): Change[] {
    const { configDir, launch, version, io } = context, previous = previousBinding(configDir, io);
    safeTarget(configDir, join(configDir, 'settings.json'));
    const [settings, settingsRaw] = readSettings(configDir, io), [display, displayRaw] = readDisplay(configDir, io, uninstall);
    const external = !uninstall && (options.external ?? loadFeature(configDir, VERSION, io)), active = external && atLeast(version, [2, 1, 258]);
    const changes: Change[] = [];
    function add(name: string, desired: Buffer | null, privateMode = false, knownRaw?: Buffer | null): void {
        const path = join(configDir, name);
        safeTarget(configDir, path);
        const raw = knownRaw === undefined ? io.read(path) : knownRaw;
        const equal = raw === null ? desired === null : desired !== null && raw.equals(desired);
        const modeChanged = privateMode && raw !== null && process.platform !== 'win32' && (fs.statSync(path).mode & 0o777) !== 0o600;
        if (!equal || modeChanged)
            changes.push({ name, path, raw, desired });
    }
    if (active) {
        const collision = join(configDir, 'commands', EXTERNAL + '.md');
        try {
            fs.lstatSync(collision);
            fail('errors.installer.foreign_statusline_configure_command_rename_it_before');
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                throw error;
        }
    }
    const library = uninstall ? null : readProfiles(configDir, io)[0];
    const rows = display.subagents.enabled || Boolean(library?.bindings.some(b => library.profiles.some(p => p.id === b.profile_id && p.display.subagents.enabled)));
    const updated = settingsPlan(settings, { directory: configDir, launch, previous, force: options.force ?? false, fast: atLeast(version, [2, 1, 258]), external: active, subagents: atLeast(version, [2, 1, 205]), rows }, uninstall);
    if (!equalSettings(settings, updated))
        add('settings.json', jsonBytes(updated), false, settingsRaw);
    for (const name of [SKILL, EXTERNAL]) {
        const base = 'skills/' + name, skill = join(configDir, base, 'SKILL.md'), ownerPath = join(configDir, base, OWNER_FILE);
        safeTarget(configDir, skill);
        safeTarget(configDir, ownerPath);
        const raw = io.read(skill), marker = io.read(ownerPath), owned = skillOwned(marker);
        if (uninstall || name === EXTERNAL && !active) {
            if (owned) {
                add(base + '/SKILL.md', null, false, raw);
                add(base + '/' + OWNER_FILE, null, false, marker);
            }
        }
        else {
            if ((raw !== null || marker !== null) && !owned && !options.force)
                fail('errors.installer.an_unrelated_skill_already_exists_rerun_with', { SLASH_COMMAND_NAME: name });
            add(base + '/SKILL.md', renderSkill(launch, name === EXTERNAL), false, raw);
            add(base + '/' + OWNER_FILE, jsonBytes({ owner: OWNER, schema_version: 1 }), false, marker);
        }
    }
    if (!uninstall) {
        const featurePath = join(configDir, FEATURE_FILENAME), featureRaw = io.read(featurePath);
        if (options.external !== undefined)
            add(FEATURE_FILENAME, jsonBytes({ schema_version: 1, experimental_slash_tui: options.external }), true, featureRaw);
        else if (featureRaw !== null)
            add(FEATURE_FILENAME, featureRaw, true, featureRaw);
        if (options.native !== undefined)
            add(NATIVE_FILENAME, jsonBytes({ schema_version: 1, native_editor: options.native }), true);
        if (displayRaw !== null && !isSchema((readJson(decodeUtf8(displayRaw)) as Record<string, unknown>).schema_version, SCHEMA_VERSION))
            add(CONFIG_FILENAME, jsonBytes(display), false, displayRaw);
        const runtimeRaw = io.read(join(configDir, RUNTIME_FILENAME));
        if (runtimeRaw !== null || options.liveMetrics !== undefined || options.nativeTiming !== undefined)
            add(RUNTIME_FILENAME, jsonBytes(loadRuntime(configDir, io, options.liveMetrics, options.nativeTiming)), true, runtimeRaw);
        const intents = bindingRecord(configDir, io)?.refresh_disabled;
        add(BINDING_FILE, jsonBytes({ owner: OWNER, schema_version: 1, backend_version: VERSION, launch, ...(intents ? { refresh_disabled: intents } : {}) }));
    }
    else if (previous)
        add(BINDING_FILE, null);
    return changes;
}
function changeFiles(context: InstallContext, options: InstallOptions, uninstall: boolean): ChangeResult {
    const action = uninstall ? 'uninstall' : 'install', { configDir, io } = context;
    function run(): ChangeResult {
        if (!options.dryRun) options.beforeCommit?.();
        const changes = prepare(context, options, uninstall), backupDir = options.dryRun ? null : commit(configDir, action, changes, io);
        if (!options.dryRun)
            for (const name of [SKILL, EXTERNAL]) {
                try {
                    fs.rmdirSync(join(configDir, 'skills', name));
                }
                catch { /* Owned files only; preserve unknown files. */ }
            }
        return { action, changed: !!changes.length, settingsPath: join(configDir, 'settings.json'), backupDir, changedPaths: changes.map(change => change.path), messages: [], failed: false };
    }
    return options.dryRun ? run() : io.lock(configDir, run);
}
function installImpl(context: InstallContext, options: InstallOptions): ChangeResult {
    const { configDir, version, io } = context;
    const requested = loadNative(configDir, options.native, VERSION, io), modes = loadRuntime(configDir, io, options.liveMetrics, options.nativeTiming), runtime = modes.native_timing || modes.live_metrics;
    const external = options.external ?? loadFeature(configDir, VERSION, io), compatible = atLeast(version, NATIVE.minimum);
    if (requested && compatible)
        commandPreflight(configDir, NATIVE);
    const planned = changeFiles(context, { ...options, dryRun: true }, false);
    const externalMessage = text(!external ? 'install.external_disabled' : atLeast(version, [2, 1, 258]) ? 'install.external_enabled' : 'install.external_suspended', { fallback: text('install.external_fallback') });
    if (options.dryRun)
        return { ...planned, nativeState: requested ? compatible ? 'requested' : 'suspended' : 'disabled', messages: [externalMessage, 'Plugin operations are not executed by dry-run.'] };
    const result = changeFiles(context, options, false), native = integrate(context, NATIVE, requested), live = integrate(context, RUNTIME, runtime);
    return { ...result, changed: result.changed || native.changed || live.changed, nativeState: native.state, messages: [externalMessage, ...native.messages, ...live.messages], failed: native.state === 'blocked' || live.state === 'blocked' || options.native === true && !native.active && !(native.state === 'suspended' && !compatible) || (options.liveMetrics === true || options.nativeTiming === true) && !live.active && live.state !== 'suspended' };
}
function uninstallImpl(context: InstallContext, options: InstallOptions): ChangeResult {
    const planned = changeFiles(context, { ...options, dryRun: true }, true);
    if (options.dryRun)
        return planned;
    const runtime = integrate(context, RUNTIME, false, true);
    if (runtime.state === 'blocked')
        return { ...planned, changed: runtime.changed, changedPaths: [], messages: runtime.messages, failed: true };
    const native = integrate(context, NATIVE, false, true);
    if (native.state === 'blocked')
        return { ...planned, changed: runtime.changed || native.changed, changedPaths: [], messages: [...runtime.messages, ...native.messages], failed: true };
    const result = changeFiles(context, options, true);
    return { ...result, changed: result.changed || runtime.changed || native.changed, nativeState: native.state, messages: [...native.messages, ...runtime.messages] };
}
export function install(context: InstallContext, options: InstallOptions = {}): ChangeResult {
    // Validation precedes even the administration lock file on invalid input.
    if (!options.dryRun) installImpl(context, { ...options, dryRun: true });
    return administration(context, options.dryRun ?? false, tracked => installImpl(tracked, options));
}
export function uninstall(context: InstallContext, options: InstallOptions = {}): ChangeResult {
    if (!options.dryRun) uninstallImpl(context, { ...options, dryRun: true });
    return administration(context, options.dryRun ?? false, tracked => uninstallImpl(tracked, options));
}
