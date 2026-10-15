import { isLinkOrReparse } from '@fbincon/statusline-platform/files';
import { dirname, relative, isAbsolute, resolve } from 'node:path';
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
