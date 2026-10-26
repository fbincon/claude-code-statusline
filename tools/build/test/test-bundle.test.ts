import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createTestBundle, restoreTestBundle, COMPILED_ROOTS, compiledPath } from '../test-bundle.js';
test('compiled outputs restore only for the exact source and lockfile, without native dependencies', t => {
    const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'ci-compiled-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { stdio: 'pipe' });
    fs.writeFileSync(join(root, 'package-lock.json'), '{}'); git('init'); git('add', '.'); git('commit', '-m', 'fixture');
    for (const directory of COMPILED_ROOTS) { fs.mkdirSync(join(root, directory), { recursive: true }); fs.writeFileSync(join(root, directory, 'example.js'), 'export const value = 1;\n'); }
    const output = join(root, 'bundle'); createTestBundle(root, output);
    for (const directory of COMPILED_ROOTS) fs.rmSync(join(root, directory), { recursive: true });
    fs.writeFileSync(join(root, 'package-lock.json'), '{"changed":true}'); assert.throws(() => restoreTestBundle(root, output));
    fs.writeFileSync(join(root, 'package-lock.json'), '{}'); restoreTestBundle(root, output);
    for (const directory of COMPILED_ROOTS) assert.equal(fs.readFileSync(join(root, directory, 'example.js'), 'utf8'), 'export const value = 1;\n');
    fs.appendFileSync(join(output, 'compiled-tests.tar'), 'corruption'); assert.throws(() => restoreTestBundle(root, output));
    for (const path of ['../escape.js', 'packages/core/dist/../../escape.js', 'node_modules/koffi/index.js', 'packages/core/dist/node_modules/secret.js']) assert.equal(compiledPath(path), false);
});
test('cross-commit restoration requires the exact accepted tree and reachable source commit', t => {
    const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'ci-compiled-merge-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    fs.writeFileSync(join(root, 'package-lock.json'), '{}'); git('init'); git('add', '.'); git('commit', '-m', 'source'); const source = git('rev-parse', 'HEAD');
    for (const directory of COMPILED_ROOTS) { fs.mkdirSync(join(root, directory), { recursive: true }); fs.writeFileSync(join(root, directory, 'example.js'), 'export const value = 1;\n'); }
    const output = join(root, 'bundle'); createTestBundle(root, output);
    for (const directory of COMPILED_ROOTS) fs.rmSync(join(root, directory), { recursive: true });
    const orphan = git('commit-tree', source + '^{tree}', '-m', 'unrelated same tree'); git('checkout', '--detach', orphan);
    assert.throws(() => restoreTestBundle(root, output, source));
    git('checkout', '--detach', source); git('commit', '--allow-empty', '-m', 'integrated same tree');
    assert.throws(() => restoreTestBundle(root, output)); restoreTestBundle(root, output, source);
    for (const directory of COMPILED_ROOTS) fs.rmSync(join(root, directory), { recursive: true });
    fs.writeFileSync(join(root, 'new-source.ts'), 'export const changed = true;'); git('add', 'new-source.ts'); git('commit', '-m', 'different tree');
    assert.throws(() => restoreTestBundle(root, output, source), /tree differs/u);
});
