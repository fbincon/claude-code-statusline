import { safeInteger, isLosslessNumber, scalarCompare, integer as jsonInteger } from '../json.js';
import { isOrderedRecord, orderedRecord, recordEntries } from '../ordered-record.js';
/** Keep error construction independent of interface-language resources. */
export class ConfigError extends Error {
    constructor(public readonly key: string, public readonly params: Record<string, unknown> = {}, public readonly code = 'invalid_configuration') {
        super(key);
    }
}
export function fail(key: string, params: Record<string, unknown> = {}): never { throw new ConfigError(key, params); }
export function isSchema(value: unknown, version: number): boolean {
    try { return jsonInteger(value) === BigInt(version); } catch { return false; }
}
export function object(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && !isLosslessNumber(value);
}
export function exact(value: unknown, keys: readonly string[], name: string): asserts value is Record<string, unknown> {
    if (!object(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) {
        fail('errors.formatting.must_contain_exactly', { name, value1: [...keys].sort(scalarCompare).join(', ') });
    }
}
export function integer(value: unknown, minimum: number, maximum: number, name: string): number {
    try {
        return safeInteger(value, minimum, maximum);
    }
    catch {
        return fail('errors.formatting.must_be_an_integer_from_through', { name, minimum, maximum });
    }
}
export function nullableInteger(value: unknown, minimum: number, maximum: number, name: string): number | null {
    return value === null ? null : integer(value, minimum, maximum, name);
}
export function safeText(value: unknown, name: string): string | null {
    if (value !== null && (typeof value !== 'string' || [...value].length > 256 || /[\p{Cc}\p{Cs}]/u.test(value))) {
        fail('errors.formatting.must_be_null_or_text_without_control', { name });
    }
    return value as string | null;
}
export function clone<T>(value: T): T {
    if (Array.isArray(value))
        return value.map(clone) as T;
    if (object(value)) {
        const entries = recordEntries(value).map(([key, item]) => [key, clone(item)] as const);
        return (isOrderedRecord(value) ? orderedRecord(entries) : Object.fromEntries(entries)) as T;
    }
    return value;
}
export function choice<T extends string>(value: unknown, choices: readonly T[], field: string): T {
    if (typeof value !== 'string' || !choices.includes(value as T))
        fail('errors.display.must_be_one_of', { field, allowed: choices.join(', ') });
    return value as T;
}
