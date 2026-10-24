import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { tmpdir } from 'node:os';
import { removeTree } from '../src/remove-tree.js';

test('owned tree cleanup removes Unicode files and directory links without following their targets', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'cleanup 中文 ')), owned = join(root, 'owned 速'), outside = join(root, 'outside');
    t.after(() => removeTree(root));
    fs.mkdirSync(join(owned, 'nested'), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(join(outside, 'keep'), 'external');
    fs.writeFileSync(join(owned, 'nested', '請.txt'), 'private');
    fs.symlinkSync(outside, join(owned, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    removeTree(owned);
    assert(!fs.existsSync(owned));
    assert.equal(fs.readFileSync(join(outside, 'keep'), 'utf8'), 'external');
    removeTree(owned);
    assert.throws(() => removeTree(parse(root).root), /filesystem root/);
    assert(fs.existsSync(dirname(outside)));
});
