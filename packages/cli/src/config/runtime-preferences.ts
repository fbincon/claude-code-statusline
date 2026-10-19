/** Read-only runtime preferences must not import display/editor storage. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_RUNTIME, RUNTIME_FILENAME, parseRuntime, type RuntimePreferences } from '@fbincon/statusline-core/config/backend-preferences';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { errorDescription } from '@fbincon/statusline-platform/errors';
import type { Storage } from './storage.js';

const readonlyStorage: Pick<Storage, 'read'> = {
    read(path) {
        try { return readFileSync(path); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
        }
    },
};

export function loadRuntime(directory: string, io: Pick<Storage, 'read'> = readonlyStorage, liveMetrics?: boolean, nativeTiming?: boolean): RuntimePreferences {
    if (liveMetrics !== undefined) return { schema_version: 2, native_timing: nativeTiming ?? liveMetrics, live_metrics: liveMetrics };
    const path = join(directory, RUNTIME_FILENAME);
    let raw: Buffer | null;
    try { raw = io.read(path); }
    catch (error) { throw new ConfigError('errors.storage.cannot_read_2', { path, exc: errorDescription(error) }); }
    let base: RuntimePreferences;
    try { base = raw === null ? { ...DEFAULT_RUNTIME } : parseRuntime(decodeUtf8(raw)); }
    catch (error) {
        if (error instanceof ConfigError) throw error;
        throw new ConfigError('errors.runtime.invalid', { FILENAME: RUNTIME_FILENAME, error: errorDescription(error) });
    }
    return { ...base, native_timing: nativeTiming ?? base.native_timing };
}
