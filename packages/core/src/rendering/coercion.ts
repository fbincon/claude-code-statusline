import { int, numeric } from '../runtime/values.js';
// Python numeric constructors accept Unicode decimal digits and surrounding
// Unicode whitespace, but not JavaScript hexadecimal/empty-string coercion.
function normalized(value: string): string {
    return value.replace(/^[\p{White_Space}]+|[\p{White_Space}]+$/gu, '').replace(/\p{Decimal_Number}/gu, char => {
        const code = char.codePointAt(0)!;
        if (code < 128 || code >= 0x11de0 && code <= 0x11de9)
            return char;
        let start = code;
        while (/\p{Decimal_Number}/u.test(String.fromCodePoint(start - 1)))
            start--;
        return String((code - start) % 10);
    });
}
export function coercedFloat(value: unknown): number | null {
    if (typeof value === 'boolean')
        return Number(value);
    if (typeof value !== 'string') {
        const n = numeric(value);
        return n !== null && !Number.isFinite(n) && int(value) !== null ? null : n;
    }
    const text = normalized(value), digits = '[0-9](?:_?[0-9])*';
    if (new RegExp('^[+-]?(?:' + digits + '(?:\\.(?:' + digits + ')?)?|\\.' + digits + ')(?:[eE][+-]?' + digits + ')?$', 'u').test(text))
        return Number(text.replaceAll('_', ''));
    if (/^[+-]?(?:inf(?:inity)?|nan)$/iu.test(text))
        return /nan/iu.test(text) ? NaN : text.startsWith('-') ? -Infinity : Infinity;
    return null;
}
export function coercedInteger(value: unknown): bigint | null {
    const whole = int(value, false);
    if (whole !== null)
        return whole;
    if (typeof value === 'string') {
        const text = normalized(value);
        if (!/^[+-]?[0-9](?:_?[0-9])*$/u.test(text))
            return null;
        const digits = text.replaceAll('_', '');
        if (digits.replace(/^[+-]/u, '').length > 4300)
            return null;
        try {
            return BigInt(digits);
        }
        catch {
            return null;
        }
    }
    const n = numeric(value);
    return n !== null && Number.isFinite(n) ? BigInt(Math.trunc(n)) : null;
}
