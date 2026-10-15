import { LosslessNumber, isLosslessNumber, pythonFloat } from '@fbincon/statusline-core/json';
import { readJson } from '@fbincon/statusline-core/json-read';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { nativeRecord, orderedDataRecord } from '@fbincon/statusline-core/ordered-record';
// Conservative lexical filters: matches inside strings only select the exact
// path unnecessarily. They never allow a lossy number or reordered key through.
const EXACT_NUMBER = /(?:^|[\s:,\[])(?:-?(?:[1-9]\d{15,}|(?:0|[1-9]\d*)[.eE])|-0)/u;
const ORDERED_KEY = /"(?:[0-9]|\\)/u;
function containerEnd(raw: string, start: number): number {
    let depth = 0, quoted = false;
    for (let i = start; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (quoted && code === 92) i++;
        else if (code === 34) quoted = !quoted;
        else if (!quoted) {
            if (code === 123 || code === 91) depth++;
            else if ((code === 125 || code === 93) && --depth === 0) return i + 1;
        }
    }
    return -1;
}
/** A single-pass data reader avoids number placeholders and a second tree walk.
 * Ordinary objects stay native; only integer member names need an order proxy.
 * Malformed/legacy input goes through the compatibility reader for exact errors.
 */
export function readDataJson(raw: string): unknown {
    if (!EXACT_NUMBER.test(raw) && !ORDERED_KEY.test(raw)) {
        try { return JSON.parse(raw); }
        catch { return readJson(raw); }
    }
    let offset = 0;
    const invalid = (): never => { throw new SyntaxError('Invalid data JSON'); };
    const whitespace = () => { for (;;) { const c = raw.charCodeAt(offset); if (c !== 32 && c !== 9 && c !== 10 && c !== 13) return; offset++; } };
    const quoted = (): string => {
        const start = offset++, end = raw.indexOf('"', offset);
        if (end < 0) return invalid();
        const value = raw.slice(offset, end);
        if (!value.includes('\\')) {
            if (/[\x00-\x1f]/u.test(value)) return invalid();
            offset = end + 1;
            return value;
        }
        while (offset < raw.length) {
            const code = raw.charCodeAt(offset++);
            if (code === 34) return JSON.parse(raw.slice(start, offset)) as string;
            if (code === 92) offset++;
        }
        return invalid();
    };
    const value = (largeDictionary = false): unknown => {
        whitespace();
        const code = raw.charCodeAt(offset);
        // A timestamp elsewhere in the cache must not force JS-level parsing of
        // tens of thousands of ordinary counters. The same conservative guards
        // and native grammar validation apply to this independently parsed span.
        if (largeDictionary && raw.length - offset >= 4096 && (code === 123 || code === 91)) {
            const end = containerEnd(raw, offset);
            if (end > offset) {
                const span = raw.slice(offset, end);
                if (!EXACT_NUMBER.test(span) && !ORDERED_KEY.test(span)) {
                    const result: unknown = JSON.parse(span);
                    offset = end;
                    return result;
                }
            }
        }
        if (code === 34) return quoted();
        if (code === 123) {
            offset++; whitespace();
            let result: Record<string, unknown> = {};
            if (raw.charCodeAt(offset) === 125) { offset++; return result; }
            for (;;) {
                if (raw.charCodeAt(offset) !== 34) return invalid();
                const key = quoted(); whitespace();
                if (raw.charCodeAt(offset++) !== 58) return invalid();
                const item = value(key === 'ids');
                // JS reorders array-index names; wrap BEFORE the first insertion.
                const first = key.charCodeAt(0);
                if (first >= 48 && first <= 57 && /^(?:0|[1-9][0-9]{0,9})$/u.test(key) && Number(key) < 4294967295) result = orderedDataRecord(result);
                if (key === '__proto__') Object.defineProperty(result, key, { value: item, enumerable: true, configurable: true, writable: true });
                else result[key] = item;
                whitespace();
                const next = raw.charCodeAt(offset++);
                if (next === 125) return result;
                if (next !== 44) return invalid();
                whitespace();
            }
        }
        if (code === 91) {
            offset++; whitespace();
            const result: unknown[] = [];
            if (raw.charCodeAt(offset) === 93) { offset++; return result; }
            for (;;) {
                result.push(value()); whitespace();
                const next = raw.charCodeAt(offset++);
                if (next === 93) return result;
                if (next !== 44) return invalid();
            }
        }
        if (code === 110 && raw.startsWith('null', offset)) { offset += 4; return null; }
        if (code === 116 && raw.startsWith('true', offset)) { offset += 4; return true; }
        if (code === 102 && raw.startsWith('false', offset)) { offset += 5; return false; }
        const start = offset;
        let integer = 0;
        if (code === 45) offset++;
        let digit = raw.charCodeAt(offset);
        if (digit === 48) offset++;
        else {
            if (!(digit >= 49 && digit <= 57)) return invalid();
            do { integer = integer * 10 + (digit - 48); offset++; digit = raw.charCodeAt(offset); } while (digit >= 48 && digit <= 57);
        }
        let whole = true;
        if (raw.charCodeAt(offset) === 46) {
            whole = false; offset++;
            digit = raw.charCodeAt(offset);
            if (!(digit >= 48 && digit <= 57)) return invalid();
            do { offset++; digit = raw.charCodeAt(offset); } while (digit >= 48 && digit <= 57);
        }
        if (raw.charCodeAt(offset) === 101 || raw.charCodeAt(offset) === 69) {
            whole = false; offset++;
            if (raw.charCodeAt(offset) === 43 || raw.charCodeAt(offset) === 45) offset++;
            digit = raw.charCodeAt(offset);
            if (!(digit >= 48 && digit <= 57)) return invalid();
            do { offset++; digit = raw.charCodeAt(offset); } while (digit >= 48 && digit <= 57);
        }
        if (whole && Number.isSafeInteger(integer)) return integer === 0 ? 0 : code === 45 ? -integer : integer;
        const source = raw.slice(start, offset);
        return whole ? BigInt(source) : new LosslessNumber(source);
    };
    try {
        const result = value(); whitespace();
        if (offset !== raw.length) return invalid();
        return result;
    } catch (error) {
        if (error instanceof SyntaxError) return readJson(raw);
        throw error;
    }
}
/** Python's default cache JSON layout, with native serialization for ordinary
 * records. Ordered numeric keys and non-finite legacy values use the exact path.
 */
export function dumpDataJson(value: unknown): string {
    try {
        const raw = (JSON as unknown as {
            rawJSON(value: string): unknown;
        }).rawJSON;
        const compact = JSON.stringify(value, (_key, item: unknown) => {
            if (typeof item === 'bigint')
                return item >= -9007199254740991n && item <= 9007199254740991n ? Number(item) : raw(String(item));
            if (isLosslessNumber(item))
                return raw(/^-?\d+$/u.test(item.value) ? String(BigInt(item.value)) : pythonFloat(Number(item.value)));
            if (typeof item === 'number' && (!Number.isSafeInteger(item) || Object.is(item, -0)))
                return raw(pythonFloat(item));
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                const record = nativeRecord(item);
                const prototype = record && Object.getPrototypeOf(record);
                if (!record || prototype !== Object.prototype && prototype !== null)
                    throw new Error('Exact JSON path required');
                return record;
            }
            if (item === undefined || typeof item === 'function' || typeof item === 'symbol')
                throw new Error('Invalid JSON data');
            return item;
        });
        if (compact === undefined)
            throw new Error('Invalid JSON data');
        return compact.replace(/"(?:\\[\s\S]|[^"\\])*"|[:,]/gu, token => token === ',' ? ', ' : token === ':' ? ': ' : token)
            .replace(/[\u007f-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
    }
    catch {
        return pythonJson(value, { allowNan: true });
    }
}
