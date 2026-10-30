import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { githubSelection, requireObservation, installationSnapshot } from '../showcase-operations.js';

test('showcase operations cannot silently query GitHub or select another repository', () => {
    assert.equal(githubSelection(undefined), null);
    assert.equal(githubSelection('fbincon/claude-code-statusline'), 'fbincon/claude-code-statusline');
    for (const value of ['', 'other/private', 'https://github.com/fbincon/claude-code-statusline', 'fbincon/claude-code-statusline --help'])
        assert.throws(() => githubSelection(value), /explicitly authorized/u);
});

test('source walkthrough assertions reject retained zero as success and preserve independent freshness', () => {
    const missing = { state: 'missing', reason: 'missing', value: 0, freshness: 'current' };
    requireObservation(missing, 'missing', 'missing', 0);
    assert.throws(() => requireObservation(missing, 'valid', 'valid', 0), /state differs/u);
    assert.throws(() => requireObservation(missing, 'missing', 'missing_file', 0), /reason differs/u);
    const stale = { state: 'valid', reason: 'valid', value: 7, freshness: 'stale' };
    requireObservation(stale, 'valid', 'valid', 7, 'stale');
    assert.throws(() => requireObservation(stale, 'valid', 'valid', 7, 'current'), /freshness differs/u);
    assert.throws(() => requireObservation({ state: 'disabled', reason: 'disabled', value: 0 }, 'disabled', 'disabled', null), /value differs/u);
});

test('installation snapshots preserve npm bin-link identity without traversing it', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'showcase-npm-links-'));
    try {
        fs.mkdirSync(join(root, 'bin')); fs.mkdirSync(join(root, 'package')); fs.writeFileSync(join(root, 'package/entry.js'), 'original');
        const link = join(root, 'bin/command');
        if (process.platform === 'win32') fs.writeFileSync(link, 'shim');
        else fs.symlinkSync('../package/entry.js', link);
        const before = installationSnapshot(root); assert.deepEqual(installationSnapshot(root), before);
        fs.writeFileSync(join(root, 'package/entry.js'), 'changed'); assert.notDeepEqual(installationSnapshot(root), before);
        if (process.platform !== 'win32') {
            fs.writeFileSync(join(root, 'package/entry.js'), 'original'); removeTree(link); fs.symlinkSync('../missing', link);
            assert.notDeepEqual(installationSnapshot(root), before);
            assert.deepEqual(installationSnapshot(root)['bin/command'], { kind: 'link', target: '../missing', mode: fs.lstatSync(link).mode & 0o777 });
        }
    } finally { removeTree(root); }
});
