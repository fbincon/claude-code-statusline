import { readJson } from '../json-read.js';
import { integer, isLosslessNumber, scalarCompare } from '../json.js';
import { isSchema } from './display.js';
import { ConfigError, fail, object } from './validation.js';
import { editorsEnabledByDefault } from '../release.js';
export const RUNTIME_FILENAME = 'claude-statusline-runtime.json';
export const NATIVE_FILENAME = 'claude-statusline-native.json';
export const FEATURE_FILENAME = 'claude-statusline-features.json';
export interface RuntimePreferences {
    schema_version: 2;
    native_timing: boolean;
    live_metrics: boolean;
}
export const DEFAULT_RUNTIME: RuntimePreferences = { schema_version: 2, native_timing: false, live_metrics: false };
export const enabledByDefault = editorsEnabledByDefault;
function detail(error: unknown): unknown { return error instanceof ConfigError ? error : error instanceof Error ? error.message : String(error); }
export function parseRuntime(raw: string): RuntimePreferences {
    try {
        const value = readJson(raw, { duplicate() { return fail('errors.runtime.duplicate_runtime_preference_field'); } });
        if (!object(value))
            fail('errors.runtime.expected_runtime_preference_schema_1_or_2');
        try {
            integer(value.schema_version);
        }
        catch {
            fail('errors.runtime.expected_runtime_preference_schema_1_or_2');
        }
        if (isSchema(value.schema_version, 1) && Object.keys(value).length === 2 && Object.hasOwn(value, 'live_metrics')) {
            if (typeof value.live_metrics !== 'boolean')
                fail('errors.runtime.live_metrics_must_be_a_boolean');
            return { schema_version: 2, native_timing: value.live_metrics, live_metrics: value.live_metrics };
        }
        if (!isSchema(value.schema_version, 2) || Object.keys(value).length !== 3 || !Object.hasOwn(value, 'native_timing') || !Object.hasOwn(value, 'live_metrics'))
            fail('errors.runtime.expected_schema_version_2_native_timing_and');
        if (typeof value.native_timing !== 'boolean' || typeof value.live_metrics !== 'boolean')
            fail('errors.runtime.runtime_preferences_must_be_booleans');
        return { schema_version: 2, native_timing: value.native_timing, live_metrics: value.live_metrics };
    }
    catch (error) {
        return fail('errors.runtime.invalid', { FILENAME: RUNTIME_FILENAME, error: detail(error) });
    }
}
export function parseNative(raw: string): boolean {
    try {
        const value = readJson(raw, { duplicate() { return fail('errors.native.duplicate_native_preference_field'); } });
        if (!object(value) || Object.keys(value).length !== 2 || !isSchema(value.schema_version, 1) || typeof value.native_editor !== 'boolean')
            fail('errors.native.expected_schema_version_1_and_a_native');
        return value.native_editor;
    }
    catch (error) {
        return fail('errors.native.invalid', { FILENAME: NATIVE_FILENAME, exc: detail(error) });
    }
}
export function parseFeature(raw: string, label = FEATURE_FILENAME): boolean {
    let value: unknown;
    try {
        value = readJson(raw, { duplicate(field) { return fail('errors.features.duplicate_field', { field }); } });
    }
    catch (error) {
        return fail('errors.features.invalid_json_in', { label, exc: detail(error) });
    }
    if (!object(value))
        fail('errors.features.must_contain_a_json_object', { label });
    const expected = ['schema_version', 'experimental_slash_tui'];
    const missing = expected.filter(key => !Object.hasOwn(value, key)).sort(scalarCompare), unknown = Object.keys(value).filter(key => !expected.includes(key)).sort(scalarCompare);
    if (missing.length || unknown.length)
        fail('errors.features.invalid_feature_configuration_in', { label, value1: [...(missing.length ? ['missing fields: ' + missing.join(', ')] : []), ...(unknown.length ? ['unknown fields: ' + unknown.join(', ')] : [])].join('; ') });
    if (!isSchema(value.schema_version, 1)) {
        const schema = value.schema_version;
        const repr = schema === true ? 'True' : schema === false ? 'False' : schema === null ? 'None' : typeof schema === 'string' ? "'" + schema.replaceAll("'", "\\'") + "'" : isLosslessNumber(schema) ? schema.value : String(schema);
        fail('errors.features.unsupported_feature_configuration_schema_in', { label, schema: repr });
    }
    if (typeof value.experimental_slash_tui !== 'boolean')
        fail('errors.features.experimental_slash_tui_in_must_be_a', { label });
    return value.experimental_slash_tui;
}
