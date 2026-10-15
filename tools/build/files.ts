import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import * as tar from 'tar';
export const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');
export function npmEntry(): string {
    const found = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(path => path && fs.existsSync(path));
    if (!found) throw new Error('Run with the pinned npm runtime');
    return found;
}
export function files(root: string, prefix = ''): string[] {
    return fs.readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
        const name = prefix ? prefix + '/' + entry.name : entry.name;
        if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) throw new Error('Non-regular build input: ' + name);
        return entry.isDirectory() ? files(root, name) : [name];
    });
}
export function readTar(path: string, prefix = 'package/'): Map<string, Buffer> {
    const result = new Map<string, Buffer>(); let size = 0;
    tar.t({ file: path, sync: true, strict: true, onReadEntry(entry) {
        if (!entry.path.startsWith(prefix) || entry.path.includes('\\') || entry.path.split('/').some(part => part === '..' || part === '.') || !['File', 'Directory'].includes(entry.type)) throw new Error('Unsafe tar entry: ' + entry.path);
        if (entry.type === 'Directory') return;
        const name = entry.path.slice(prefix.length);
        if (!name || result.has(name)) throw new Error('Duplicate/empty tar entry');
        size += entry.size;
        if (entry.size > 64 * 1024 * 1024 || size > 256 * 1024 * 1024) throw new Error('Candidate exceeds extraction limit');
        const chunks: Buffer[] = [];
        entry.on('data', chunk => chunks.push(chunk));
        entry.on('end', () => result.set(name, Buffer.concat(chunks)));
    } });
    if (!result.size) throw new Error('Empty archive');
    return result;
}
export function extractFiles(entries: Map<string, Buffer>, directory: string) {
    for (const [name, raw] of entries) {
        const path = join(directory, name); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, raw);
    }
}
export function sums(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.trim().split('\n')) {
        const match = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/u);
        if (!match || Object.hasOwn(result, match[2]!)) throw new Error('Invalid or duplicate checksum entry');
        result[match[2]!] = match[1]!;
    }
    return result;
}
export function verifyChecksums(directory: string, expected: readonly string[]): Record<string, string> {
    const manifest = sums(fs.readFileSync(join(directory, 'SHA256SUMS'), 'utf8'));
    if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify([...expected].sort())) throw new Error('Incomplete or unexpected delivery checksum inventory');
    for (const [name, hash] of Object.entries(manifest)) if (sha256(fs.readFileSync(join(directory, name))) !== hash) throw new Error('Delivery checksum mismatch: ' + name);
    return manifest;
}
