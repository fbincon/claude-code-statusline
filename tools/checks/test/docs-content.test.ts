import test from 'node:test';
import assert from 'node:assert/strict';
import { contentDocuments, contentErrors, example, sourceExample } from '../docs-content.js';
import { ITEMS, NODE_TYPES } from '@fbincon/statusline-core/config/catalog';
import { SCHEMA_VERSION } from '@fbincon/statusline-core/config/display';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { LANGUAGES, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/registry';

const pages = contentDocuments(process.cwd());
test('current bilingual documentation facts and JSON examples agree with production definitions', () => {
    assert.deepEqual(contentErrors(pages), []);
    assert.deepEqual(contentErrors(new Map([...pages].map(([path, text]) => [path, text.replaceAll('\n', '\r\n')]))), []);
});
test('documentation checks reject changed counts, missing IDs/languages/presets and stale contracts', () => {
    for (const suffix of ['', '.zh-CN']) {
        for (const [path, before, after] of [
            [`README${suffix}.md`, ITEMS.filter(item => item.scope === 'main' && !(NODE_TYPES as readonly string[]).includes(item.id)).length + ' ', '999 '],
            [`README${suffix}.md`, LANGUAGE_NAMES[LANGUAGES.at(-1)!], 'Missing language'],
            [`docs/USER_GUIDE${suffix}.md`, '`zh-HK`', '`missing-code`'],
            [`docs/SCHEMES${suffix}.md`, '`quota-cost`', '`wrong-scheme`'],
            [`docs/SCHEMES${suffix}.md`, '`repeated-metrics`', '`wrong-preset`'],
            [`docs/COMPOSITION${suffix}.md`, 'schema ' + SCHEMA_VERSION, 'schema 999'],
            [`docs/EXTENSIONS${suffix}.md`, (suffix ? '协议 ' : 'protocol ') + PROTOCOL_VERSION, suffix ? '协议 999' : 'protocol 999'],
            [`docs/reference/cli${suffix}.md`, '"schema_version": ' + SCHEMA_VERSION, '"schema_version": ' + (SCHEMA_VERSION - 1)],
        ] as const) {
            const changed = new Map(pages), original = changed.get(path!)!;
            assert(original.includes(before!), path); changed.set(path!, original.replaceAll(before!, after!));
            assert(contentErrors(changed).some(error => error.startsWith(path! + ':')), path);
        }
        const missing = new Map(pages);
        for (const base of ['docs/DISPLAY_ITEMS', 'docs/USER_GUIDE']) {
            const path = base + suffix + '.md'; missing.set(path, missing.get(path)!.replaceAll('`git-ahead-behind`', '`unknown-id`'));
        }
        assert(contentErrors(missing).some(error => error.includes('Missing metric ID git-ahead-behind')));
    }
});
test('documentation examples require unique markers and strict production-compatible JSON', () => {
    for (const suffix of ['', '.zh-CN']) {
        const path = `docs/EXTENSIONS${suffix}.md`, original = pages.get(path)!;
        for (const [before, after] of [
            ['<!-- docs-example: github-source -->', ''],
            ['<!-- docs-example: command-workflow -->', '<!-- docs-example: removed -->'],
            ['"kind": "github",', '"kind": "github",,'],
            ['"ttl_seconds": 300,', '"ttl_seconds": 300, "ttl_seconds": 301,'],
            ['"ttl_seconds": 300,', '"ttl_seconds": NaN,'],
            ['"timeout_ms": 5000', '"unknown_timeout": 5000'],
        ] as const) {
            assert(original.includes(before));
            const changed = new Map(pages); changed.set(path, original.replaceAll(before, after));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':')), before);
        }
        assert.throws(() => example(original + '\n<!-- docs-example: github-source -->', 'github-source', 'json'));
        assert.throws(() => sourceExample(original.replace('"kind": "command"', '"kind": "github"'), 'command'));
        assert.throws(() => example(original.replace('```text', '```sh'), 'github-workflow', 'text'));
    }
});
