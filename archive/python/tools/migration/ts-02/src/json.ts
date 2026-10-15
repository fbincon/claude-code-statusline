import { createHash } from 'node:crypto';
import { stringify, LosslessNumber, isLosslessNumber } from 'lossless-json';

// Retain numeric spelling until the field's runtime validator chooses its type.
export function decode(raw: string): unknown {
  raw = raw.replace(/^\uFEFF/, '');
  const parse = JSON.parse as (text: string, reviver: (key: string, value: unknown, context: { source?: string }) => unknown) => unknown;
  const value = parse(raw, (_key, value, context) => {
    if (typeof value !== 'number') return value;
    if (!context.source) throw new Error('JSON source lexemes unavailable');
    return new LosslessNumber(context.source);
  });
  // lossless-json 4.3.1 suppresses equal duplicate keys even with a callback.
  // JSON.parse supplies original numeric lexemes and safe own __proto__ keys;
  // this scan checks keys only, after the native parser validated the grammar.
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
  if (!isLosslessNumber(value) || !/^-?\d+$/.test(value.value)) throw new TypeError('Expected JSON integer');
  return BigInt(value.value);
}
export function encode(value: unknown): string {
  const result = stringify(value);
  if (result === undefined) throw new TypeError('Not JSON');
  return result;
}
function scalarCompare(a: string, b: string): number {
  const x = [...a].map(c => c.codePointAt(0)!);
  const y = [...b].map(c => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
}
export function canonical(value: unknown): string {
  if (isLosslessNumber(value)) {
    if (/^-?\d+$/.test(value.value)) return BigInt(value.value).toString();
    // Config revisions in this probe are integer/string/bool/null. Do not
    // silently claim Python float formatting parity (1.0, exponents, -0.0).
    throw new TypeError('Float canonicalization requires TS-03 parity work');
  }
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object') {
    return '{' + Object.keys(value!).sort(scalarCompare).map(key =>
      JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  }
  throw new TypeError('Unsupported canonical value');
}
export function revision(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}
export { LosslessNumber };
