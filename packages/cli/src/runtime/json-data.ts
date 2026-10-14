import { LosslessNumber, isLosslessNumber, pythonFloat } from '@fbincon/statusline-core/json';
import { readJson } from '@fbincon/statusline-core/json-read';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { nativeRecord } from '@fbincon/statusline-core/ordered-record';
/** Internal cache/transcript records have fixed fields. Callers restore mutable
 * ID dictionaries; other nested objects are consumed as data only.
 * Numeric member names require the ordered parser, including escaped names.
 * Public strict JSON parsing and its duplicate/diagnostic rules are unchanged.
 */
export function readDataJson(raw: string): unknown {
    const marker = '\u0000statusline:number';
    try {
        // Only a numeric/escaped first character can become an integer index
        // or the reserved marker key. Other keys need no JS-level token walk.
        for (const match of raw.matchAll(/"(?:[0-9]|\\[\s\S])(?:\\[\s\S]|[^"\\])*"\s*:/gu)) {
            const token = match[0], key = JSON.parse(token.slice(0, token.lastIndexOf(':')).trim()) as string;
            if (key === marker || /^(?:0|[1-9][0-9]{0,9})$/u.test(key) && Number(key) < 4294967295)
                return readJson(raw);
        }
        // Let the native parser handle ordinary integer fields without a reviver
        // callback/context allocation per value. Only exceptional numeric tokens
        // need a temporary placeholder; quote boundaries exclude string contents.
        const numbers: (bigint | LosslessNumber | number)[] = [], parts: string[] = [];
        // Safe integer counters need no callback. Number candidates inside
        // strings are excluded using unescaped quote boundaries. Keep the JSON
        // integer grammar here so replacement cannot repair invalid leading 0s.
        const tokens = /-?(?:[1-9]\d{15,}(?:\.\d+)?(?:[eE][+-]?\d+)?|(?:0|[1-9]\d*)\.\d+(?:[eE][+-]?\d+)?|(?:0|[1-9]\d*)[eE][+-]?\d+)|-0(?![\d.eE])/gu;
        let position = 0, quoteCursor = 0, quoted = false;
        for (const token of raw.matchAll(tokens)) {
            const source = token[0];
            for (;;) {
                const quote = raw.indexOf('"', quoteCursor);
                if (quote < 0 || quote >= token.index)
                    break;
                let backslashes = 0;
                for (let i = quote - 1; i >= 0 && raw.charCodeAt(i) === 92; i--)
                    backslashes++;
                if (backslashes % 2 === 0)
                    quoted = !quoted;
                quoteCursor = quote + 1;
            }
            if (quoted)
                continue;
            const whole = /^-?\d+$/u.test(source);
            if (whole && source !== '-0' && Number.isSafeInteger(Number(source)))
                continue;
            numbers.push(whole ? source === '-0' ? 0 : BigInt(source) : new LosslessNumber(source));
            parts.push(raw.slice(position, token.index), '{' + JSON.stringify(marker) + ':' + (numbers.length - 1) + '}');
            position = token.index + source.length;
        }
        const value: unknown = JSON.parse(numbers.length ? parts.join('') + raw.slice(position) : raw);
        if (!numbers.length)
            return value;
        function restore(value: unknown): unknown {
            if (!value || typeof value !== 'object')
                return value;
            if (Object.hasOwn(value, marker))
                return numbers[(value as Record<string, number>)[marker]!];
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++)
                    value[i] = restore(value[i]);
            }
            else
                for (const key of Object.keys(value))
                    (value as Record<string, unknown>)[key] = restore((value as Record<string, unknown>)[key]);
            return value;
        }
        return restore(value);
    }
    catch (error) {
        if (error instanceof SyntaxError)
            return readJson(raw);
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
                return raw(String(item));
            if (isLosslessNumber(item))
                return raw(/^-?\d+$/u.test(item.value) ? String(BigInt(item.value)) : pythonFloat(Number(item.value)));
            if (typeof item === 'number' && (!Number.isSafeInteger(item) || Object.is(item, -0)))
                return raw(pythonFloat(item));
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                const record = nativeRecord(item);
                if (!record || ![Object.prototype, null].includes(Object.getPrototypeOf(record)))
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
