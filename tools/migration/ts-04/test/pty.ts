import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { library } from '@fbincon/statusline-platform/native';
import { join } from 'node:path';
import { repoRoot } from '../../ts-03/common.js';
/** Native PTY harness; no Python process participates in TS editor acceptance. */
export function openPty(configDir: string, columns = 80, rows = 24, extra: NodeJS.ProcessEnv = {}, language = 'en', command?: {
    executable: string;
    args: string[];
    cwd?: string;
}) {
    if (process.platform === 'win32')
        throw new Error('POSIX PTY only');
    const lib = library(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6');
    const util = process.platform === 'darwin' ? lib : library('libutil.so.1');
    const size = Buffer.alloc(8);
    size.writeUInt16LE(rows);
    size.writeUInt16LE(columns, 2);
    const master = [0], slave = [0];
    if (util.func('int openpty(_Out_ int *master, _Out_ int *slave, void *name, void *termios, void *size)')(master, slave, null, null, size))
        throw new Error('openpty failed');
    const m = master[0]!, s = slave[0]!;
    const attrs = lib.func('int tcgetattr(int fd, _Out_ void *termios)');
    const attributes = () => { const bytes = Buffer.alloc(256); if (attrs(s, bytes))
        throw new Error('tcgetattr failed'); return bytes; };
    const before = attributes();
    const fcntl = lib.func('int fcntl(int fd, int cmd, ...)');
    if (fcntl(m, 4, 'int', process.platform === 'darwin' ? 4 : 2048))
        throw new Error('fcntl failed');
    const child = spawn(command?.executable ?? process.execPath, command?.args ?? [join(repoRoot, 'packages/cli/dist/src/entry.js'), '--language', language, 'configure', '--config-dir', configDir], {
        detached: true, cwd: command?.cwd, stdio: [s, s, s], env: { PATH: '', HOME: configDir, USERPROFILE: configDir, LANG: 'C.UTF-8', TERM: 'xterm-256color', ...extra },
    });
    let closed = false, failure: Error | null = null;
    child.once('exit', () => { closed = true; });
    child.once('error', error => { failure = error; closed = true; });
    const chunks: Buffer[] = [];
    const drain = () => { const buffer = Buffer.alloc(65536); try {
        for (let i = 0; i < 16; i++) {
            const count = fs.readSync(m, buffer, 0, buffer.length, null);
            if (!count)
                break;
            chunks.push(Buffer.from(buffer.subarray(0, count)));
        }
    }
    catch (error) {
        if (!['EIO', 'EAGAIN'].includes((error as NodeJS.ErrnoException).code ?? ''))
            throw error;
    } };
    const captured = () => { drain(); return Buffer.concat(chunks); };
    const wait = async (predicate: (output: string) => boolean, limit = 8000) => {
        const stop = performance.now() + limit;
        while (performance.now() < stop) {
            if (failure)
                throw failure;
            if (predicate(captured().toString('utf8')))
                return;
            if (closed)
                break;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('PTY expectation failed: ' + captured().toString('utf8').slice(-1500));
    };
    return {
        child, before, attributes, captured, wait,
        send: (value: string | Buffer) => { fs.writeSync(m, typeof value === 'string' ? Buffer.from(value) : value); },
        readInput: () => {
            const original = fcntl(s, 3);
            if (original < 0 || fcntl(s, 4, 'int', original | (process.platform === 'darwin' ? 4 : 2048))) throw new Error('fcntl input failed');
            try { const bytes = Buffer.alloc(4096); return bytes.subarray(0, fs.readSync(s, bytes, 0, bytes.length, null)).toString('utf8'); }
            catch (error) { if ((error as NodeJS.ErrnoException).code === 'EAGAIN') return ''; throw error; }
            finally { if (fcntl(s, 4, 'int', original)) throw new Error('fcntl input restoration failed'); }
        },
        resize(width: number, height: number) { size.writeUInt16LE(height); size.writeUInt16LE(width, 2); if (lib.func('int ioctl(int fd, unsigned long request, ...)')(m, process.platform === 'darwin' ? 0x80087467 : 0x5414, 'void *', size))
            throw new Error('ioctl failed'); child.kill('SIGWINCH'); },
        exited: () => wait(() => closed),
        async close() { if (!closed) {
            child.kill('SIGKILL');
            await wait(() => closed).catch(() => { });
        } drain(); fs.closeSync(m); fs.closeSync(s); },
    };
}
