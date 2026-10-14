import { own, object, int, numeric, type Data } from '../runtime/values.js';
import { divideIntegers, fixed } from '../numbers.js';
import { clip } from '../unicode/index.js';
import { truncateStyled, displayWidth } from './layout.js';
import { coercedInteger } from './coercion.js';
export { coercedInteger };
export { formatDuration } from './timer.js';
export { displayWidth };
export function deepGet(value: unknown, path: readonly string[]): unknown { for (const key of path) {
    if (!object(value))
        return null;
    value = own(value, key);
} return value ?? null; }
export function sanitizePayloadText(value: unknown): string | null {
    if (typeof value !== 'string')
        return null;
    let text = '';
    for (const char of value) {
        const code = char.codePointAt(0)!;
        text += /[\p{Cc}\p{Cs}]/u.test(char) || /\p{Cf}/u.test(char) && code !== 0x200d && !(code >= 0xe0020 && code <= 0xe007f) ? ' ' : char;
    }
    return text.split(/[\p{White_Space}\x1c-\x1f]+/u).filter(Boolean).join(' ') || null;
}
export function humanizeTokens(value: unknown): string | null {
    const parsed = coercedInteger(value);
    if (typeof value === 'boolean' || parsed === null || parsed < 0n)
        return null;
    try {
        if (parsed >= 1000000n)
            return fixed(divideIntegers(parsed, 1000000n), 2).replace(/0+$/u, '').replace(/\.$/u, '') + 'M';
        if (parsed >= 1000n)
            return fixed(divideIntegers(parsed, 1000n), 1).replace(/0+$/u, '').replace(/\.$/u, '') + 'K';
        return String(parsed);
    }
    catch {
        return null;
    }
}
export function humanizeApiTokens(value: unknown): string {
    const parsed = coercedInteger(value);
    if (parsed === null)
        return '0';
    try {
        if (parsed >= 1000000n)
            return fixed(divideIntegers(parsed, 1000000n), 2).replace(/0+$/u, '').replace(/\.$/u, '') + 'M';
        if (parsed >= 1000n)
            return fixed(divideIntegers(parsed, 1000n), 1) + 'K';
        return String(parsed < 0n ? 0n : parsed);
    }
    catch {
        return '0';
    }
}
export function truncateText(text: string, width: number, ellipsis = '…'): string { return text.includes('\x1b[') ? truncateStyled(text, width, ellipsis) : clip(text, Math.trunc(width), ellipsis); }
