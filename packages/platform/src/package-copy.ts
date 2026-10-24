/** Copy an installed package before loading any native adapter from it. */
import * as fs from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { resolvedPath } from './commands.js';

export function copyPackage(source: string, destination: string, limits = { entries: 16384, bytes: 256 * 1024 * 1024 }): void {
    // Resolve existing ancestors on both sides, including Windows short names
    // and junctions, before accepting an absent destination below them.
    const origin = fs.realpathSync.native(source), target = resolvedPath(destination);
    const inside = relative(origin, target);
    if (!inside || !isAbsolute(inside) && inside !== '..' && !inside.startsWith('..' + sep))
        throw new Error('Package copy destination must be outside the source');
    if (!fs.lstatSync(source).isDirectory())
        throw new Error('Package copy source must be a regular directory');
    fs.mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    fs.mkdirSync(target, { mode: 0o700 });
    let entries = 0, bytes = 0;
    const pending = [{ source: origin, destination: target }];
    try {
        while (pending.length) {
            const directory = pending.pop()!;
            for (const name of fs.readdirSync(directory.source)) {
                if (++entries > limits.entries)
                    throw new Error('Package copy exceeds its entry limit');
                const from = join(directory.source, name), to = join(directory.destination, name), stat = fs.lstatSync(from);
                if (stat.isDirectory()) {
                    fs.mkdirSync(to, { mode: 0o700 });
                    pending.push({ source: from, destination: to });
                }
                else if (stat.isFile()) {
                    bytes += stat.size;
                    if (bytes > limits.bytes)
                        throw new Error('Package copy exceeds its byte limit');
                    // Avoid fs.cpSync: Node 22.23.4 Windows acceptance exited
                    // with 0xC0000409 inside that call, before native loading.
                    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
                    fs.chmodSync(to, stat.mode & 0o111 ? 0o700 : 0o600);
                }
                else
                    throw new Error('Package copy contains a link or special file');
            }
        }
    }
    catch (error) {
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
        throw error;
    }
}
