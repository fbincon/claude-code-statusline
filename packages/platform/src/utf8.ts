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
