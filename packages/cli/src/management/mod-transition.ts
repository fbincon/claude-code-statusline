/** Refresh owned Mod bytes with the newer ownership reader before an older installer runs. */
import { join } from 'node:path';
import { bundledModProtocols, compatibility, compareVersions } from '@fbincon/statusline-core/management/compatibility';
import { PACKAGE_NAME, VERSION } from '@fbincon/statusline-core/release';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readPackageManifest } from '@fbincon/statusline-platform/npm';
import { readJson } from '@fbincon/statusline-core/json-read';
import { agentRowCapabilities } from '@fbincon/statusline-core/integration/agent-row-capabilities';
import { commandFor } from '@fbincon/statusline-platform/commands';
import { AGENT_ROWS, MANAGED_MODS, NATIVE, RUNTIME, type InstallContext, type ModSpec } from '../integration/model.js';
import { owner, registered, cacheOwned } from '../integration/mod-ownership.js';
import { bundledFiles, digest, type Bundle } from '../integration/resources.js';
import { integrate } from '../integration/mods.js';
import { modFailureDetail } from '../integration/mod-diagnostic.js';
import { BINDING_FILE } from '../integration/ownership.js';
import { deactivateAgentRowRoute, readAgentRowRoute } from '../integration/agent-row-state.js';
import { commit, type Change } from '../integration/transaction.js';
import { administration } from '../recovery/service.js';
import { refreshIntents } from '../recovery/journal.js';
import { loadNative, loadRuntime } from '../config/backend-preferences.js';
import { jsonBytes, readDisplay, readSettings } from '../config/storage.js';
import { configuredAgentRows } from '../config/agent-rows.js';
import { readProfiles } from '../rendering/configuration.js';
import { automaticRequested } from '../sources/automatic-state.js';
import { atLeast } from '../config/service.js';
import { assertConfiguration, configurationBytes, configurationHashes, type ConfigHashes } from './configuration.js';

interface Transition {
    spec: ModSpec;
    bundle?: Bundle;
    requested: boolean;
    disabled: boolean;
}

/** Revoke the current Mod's authority before detaching its marketplace. An old
 * target can already serve its command throughout the rest of the transaction. */
function retireAgentRows(context: InstallContext, intents: string[]): { changes: Change[]; transition?: Transition } {
    const { configDir, io } = context;
    const marker = owner(configDir, AGENT_ROWS, io, true);
    const route = readAgentRowRoute(configDir);
    const intent = intents.includes(AGENT_ROWS.name);
    if (!marker && !route && !intent) return { changes: [] };
    const [settings, raw] = readSettings(configDir, io);
    let disabled = intent;
    if (marker) {
        const [markets, plugins] = context.host(AGENT_ROWS).listing();
        const [, row] = registered(configDir, AGENT_ROWS, markets, plugins, marker);
        if (row) cacheOwned(configDir, AGENT_ROWS, row, marker, io);
        const flags = settings.enabledPlugins as Record<string, unknown> | undefined;
        disabled ||= !marker.suspended && (row?.enabled === false || flags?.[AGENT_ROWS.plugin] === false);
    }
    const changes: Change[] = [];
    const retirement = deactivateAgentRowRoute(configDir, disabled);
    if (retirement) changes.push(retirement);
    if ((marker || route?.installationId) && settings.subagentStatusLine == null && settings.disableAllHooks !== true &&
        agentRowCapabilities(context.version).legacy && configuredAgentRows(readDisplay(configDir, io)[0], readProfiles(configDir, io)[0])) {
        const callback = { type: 'command', command: commandFor(context.launch, 'render-subagents') };
        changes.push({ name: 'settings.json', path: join(configDir, 'settings.json'), raw, desired: jsonBytes({ ...settings, subagentStatusLine: callback }) });
    }
    return { changes, transition: marker || intent ? { spec: AGENT_ROWS, requested: false, disabled: true } : undefined };
}

export function prepareModDowngrade(context: InstallContext, root: string, version: string, expected: ConfigHashes, dryRun: boolean): ConfigHashes {
    assertConfiguration(context.configDir, expected);
    const manifest = readPackageManifest(root);
    if (manifest.version !== version || manifest.name !== PACKAGE_NAME) throw new PackageError('identity');
    const target = compatibility(manifest.statuslineCompatibility, version);
    const modes = loadRuntime(context.configDir, context.io);
    const restricted = readSettings(context.configDir, context.io)[0].disableAllHooks === true;
    const intents = refreshIntents(context.configDir);
    const protocols = bundledModProtocols(target);
    const retirement = target.agent_rows_protocol === undefined ? retireAgentRows(context, intents) : { changes: [], transition: undefined };
    const transitions: Transition[] = retirement.transition ? [retirement.transition] : [];
    for (const original of MANAGED_MODS) {
        const protocol = protocols[original.name];
        if (protocol === undefined) continue;
        const marker = owner(context.configDir, original, context.io, true);
        const newerTarget = compareVersions(VERSION, version) < 0;
        if (!marker || newerTarget && marker.protocol_version <= protocol && compareVersions(marker.mod_version, version) <= 0 &&
            target.editor_protocol >= PROTOCOL_VERSION) continue;
        const spec = { ...original, protocol };
        const bundle = bundledFiles(spec, { root: join(root, 'node_modules/@fbincon/statusline-cli/resources', spec.name), version });
        if (version === VERSION && marker.mod_version === version && marker.protocol_version === protocol &&
            marker.files['plugins/' + spec.name + '/resource-manifest.json'] === digest(bundle.files.get('resource-manifest.json')!)) continue;
        const requested = original.name === NATIVE.name ? loadNative(context.configDir, undefined, version, context.io)
            : original.name === RUNTIME.name ? modes.native_timing || modes.live_metrics || automaticRequested(context.configDir)
            : !!readAgentRowRoute(context.configDir)?.installationId;
        transitions.push({ spec, bundle, requested, disabled: !requested || restricted || intents.includes(spec.name) || !atLeast(context.version, spec.minimum) });
    }
    if (dryRun || !transitions.length && !retirement.changes.length) return expected;
    const before = configurationBytes(context.configDir);
    administration(context, false, tracked => {
        context.io.lock(context.configDir, () => {
            assertConfiguration(context.configDir, expected);
            if (retirement.changes.length) commit(context.configDir, 'retire-agent-rows', retirement.changes, context.io);
        });
        for (const { spec, requested, bundle } of transitions) {
            const result = integrate(tracked, spec, requested, !requested, bundle);
            if (!['installed','plugin-disabled','disabled','suspended'].includes(result.state))
                throw new PackageError('integration_failed', modFailureDetail(result.messages));
        }
    });
    for (const change of retirement.changes) before[change.name] = change.desired;
    const after = configurationBytes(context.configDir);
    for (const name of Object.keys(before)) {
        const a = before[name]!, b = after[name]!;
        if (a === null ? b === null : b !== null && a.equals(b)) continue;
        // Official refresh may rewrite formatting and the owned backend version.
        // All other configuration values must still match the reviewed snapshot.
        if (!['settings.json', BINDING_FILE].includes(name) || a === null || b === null) throw new PackageError('conflict');
        const left = readJson(decodeUtf8(a)) as Record<string, any>, right = readJson(decodeUtf8(b)) as Record<string, any>;
        if (name === 'settings.json') {
            if (retirement.transition) {
                // The official uninstaller may delete its plugin configuration
                // and directory marketplace. Every other entry must survive.
                for (const [key, owned] of [['pluginConfigs', AGENT_ROWS.plugin], ['extraKnownMarketplaces', AGENT_ROWS.marketplace]] as const) {
                    if (left[key] && !Object.hasOwn(right[key] ?? {}, owned)) delete left[key][owned];
                    for (const record of [left, right]) if (record[key] && !Object.keys(record[key]).length) delete record[key];
                }
            }
            for (const { spec, requested } of transitions) if (requested) {
                const a = left.pluginConfigs?.[spec.plugin]?.options, b = right.pluginConfigs?.[spec.plugin]?.options;
                if (a && b && b.backendVersion === version) a.backendVersion = version;
            }
            for (const { spec, disabled } of transitions) if (disabled) {
                if (right.enabledPlugins?.[spec.plugin] === true) throw new PackageError('conflict');
                if (left.enabledPlugins) delete left.enabledPlugins[spec.plugin];
                if (right.enabledPlugins) delete right.enabledPlugins[spec.plugin];
            }
            for (const value of [left, right]) if (value.enabledPlugins && !Object.keys(value.enabledPlugins).length) delete value.enabledPlugins;
        }
        if (name === BINDING_FILE) for (const value of [left, right]) {
            value.refresh_disabled = value.refresh_disabled?.filter((name: string) => !transitions.some(t => t.spec.name === name && intents.includes(name)));
            if (!value.refresh_disabled?.length) delete value.refresh_disabled;
        }
        if (!equalSettings(left, right)) throw new PackageError('conflict');
    }
    return configurationHashes(after);
}
