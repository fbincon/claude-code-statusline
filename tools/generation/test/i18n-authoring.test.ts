import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { analyze, DATA_ROOT, readJson } from '../i18n/analysis.js';
import { acceptValidation, freeze, validateSelection } from '../i18n/authoring.js';
import { runLanguageCommand } from '../i18n/cli.js';
import { fixture, acceptFixture, editPack, put } from './i18n-fixture.js';

test('explicit acceptance binds reviewed translations and preserves prior history without rewriting raw packs', () => {
    const inputs = fixture(); editPack(inputs, 'ja', pack => { pack.hello = 'こんにちは {name}'; });
    const validation = validateSelection(analyze(inputs), ['ja'], ['hello'], 'Reviewed greeting, name interpolation and current context.');
    const changes = acceptValidation(inputs, validation); assert([...changes.keys()].every(path => path.startsWith(DATA_ROOT)));
    assert.equal(analyze(inputs).states.ja!.hello, 'pending_validation');
    const accepted = analyze(new Map([...inputs, ...changes])); assert.equal(accepted.states.ja!.hello, 'accepted'); assert.equal(accepted.effective.ja!.hello, 'こんにちは {name}');
    assert.equal(readJson(changes, DATA_ROOT + 'history.json').entries.ja.hello.length, 1);
    assert.throws(() => acceptValidation(inputs, { ...validation, review: null }), /contextual review/);
    editPack(inputs, 'ja', pack => { pack.term = 'changed after validation'; });
    assert.throws(() => acceptValidation(inputs, validation), /stale/);
});
test('freeze distinguishes additions, meaning/context changes, placeholder changes and retirement without mutations', () => {
    const base = fixture(), current = new Map(base);
    editPack(current, 'en', pack => { pack.added = 'Added'; pack.hello = 'Hi {person}'; delete pack['statusline.example']; });
    put(current, DATA_ROOT + 'context.json', { schema_version: 1, entries: { term: { version: 2, description: 'Version control software', terms: [] } } });
    const before = [...current].map(([key, bytes]) => [key, Buffer.from(bytes)]);
    const result = freeze(current, 'b'.repeat(40), { inputs: base, commit: 'a'.repeat(40) });
    assert.deepEqual(Object.fromEntries(result.items.map(item => [item.key, item.change])), { added: 'added', hello: 'parameters_changed', 'statusline.example': 'deleted', term: 'changed' });
    assert.equal(result.items.find(item => item.key === 'hello')!.simplified_chinese, 'zh-CN {name}');
    assert.deepEqual([...current].map(([key, bytes]) => [key, Buffer.from(bytes)]), before);
    assert.deepEqual(freeze(current, 'b'.repeat(40), { inputs: base, commit: 'a'.repeat(40) }), result);
    acceptFixture(current, ['en'], ['added', 'hello', 'term']);
    assert.notEqual(freeze(current, 'b'.repeat(40)).freeze_sha256, result.freeze_sha256);
});
test('report and validation CLI preserve sources; stale proof and invalid output fail before acceptance writes', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'i18n authoring '));
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const inputs = fixture(); editPack(inputs, 'ja', pack => { pack.hello = 'こんにちは {name}'; });
    for (const [path, bytes] of inputs) { fs.mkdirSync(dirname(join(root, path)), { recursive: true }); fs.writeFileSync(join(root, path), bytes); }
    const snapshot = () => [...inputs.keys()].map(path => [path, fs.readFileSync(join(root, path)).toString()]);
    const before = snapshot();
    runLanguageCommand(['report', '--output', 'report.json'], root);
    runLanguageCommand(['validate', '--language', 'ja', '--keys', 'hello', '--review', 'Reviewed the greeting and placeholder.', '--output', 'validation.json'], root);
    assert.deepEqual(snapshot(), before);
    assert.throws(() => runLanguageCommand(['release-check', '--output', 'release.json'], root), /Release language gate/);
    assert.throws(() => runLanguageCommand(['accept', '--validation', 'validation.json', '--output', 'report.json'], root), /new report/);
    assert.throws(() => runLanguageCommand(['accept', '--validation', 'validation.json', '--output', DATA_ROOT + 'policy.json'], root), /overwrite language/);
    assert.deepEqual(snapshot(), before);
    runLanguageCommand(['accept', '--validation', 'validation.json', '--output', 'accepted.json'], root);
    runLanguageCommand(['release-check', '--output', 'ready.json'], root);
    assert.equal(JSON.parse(fs.readFileSync(join(root, 'ready.json'), 'utf8')).release_ready, true);
    assert.throws(() => runLanguageCommand(['accept', '--validation', 'validation.json', '--output', 'stale.json'], root), /stale/);
});
