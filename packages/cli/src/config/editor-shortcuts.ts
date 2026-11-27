import { join } from 'node:path';
import { EDITOR_SHORTCUTS_FILENAME, EDITOR_SHORTCUTS_SCHEMA_VERSION, type EditorShortcutsResult } from '@fbincon/statusline-core/contracts/ui';
import { isBindingMap, shortcutConflict, type ShortcutBindings } from '@fbincon/statusline-core/editor/shortcut-map';
import { isSchema } from '@fbincon/statusline-core/config/display';
import { ConfigError, fail, object } from '@fbincon/statusline-core/config/validation';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { integer } from '@fbincon/statusline-core/json';
import { readJson } from '@fbincon/statusline-core/json-read';
import { artifact, decodeUtf8, errorDetail, jsonBytes, type Storage } from './storage.js';
import { safeTarget } from '../integration/paths.js';
import { commit } from '../recovery/files.js';
import { assertClear, hash } from '../recovery/journal.js';

const version = EDITOR_SHORTCUTS_SCHEMA_VERSION;

function decode(raw: Buffer | null): { bindings: ShortcutBindings | null; future: boolean } {
    if (raw === null) return { bindings: {}, future: false };
    let data: unknown;
    try {
        data = readJson(decodeUtf8(raw), { duplicate() { throw new Error('Duplicate shortcut preference field'); } });
    } catch {
        return { bindings: null, future: false };
    }
    if (object(data)) {
        try {
            if (integer(data.schema_version) > BigInt(version)) return { bindings: null, future: true };
        } catch { /* The user can explicitly restore an invalid schema. */ }
        if (Object.keys(data).length === 2 && isSchema(data.schema_version, version) && isBindingMap(data.bindings) && !shortcutConflict(data.bindings))
            return { bindings: data.bindings, future: false };
    }
    return { bindings: null, future: false };
}

export function readEditorShortcuts(directory: string, io: Storage): EditorShortcutsResult {
    const path = join(directory, EDITOR_SHORTCUTS_FILENAME);
    try {
        safeTarget(directory, path);
        const raw = io.read(path), { bindings, future } = decode(raw);
        return {
            schema_version: version, revision: hash(raw), bindings: bindings ?? {},
            warning: bindings ? null : future ? text('shortcuts.future') : text('shortcuts.invalid'),
        };
    } catch (error) {
        return { schema_version: version, revision: null, bindings: {}, warning: text('shortcuts.read-failed', { detail: errorDetail(error) }) };
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
            if (current.future) fail('shortcuts.future');
            if (expected !== revision) throw new ConfigError('shortcuts.changed', {}, 'configuration_conflict');
            const entries = Object.entries(bindings).sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1);
            const result = { schema_version: version, bindings: Object.fromEntries(entries), warning: null };
            if (entries.length && current.bindings && entries.length === Object.keys(current.bindings).length && entries.every(([id, key]) => current.bindings![id as keyof ShortcutBindings] === key))
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
