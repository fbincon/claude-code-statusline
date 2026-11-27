import { join } from 'node:path';
import { EDITOR_SHORTCUTS_FILENAME, EDITOR_SHORTCUTS_SCHEMA_VERSION, type EditorShortcutsResult } from '@fbincon/statusline-core/contracts/ui';
import { isBindingMap, readShortcutBindings, shortcutConflict } from '@fbincon/statusline-core/editor/shortcut-map';
import { isSchema } from '@fbincon/statusline-core/config/display';
import { ConfigError, fail, object } from '@fbincon/statusline-core/config/validation';
import { text, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import { integer } from '@fbincon/statusline-core/json';
import { readJson } from '@fbincon/statusline-core/json-read';
import { FileLockBusyError, readWithExistingLock } from '@fbincon/statusline-platform/files';
import { artifact, configurationLockPath, decodeUtf8, errorDetail, jsonBytes, type Storage } from './storage.js';
import { safeTarget } from '../integration/paths.js';
import { commit, recoverFiles } from '../recovery/files.js';
import { assertClear, hash, pending, readJournal, type FileEntry } from '../recovery/journal.js';

const version = EDITOR_SHORTCUTS_SCHEMA_VERSION;

function decode(raw: Buffer | null): Pick<EditorShortcutsResult, 'bindings' | 'warning'> {
    if (raw === null) return { bindings: {}, warning: null };
    let data: unknown;
    try {
        data = readJson(decodeUtf8(raw), { duplicate() { throw new Error('Duplicate shortcut preference field'); } });
    } catch { /* Invalid bytes remain available for explicit repair. */ }
    if (object(data)) {
        try {
            if (integer(data.schema_version) > BigInt(version)) return { bindings: {}, warning: text('shortcuts.future') };
        } catch { /* The user can explicitly restore an invalid schema. */ }
        if (Object.keys(data).length === 2 && isSchema(data.schema_version, version)) {
            const decoded = readShortcutBindings(data.bindings);
            if (decoded) return decoded;
        }
    }
    return { bindings: {}, warning: text('shortcuts.invalid') };
}

export function readEditorShortcuts(directory: string, io: Storage): EditorShortcutsResult {
    const path = join(directory, EDITOR_SHORTCUTS_FILENAME);
    const lock = configurationLockPath(directory);
    const failed = (detail: string | LocalizedText): EditorShortcutsResult => ({
        schema_version: version, revision: null, bindings: {}, warning: text('shortcuts.read-failed', { detail }),
    });
    try {
        safeTarget(directory, lock);
        safeTarget(directory, path);
        return readWithExistingLock(lock, locked => {
            let committed: FileEntry | undefined;
            try {
                for (const file of pending(directory)) {
                    const journal = readJournal(directory, file);
                    if (journal.kind !== 'files') continue;
                    const entry = journal.entries.find(item => item.path === EDITOR_SHORTCUTS_FILENAME);
                    if (!entry) continue;
                    if (!locked || committed || journal.phase !== 'committed' || journal.progress !== journal.entries.length)
                        return failed(text('shortcuts.read-recovery'));
                    // Recovery verifies every target and before-image without clearing the journal.
                    recoverFiles(journal, io, true);
                    committed = entry;
                }
            } catch { return failed(text('shortcuts.read-recovery')); }
            const raw = io.read(path), revision = hash(raw);
            if (committed && committed.after !== revision) return failed(text('shortcuts.read-recovery'));
            return { schema_version: version, revision, ...decode(raw) };
        });
    } catch (error) {
        return failed(error instanceof FileLockBusyError ? text('shortcuts.read-busy') : errorDetail(error));
    }
}

export function setEditorShortcuts(directory: string, bindings: unknown, expected: unknown, io: Storage): EditorShortcutsResult {
    if (!isBindingMap(bindings) || shortcutConflict(bindings) || !(expected === null || typeof expected === 'string' && expected.length === 64 && /^[a-f0-9]{64}$/u.test(expected)))
        throw new ConfigError('shortcuts.invalid-request', {}, 'invalid_request');
    const path = join(directory, EDITOR_SHORTCUTS_FILENAME);
    try {
        return io.lock(directory, () => {
            assertClear(directory);
            safeTarget(directory, path);
            const raw = io.read(path), revision = hash(raw), current = decode(raw);
            if (current.warning?.key === 'shortcuts.future') fail('shortcuts.future');
            if (expected !== revision) throw new ConfigError('shortcuts.changed', {}, 'configuration_conflict');
            const entries = Object.entries(bindings).sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1);
            const result = { schema_version: version, bindings: Object.fromEntries(entries), warning: null };
            if (entries.length && current.warning === null && entries.length === Object.keys(current.bindings).length && entries.every(([id, key]) => current.bindings[id] === key))
                return { ...result, revision };
            const desired = entries.length ? jsonBytes({ schema_version: version, bindings: result.bindings }) : null;
            if (desired !== null || raw !== null) commit(directory, 'editor-shortcuts', [{ ...artifact(path, raw), desired }], io, raw !== null);
            return { ...result, revision: hash(desired) };
        });
    } catch (error) {
        if (error instanceof ConfigError) throw error;
        throw new ConfigError('shortcuts.write-failed', { detail: errorDetail(error) }, 'io_error');
    }
}
