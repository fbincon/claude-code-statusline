import { LosslessNumber } from 'lossless-json';

export { LosslessNumber };
// Do not use the dependency's marker-property guard at an untrusted boundary.
export function isLosslessNumber(value: unknown): value is LosslessNumber { return value instanceof LosslessNumber; }
export type Json = null | boolean | string | number | bigint | LosslessNumber | Json[] | { [key: string]: Json };

/** Parse before validation without rounding integers or losing their numeric kind. */
export function decode(text: string): unknown {
  const raw = text.replace(/^\uFEFF/, '');
  const parse = JSON.parse as (text: string, reviver: (key: string, value: unknown, context: { source?: string }) => unknown) => unknown;
  const value = parse(raw, (_key, item, context) => {
    if (typeof item !== 'number') return item;
    if (!context.source) throw new Error('JSON source lexemes are unavailable');
    return new LosslessNumber(context.source);
  });
  // The dependency parser suppresses equal duplicates. Scan keys after the
  // native parser has checked grammar, decoding escaped keys before comparison.
  const stack: { object: boolean; key: boolean; seen: Set<string> }[] = [];
  for (const match of raw.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]/gu)) {
    const token = match[0], top = stack.at(-1);
    if (token === '{' || token === '[') stack.push({ object: token === '{', key: true, seen: new Set() });
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && top?.object) top.key = true;
    else if (token.startsWith('"') && top?.object && top.key) {
      const key = JSON.parse(token) as string;
      if (top.seen.has(key)) throw new SyntaxError(`Duplicate JSON key: ${key}`);
      top.seen.add(key); top.key = false;
    }
  }
  return value;
}

export function integer(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (isLosslessNumber(value) && /^-?\d+$/.test(value.value)) return BigInt(value.value);
  throw new TypeError('Expected an exact JSON integer');
}

export function safeInteger(value: unknown, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): number {
  const result = integer(value);
  if (result < BigInt(minimum) || result > BigInt(maximum)) throw new RangeError('Integer outside the permitted range');
  return Number(result);
}

export function finiteNumber(value: unknown): number {
  const result = isLosslessNumber(value) ? Number(value.value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(result)) throw new TypeError('Expected a finite JSON number');
  return result;
}

/** Numeric disk literals remain literals, including integers larger than 2^53. */
export function encode(value: unknown): string {
  const ancestors = new Set<object>();
  function visit(item: unknown): string {
    if (isLosslessNumber(item)) {
      if (!/^-?\d+$/.test(item.value) && !Number.isFinite(Number(item.value))) throw new TypeError('Non-finite JSON number');
      return item.value;
    }
    if (typeof item === 'bigint') return String(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Non-finite JSON number');
      return String(item);
    }
    if (typeof item === 'string' || typeof item === 'boolean' || item === null) return JSON.stringify(item);
    if (typeof item !== 'object' || ancestors.has(item)) throw new TypeError('Unsupported or circular JSON value');
    ancestors.add(item);
    try {
      if (Array.isArray(item)) return '[' + Array.from(item, visit).join(',') + ']';
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new TypeError('Expected a JSON object');
      return '{' + Object.keys(item).map(key => JSON.stringify(key) + ':' + visit((item as Record<string, unknown>)[key])).join(',') + '}';
    } finally { ancestors.delete(item); }
  }
  return visit(value);
}

/** Python repr(float): shortest round trip, exponent threshold and signed zero. */
export function pythonFloat(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError('Non-finite JSON number');
  if (value === 0) return Object.is(value, -0) ? '-0.0' : '0.0';
  const negative = value < 0 ? '-' : '';
  const [mantissa, rawExponent] = Math.abs(value).toExponential().split('e') as [string, string];
  const exponent = Number(rawExponent);
  if (exponent < -4 || exponent >= 16) {
    return negative + mantissa + 'e' + (exponent < 0 ? '-' : '+') + String(Math.abs(exponent)).padStart(2, '0');
  }
  const digits = mantissa.replace('.', ''), point = exponent + 1;
  if (point <= 0) return negative + '0.' + '0'.repeat(-point) + digits;
  if (point >= digits.length) return negative + digits + '0'.repeat(point - digits.length) + '.0';
  return negative + digits.slice(0, point) + '.' + digits.slice(point);
}

export function scalarCompare(a: string, b: string): number {
  const x = [...a], y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const difference = x[i]!.codePointAt(0)! - y[i]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return x.length - y.length;
}

function quoted(value: string): string {
  // Python's ensure_ascii=False output cannot be encoded as UTF-8 with lone
  // surrogates. Do not silently hash escaped/replacement bytes in its place.
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) throw new TypeError('Unpaired Unicode surrogate');
  }
  return JSON.stringify(value);
}

/** json.dumps(ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False). */
export function canonical(value: unknown): string {
  const ancestors = new Set<object>();
  function visit(item: unknown): string {
    if (isLosslessNumber(item)) return /^-?\d+$/.test(item.value) ? BigInt(item.value).toString() : pythonFloat(Number(item.value));
    if (typeof item === 'bigint') return String(item);
    if (typeof item === 'string') return quoted(item);
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (Number.isSafeInteger(item) && !Object.is(item, -0)) return String(item);
      return pythonFloat(item);
    }
    if (typeof item !== 'object') throw new TypeError('Unsupported canonical value');
    if (ancestors.has(item)) throw new TypeError('Circular JSON value');
    ancestors.add(item);
    try {
      if (Array.isArray(item)) return '[' + Array.from(item, visit).join(',') + ']';
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new TypeError('Expected a JSON object');
      return '{' + Object.keys(item).sort(scalarCompare).map(key => quoted(key) + ':' + visit((item as Record<string, unknown>)[key])).join(',') + '}';
    } finally { ancestors.delete(item); }
  }
  return visit(value);
}
