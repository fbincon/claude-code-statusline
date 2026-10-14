import { openSync, closeSync, readSync } from 'node:fs';
/** Byte offsets only; incomplete final lines remain behind the published cursor. */
export function readCompleteLines(path: string, start: bigint, visit: (line: Buffer) => void): bigint {
    if (start < 0n || start > BigInt(Number.MAX_SAFE_INTEGER))
        throw new RangeError('Invalid file cursor');
    const fd = openSync(path, 'r');
    let position = Number(start), cursor = start, tail = Buffer.alloc(0);
    const chunk = Buffer.allocUnsafe(64 * 1024);
    try {
        for (;;) {
            const count = readSync(fd, chunk, 0, chunk.length, position);
            if (!count)
                break;
            position += count;
            const raw = tail.length ? Buffer.concat([tail, chunk.subarray(0, count)]) : Buffer.from(chunk.subarray(0, count));
            let offset = 0, newline: number;
            while ((newline = raw.indexOf(10, offset)) >= 0) {
                const line = raw.subarray(offset, newline + 1);
                visit(line);
                cursor += BigInt(line.length);
                offset = newline + 1;
            }
            tail = Buffer.from(raw.subarray(offset));
        }
        return cursor;
    }
    finally {
        closeSync(fd);
    }
}
