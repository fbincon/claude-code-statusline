/** Refresh owned Mod bytes with the newer ownership reader before an older installer runs. */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { compatibility } from '@fbincon/statusline-core/management/compatibility';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readJson } from '@fbincon/statusline-core/json-read';
import { NATIVE, type InstallContext } from '../integration/model.js';
import { owner } from '../integration/mod-ownership.js';
import { bundledFiles } from '../integration/resources.js';
import { integrate } from '../integration/mods.js';
import { BINDING_FILE } from '../integration/ownership.js';
import { administration } from '../recovery/service.js';
import { refreshIntents } from '../recovery/journal.js';
import { loadNative } from '../config/backend-preferences.js';
import { readSettings } from '../config/storage.js';
import { assertConfiguration, configurationBytes, configurationHashes, type ConfigHashes } from './configuration.js';

export function prepareModDowngrade(context: InstallContext, root: string, version: string, expected: ConfigHashes, dryRun: boolean): ConfigHashes {
    assertConfiguration(context.configDir, expected);
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (manifest.version !== version || manifest.name !== PACKAGE_NAME) throw new PackageError('identity');
    const protocol = compatibility(manifest.statuslineCompatibility, version).editor_protocol;
    if (protocol >= PROTOCOL_VERSION) return expected;
    const marker = owner(context.configDir, NATIVE, context.io, true);
    if (!marker || marker.protocol_version <= protocol) return expected;
    const spec = { ...NATIVE, protocol };
    const bundle = bundledFiles(spec, { root: join(root, 'node_modules/@fbincon/statusline-cli/resources', NATIVE.name), version });
    if (dryRun) return expected;
    const before = configurationBytes(context.configDir);
    const requested = loadNative(context.configDir, undefined, version, context.io);
    const restricted = readSettings(context.configDir, context.io)[0].disableAllHooks === true;
    const disabledIntent = refreshIntents(context.configDir).includes(NATIVE.name);
    administration(context, false, tracked => {
        assertConfiguration(context.configDir, expected);
        const result = integrate(tracked, spec, requested, !requested, bundle);
        if (!['installed','plugin-disabled','disabled'].includes(result.state)) throw new PackageError('integration_failed');
    });
    const after = configurationBytes(context.configDir);
    for (const name of Object.keys(before)) {
        const a = before[name]!, b = after[name]!;
        if (a === null ? b === null : b !== null && a.equals(b)) continue;
        // Official plugin refresh may rewrite JSON formatting. No configuration value may change.
        if (!['settings.json', BINDING_FILE].includes(name) || a === null || b === null) throw new PackageError('conflict');
        const left = readJson(decodeUtf8(a)) as Record<string, any>, right = readJson(decodeUtf8(b)) as Record<string, any>;
        if (name === 'settings.json' && (!requested || restricted || disabledIntent)) {
            if (right.enabledPlugins?.[NATIVE.plugin] === true) throw new PackageError('conflict');
            if (left.enabledPlugins) delete left.enabledPlugins[NATIVE.plugin];
            if (right.enabledPlugins) delete right.enabledPlugins[NATIVE.plugin];
            for (const value of [left, right]) if (value.enabledPlugins && !Object.keys(value.enabledPlugins).length) delete value.enabledPlugins;
        }
        if (name === BINDING_FILE && disabledIntent) for (const value of [left, right]) {
            value.refresh_disabled = value.refresh_disabled?.filter((name: string) => name !== NATIVE.name);
            if (!value.refresh_disabled?.length) delete value.refresh_disabled;
        }
        if (!equalSettings(left, right)) throw new PackageError('conflict');
    }
    return configurationHashes(after);
}
