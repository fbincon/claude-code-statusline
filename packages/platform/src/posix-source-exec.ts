/** A short-lived execve handoff: unlike execvp, it never retries ENOEXEC in sh. */
import { fileURLToPath } from 'node:url';
import { nativeFunction } from './native.js';

export function execSource(): void {
    try {
        const spec = JSON.parse(process.env.STATUSLINE_SOURCE_LAUNCH ?? 'null');
        if (process.platform === 'win32' || !spec || typeof spec.executable !== 'string' || !Array.isArray(spec.args) || spec.args.some((arg: unknown) => typeof arg !== 'string') || !spec.environment || typeof spec.environment !== 'object')
            throw new Error('Invalid source handoff');
        const environment = Object.entries(spec.environment).filter((entry): entry is [string, string] => typeof entry[1] === 'string').map(([key, value]) => key + '=' + value);
        const library = process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6';
        const fcntl = nativeFunction(library, 'int fcntl(int fd, int command, ...)');
        // Node marks inherited stdio close-on-exec during startup. Preserve only
        // the three pipes explicitly provided by the source process adapter.
        for (const fd of [0, 1, 2]) if (fcntl(fd, 2, 'int', 0) < 0) throw new Error('Cannot preserve source pipes');
        // execve replaces this process, preserving its process group and pipes.
        // https://man7.org/linux/man-pages/man2/execve.2.html
        nativeFunction(library, 'int execve(const char *file, const char **argv, const char **envp)')(spec.executable, [spec.executable, ...spec.args, null], [...environment, null]);
    } catch { /* Handoff errors must never disclose the command environment. */ }
    process.exitCode = 126;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) execSource();
