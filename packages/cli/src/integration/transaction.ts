import { isLinkOrReparse } from '@fbincon/statusline-platform/files';
import { dirname, relative, isAbsolute, resolve } from 'node:path';
import type { Storage } from '../config/storage.js';
export interface Change {
    name: string;
    path: string;
    raw: Buffer | null;
    desired: Buffer | null;
}
export function safeTarget(directory: string, path: string): void {
    const rel = relative(directory, path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || path !== resolve(path))
        throw new Error('Unsafe installation artifact');
    for (let item = path; item !== dirname(directory); item = dirname(item)) {
        if (isLinkOrReparse(item))
            throw new Error('Installation artifact contains a symbolic link or reparse point: ' + item);
        if (item === directory)
            break;
    }
}
/** Caller owns the installation lock. File phases stay separate from official plugin operations. */
export function commit(directory: string, action: string, changes: Change[], io: Storage): string | null {
    if (!changes.length)
        return null;
    for (const change of changes)
        safeTarget(directory, change.path);
    const backup = io.backup(directory, action, changes);
    try {
        for (const change of changes)
            change.desired === null ? io.remove(change.path) : io.write(change.path, change.desired);
    }
    catch (error) {
        const failures: string[] = [];
        for (const change of [...changes].reverse()) {
            try {
                change.raw === null ? io.remove(change.path) : io.write(change.path, change.raw);
            }
            catch (rollback) {
                failures.push(String(rollback));
            }
        }
        throw new Error(`${String(error)}${failures.length ? '; rollback failed: ' + failures.join('; ') : ''}`);
    }
    return backup;
}
