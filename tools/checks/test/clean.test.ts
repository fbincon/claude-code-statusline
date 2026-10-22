import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { repoRoot } from '../../migration/ts-03/common.js';

const outputs = ['packages/core/dist', 'packages/platform/dist', 'packages/cli/dist', 'packages/tui/dist', 'tools/testing/dist', 'dist/typescript'];

function put(root: string, name: string, text = name) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
}
function fixture(t: { after: (fn: () => void) => void }) {
    const root = mkdtempSync(join(tmpdir(), 'statusline clean '));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(root, 'tools/typescript'), { recursive: true });
    copyFileSync(join(repoRoot, 'tools/typescript/clean.mjs'), join(root, 'tools/typescript/clean.mjs'));
    return root;
}
function run(root: string, ...args: string[]) {
    return spawnSync(process.execPath, [join(root, 'tools/typescript/clean.mjs'), ...args], { cwd: tmpdir(), encoding: 'utf8' });
}
function link(target: string, path: string) {
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir');
}

test('clean previews and removes all compiled outputs, including orphaned files, while retaining sources and evidence', t => {
    const root = fixture(t);
    const retained = ['packages/core/src/current.ts', 'tools/testing/oracle.ts', 'tools/build/pack.ts', 'archive/python/source.py', 'dist/validation/report.json', 'dist/releases/package.tgz', 'dist/other-output/result.json', '.local-roadmap/notes.md', 'node_modules/dependency/index.js'];
    for (const output of outputs) {
        put(root, output + '/src/deleted-source.js');
        put(root, output + '/tsconfig.tsbuildinfo');
    }
    for (const name of retained) put(root, name);
    const preview = run(root, '--dry-run');
    assert.equal(preview.status, 0, preview.stderr);
    for (const output of outputs) {
        assert(preview.stdout.includes('Would remove ' + output));
        assert.equal(readFileSync(join(root, output, 'src/deleted-source.js'), 'utf8'), output + '/src/deleted-source.js');
        assert(existsSync(join(root, output, 'tsconfig.tsbuildinfo')));
    }
    const cleaned = run(root);
    assert.equal(cleaned.status, 0, cleaned.stderr);
    for (const output of outputs) assert(!existsSync(join(root, output)), output);
    for (const name of retained) assert.equal(readFileSync(join(root, name), 'utf8'), name);
    const repeated = run(root);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.match(repeated.stdout, /No compiled outputs to clean/u);
});

test('clean rejects unknown arguments before deleting any output', t => {
    const root = fixture(t);
    put(root, 'packages/core/dist/keep.js');
    for (const args of [['--force'], ['--dry-run', '--force'], ['--dry-run', '--dry-run']]) {
        const result = run(root, ...args);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Usage:/u);
        assert(existsSync(join(root, 'packages/core/dist/keep.js')));
    }
});

test('clean rejects linked outputs and parent directories before removing any other output', t => {
    for (const path of ['dist/typescript', 'dist', 'packages/core/dist', 'packages/core']) {
        const root = fixture(t), outside = fixture(t);
        put(root, 'tools/testing/dist/keep.js');
        put(outside, 'typescript/protected.json');
        link(outside, join(root, path));
        for (const args of [[], ['--dry-run']]) {
            const result = run(root, ...args);
            assert.equal(result.status, 1);
            assert.match(result.stderr, /Refusing to clean through a symbolic link/u);
            assert(existsSync(join(root, 'tools/testing/dist/keep.js')));
            assert.equal(readFileSync(join(outside, 'typescript/protected.json'), 'utf8'), 'typescript/protected.json');
        }
    }
});

test('clean unlinks nested build-output links without deleting their destinations', t => {
    const root = fixture(t), outside = fixture(t);
    put(outside, 'protected.json');
    link(outside, join(root, 'packages/core/dist/linked-dependency'));
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert(!existsSync(join(root, 'packages/core/dist')));
    assert.equal(readFileSync(join(outside, 'protected.json'), 'utf8'), 'protected.json');
});

test('clean refuses unexpected files in output paths before deleting other compiled directories', t => {
    const root = fixture(t);
    put(root, 'packages/core/dist/keep.js');
    put(root, 'dist', 'unexpected file');
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected a build output directory/u);
    assert(existsSync(join(root, 'packages/core/dist/keep.js')));
    assert.equal(readFileSync(join(root, 'dist'), 'utf8'), 'unexpected file');
});
