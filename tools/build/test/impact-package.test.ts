import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { comparePackages } from '../impact-package.js';
import { hash } from '../../checks/impact-content.js';

function fixture(t: any) {
    const root = fs.mkdtempSync(join(tmpdir(), 'impact-pack-')); let sequence = 0;
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    return (commit: string, changes: Record<string, string> = {}) => {
        const directory = join(root, String(sequence++)); fs.mkdirSync(directory);
        const files = { 'package.json': '{"name":"fixture","version":"3.13.0"}', 'README.md': 'Documentation',
            'node_modules/@fbincon/statusline-core/dist/src/render.js': 'export const render = () => "value";',
            'node_modules/@fbincon/statusline-core/dist/src/release.js': 'export const VERSION = "3.13.0";', ...changes };
        for (const [name, bytes] of Object.entries(files)) { fs.mkdirSync(dirname(join(directory, name)), { recursive: true }); fs.writeFileSync(join(directory, name), bytes); }
        fs.writeFileSync(join(directory, 'candidate.json'), JSON.stringify({ commit, files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)])) }));
        const file = directory + '.tgz'; tar.c({ file, cwd: directory, sync: true, gzip: true, portable: true, noMtime: true, noDirRecurse: true, prefix: 'package' }, [...Object.keys(files), 'candidate.json']); return file;
    };
}
test('maintenance packages retain distinct source hashes while equivalent product members compare equal', t => {
    const pack = fixture(t), base = 'a'.repeat(40), head = 'b'.repeat(40);
    const before = pack(base), after = pack(head, { 'README.md': 'Updated docs', 'package.json': '{"name":"fixture","version":"3.13.1"}',
        'node_modules/@fbincon/statusline-core/dist/src/release.js': 'export const VERSION = "3.13.1";' });
    const result = comparePackages(base, head, before, after); assert.equal(result.equivalent, true); assert.notEqual(result.base_sha256, result.head_sha256);
    assert.throws(() => comparePackages(base, head, before, before), /commit|equal/u);
});
test('runtime changes, new executable files disguised as licenses and package entrypoint changes are not equivalent', t => {
    const pack = fixture(t), base = 'a'.repeat(40), head = 'b'.repeat(40), before = pack(base);
    const changes: Record<string, string>[] = [{ 'node_modules/@fbincon/statusline-core/dist/src/render.js': 'export const render = () => "other";' },
        { 'LICENSE.js': 'process.exit(1);' }, { 'package.json': '{"name":"fixture","version":"3.13.0","bin":"different.js"}' }];
    for (const change of changes) {
        const result = comparePackages(base, head, before, pack(head, change)); assert.equal(result.equivalent, false); assert(result.changed_members.length);
    }
});
test('presentation normalization preserves message keys, placeholders and non-message executable operations', t => {
    const pack = fixture(t), base = 'a'.repeat(40), head = 'b'.repeat(40), path = 'node_modules/@fbincon/statusline-core/resources/i18n/locales/en.json';
    const before = pack(base, { [path]: '{"hello":"Hello {name}"}' });
    assert(comparePackages(base, head, before, pack(head, { [path]: '{"hello":"Welcome {name}"}' })).equivalent);
    assert(!comparePackages(base, head, before, pack(head, { [path]: '{"hello":"Welcome {other}"}' })).equivalent);
    assert(!comparePackages(base, head, before, pack(head, { [path]: '{"new":"Welcome {name}"}' })).equivalent);
});
