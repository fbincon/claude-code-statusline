import { LosslessNumber } from './json.js';
import { orderedRecord } from './ordered-record.js';
export class JsonSyntaxError extends SyntaxError {
}
export interface JsonReadOptions {
    duplicate?: (key: string) => never;
    constant?: (token: string) => never;
    allowBom?: boolean;
}
/** Python JSON diagnostics and exact numeric kinds at public compatibility boundaries. */
export function readJson(input: string, options: JsonReadOptions = {}): unknown {
    let raw = input, offset = 0;
    function error(message: string, position = offset): never {
        const before = raw.slice(0, position), line = before.split('\n').length;
        const column = [...before.slice(before.lastIndexOf('\n') + 1)].length + 1;
        throw new JsonSyntaxError(`${message}: line ${line} column ${column} (char ${[...before].length})`);
    }
    if (raw.startsWith('\uFEFF')) {
        if (options.allowBom)
            raw = raw.slice(1);
        else
            error('Unexpected UTF-8 BOM (decode using utf-8-sig)', 0);
    }
    function whitespace(): void { while (/[ \t\r\n]/u.test(raw[offset] ?? 'x'))
        offset++; }
    function string(): string {
        const start = offset++;
        while (offset < raw.length) {
            const c = raw[offset++]!;
            if (c === '"')
                return JSON.parse(raw.slice(start, offset)) as string;
            if (c.charCodeAt(0) < 32)
                error('Invalid control character at', offset - 1);
            if (c === '\\') {
                const escape = raw[offset++];
                if (escape === undefined)
                    error('Unterminated string starting at', start);
                if (escape === 'u') {
                    if (!/^[0-9a-fA-F]{4}$/u.test(raw.slice(offset, offset + 4)))
                        error('Invalid \\uXXXX escape', offset - 1);
                    offset += 4;
                }
                else if (!'"\\/bfnrt'.includes(escape))
                    error('Invalid \\escape', offset - 2);
            }
        }
        return error('Unterminated string starting at', start);
    }
    function value(): unknown {
        whitespace();
        const c = raw[offset];
        if (c === '"')
            return string();
        if (c === '{') {
            offset++;
            whitespace();
            const pairs: [
                string,
                unknown
            ][] = [];
            if (raw[offset] === '}') {
                offset++;
                return orderedRecord([]);
            }
            for (;;) {
                if (raw[offset] !== '"')
                    error('Expecting property name enclosed in double quotes');
                const key = string();
                whitespace();
                if (raw[offset] !== ':')
                    error("Expecting ':' delimiter");
                offset++;
                pairs.push([key, value()]);
                whitespace();
                if (raw[offset] === '}') {
                    offset++;
                    break;
                }
                if (raw[offset] !== ',')
                    error("Expecting ',' delimiter");
                const comma = offset++;
                whitespace();
                if (raw[offset] === '}')
                    error('Illegal trailing comma before end of object', comma);
            }
            const seen = new Set<string>();
            for (const [key] of pairs) {
                if (seen.has(key))
                    options.duplicate?.(key);
                seen.add(key);
            }
            return orderedRecord(pairs);
        }
        if (c === '[') {
            offset++;
            whitespace();
            const result: unknown[] = [];
            if (raw[offset] === ']') {
                offset++;
                return result;
            }
            for (;;) {
                result.push(value());
                whitespace();
                if (raw[offset] === ']') {
                    offset++;
                    return result;
                }
                if (raw[offset] !== ',')
                    error("Expecting ',' delimiter");
                const comma = offset++;
                whitespace();
                if (raw[offset] === ']')
                    error('Illegal trailing comma before end of array', comma);
            }
        }
        for (const [literal, result] of [['null', null], ['true', true], ['false', false]] as const) {
            if (raw.startsWith(literal, offset)) {
                offset += literal.length;
                return result;
            }
        }
        for (const token of ['NaN', 'Infinity', '-Infinity']) {
            if (raw.startsWith(token, offset)) {
                offset += token.length;
                options.constant?.(token);
                return Number(token);
            }
        }
        const match = raw.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
        if (match) {
            offset += match[0].length;
            return new LosslessNumber(match[0]);
        }
        return error('Expecting value');
    }
    const result = value();
    whitespace();
    if (offset !== raw.length)
        error('Extra data');
    return result;
}
