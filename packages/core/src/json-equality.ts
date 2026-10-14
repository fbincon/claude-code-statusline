import { isLosslessNumber } from './json.js';

function numeric(value: unknown): bigint | number | undefined {
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (typeof value === 'bigint' || typeof value === 'number') return value;
  if (isLosslessNumber(value)) return /^-?\d+$/u.test(value.value) ? BigInt(value.value) : Number(value.value);
  return undefined;
}
/** Python dictionary equality for settings; canonical revision types stay strict. */
export function equalSettings(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  const a = numeric(left), b = numeric(right);
  if (a !== undefined || b !== undefined) {
    if (a === undefined || b === undefined) return false;
    if (typeof a === typeof b) return a === b;
    const integer = typeof a === 'bigint' ? a : b as bigint, floating = typeof a === 'number' ? a : b as number;
    return Number.isFinite(floating) && Number.isInteger(floating) && integer === BigInt(floating);
  }
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, i) => equalSettings(value, right[i]));
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const x = left as Record<string, unknown>, y = right as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && equalSettings(x[key], y[key]));
}
