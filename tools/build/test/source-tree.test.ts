import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { verifyGitSource } from '../candidate.js';

test('Git source verification uses actual independent blob IDs for binary and Unicode bytes', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'source-git-blobs-'));
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '--object-format=sha1', '--initial-branch=main');
    const entries = new Map([
        ['binary.png', Buffer.from([0, 1, 255, 13, 10, 128, 0, 42])],
        ['résumé 中文.txt', Buffer.from('Français Русский e\u0301 👩🏽‍💻\r\n')],
        ['empty', Buffer.alloc(0)],
    ]);
    for (const [name, bytes] of entries) fs.writeFileSync(join(root, name), bytes);
    git('-c', 'core.autocrlf=false', 'add', '--', ...entries.keys());
    const object = git('write-tree').trim(), tree = git('ls-tree', '-rz', '--full-tree', object);
    verifyGitSource(entries, tree);

    // These are independently known Git objects, so rehashing a damaged export
    // into a self-consistent candidate manifest cannot authorize the damage.
    const corrupt = new Map(entries); corrupt.set('binary.png', Buffer.from([0, 1, 254, 13, 10, 128, 0, 42]));
    assert.throws(() => verifyGitSource(corrupt, tree), /Git source bytes differ: binary\.png/u);
    const normalized = new Map(entries); normalized.set('résumé 中文.txt', Buffer.from('Français Русский é 👩🏽‍💻\n'));
    assert.throws(() => verifyGitSource(normalized, tree), /Git source bytes differ/u);
    const missing = new Map(entries); missing.delete('empty');
    assert.throws(() => verifyGitSource(missing, tree), /Git source inventory differs/u);
    const extra = new Map(entries); extra.set('extra', Buffer.from('unexpected'));
    assert.throws(() => verifyGitSource(extra, tree), /Git source inventory differs/u);
    const reserved = new Map(entries); reserved.set('.candidate-source.json', Buffer.from('{}'));
    assert.throws(() => verifyGitSource(reserved, tree), /Reserved source manifest/u);
    assert.throws(() => verifyGitSource(entries, tree.slice(0, -1)), /Incomplete/u);
    assert.throws(() => verifyGitSource(entries, tree + tree.split('\0')[0] + '\0'), /duplicate/u);
    assert.throws(() => verifyGitSource(entries, tree.replace('100644 blob', '120000 blob')), /Unsupported/u);
    assert.throws(() => verifyGitSource(entries, tree.replace('100644 blob', '160000 commit')), /Unsupported/u);
});
