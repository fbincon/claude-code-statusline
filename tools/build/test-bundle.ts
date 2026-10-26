/** Portable compiler output, never native dependencies or an independent-build input. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as tar from 'tar';
import { files, sha256, readTar } from './files.ts';
export const COMPILED_ROOTS = ['packages/core/dist', 'packages/platform/dist', 'packages/cli/dist', 'packages/tui/dist', 'tools/testing/dist', 'dist/typescript'];
export function compiledPath(path: string): boolean {
    return COMPILED_ROOTS.some(root => path.startsWith(root + '/')) &&
        !path.split('/').some(part => ['..', '.', 'node_modules', '.git'].includes(part)) &&
        !path.includes('\\') && /\.(?:js|json|map|ts)$/u.test(path) && !path.endsWith('.tsbuildinfo');
}
export function createTestBundle(root: string, output: string): void {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const names = COMPILED_ROOTS.flatMap(directory => files(join(root, directory)).map(name => directory + '/' + name)).filter(compiledPath).sort();
    assert(names.length > 0);
    fs.mkdirSync(output, { recursive: true });
    const archive = join(output, 'compiled-tests.tar');
    tar.c({ file: archive, cwd: root, sync: true, portable: true, noMtime: true, prefix: 'ci-tests', noDirRecurse: true }, names);
    fs.writeFileSync(join(output, 'compiled-tests.json'), JSON.stringify({ schema_version: 1, commit, node: process.version,
        lock_sha256: sha256(fs.readFileSync(join(root, 'package-lock.json'))), archive_sha256: sha256(fs.readFileSync(archive)),
        files: Object.fromEntries(names.map(name => [name, sha256(fs.readFileSync(join(root, name)))])) }, null, 2) + '\n');
}
export function restoreTestBundle(root: string, input: string): void {
    const manifest = JSON.parse(fs.readFileSync(join(input, 'compiled-tests.json'), 'utf8'));
    assert.equal(manifest.schema_version, 1); assert.equal(manifest.node, process.version);
    assert.equal(manifest.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
    assert.equal(manifest.lock_sha256, sha256(fs.readFileSync(join(root, 'package-lock.json'))));
    const archive = join(input, 'compiled-tests.tar'); assert.equal(sha256(fs.readFileSync(archive)), manifest.archive_sha256);
    const entries = readTar(archive, 'ci-tests/');
    assert.deepEqual([...entries.keys()].sort(), Object.keys(manifest.files).sort());
    for (const [name, bytes] of entries) { assert(compiledPath(name), 'Unexpected compiled output'); assert.equal(sha256(bytes), manifest.files[name]); }
    for (const [name, bytes] of entries) {
        const path = join(root, name);
        for (let parent = path; parent !== root; parent = dirname(parent))
            if (fs.existsSync(parent)) assert(!fs.lstatSync(parent).isSymbolicLink(), 'Linked output is not accepted');
        fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, bytes, { flag: 'wx' });
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    assert(['create', 'restore'].includes(process.argv[2]!) && process.argv.length === 4, 'Use create|restore DIRECTORY');
    (process.argv[2] === 'create' ? createTestBundle : restoreTestBundle)(fs.realpathSync(process.cwd()), resolve(process.argv[3]!));
}
