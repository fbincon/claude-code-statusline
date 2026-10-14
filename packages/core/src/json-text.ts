import { isLosslessNumber, pythonFloat, scalarCompare } from './json.js';

export interface JsonTextOptions { indent?: number; ensureAscii?: boolean; sortKeys?: boolean; compact?: boolean }

/** Python-compatible JSON text for persisted snapshots and generated resources. */
export function pythonJson(value: unknown, options: JsonTextOptions = {}): string {
  const { indent, ensureAscii = true, sortKeys = false, compact = false } = options;
  if (indent !== undefined && (!Number.isSafeInteger(indent) || indent < 0)) throw new TypeError('Invalid JSON indent');
  const ancestors = new Set<object>();
  function quote(value: string): string {
    if (!ensureAscii && /\p{Cs}/u.test(value)) throw new TypeError('Unpaired Unicode surrogate');
    const text = JSON.stringify(value);
    return ensureAscii ? text.replace(/[\u007f-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0')) : text;
  }
  function visit(item: unknown, depth: number): string {
    if (item === null || typeof item === 'boolean') return String(item);
    if (typeof item === 'string') return quote(item);
    if (typeof item === 'bigint') return String(item);
    if (isLosslessNumber(item)) return /^-?\d+$/u.test(item.value) ? String(BigInt(item.value)) : pythonFloat(Number(item.value));
    if (typeof item === 'number') return Number.isSafeInteger(item) && !Object.is(item, -0) ? String(item) : pythonFloat(item);
    if (!item || typeof item !== 'object' || ancestors.has(item)) throw new TypeError('Unsupported or circular JSON value');
    ancestors.add(item);
    try {
      const array = Array.isArray(item);
      if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new TypeError('Expected a JSON object');
      const colon = compact ? ':' : ': ';
      const entries = array ? Array.from(item, child => visit(child, depth + 1)) :
        (sortKeys ? Object.keys(item).sort(scalarCompare) : Object.keys(item)).map(key => quote(key) + colon + visit((item as Record<string, unknown>)[key], depth + 1));
      const [open, close] = array ? ['[', ']'] : ['{', '}'];
      if (!entries.length) return open! + close;
      if (indent !== undefined) {
        const padding = ' '.repeat(indent * depth), childPadding = padding + ' '.repeat(indent);
        return open + '\n' + childPadding + entries.join(',\n' + childPadding) + '\n' + padding + close;
      }
      return open + entries.join(compact ? ',' : ', ') + close;
    } finally { ancestors.delete(item); }
  }
  return visit(value, 0);
}
