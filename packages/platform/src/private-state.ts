/** Bounded snapshots of atomically replaced, caller-owned private state. */
import { constants, openSync, closeSync, fstatSync, readSync, lstatSync } from 'node:fs';
import { FileChangedError, fileIdentity, sameFileIdentity, isLinkOrReparse } from './files.js';
import type { BigIntStats } from 'node:fs';

function privateFile(stat: BigIntStats): boolean {
    return stat.isFile() && (process.platform === 'win32' ||
        (stat.mode & 0o077n) === 0n && stat.uid === BigInt(process.geteuid!()));
}
function snapshot(path: string, maximum: number): Buffer {
    const before = lstatSync(path, { bigint: true });
    if (!privateFile(before) || isLinkOrReparse(path) || before.size > BigInt(maximum))
        throw new Error('Unsafe, non-private or oversized private state');
    const identity = fileIdentity(path, before);
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
        const opened = fstatSync(fd, { bigint: true });
        if (!privateFile(opened) || opened.size > BigInt(maximum)) throw new Error('Unsafe private state');
        if (!sameFileIdentity(identity, opened)) throw new FileChangedError();
        const bytes = Buffer.alloc(maximum + 1);
        let size = 0, count: number;
        while (size < bytes.length && (count = readSync(fd, bytes, size, bytes.length - size, null)) > 0) size += count;
        if (size > maximum) throw new Error('Private state grew past its limit');
        const after = fstatSync(fd, { bigint: true });
        if (!privateFile(after)) throw new Error('Private state permissions changed');
        if (after.mtimeNs !== opened.mtimeNs || after.size !== opened.size) throw new FileChangedError();
        return bytes.subarray(0, size);
    } finally { closeSync(fd); }
}
/** Retry only identity/content races; unsafe files, missing data and invalid JSON
 * remain errors. Immutable recovery journals and snapshots use their own reader. */
export function readPrivateState(path: string, maximum = 1024 * 1024): Buffer {
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 32 * 1024 * 1024) throw new RangeError('Invalid private state limit');
    for (let attempt = 0; attempt < 3; attempt++) {
        try { return snapshot(path, maximum); }
        catch (error) { if (!(error instanceof FileChangedError) || attempt === 2) throw error; }
    }
    throw new FileChangedError();
}
