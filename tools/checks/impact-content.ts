/** Content identities for impact checks. Historical sourceHashes/policyDigest stay unchanged. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';

export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en'))) : item);
export interface Blob { mode: string; oid: string; bytes(): Buffer }
export function git(...args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
export function tree(revision: string): Map<string, Blob> {
    assert.match(revision, /^[a-f0-9]{40}$/u, 'Use an immutable full source SHA');
    return new Map(git('ls-tree', '-r', '-z', revision).split('\0').filter(Boolean).map(row => {
        const split = row.indexOf('\t'), path = row.slice(split + 1), [mode, kind, oid] = row.slice(0, split).split(' ');
        assert(mode && oid && kind, 'Invalid Git tree');
        let content: Buffer | undefined;
        return [path, { mode: kind === 'blob' ? mode : kind, oid, bytes: () => content ??= execFileSync('git', ['cat-file', 'blob', oid], { maxBuffer: 64 * 1024 * 1024 }) }];
    }));
}
export function emitted(text: string, presentation = false, identity = false, path = 'input.ts'): string {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true);
    assert.equal((source as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length, 0, 'Cannot parse product input');
    const transformed = ts.transform(source, [context => root => {
        const visit: ts.Visitor = node => {
            // Only explicit value slots are presentation data. Identifiers, keys,
            // array lengths, imports and every executable operation remain bound.
            if (presentation && ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer) &&
                ts.isIdentifier(node.name) && ['blockText', 'separator', 'warning', 'critical'].includes(node.name.text))
                return context.factory.updatePropertyAssignment(node, node.name, context.factory.createStringLiteral('<display>'));
            if (presentation && ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) &&
                ['foreground', 'backgrounds'].includes(node.name.text) && ts.isArrayLiteralExpression(node.initializer) &&
                node.initializer.elements.every(ts.isStringLiteral))
                return context.factory.updatePropertyAssignment(node, node.name, context.factory.createArrayLiteralExpression(node.initializer.elements.map(() => context.factory.createStringLiteral('<display>'))));
            if (identity && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'VERSION' && node.initializer && ts.isStringLiteral(node.initializer))
                return context.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type, context.factory.createStringLiteral('<version>'));
            return ts.visitEachChild(node, visit, context);
        };
        return ts.visitNode(root, visit) as ts.SourceFile;
    }]);
    try {
        const printed = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]!);
        const output = ts.transpileModule(printed, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, removeComments: true }, reportDiagnostics: true });
        assert(!output.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error), 'Cannot lower product input');
        return output.outputText;
    } finally { transformed.dispose(); }
}
export const localePath = (path: string) => /^packages\/core\/resources\/i18n\/locales\/[^/]+\.json$/u.test(path);
export const generatedLocalePath = (path: string) => /^packages\/core\/src\/i18n\/(?:generated-locales|statusline\/[^/]+)\.ts$/u.test(path) ||
    /^mods\/statusline-native\/lib\/i18n\/(?:generated-locales|locales\/[^/]+)\.ts$/u.test(path);
export function messageShape(bytes: Buffer): unknown {
    const value = JSON.parse(bytes.toString('utf8'));
    assert(value && typeof value === 'object' && !Array.isArray(value));
    return Object.fromEntries(Object.entries(value).map(([key, text]) => {
        assert.equal(typeof text, 'string');
        return [key, [...(text as string).matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/gu)].map(match => match[1]).sort()];
    }));
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
export function productPath(path: string): boolean {
    return /^packages\/[^/]+\/(?:src|resources)\//u.test(path) || /^packages\/[^/]+\/package\.json$/u.test(path) ||
        /^mods\/[^/]+\/(?:hooks|lib|ui)\//u.test(path) || /^mods\/[^/]+\/\.claude-plugin\/plugin\.json$/u.test(path) || path === 'tools/unicode/data.json';
}
export function productInputs(revision: string): string {
    const entries = tree(revision), rows: Record<string, unknown> = {};
    for (const [path, blob] of entries) {
        if (!productPath(path) || generatedLocalePath(path)) continue;
        const bytes = blob.bytes();
        let value: unknown = hash(bytes);
        if (localePath(path)) value = messageShape(bytes);
        else if (path.endsWith('.ts')) value = emitted(bytes.toString('utf8'), ['packages/core/src/editor/themes.ts', 'mods/statusline-native/lib/editor/themes.ts'].includes(path), path === 'packages/core/src/release.ts', path);
        else if (/\/\.claude-plugin\/plugin\.json$/u.test(path)) {
            const manifest = JSON.parse(bytes.toString()); value = { ...manifest, version: '<version>' };
        }
        rows[path] = { mode: blob.mode, value };
    }
    const lock = entries.get('package-lock.json'); assert(lock, 'Missing runtime lockfile');
    rows['runtime-dependency-closure'] = runtimeLock(lock.bytes());
    return hash(canonical(rows));
}
