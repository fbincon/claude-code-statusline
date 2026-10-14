export const SGR_RE = /\x1b\[[0-9;:]*m/gu, RESET = '\x1b[0m';
export type Color = readonly [
    'ansi',
    number
] | readonly [
    'rgb',
    string
];
export interface Style {
    bold: boolean;
    foreground: Color | null;
    background: Color | null;
}
export const DEFAULT: Style = Object.freeze({ bold: false, foreground: null, background: null });
export function sameColor(a: Color | null, b: Color | null): boolean { return a === b || a !== null && b !== null && a[0] === b[0] && a[1] === b[1]; }
export function memo<K, V>(limit: number, calculate: (key: K) => V): (key: K) => V {
    const cache = new Map<K, V>();
    return key => {
        if (cache.has(key)) {
            const value = cache.get(key)!;
            cache.delete(key);
            cache.set(key, value);
            return value;
        }
        const value = calculate(key);
        cache.set(key, value);
        if (cache.size > limit)
            cache.delete(cache.keys().next().value!);
        return value;
    };
}
export function colorCodes(color: Color, background = false): number[] {
    if (color[0] === 'rgb')
        return [background ? 48 : 38, 2, ...[1, 3, 5].map(i => parseInt(color[1].slice(i, i + 2), 16))];
    const index = color[1];
    return index < 8 ? [(background ? 40 : 30) + index] : index < 16 ? [(background ? 100 : 90) + index - 8] : [background ? 48 : 38, 5, index];
}
const serialized = memo<string, string>(1024, key => {
    const style = JSON.parse(key) as Style, codes = style.bold ? [1] : [];
    if (style.foreground)
        codes.push(...colorCodes(style.foreground));
    if (style.background)
        codes.push(...colorCodes(style.background, true));
    return codes.length ? '\x1b[' + codes.join(';') + 'm' : '';
});
export function serialize(style: Style): string { return serialized(JSON.stringify(style)); }
function color(mode: string, values: string[]): Color | null {
    if (values.some(v => !/^\d+$/u.test(v)))
        return null;
    const numbers = values.map(Number);
    if (numbers.some(v => v < 0 || v > 255))
        return null;
    if (mode === '5' && numbers.length === 1)
        return ['ansi', numbers[0]!];
    if (mode === '2' && numbers.length === 3)
        return ['rgb', '#' + numbers.map(v => v.toString(16).padStart(2, '0')).join('')];
    return null;
}
const advanced = memo<string, Style>(2048, key => {
    const [style, sequence] = JSON.parse(key) as [
        Style,
        string
    ];
    if (!/^\x1b\[[0-9;:]*m$/u.test(sequence))
        return style;
    let { bold, foreground, background } = style;
    const fields = sequence.slice(2, -1).split(';');
    let index = 0;
    while (index < fields.length) {
        const field = fields[index++]!;
        if (field.includes(':')) {
            const parts = field.split(':');
            if (!['38', '48'].includes(parts[0]!) || parts.length < 3)
                continue;
            let values = parts.slice(2);
            if (parts[1] === '2' && values.length === 4) {
                if (!['', '0'].includes(values[0]!))
                    continue;
                values = values.slice(1);
            }
            const value = color(parts[1]!, values);
            if (value) {
                if (parts[0] === '38')
                    foreground = value;
                else
                    background = value;
            }
            continue;
        }
        const code = Number(field || '0');
        if (code === 38 || code === 48) {
            if (index === fields.length)
                break;
            const mode = fields[index]!, count = mode === '2' ? 3 : mode === '5' ? 1 : null;
            if (count === null)
                break;
            const value = color(mode, fields.slice(index + 1, index + 1 + count));
            index += 1 + count;
            if (value) {
                if (code === 38)
                    foreground = value;
                else
                    background = value;
            }
        }
        else if (code === 0) {
            bold = false;
            foreground = background = null;
        }
        else if (code === 1 || code === 22)
            bold = code === 1;
        else if (code === 39)
            foreground = null;
        else if (code === 49)
            background = null;
        else if (code >= 30 && code <= 37 || code >= 90 && code <= 97)
            foreground = ['ansi', code < 90 ? code - 30 : code - 90 + 8];
        else if (code >= 40 && code <= 47 || code >= 100 && code <= 107)
            background = ['ansi', code < 100 ? code - 40 : code - 100 + 8];
    }
    return { bold, foreground, background };
});
export function advance(style: Style, sequence: string): Style { return advanced(JSON.stringify([style, sequence])); }
export function parse(sequence: string): Style { let state = DEFAULT; for (const match of sequence.matchAll(SGR_RE))
    state = advance(state, match[0]); return state; }
export function wireColor(color: Color | null) { return color === null ? null : { kind: color[0], value: color[1] }; }
