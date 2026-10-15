import * as fs from 'node:fs';
import { join, relative, isAbsolute, dirname, resolve } from 'node:path';
import { isLinkOrReparse } from '@fbincon/statusline-platform/files';
import { resolvedPath } from '@fbincon/statusline-platform/commands';
import { decode } from '@fbincon/statusline-core/json';
import { object } from '@fbincon/statusline-core/config/validation';
import { isSchema } from '@fbincon/statusline-core/config/display';
import { decodeUtf8, type Storage } from '../config/storage.js';
import { OWNER, OWNER_FILE, type ModSpec } from './model.js';
import { digest, type Inventory } from './resources.js';
import { safeTarget } from './transaction.js';
export interface Snapshot {
    mod_version: string;
    files: Record<string, string>;
}
export interface Marker extends Inventory {
    owner: string;
    suspended: boolean;
    cache_inventories: Snapshot[];
}
export function ownedPath(root: string, name: string): string {
    if (!name || name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..') || isAbsolute(name))
        throw new Error('Unsafe owned resource path');
    const target = join(root, name);
    safeTarget(root, target);
    return target;
}
export function owner(directory: string, spec: ModSpec, io: Storage, allowMissing = false): Marker | null {
    const root = join(directory, spec.name), path = join(root, OWNER_FILE);
    safeTarget(directory, path);
    const raw = io.read(path);
    if (raw === null) {
        if (fs.existsSync(root))
            throw new Error('Unowned Mod directory: ' + root);
        return null;
    }
    const value = decode(decodeUtf8(raw));
    if (!object(value) || Object.keys(value).sort().join(',') !== 'backend_version,cache_inventories,files,mod_version,owner,protocol_version,schema_version,suspended' || value.owner !== OWNER || !isSchema(value.schema_version, 1) || typeof value.suspended !== 'boolean' || typeof value.backend_version !== 'string' || typeof value.mod_version !== 'string' || !Array.from({ length: 11 }, (_, i) => i + 1).some(n => isSchema(value.protocol_version, n)) || !Array.isArray(value.cache_inventories) || value.cache_inventories.length > 3)
        throw new Error('Untrusted Mod ownership marker: ' + path);
    function hashes(files: unknown): asserts files is Record<string, string> {
        if (!object(files) || !Object.keys(files).length)
            throw new Error('Invalid resource inventory');
        for (const [name, hash] of Object.entries(files)) {
            if (!(name === '.claude-plugin/marketplace.json' || name.startsWith(`plugins/${spec.name}/`)) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/u.test(hash))
                throw new Error('Invalid owned resource digest');
            ownedPath(root, name);
        }
    }
    hashes(value.files);
    for (const snapshot of value.cache_inventories) {
        if (!object(snapshot) || Object.keys(snapshot).sort().join(',') !== 'files,mod_version' || typeof snapshot.mod_version !== 'string')
            throw new Error('Invalid cache snapshot');
        hashes(snapshot.files);
        if (!Object.hasOwn(snapshot.files, `plugins/${spec.name}/.claude-plugin/plugin.json`))
            throw new Error('Incomplete cache snapshot');
    }
    for (const [name, hash] of Object.entries(value.files)) {
        const content = io.read(ownedPath(root, name));
        if (content === null && allowMissing)
            continue;
        if (content === null || digest(content) !== hash)
            throw new Error('Owned Mod resource changed or missing: ' + name);
    }
    return { ...value, schema_version: 1, protocol_version: Number(String(value.protocol_version)) } as unknown as Marker;
}
export function registered(directory: string, spec: ModSpec, markets: Record<string, unknown>[], plugins: Record<string, unknown>[], marker: Marker | null): [
    boolean,
    Record<string, unknown> | null
] {
    const matches = markets.filter(row => row.name === spec.marketplace), rows = plugins.filter(row => row.id === spec.plugin);
    if (matches.length && (matches.length !== 1 || matches[0]!.source !== 'directory' || typeof matches[0]!.path !== 'string' || resolvedPath(matches[0]!.path) !== resolvedPath(join(directory, spec.name)) || !marker))
        throw new Error('Foreign marketplace: ' + spec.marketplace);
    if (rows.length && (rows.length !== 1 || rows[0]!.scope !== 'user' || !marker))
        throw new Error('Foreign or ambiguous plugin: ' + spec.plugin);
    return [!!matches.length, rows[0] ?? null];
}
export function cacheOwned(directory: string, spec: ModSpec, row: Record<string, unknown>, marker: Marker, io: Storage, current = false): string {
    if (typeof row.installPath !== 'string')
        throw new Error('Missing plugin installPath');
    // Canonicalize the explicitly selected configuration prefix only. Resolving
    // the entire cache path first would conceal links inside owned artifacts.
    const configRoot = resolvedPath(directory);
    let prefix = resolve(row.installPath);
    while (resolvedPath(prefix) !== configRoot && prefix !== dirname(prefix))
        prefix = dirname(prefix);
    if (resolvedPath(prefix) !== configRoot)
        throw new Error('Foreign Mod cache location');
    const path = join(configRoot, relative(prefix, resolve(row.installPath))), root = join(configRoot, 'plugins/cache', spec.marketplace, spec.name), rel = relative(root, path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel))
        throw new Error('Foreign Mod cache location');
    safeTarget(configRoot, path);
    for (const snapshot of [{ mod_version: marker.mod_version, files: marker.files }, ...(current ? [] : marker.cache_inventories)]) {
        if (row.version !== snapshot.mod_version)
            continue;
        if (Object.entries(snapshot.files).every(([name, hash]) => {
            const prefix = `plugins/${spec.name}/`;
            if (!name.startsWith(prefix))
                return true;
            const raw = io.read(ownedPath(path, name.slice(prefix.length)));
            return raw !== null && digest(raw) === hash;
        }))
            return path;
    }
    throw new Error('Installed Mod cache changed; restore or inspect before changing it: ' + path);
}
export function prune(root: string, paths: string[]): void {
    const parents = new Set<string>();
    for (const path of paths)
        for (let parent = dirname(path); parent.startsWith(root) && parent !== dirname(root); parent = dirname(parent))
            parents.add(parent);
    for (const parent of [...parents].sort((a, b) => b.length - a.length)) {
        try {
            if (!isLinkOrReparse(parent)) {
                safeTarget(dirname(root), parent);
                fs.rmdirSync(parent);
            }
        }
        catch { /* Unknown files survive. */ }
    }
}
