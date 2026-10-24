/** Remove caller-owned files without the old Windows rmSync Unicode bug. */
import * as fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function remove(path: string, directory: boolean): void {
    for (const delay of [10, 20, 40, 80, 160, null]) {
        try {
            if (directory) fs.rmdirSync(path);
            else fs.unlinkSync(path);
            return;
        }
        catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') return;
            if (process.platform !== 'win32' || delay === null || !['EACCES', 'EPERM', 'EBUSY', 'ENOTEMPTY'].includes(code ?? '')) throw error;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
        }
    }
}

/** The caller supplies its own private/owned target. Links are removed, never traversed. */
export function removeTree(path: string): void {
    const root = resolve(path);
    if (dirname(root) === root) throw new Error('Cannot remove a filesystem root');
    const pending = [{ path: root, visited: false }];
    while (pending.length) {
        const entry = pending.pop()!;
        let stat: fs.Stats;
        try { stat = fs.lstatSync(entry.path); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
        if (!stat.isDirectory()) remove(entry.path, false);
        else if (entry.visited) remove(entry.path, true);
        else {
            pending.push({ ...entry, visited: true });
            for (const name of fs.readdirSync(entry.path)) pending.push({ path: join(entry.path, name), visited: false });
        }
    }
}
