import * as fs from 'node:fs';
import { join } from 'node:path';
import { readJson } from '@fbincon/statusline-core/json-read';
import { trim } from '@fbincon/statusline-core/runtime/transcript';
import { atomicWrite, durableUnlink, isLinkOrReparse, withLock } from '@fbincon/statusline-platform/files';
import { readCompleteLines } from '@fbincon/statusline-platform/line-cursor';
import { resolvedPath } from '@fbincon/statusline-platform/commands';
import { decodeUtf8, decodeJsonBytes } from '@fbincon/statusline-platform/utf8';
import { privateDirectory } from '../config/storage.js';
import { readDataJson } from './json-data.js';
export interface FileInfo {
    size: bigint;
    mtimeNs: bigint;
    dev: bigint;
    ino: bigint;
}
export interface Entry {
    name: string;
    path: string;
    file: boolean;
    directory: boolean;
    link: boolean;
}
export interface RuntimeIO {
    read(path: string): Buffer | null;
    write(path: string, raw: Buffer): void;
    remove(path: string): void;
    privateDirectory(path: string): void;
    lock<T>(path: string, callback: () => T): T;
    stat(path: string, follow?: boolean): FileInfo;
    entries(path: string): Entry[];
    isLink(path: string): boolean;
    resolve(path: string): string;
    lines(path: string, start: bigint, visit: (line: Buffer) => void): bigint;
}
export function runtimeIO(): RuntimeIO {
    return {
        read(path) {
            try {
                return fs.readFileSync(path);
            }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                    return null;
                throw error;
            }
        },
        write(path, raw) { atomicWrite(path, raw); }, remove: durableUnlink, privateDirectory, lock: withLock,
        stat(path, follow = true) { const stat = follow ? fs.statSync(path, { bigint: true }) : fs.lstatSync(path, { bigint: true }); return { size: stat.size, mtimeNs: stat.mtimeNs, dev: stat.dev, ino: stat.ino }; },
        entries(path) { return fs.readdirSync(path, { withFileTypes: true }).map(entry => ({ name: entry.name, path: join(path, entry.name), file: entry.isFile(), directory: entry.isDirectory(), link: entry.isSymbolicLink() })); },
        isLink: isLinkOrReparse, resolve: resolvedPath, lines: readCompleteLines,
    };
}
export function readStored(io: RuntimeIO, path: string, bytes = false): unknown {
    const raw = io.read(path);
    return raw === null ? null : readJson(bytes ? decodeJsonBytes(raw) : decodeUtf8(raw));
}
export function transcriptChunk(io: RuntimeIO, path: string, start: bigint): {
    lines: unknown[];
    cursor: bigint;
} {
    const lines: unknown[] = [];
    let first = true;
    try {
        const cursor = io.lines(path, start, raw => {
            let text = raw.toString('utf8');
            if (first && text.startsWith('\uFEFF'))
                text = text.slice(1);
            first = false;
            text = trim(text);
            if (!text)
                return;
            try {
                lines.push(readDataJson(text));
            }
            catch { /* A malformed complete line is consumed permanently. */ }
        });
        return { lines, cursor };
    }
    catch {
        return { lines: [], cursor: start };
    }
}
