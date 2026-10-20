import { realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { expandUser } from './commands.js';

export interface ProjectPaths {
    canonical(path: string): string | null;
    contains(root: string, directory: string): boolean;
    depth(path: string): number;
}
function canonical(path: string): string | null {
    if (!isAbsolute(path) || path.includes('\0')) return null;
    try {
        const resolved = realpathSync.native(path);
        return statSync(resolved).isDirectory() ? resolved : null;
    } catch { return null; }
}
/** Native directory identity preserves case-sensitive Windows/macOS volumes too. */
export const projectPaths: ProjectPaths = {
    canonical,
    contains(root, directory) {
        try {
            const wanted = statSync(root, { bigint: true });
            for (let current = directory;; current = dirname(current)) {
                const actual = statSync(current, { bigint: true });
                if (current === root || wanted.ino !== 0n && wanted.ino === actual.ino && wanted.dev === actual.dev) return true;
                if (dirname(current) === current) return false;
            }
        } catch { return false; }
    },
    depth(path) { let count = 0; for (let next = path; dirname(next) !== next; next = dirname(next)) count++; return count; },
};
export function explicitProjectPath(path: string): string {
    return resolve(expandUser(path));
}
