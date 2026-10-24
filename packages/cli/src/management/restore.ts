import { join, dirname } from 'node:path';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { compatibility } from '@fbincon/statusline-core/management/compatibility';
import { readOperation, operationPath } from './store.js';
import { configurationBytes, configurationHashes, assertConfiguration, configurationCompatibility, readSnapshot } from './configuration.js';
import { readRegular, assertClear } from '../recovery/journal.js';
import { commit } from '../recovery/files.js';
import { createStorage, artifact, jsonBytes, readSettings } from '../config/storage.js';
import { validateDisplay, defaultDisplay } from '@fbincon/statusline-core/config/display';
import { validateProfiles, emptyProfiles } from '@fbincon/statusline-core/config/profiles';
import { readJson } from '@fbincon/statusline-core/json-read';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { ConfigurationService } from '../config/service.js';
import { profileRowsSettings } from '../config/profiles.js';
import { previousBinding } from '../integration/ownership.js';
import { detectClaudeVersion } from '@fbincon/statusline-platform/commands';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import type { ManagementOptions } from './arguments.js';
import { confirmPackage } from './first-entry.js';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
export async function restoreConfiguration(flags: ManagementOptions, configDir: string, prefix: string, language: Language, stdout: (value: string) => void, confirm?: () => Promise<boolean>, signal?: AbortSignal): Promise<number> {
    const operation = readOperation(configDir, prefix, flags.restoreConfig), current = configurationBytes(configDir), hashes = configurationHashes(current);
    if (!operation.snapshot || !operation.before)
        throw new PackageError('backup');
    const backup = readSnapshot(configDir, dirname(operationPath(operation)), operation.snapshot);
    const declared = compatibility(operation.beforeCompatibility, operation.before.version);
    if (configurationCompatibility(backup, declared).length)
        throw new PackageError('backup');
    const names = ['claude-statusline.json', 'claude-statusline-profiles.json'];
    const proposed = { ...current, ...Object.fromEntries(names.map(name => [name, backup[name] ?? null])) };
    // Product preferences and execution grants always remain current. The target
    // rollback will recheck all of them before replacing the package.
    const display = backup[names[0]!] ? validateDisplay(readJson(decodeUtf8(backup[names[0]!]!))) : defaultDisplay();
    const profiles = backup[names[1]!] ? validateProfiles(readJson(decodeUtf8(backup[names[1]!]!))) : emptyProfiles();
    const io = createStorage(), binding = previousBinding(configDir, io);
    const changes = names.filter(name => !current[name]?.equals(proposed[name] ?? Buffer.alloc(0)) && (current[name] !== null || proposed[name] !== null)).map(name => ({ ...artifact(join(configDir, name), current[name] ?? null), desired: proposed[name] ?? null }));
    if (binding) {
        const service = new ConfigurationService({ configDir, launch: binding, hostVersion: detectClaudeVersion }, io), [settings, raw] = readSettings(configDir, io);
        const updated = profileRowsSettings(service, settings, display, profiles);
        if (!equalSettings(settings, updated))
            changes.push({ ...artifact(join(configDir, 'settings.json'), raw), desired: jsonBytes(updated) });
    }
    const review = { schema_version: 1, action: 'restore-config', backup_id: operation.id, source_version: operation.before.version, prefix, files: changes.map(change => ({ path: change.path, current: hashes[change.name] ?? null, backup: operation.snapshot![change.name] ?? null })), preserved: ['source_authorization', 'runtime_preferences', 'editor_preferences', 'unrelated_claude_settings'] };
    if (!flags.json)
        stdout(t('management.restore_review', language) + '\n');
    stdout(JSON.stringify(review, null, 2) + '\n');
    if (flags.dryRun)
        return 0;
    if (!flags.yes && !await (confirm?.() ?? confirmPackage(language, stdout, signal)))
        return 0;
    if (signal?.aborted)
        throw new PackageError('interrupted');
    const backupDir = io.lock(configDir, () => {
        assertClear(configDir);
        assertConfiguration(configDir, hashes);
        // Verify the immutable source once more while holding the revision lock.
        readSnapshot(configDir, dirname(operationPath(operation)), operation.snapshot!);
        return commit(configDir, 'package-config-restore', changes, io);
    });
    stdout(t('management.restored', language, { backup: backupDir ?? '-' }) + '\n');
    return 0;
}
