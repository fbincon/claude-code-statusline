import { join } from 'node:path';
import { integer } from '@fbincon/statusline-core/json';
import { readJson } from '@fbincon/statusline-core/json-read';
import { isSchema } from '@fbincon/statusline-core/config/display';
import { ConfigError, object, fail } from '@fbincon/statusline-core/config/validation';
import { resolveLanguage, type Language } from '@fbincon/statusline-core/i18n/registry';
import { text, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import { artifact, createStorage, decodeUtf8, errorDetail, jsonBytes, type Storage } from './storage.js';
import { commit } from '../recovery/files.js';
import { assertClear } from '../recovery/journal.js';
export const UI_FILENAME = 'statusline-ui.json';
export interface Preferences {
    schema_version: 1;
    ui_language: Language;
    warning: LocalizedText | null;
}
function decode(raw: Buffer): unknown {
    return readJson(decodeUtf8(raw), { duplicate() { throw new Error('duplicate preference key'); }, constant(value) { throw new Error(value); } });
}
function valid(data: unknown): data is {
    schema_version: unknown;
    ui_language: string;
} {
    return object(data) && Object.keys(data).length === 2 && isSchema(data.schema_version, 1) && typeof data.ui_language === 'string' && resolveLanguage(data.ui_language) !== null;
}
export function readPreferences(directory: string, io: Storage = createStorage()): Preferences {
    const path = join(directory, UI_FILENAME), base = { schema_version: 1 as const, ui_language: 'en' as const };
    let raw: Buffer | null;
    try {
        raw = io.read(path);
    }
    catch (detail) {
        return { ...base, warning: text('preferences.read_failed', { path, detail: errorDetail(detail) }) };
    }
    if (raw === null)
        return { ...base, warning: null };
    try {
        const data = decode(raw);
        if (!valid(data))
            throw new Error('unsupported or invalid preferences');
        return { schema_version: 1, ui_language: resolveLanguage(data.ui_language)!, warning: null };
    }
    catch {
        return { ...base, warning: text('preferences.invalid', { path }) };
    }
}
export function setLanguage(directory: string, language: unknown, io: Storage = createStorage()): Preferences {
    const selected = resolveLanguage(language);
    if (selected === null)
        fail('preferences.unsupported_language', { language });
    const path = join(directory, UI_FILENAME);
    try {
        io.lock(directory, () => {
            assertClear(directory);
            const raw = io.read(path);
            if (raw !== null) {
                let data: unknown = null;
                try {
                    data = decode(raw);
                }
                catch { /* Corrupt preferences are repairable. */ }
                if (object(data)) {
                    let version: bigint | undefined;
                    try {
                        version = integer(data.schema_version);
                    }
                    catch { /* Invalid schema is repairable. */ }
                    if (version !== undefined && version > 1n)
                        fail('preferences.future_schema', { version });
                }
                if (valid(data) && data.ui_language === selected)
                    return;
            }
            try {
                commit(directory, 'ui-language', [{ ...artifact(path, raw), desired: jsonBytes({ schema_version: 1, ui_language: selected }) }], io, raw !== null);
            }
            catch (detail) {
                throw detail;
            }
        });
    }
    catch (detail) {
        if (detail instanceof ConfigError)
            throw detail;
        throw new ConfigError('preferences.write_failed', { path, detail: errorDetail(detail) }, 'io_error');
    }
    return { schema_version: 1, ui_language: selected, warning: null };
}
