import { automaticRequested } from '../sources/automatic-state.js';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { PluginHost } from '@fbincon/statusline-platform/plugin-host';
import { revision } from '@fbincon/statusline-platform/hash';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { readJson } from '@fbincon/statusline-core/json-read';
import { CONFIG_FILENAME, SCHEMA_VERSION, isSchema } from '@fbincon/statusline-core/config/display';
import { FEATURE_FILENAME, NATIVE_FILENAME, RUNTIME_FILENAME } from '@fbincon/statusline-core/config/backend-preferences';
import { fail, object } from '@fbincon/statusline-core/config/validation';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { atLeast } from '../config/service.js';
import { configuredAgentRows } from '../config/agent-rows.js';
import { createStorage, decodeUtf8, jsonBytes, readSettings, readDisplay, type Storage } from '../config/storage.js';
import { loadFeature, loadNative, loadRuntime } from '../config/backend-preferences.js';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { OWNER, OWNER_FILE, SKILL, EXTERNAL, NATIVE, RUNTIME, AGENT_ROWS, VERSION, type InstallContext, type InstallOptions, type ChangeResult, type Host, type ModResult, type ModSpec } from './model.js';
import { BINDING_FILE, previousBinding, bindingRecord, skillOwned } from './ownership.js';
import { bundledFiles, renderSkill } from './resources.js';
import { setLegacyRows, settingsPlan } from './plan.js';
import { commandPreflight, integrate } from './mods.js';
import { commit, safeTarget, type Change } from './transaction.js';
import { administration } from '../recovery/service.js';
import { readProfiles } from '../rendering/configuration.js';
import { deactivateAgentRowRoute, planAgentRowInstall, readAgentRowRoute, type AgentRowInstallPlan } from './agent-row-route.js';
import { owner } from './mod-ownership.js';
import { pending, refreshIntents } from '../recovery/journal.js';
export function installContext(configDir: string, launch: LaunchSpec, version: readonly number[] | null, io: Storage = createStorage(), host: (spec: ModSpec) => Host = () => new PluginHost(configDir)): InstallContext {
    return { configDir, launch, version, io, host };
}
interface PreparedFiles {
    changes: Change[];
    routing: AgentRowInstallPlan | null;
    previousLegacy: unknown;
    plannedLegacy: unknown;
}
interface FileResult extends PreparedFiles { result: ChangeResult }

class AgentRowResourcesUnavailable extends Error {}

function agentRowPlan(context: InstallContext, settings: Record<string, unknown>, rows: boolean, options: InstallOptions, modUnavailable?: 'disabled' | 'failed'): AgentRowInstallPlan {
    const available = atLeast(context.version, AGENT_ROWS.minimum);
    // Read an ownership marker only to distinguish our previous capability suspension from a user's opt-out.
    const disabled = object(settings.enabledPlugins) && settings.enabledPlugins[AGENT_ROWS.plugin] === false;
    let modSuspended = false;
    if (available && disabled && rows && options.subagentRenderer !== 'legacy') {
        try { modSuspended = owner(context.configDir, AGENT_ROWS, context.io, true)?.suspended === true; }
        catch { /* A foreign or unverifiable marker cannot authorize enabling a disabled plugin. */ }
    }
    const request = { preference: options.subagentRenderer, force: options.force, modUnavailable, modSuspended };
    try {
        return planAgentRowInstall(context, settings, rows, { ...request, resourceRevision() {
            try { return revision(bundledFiles(AGENT_ROWS).inventory); }
            catch (error) { throw new AgentRowResourcesUnavailable(String(error)); }
        } });
    } catch (error) {
        if (!(error instanceof AgentRowResourcesUnavailable)) throw error;
        return planAgentRowInstall(context, settings, rows, { ...request, modUnavailable: 'failed' });
    }
}

function routeNotice(plan: AgentRowInstallPlan) {
    return text('agent_rows.install.route', { mode: plan.mode, reason: text('agent_rows.reason.' + plan.reason) });
}

function prepare(context: InstallContext, options: InstallOptions, uninstall: boolean, preserveRowOptOut: boolean): PreparedFiles {
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
    const routing = uninstall ? null : agentRowPlan(context, settings, configuredAgentRows(display, library), options);
    if (routing?.unsupported)
        fail('agent_rows.install.unavailable', { preference: routing.preference, reason: text('agent_rows.reason.' + routing.reason) });
    const updated = settingsPlan(settings, { directory: configDir, launch, previous, force: options.force ?? false, fast: atLeast(version, [2, 1, 258]), external: active, subagentLifecycle: atLeast(version, [2, 1, 205]), legacyRows: routing?.legacy ?? 'remove' }, uninstall);
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
    const routeChange = uninstall ? deactivateAgentRowRoute(configDir, preserveRowOptOut) : routing?.change;
    if (routeChange) changes.push(routeChange);
    return { changes, routing, previousLegacy: settings.subagentStatusLine, plannedLegacy: updated.subagentStatusLine };
}
function changeFiles(context: InstallContext, options: InstallOptions, uninstall: boolean, preserveRowOptOut = false): FileResult {
    const action = uninstall ? 'uninstall' : 'install', { configDir, io } = context;
    function run(): FileResult {
        if (!options.dryRun) options.beforeCommit?.();
        const prepared = prepare(context, options, uninstall, preserveRowOptOut), { changes } = prepared;
        const backupDir = options.dryRun ? null : commit(configDir, action, changes, io);
        if (!options.dryRun)
            for (const name of [SKILL, EXTERNAL]) {
                try {
                    fs.rmdirSync(join(configDir, 'skills', name));
                }
                catch { /* Owned files only; preserve unknown files. */ }
            }
        return { ...prepared, result: { action, changed: !!changes.length, settingsPath: join(configDir, 'settings.json'), backupDir, changedPaths: changes.map(change => change.path), messages: [], failed: false } };
    }
    return options.dryRun ? run() : io.lock(configDir, run);
}

function integrateAgentRows(context: InstallContext, plan: AgentRowInstallPlan): ModResult | null {
    if (!context.version || plan.mode === 'preserve' || plan.reason === 'mod-disabled' || plan.reason === 'mod-failed') return null;
    const { configDir } = context;
    const marked = fs.existsSync(join(configDir, AGENT_ROWS.name, OWNER_FILE));
    if (!plan.wantMod && !marked && !refreshIntents(configDir).includes(AGENT_ROWS.name)) return null;
    // An older host may lack the plugin-management commands. Suspend our existing plugin on disk.
    const suspend = marked && (!atLeast(context.version, AGENT_ROWS.minimum) || plan.reason === 'restricted');
    return integrate(context, AGENT_ROWS, plan.wantMod || suspend);
}

/** A failed candidate can change only the route it prepared. Keep newer or third-party decisions. */
function recoverAgentRowRoute(context: InstallContext, options: InstallOptions, prepared: FileResult, mod: ModResult): AgentRowInstallPlan {
    const route = prepared.routing!;
    const { configDir, io } = context;
    if (!route.wantMod || mod.active || pending(configDir).length) return route;
    return io.lock(configDir, () => {
        const currentRoute = readAgentRowRoute(configDir);
        if (currentRoute?.installationId !== route.installationId || route.mode === 'standby' && currentRoute?.mode === 'mod') return route;
        const [settings, raw] = readSettings(configDir, io), updated = { ...settings };
        const changes: Change[] = [];
        let selected = route;
        if (route.preference === 'auto') {
            const [display] = readDisplay(configDir, io), [profiles] = readProfiles(configDir, io);
            selected = agentRowPlan(context, settings, configuredAgentRows(display, profiles), options, mod.state === 'plugin-disabled' ? 'disabled' : 'failed');
            if (selected.change) changes.push(selected.change);
            setLegacyRows(updated, { launch: context.launch, previous: previousBinding(configDir, io), force: false }, selected.legacy);
        } else {
            // An explicitly forced destination never silently changes into a fallback preference.
            const change = route.change;
            if (change) {
                const current = io.read(change.path);
                if (!current?.equals(change.desired ?? Buffer.alloc(0))) return route;
                changes.push({ ...change, raw: current, desired: change.raw });
            }
            if (equalSettings(settings.subagentStatusLine, prepared.plannedLegacy)) {
                if (prepared.previousLegacy === undefined) delete updated.subagentStatusLine;
                else updated.subagentStatusLine = prepared.previousLegacy;
            }
        }
        if (!equalSettings(settings, updated))
            changes.push({ name: 'settings.json', path: join(configDir, 'settings.json'), raw, desired: jsonBytes(updated) });
        const backup = commit(configDir, 'subagent-renderer-fallback', changes, io);
        if (backup) {
            prepared.result.backupDir ??= backup;
            prepared.result.changedPaths = [...new Set([...prepared.result.changedPaths, ...changes.map(change => change.path)])];
            prepared.result.changed = true;
        }
        return selected;
    });
}

function installImpl(context: InstallContext, options: InstallOptions): ChangeResult {
    const { configDir, version, io } = context;
    const requested = loadNative(configDir, options.native, VERSION, io), modes = loadRuntime(configDir, io, options.liveMetrics, options.nativeTiming), runtime = modes.native_timing || modes.live_metrics || automaticRequested(configDir);
    const external = options.external ?? loadFeature(configDir, VERSION, io), compatible = atLeast(version, NATIVE.minimum);
    if (requested && compatible)
        commandPreflight(configDir, NATIVE);
    const externalMessage = text(!external ? 'install.external_disabled' : atLeast(version, [2, 1, 258]) ? 'install.external_enabled' : 'install.external_suspended', { fallback: text('install.external_fallback') });
    const prepared = changeFiles(context, options, false), { result, routing } = prepared;
    if (options.dryRun)
        return { ...result, nativeState: requested ? compatible ? 'requested' : 'suspended' : 'disabled', messages: [externalMessage, routeNotice(routing!), 'Plugin operations are not executed by dry-run.'] };
    const native = integrate(context, NATIVE, requested), live = integrate(context, RUNTIME, runtime);
    const agent = integrateAgentRows(context, routing!);
    const selected = agent ? recoverAgentRowRoute(context, options, prepared, agent) : routing!;
    const agentFailed = selected.reason === 'mod-failed' || agent?.state === 'blocked' || Boolean(routing!.wantMod && selected.preference === 'mod' && !agent?.active);
    const routeMessage = agentFailed && selected.preference === 'mod'
        ? text('agent_rows.install.unavailable', { preference: selected.preference, reason: text('agent_rows.reason.mod-failed') }) : routeNotice(selected);
    return { ...result, changed: result.changed || native.changed || live.changed || Boolean(agent?.changed), nativeState: native.state,
        messages: [externalMessage, ...native.messages, ...live.messages, ...(agent?.messages ?? []), routeMessage],
        failed: native.state === 'blocked' || live.state === 'blocked' || agentFailed || options.native === true && !native.active && !(native.state === 'suspended' && !compatible) || (options.liveMetrics === true || options.nativeTiming === true) && !live.active && live.state !== 'suspended' };
}
function uninstallImpl(context: InstallContext, options: InstallOptions): ChangeResult {
    const [settings] = readSettings(context.configDir, context.io);
    const plugins = settings.enabledPlugins;
    const disabled = object(plugins) && Object.hasOwn(plugins, AGENT_ROWS.plugin) && plugins[AGENT_ROWS.plugin] !== true;
    const marker = disabled ? owner(context.configDir, AGENT_ROWS, context.io, true) : null;
    const preserveOptOut = Boolean(marker && !marker.suspended) || refreshIntents(context.configDir).includes(AGENT_ROWS.name);
    const { result: planned } = changeFiles(context, { ...options, dryRun: true }, true, preserveOptOut);
    if (options.dryRun)
        return planned;
    const mods: ModResult[] = [];
    for (const spec of [AGENT_ROWS, RUNTIME, NATIVE]) {
        const mod = integrate(context, spec, false, true);
        mods.push(mod);
        if (mod.state === 'blocked')
            return { ...planned, changed: mods.some(item => item.changed), changedPaths: [], messages: mods.flatMap(item => item.messages), failed: true };
    }
    const { result } = changeFiles(context, options, true, preserveOptOut);
    return { ...result, changed: result.changed || mods.some(item => item.changed), nativeState: mods.at(-1)!.state, messages: mods.reverse().flatMap(item => item.messages) };
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
