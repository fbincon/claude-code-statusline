import { readSync } from 'node:fs';
/** Consume at most limit + 1 bytes so oversized machine requests stay bounded. */
export function readLimitedInput(limit: number, descriptor = 0): Buffer {
    const raw = Buffer.alloc(limit + 1);
    let offset = 0;
    while (offset < raw.length) {
        const count = readSync(descriptor, raw, offset, raw.length - offset, null);
        if (!count)
            break;
        offset += count;
    }
    return raw.subarray(0, offset);
}
