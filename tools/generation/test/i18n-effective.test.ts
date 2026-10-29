import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { ROOT, languageOutputs } from '../resources.js';
import { fixture, acceptFixture, editPack } from './i18n-fixture.js';

test('generated Node and Native translators/search share effective text and truthful origins; statusline modules stay isolated', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'i18n effective ')); t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const inputs = fixture();
    for (const code of ['en', 'zh-CN', 'ja']) editPack(inputs, code, pack => {
        pack['items.main.example.label'] = code === 'en' ? 'Source label' : code + ' label';
        pack['items.main.example.description'] = code === 'en' ? 'Source description' : code + ' description';
        pack['catalog.categories.system'] = code === 'en' ? 'System' : code + ' system';
    });
    acceptFixture(inputs, ['en', 'zh-CN', 'ja']);
    editPack(inputs, 'ja', pack => { delete pack['items.main.example.label']; pack['items.main.example.description'] = 'Unvalidated replacement'; });
    for (const [path, bytes] of inputs) { fs.mkdirSync(dirname(join(root, path)), { recursive: true }); fs.writeFileSync(join(root, path), bytes); }
    const output = languageOutputs(root); assert.deepEqual(languageOutputs(root), output);
    const source = fs.readFileSync(join(ROOT, 'packages/core/src/i18n/messages.ts'), 'utf8'), search = fs.readFileSync(join(ROOT, 'packages/core/src/editor/search.ts'), 'utf8');
    const writeJs = (path: string, text: string) => {
        fs.mkdirSync(dirname(path), { recursive: true });
        fs.writeFileSync(path, ts.transpileModule(text.replaceAll('.ts\'', '.js\''), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 } }).outputText);
    };
    fs.writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    for (const frontend of ['node', 'native']) {
        const directory = join(root, frontend), prefix = 'mods/statusline-native/lib/i18n/';
        writeJs(join(directory, 'i18n/generated-locales.js'), output.get(frontend === 'node' ? 'packages/core/src/i18n/generated-locales.ts' : prefix + 'generated-locales.ts')!);
        if (frontend === 'native') for (const [path, text] of output) if (path.startsWith(prefix + 'locales/')) writeJs(join(directory, 'i18n/locales', path.split('/').at(-1)!.replace('.ts', '.js')), text);
        writeJs(join(directory, 'i18n/messages.js'), source); writeJs(join(directory, 'editor/search.js'), search);
        const messages = await import(pathToFileURL(join(directory, 'i18n/messages.js')).href), index = await import(pathToFileURL(join(directory, 'editor/search.js')).href);
        assert.equal(messages.t('items.main.example.label', 'ja'), 'Source label');
        assert.equal(messages.messageOrigin('items.main.example.label', 'ja'), 'en');
        assert.equal(messages.messageOrigin('term', 'ja'), 'ja'); assert.equal(messages.messageOrigin('unknown', 'ja'), 'en');
        const item = { scope: 'main', id: 'example', group: 'system', label: 'Source label', description: 'Source description' };
        const fields = index.fields(item); assert(!fields.some((row: any[]) => row[0] === 'label.ja' || row[0] === 'description.ja'));
        assert.equal(index.bestMatch(fields, 'Source label').field, 'label.en');
        assert.deepEqual(index.bestMatch(fields, 'sl').positions, [0, 7]);
        assert.equal(index.bestMatch(index.fields(item, 'Custom'), 'Custom').field, 'custom_label');
    }
    const statusline = output.get('packages/core/src/i18n/statusline/ja.ts')!;
    assert(!statusline.includes('items.main.') && !statusline.includes('generated-locales') && !statusline.includes('acceptance'));
    for (const [path, text] of output) if (path.startsWith('mods/')) assert(Buffer.byteLength(text) < 1024 * 1024);
});
