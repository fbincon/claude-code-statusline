import { integer, isLosslessNumber, pythonFloat } from '../json.js';
import { object } from '../config/validation.js';
import { orderedRecord } from '../ordered-record.js';
export { object };
export type Data = Record<string, unknown>;
export function dictionary<T = unknown>(entries: Iterable<readonly [
    string,
    T
]> = []): Record<string, T> {
    const value = orderedRecord(entries);
    Object.setPrototypeOf(value, null);
    return value as Record<string, T>;
}
export function own<T>(data: Record<string, T>, key: unknown): T | undefined { return typeof key === 'string' && Object.hasOwn(data, key) ? data[key] : undefined; }
export function int(value: unknown, strict = true): bigint | null {
    if (!strict && typeof value === 'boolean')
        return value ? 1n : 0n;
    try {
        return integer(value);
    }
    catch {
        return null;
    }
}
export function numeric(value: unknown): number | null {
    if (isLosslessNumber(value))
        return Number(value.value);
    if (typeof value === 'number' || typeof value === 'bigint')
        return Number(value);
    return null;
}
export function truth(value: unknown): boolean {
    if (value == null || value === false)
        return false;
    if (typeof value === 'string' || Array.isArray(value))
        return value.length > 0;
    const number = numeric(value);
    if (number !== null)
        return number !== 0;
    return object(value) ? Object.keys(value).length > 0 : Boolean(value);
}
export function string(value: unknown): string {
    if (value === null || value === undefined)
        return 'None';
    if (value === true)
        return 'True';
    if (value === false)
        return 'False';
    if (typeof value === 'string')
        return value;
    const number = numeric(value);
    if (number !== null) {
        const exact = int(value);
        if (exact !== null)
            return String(exact);
        return Number.isFinite(number) ? pythonFloat(number) : Number.isNaN(number) ? 'nan' : number < 0 ? '-inf' : 'inf';
    }
    return repr(value);
}
function repr(value: unknown): string {
    if (typeof value === 'string') {
        const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
        return quote + value.replaceAll('\\', '\\\\').replaceAll(quote, '\\' + quote).replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t') + quote;
    }
    if (Array.isArray(value))
        return '[' + value.map(repr).join(', ') + ']';
    if (object(value))
        return '{' + Object.entries(value).map(([key, item]) => repr(key) + ': ' + repr(item)).join(', ') + '}';
    return string(value);
}
export function maxInt(values: Iterable<bigint>, fallback = 0n): bigint {
    let found = false, result = fallback;
    for (const value of values) {
        if (!found || value > result)
            result = value;
        found = true;
    }
    return result;
}
export function compareInt(a: bigint, b: bigint): number { return a < b ? -1 : a > b ? 1 : 0; }
export function maxNumber(a: unknown, b: unknown): unknown { return numeric(a)! >= numeric(b)! ? a : b; }
export function minNumber(a: unknown, b: unknown): unknown { return numeric(a)! <= numeric(b)! ? a : b; }
export function compareNumbers(a: unknown, b: unknown): number {
    const left = int(a), right = int(b);
    if (left !== null && right !== null)
        return compareInt(left, right);
    function integerFloat(whole: bigint, value: number | null): number {
        if (value === null || Number.isNaN(value))
            return NaN;
        if (!Number.isFinite(value))
            return value > 0 ? -1 : 1;
        const floor = Math.floor(value), order = compareInt(whole, BigInt(floor));
        return order || (value === floor ? 0 : -1);
    }
    if (left !== null)
        return integerFloat(left, numeric(b));
    if (right !== null)
        return -integerFloat(right, numeric(a));
    const x = numeric(a), y = numeric(b);
    return x === null || y === null ? NaN : x < y ? -1 : x > y ? 1 : x === y ? 0 : NaN;
}
export function multiplyInteger(value: unknown, factor: bigint): bigint | number {
    const whole = int(value);
    return whole === null ? numeric(value)! * Number(factor) : whole * factor;
}
