import { join } from 'node:path';
import { DEFAULT_RUNTIME, FEATURE_FILENAME, NATIVE_FILENAME, RUNTIME_FILENAME, enabledByDefault, parseFeature, parseNative, parseRuntime, type RuntimePreferences } from '@fbincon/statusline-core/config/backend-preferences';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { createStorage, decodeUtf8, jsonBytes, errorDetail, type Storage } from './storage.js';
function optional(path: string, io: Storage): Buffer | null {
    try { return io.read(path); }
    catch (exc) { throw new ConfigError('errors.storage.cannot_read_2', { path, exc: errorDetail(exc) }); }
}
export function loadRuntime(directory: string, io: Storage = createStorage(), liveMetrics?: boolean, nativeTiming?: boolean): RuntimePreferences {
    if (liveMetrics !== undefined)
        return { schema_version: 2, native_timing: nativeTiming ?? liveMetrics, live_metrics: liveMetrics };
    const raw = optional(join(directory, RUNTIME_FILENAME), io);
    let base: RuntimePreferences;
    try { base = raw === null ? { ...DEFAULT_RUNTIME } : parseRuntime(decodeUtf8(raw)); }
    catch (error) {
        if (error instanceof ConfigError) throw error;
        throw new ConfigError('errors.runtime.invalid', { FILENAME: RUNTIME_FILENAME, error: errorDetail(error) });
    }
    return { ...base, native_timing: nativeTiming ?? base.native_timing };
}
export function loadNative(directory: string, explicit?: boolean, version = '2.0.0', io: Storage = createStorage()): boolean {
    if (explicit !== undefined)
        return explicit;
    const raw = optional(join(directory, NATIVE_FILENAME), io);
    try { return raw === null ? enabledByDefault(version) : parseNative(decodeUtf8(raw)); }
    catch (exc) {
        if (exc instanceof ConfigError) throw exc;
        throw new ConfigError('errors.native.invalid', { FILENAME: NATIVE_FILENAME, exc: errorDetail(exc) });
    }
}
export function loadFeature(directory: string, version = '2.0.0', io: Storage = createStorage()): boolean {
    const path = join(directory, FEATURE_FILENAME);
    let raw: Buffer | null;
    try {
        raw = io.read(path);
    }
    catch (exc) {
        throw new ConfigError('errors.features.cannot_read', { path, exc: errorDetail(exc) });
    }
    if (raw === null)
        return enabledByDefault(version);
    let source: string;
    try {
        source = decodeUtf8(raw);
    }
    catch (exc) {
        throw new ConfigError('errors.features.invalid_json_in', { label: path, exc: errorDetail(exc) });
    }
    return parseFeature(source, path);
}
export function writeFeature(directory: string, enabled: boolean, io: Storage = createStorage()): string {
    const path = join(directory, FEATURE_FILENAME);
    try {
        io.write(path, jsonBytes({ schema_version: 1, experimental_slash_tui: enabled }));
    }
    catch (exc) {
        throw new ConfigError('errors.features.cannot_write', { path, exc: errorDetail(exc) });
    }
    return path;
}
