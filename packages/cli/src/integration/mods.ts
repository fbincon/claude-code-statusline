import * as fs from 'node:fs';
import { join } from 'node:path';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { object } from '@fbincon/statusline-core/config/validation';
import { atLeast } from '../config/service.js';
import { jsonBytes, readSettings } from '../config/storage.js';
import { loadRuntime } from '../config/backend-preferences.js';
import { OWNER, OWNER_FILE, type InstallContext, type ModSpec, type ModResult } from './model.js';
import { bundledFiles, digest } from './resources.js';
import { owner, ownedPath, registered, cacheOwned, prune, type Marker } from './mod-ownership.js';
import { commit, safeTarget, type Change } from './transaction.js';
export function commandPreflight(directory: string, spec: ModSpec): void {
    if (spec.name !== 'statusline-native')
        return;
    for (const path of [join(directory, 'commands/statusline-configure-native.md'), join(directory, 'skills/statusline-configure-native')]) {
        try {
            fs.lstatSync(path);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                continue;
            throw error;
        }
        throw new Error('Foreign command or skill; rename it before native migration: ' + path);
    }
}
function recheck(context: InstallContext, spec: ModSpec, previous: Marker, allowMissing = false): void {
    if (!equalSettings(owner(context.configDir, spec, context.io, allowMissing), previous))
        throw new Error('Mod ownership changed; rerun install');
}
export function stage(context: InstallContext, spec: ModSpec, previous: Marker | null): [
    Marker,
    boolean
] {
    const { configDir, io } = context, root = join(configDir, spec.name), bundle = bundledFiles(spec);
    const artifacts = new Map([...bundle.files].map(([name, raw]) => [`plugins/${spec.name}/${name}`, raw as Buffer | null]));
    artifacts.set('.claude-plugin/marketplace.json', jsonBytes({ name: spec.marketplace, owner: { name: 'fbincon' }, metadata: { description: 'Matching Mod bundled with claude-code-statusline' }, plugins: [{ name: spec.name, source: `./plugins/${spec.name}`, version: bundle.inventory.mod_version }] }));
    const marker: Marker = { ...bundle.inventory, owner: OWNER, suspended: previous?.suspended ?? false, files: Object.fromEntries([...artifacts].map(([name, raw]) => [name, digest(raw!)])), cache_inventories: [] };
    for (const snapshot of previous ? [{ mod_version: previous.mod_version, files: previous.files }, ...previous.cache_inventories] : []) {
        if (equalSettings(snapshot, { mod_version: marker.mod_version, files: marker.files }) || marker.cache_inventories.some(value => equalSettings(value, snapshot)))
            continue;
        marker.cache_inventories.push(snapshot);
    }
    marker.cache_inventories = marker.cache_inventories.slice(0, 3);
    const obsolete = Object.keys(previous?.files ?? {}).filter(name => !artifacts.has(name));
    for (const name of obsolete)
        artifacts.set(name, null);
    artifacts.set(OWNER_FILE, jsonBytes(marker));
    return io.lock(configDir, () => {
        if (!equalSettings(owner(configDir, spec, io, true), previous))
            throw new Error('Mod ownership changed while staging');
        const changes: Change[] = [...artifacts].flatMap(([name, desired]) => {
            const path = ownedPath(root, name), raw = io.read(path);
            return raw?.equals(desired ?? Buffer.alloc(0)) && desired !== null || raw === null && desired === null ? [] : [{ name: spec.name + '/' + name, path, raw, desired }];
        });
        commit(configDir, 'mod-stage', changes, io);
        prune(root, obsolete.map(name => ownedPath(root, name)));
        return [marker, !!changes.length];
    });
}
function suspended(context: InstallContext, spec: ModSpec, marker: Marker, enabled: boolean, changeSettings = false): boolean {
    const { configDir, io } = context;
    return io.lock(configDir, () => {
        recheck(context, spec, marker);
        const [settings, raw] = readSettings(configDir, io), plugins = settings.enabledPlugins;
        if (changeSettings && (!object(plugins) || plugins[spec.plugin] !== true))
            return false;
        const path = join(configDir, spec.name, OWNER_FILE), changes: Change[] = [];
        if (changeSettings) {
            (plugins as Record<string, unknown>)[spec.plugin] = false;
            changes.push({ name: 'settings.json', path: join(configDir, 'settings.json'), raw, desired: jsonBytes(settings) });
        }
        if (marker.suspended !== enabled)
            changes.push({ name: spec.name + '/' + OWNER_FILE, path, raw: io.read(path), desired: jsonBytes({ ...marker, suspended: enabled }) });
        commit(configDir, 'mod-suspend', changes, io);
        return !!changes.length;
    });
}
function removeResources(context: InstallContext, spec: ModSpec, marker: Marker): void {
    const { configDir, io } = context, root = join(configDir, spec.name);
    io.lock(configDir, () => {
        recheck(context, spec, marker, true);
        const paths = [...Object.keys(marker.files), OWNER_FILE].map(name => ownedPath(root, name));
        commit(configDir, 'mod-remove', paths.map(path => ({ name: spec.name + '/' + path.slice(root.length + 1).replaceAll('\\', '/'), path, raw: io.read(path), desired: null })), io);
        prune(root, [...paths, ...marker.cache_inventories.flatMap(snapshot => Object.keys(snapshot.files).map(name => ownedPath(root, name)))]);
    });
}
export function bindingValues(context: InstallContext, spec: ModSpec): Record<string, string> {
    const modes = spec.name === 'statusline-runtime' ? loadRuntime(context.configDir, context.io) : null;
    return { backendExecutable: context.launch.executable, backendArgs: JSON.stringify(context.launch.args), configDir: context.configDir, backendVersion: bundledFiles(spec).inventory.backend_version, ...(modes ? { nativeTiming: String(modes.native_timing), liveMetrics: String(modes.live_metrics) } : {}) };
}
export function bindingMatches(options: unknown, values: Record<string, string>): boolean {
    return object(options) && object(options.inputs) && Object.entries(values).every(([key, value]) => options.inputs && (options.inputs as Record<string, unknown>)[key] === value);
}
export function integrate(context: InstallContext, spec: ModSpec, requested: boolean, uninstall = false): ModResult {
    const { configDir, version, io } = context;
    let changed = false;
    const result = (state: ModResult['state'], message: string): ModResult => {
        const key = state === 'installed' ? 'native_plugin_installed_enabled_on_disk_restart' : state === 'plugin-disabled' ? 'is_explicitly_disabled_owned_resources_and_backend' : state === 'suspended' ? 'native_editor_suspended_preference_retained' : message === 'disabled by preference' ? 'native_editor_is_disabled_enable_with_install' : 'owned_native_plugin_and_marketplace_removed_preference';
        return { state, active: state === 'installed', changed, messages: [text((spec.name === 'statusline-runtime' ? 'runtime.' : '') + 'native.notice.' + key, { value0: state === 'plugin-disabled' ? spec.plugin : message })] };
    };
    try {
        const marker = owner(configDir, spec, io, true);
        if (!requested && !marker)
            return result('disabled', 'disabled by preference');
        const restricted = readSettings(configDir, io)[0].disableAllHooks === true, compatible = atLeast(version, spec.minimum);
        if (requested && !marker && (!compatible || restricted))
            return result('suspended', 'preference retained; host unavailable or restricted');
        if (requested && !compatible) {
            changed = suspended(context, spec, marker!, true, true);
            return result('suspended', 'preference retained; requires Claude Code ' + spec.minimum.join('.') + '+');
        }
        const host = context.host(spec);
        const [markets, plugins] = host.listing();
        let [registration, row] = registered(configDir, spec, markets, plugins, marker);
        if (row)
            cacheOwned(configDir, spec, row, marker!, io);
        if (!requested || uninstall) {
            if (row) {
                host.run(['uninstall', spec.plugin, '--scope', 'user']);
                changed = true;
                if (host.listing()[1].some(value => value.id === spec.plugin))
                    throw new Error('Plugin removal could not be confirmed');
            }
            if (registration) {
                host.run(['marketplace', 'remove', spec.marketplace, '--scope', 'user']);
                changed = true;
                if (host.listing()[0].some(value => value.name === spec.marketplace))
                    throw new Error('Marketplace removal could not be confirmed');
            }
            if (marker) {
                removeResources(context, spec, marker);
                changed = true;
            }
            return result('disabled', 'owned plugin and marketplace removed; preferences retained');
        }
        if (restricted) {
            if (row?.enabled === true) {
                host.run(['disable', spec.plugin, '--scope', 'user', '--json']);
                changed = true;
                if (host.listing()[1].some(value => value.id === spec.plugin && value.enabled))
                    throw new Error('Plugin suspension could not be confirmed');
                suspended(context, spec, marker!, true);
            }
            return result('suspended', 'disableAllHooks is enabled; preference retained');
        }
        const userDisabled = !!row && row.enabled !== true && !marker!.suspended;
        commandPreflight(configDir, spec);
        const [current, staged] = stage(context, spec, marker);
        changed ||= staged;
        const root = join(configDir, spec.name);
        host.run(['validate', '--strict', root]);
        host.run(['validate', '--strict', join(root, 'plugins', spec.name)]);
        if (!registration) {
            host.run(['marketplace', 'add', root]);
            changed = true;
        }
        else if (staged)
            host.run(['marketplace', 'update', spec.marketplace]);
        const values = bindingValues(context, spec);
        if (row && staged && row.version === current.mod_version) {
            host.run(['uninstall', spec.plugin, '--scope', 'user']);
            changed = true;
            row = null;
        }
        if (row) {
            if (staged)
                host.run(['update', spec.plugin, '--scope', 'user', '--json']);
            const before = host.run(['configure', spec.plugin, '--json'], undefined, true);
            if (!bindingMatches(before, values)) {
                host.run(['configure', spec.plugin, '--values-stdin'], values);
                changed = true;
            }
            if (marker!.suspended) {
                host.run(['enable', spec.plugin, '--scope', 'user', '--json']);
                changed = true;
            }
        }
        else {
            host.run(['install', spec.plugin, '--scope', 'user', '--json', ...Object.entries(values).flatMap(([key, value]) => ['--config', key + '=' + value])]);
            changed = true;
        }
        let [currentMarkets, currentPlugins] = host.listing();
        let [, saved] = registered(configDir, spec, currentMarkets, currentPlugins, current);
        if (userDisabled && saved?.enabled === true) {
            host.run(['disable', spec.plugin, '--scope', 'user', '--json']);
            changed = true;
            [currentMarkets, currentPlugins] = host.listing();
            [, saved] = registered(configDir, spec, currentMarkets, currentPlugins, current);
        }
        if (!saved || saved.enabled !== !userDisabled)
            throw new Error('Mod enablement preference could not be confirmed');
        cacheOwned(configDir, spec, saved, current, io, true);
        if (!bindingMatches(host.run(['configure', spec.plugin, '--json'], undefined, true), values))
            throw new Error('Mod backend binding could not be confirmed');
        suspended(context, spec, current, false);
        return result(userDisabled ? 'plugin-disabled' : 'installed', userDisabled ? 'explicitly disabled; resources and binding refreshed' : 'installed and enabled on disk; session loading remains unverified');
    }
    catch (error) {
        return { state: 'blocked', active: false, changed, messages: [text('native.notice.compatibility_configuration_is_retained_run_doctor_before', { value0: String(error) })] };
    }
}
