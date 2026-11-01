/** Immutable package identities used by both impact routing and historical coverage. */
import assert from 'node:assert/strict';

export const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en'))) : item);
export function withoutCiScripts(bytes: Buffer) {
    const value = JSON.parse(bytes.toString());
    for (const key of Object.keys(value.scripts ?? {})) if (key.startsWith('ci:')) delete value.scripts[key];
    return value;
}
export function runtimeManifest(bytes: Buffer): string {
    const value = JSON.parse(bytes.toString('utf8'));
    for (const name of ['description', 'keywords', 'homepage', 'bugs', 'repository', 'author', 'contributors', 'funding', 'license']) delete value[name];
    return canonical(value);
}
/** Lockfile flags alone cannot establish that a dependency is development-only. */
export function runtimeLock(bytes: Buffer): string {
    const lock = JSON.parse(bytes.toString('utf8'));
    assert.equal(lock.lockfileVersion, 3); assert(lock.packages);
    const seen = new Set<string>(), result: Record<string, unknown> = {};
    function visit(path: string) {
        if (seen.has(path)) return;
        seen.add(path);
        const entry = lock.packages[path]; assert(entry, 'Missing runtime dependency: ' + path);
        if (entry.link) { assert(typeof entry.resolved === 'string'); visit(entry.resolved); result[path] = entry; return; }
        const { dev: _dev, devOptional: _devOptional, ...identity } = entry;
        result[path] = identity;
        for (const name of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies })) {
            let parent = path, found: string | undefined;
            while (true) {
                const candidate = (parent ? parent + '/' : '') + 'node_modules/' + name;
                if (lock.packages[candidate]) { found = candidate; break; }
                if (!parent) break;
                parent = parent.includes('/node_modules/') ? parent.slice(0, parent.lastIndexOf('/node_modules/')) : '';
            }
            if (!found && entry.peerDependenciesMeta?.[name]?.optional === true && !entry.dependencies?.[name]) continue;
            assert(found, 'Unresolved runtime dependency: ' + name); visit(found);
        }
    }
    for (const name of ['core', 'platform', 'cli', 'tui']) visit('packages/' + name);
    return canonical(result);
}
