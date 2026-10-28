import { resolve } from 'node:path';
import { readDiagnosticFile, MAX_DIAGNOSTIC_BYTES } from '@fbincon/statusline-platform/diagnostic-files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readJson } from '@fbincon/statusline-core/json-read';
import { ConfigError, object } from '@fbincon/statusline-core/config/validation';
export function parseDiagnosticInput(raw: string): Record<string, unknown> {
    if (Buffer.byteLength(raw) > MAX_DIAGNOSTIC_BYTES)
        throw new ConfigError('diagnose.error.size', {}, 'invalid_request');
    let input: unknown;
    try {
        input = readJson(raw.replace(/^\uFEFF/u, ''), { duplicate() { throw new Error('Duplicate key'); }, constant() { throw new Error('Nonfinite number'); } });
    }
    catch {
        throw new ConfigError('diagnose.error.json', {}, 'invalid_json');
    }
    if (!object(input))
        throw new ConfigError('diagnose.error.input', {}, 'invalid_request');
    return input;
}
export function diagnosticInputFile(path: unknown): {
    path: string;
    input: Record<string, unknown>;
} {
    if (typeof path !== 'string' || !path.trim() || path.length > 4096 || /[\p{Cc}\p{Cs}]/u.test(path))
        throw new ConfigError('diagnose.error.file', { value: typeof path === 'string' ? path : '' }, 'invalid_request');
    const absolute = resolve(path);
    let raw: string;
    try {
        const bytes = readDiagnosticFile(absolute, true);
        if (bytes === null)
            throw new Error('Missing file');
        raw = decodeUtf8(bytes);
    }
    catch {
        throw new ConfigError('diagnose.error.read', {}, 'io_error');
    }
    return { path: absolute, input: parseDiagnosticInput(raw) };
}
