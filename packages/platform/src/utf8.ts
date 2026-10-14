/** Fatal UTF-8 decoding with Python-compatible public error descriptions. */
export function decodeUtf8(raw: Uint8Array): string {
    function invalid(start: number, end: number, reason: string): never {
        const bytes = end - start === 1 ? `byte 0x${raw[start]!.toString(16).padStart(2, '0')} in position ${start}` : `bytes in position ${start}-${end - 1}`;
        throw new Error(`'utf-8' codec can't decode ${bytes}: ${reason}`);
    }
    for (let i = 0; i < raw.length;) {
        const first = raw[i]!;
        if (first < 0x80) {
            i++;
            continue;
        }
        const length = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
        if (!length)
            invalid(i, i + 1, 'invalid start byte');
        for (let n = 1; n < length; n++) {
            const byte = raw[i + n];
            if (byte === undefined)
                invalid(i, raw.length, 'unexpected end of data');
            const minimum = n === 1 && first === 0xe0 ? 0xa0 : n === 1 && first === 0xf0 ? 0x90 : 0x80;
            const maximum = n === 1 && first === 0xed ? 0x9f : n === 1 && first === 0xf4 ? 0x8f : 0xbf;
            if (byte < minimum || byte > maximum)
                invalid(i, i + n, 'invalid continuation byte');
        }
        i += length;
    }
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw);
}
export function decodeUtf8Sig(raw: Uint8Array): string {
    return decodeUtf8(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf ? raw.subarray(3) : raw);
}
/** json.loads(bytes) detects UTF-8/16/32; text-mode legacy readers stay UTF-8. */
export function decodeJsonBytes(raw: Uint8Array): string {
    let unit = 1, little = false, start = 0;
    if (raw.length >= 4 && raw[0] === 0 && raw[1] === 0 && raw[2] === 0xfe && raw[3] === 0xff) { unit = 4; start = 4; }
    else if (raw.length >= 4 && raw[0] === 0xff && raw[1] === 0xfe && raw[2] === 0 && raw[3] === 0) { unit = 4; little = true; start = 4; }
    else if (raw[0] === 0xfe && raw[1] === 0xff) { unit = 2; start = 2; }
    else if (raw[0] === 0xff && raw[1] === 0xfe) { unit = 2; little = true; start = 2; }
    else if (raw.length >= 4) {
        if (raw[0] === 0) unit = raw[1] === 0 ? 4 : 2;
        else if (raw[1] === 0) { unit = raw[2] !== 0 || raw[3] !== 0 ? 2 : 4; little = true; }
    } else if (raw.length === 2) {
        if (raw[0] === 0) unit = 2; else if (raw[1] === 0) { unit = 2; little = true; }
    }
    if (unit === 1) return decodeUtf8Sig(raw);
    if ((raw.length - start) % unit) throw new Error('Truncated JSON Unicode code unit');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), parts: string[] = [];
    for (let i = start; i < raw.length; i += unit) {
        const value = unit === 2 ? view.getUint16(i, little) : view.getUint32(i, little);
        if (value > 0x10ffff) throw new Error('Invalid JSON Unicode code point');
        parts.push(unit === 2 ? String.fromCharCode(value) : String.fromCodePoint(value));
    }
    return parts.join('');
}
