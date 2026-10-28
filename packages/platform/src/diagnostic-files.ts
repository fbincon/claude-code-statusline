import { openSync, closeSync, fstatSync, constants } from 'node:fs';
import { isLinkOrReparse } from './files.js';
import { readLimitedInput } from './input.js';

/** Deliberately has no write, lock, directory traversal or process capability. */
export interface DiagnosticFiles { read(path: string): Buffer | null }
export const MAX_DIAGNOSTIC_BYTES = 32 * 1024 * 1024;
export function readDiagnosticFile(path: string, allowLink = false): Buffer | null {
    let fd: number | undefined;
    try {
        if (!allowLink && isLinkOrReparse(path)) throw new Error('Symbolic diagnostic store');
        // A named pipe must not block in open before the regular-file check.
        fd = openSync(path, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK));
        if (!fstatSync(fd).isFile()) throw new Error('Diagnostic input is not a regular file');
        const raw = readLimitedInput(MAX_DIAGNOSTIC_BYTES, fd);
        if (raw.length > MAX_DIAGNOSTIC_BYTES) throw new Error('Diagnostic input exceeds 32 MiB');
        return raw;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    } finally { if (fd !== undefined) closeSync(fd); }
}
export const diagnosticFiles: DiagnosticFiles = { read: readDiagnosticFile };
