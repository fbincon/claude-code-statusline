/** Refresh owned Mod bytes with the newer ownership reader before an older installer runs. */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { compatibility, compareVersions } from '@fbincon/statusline-core/management/compatibility';
import { PACKAGE_NAME, VERSION } from '@fbincon/statusline-core/release';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readJson } from '@fbincon/statusline-core/json-read';
import { NATIVE, RUNTIME, type InstallContext } from '../integration/model.js';
import { owner } from '../integration/mod-ownership.js';
import { bundledFiles } from '../integration/resources.js';
import { integrate } from '../integration/mods.js';
import { BINDING_FILE } from '../integration/ownership.js';
import { administration } from '../recovery/service.js';
import { refreshIntents } from '../recovery/journal.js';
import { loadNative, loadRuntime } from '../config/backend-preferences.js';
import { readSettings } from '../config/storage.js';
import { automaticRequested } from '../sources/automatic-state.js';
import { atLeast } from '../config/service.js';
import { assertConfiguration, configurationBytes, configurationHashes, type ConfigHashes } from './configuration.js';

export function prepareModDowngrade(context: InstallContext, root: string, version: string, expected: ConfigHashes, dryRun: boolean): ConfigHashes {
    assertConfiguration(context.configDir, expected);
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (manifest.version !== version || manifest.name !== PACKAGE_NAME) throw new PackageError('identity');
    const target = compatibility(manifest.statuslineCompatibility, version);
    const modes = loadRuntime(context.configDir, context.io);
    const restricted = readSettings(context.configDir, context.io)[0].disableAllHooks === true;
    const intents = refreshIntents(context.configDir);
    const transitions = [NATIVE, RUNTIME].flatMap(original => {
        const protocol = original.name === NATIVE.name ? target.editor_protocol : target.runtime_protocol;
        const marker = owner(context.configDir, original, context.io, true);
        if (!marker || marker.protocol_version <= protocol && compareVersions(marker.mod_version, version) <= 0 &&
            target.editor_protocol >= PROTOCOL_VERSION && compareVersions(VERSION, version) <= 0) return [];
        const spec = { ...original, protocol };
        const bundle = bundledFiles(spec, { root: join(root, 'node_modules/@fbincon/statusline-cli/resources', spec.name), version });
        const requested = original.name === NATIVE.name ? loadNative(context.configDir, undefined, version, context.io)
            : modes.native_timing || modes.live_metrics || automaticRequested(context.configDir);
        return [{ spec, bundle, requested, disabled: !requested || restricted || intents.includes(spec.name) || !atLeast(context.version, spec.minimum) }];
    });
    if (dryRun || !transitions.length) return expected;
    const before = configurationBytes(context.configDir);
    administration(context, false, tracked => {
        assertConfiguration(context.configDir, expected);
        for (const { spec, requested, bundle } of transitions) {
            const result = integrate(tracked, spec, requested, !requested, bundle);
            if (!['installed','plugin-disabled','disabled','suspended'].includes(result.state)) throw new PackageError('integration_failed');
        }
    });
    const after = configurationBytes(context.configDir);
    for (const name of Object.keys(before)) {
        const a = before[name]!, b = after[name]!;
        if (a === null ? b === null : b !== null && a.equals(b)) continue;
        // Official plugin refresh may rewrite JSON formatting. No configuration value may change.
        if (!['settings.json', BINDING_FILE].includes(name) || a === null || b === null) throw new PackageError('conflict');
        const left = readJson(decodeUtf8(a)) as Record<string, any>, right = readJson(decodeUtf8(b)) as Record<string, any>;
        if (name === 'settings.json') {
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
