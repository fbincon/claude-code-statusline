import { constants, openSync, closeSync, fstatSync, readSync, lstatSync } from 'node:fs';
import { isLinkOrReparse, fileIdentity, sameFileIdentity, FileChangedError } from './files.js';
/** Reject devices/FIFOs and links before reading; bound growth during the read too. */
export function readBoundedRegularFile(path: string, maximum: number): Buffer | null {
    for (let attempt = 0; attempt < 3; attempt++) {
        try { return readSnapshot(path, maximum); }
        catch (error) {
            if (!(error instanceof FileChangedError) || attempt === 2) throw error;
        }
    }
    throw new FileChangedError();
}
/** Each retry starts over with no-follow, size and identity checks intact. */
function readSnapshot(path: string, maximum: number): Buffer | null {
    let fd: number | undefined;
    try {
        const before = lstatSync(path, { bigint: true });
        if (!before.isFile() || isLinkOrReparse(path))
            throw new Error('file_type');
        const identity = fileIdentity(path, before);
        fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
        const stat = fstatSync(fd, { bigint: true });
        if (!stat.isFile() || stat.size > maximum)
            throw new Error('file_size_or_type');
        if (!sameFileIdentity(identity, stat)) throw new FileChangedError();
        const bytes = Buffer.alloc(maximum + 1);
        let size = 0, count: number;
        while (size < bytes.length && (count = readSync(fd, bytes, size, bytes.length - size, null)) > 0)
            size += count;
        if (size > maximum)
            throw new Error('output_limit');
        const after = fstatSync(fd, { bigint: true });
        if (after.mtimeNs !== stat.mtimeNs || after.size !== stat.size)
            throw new FileChangedError();
        return bytes.subarray(0, size);
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return null;
        throw error;
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
    }
}
