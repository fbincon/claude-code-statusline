import { readSync } from 'node:fs';
/** Read at most limit + 1 bytes. A regular file's reported size is only an allocation hint. */
export function readLimitedInput(limit: number, descriptor = 0, sizeHint = limit): Buffer {
    const capacity = limit + 1;
    let raw = Buffer.alloc(Math.min(capacity, Math.max(0, sizeHint) + 1));
    let offset = 0;
    while (offset < capacity) {
        // A growing file or a zero-sized virtual file can outlive the initial buffer.
        if (offset === raw.length) {
            const grown = Buffer.alloc(Math.min(capacity, Math.max(4096, raw.length * 2)));
            raw.copy(grown);
            raw = grown;
        }
        const count = readSync(descriptor, raw, offset, raw.length - offset, null);
        if (!count)
            break;
        offset += count;
    }
    return raw.subarray(0, offset);
}
