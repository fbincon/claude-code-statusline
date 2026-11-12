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
    // Checkout may already use CRLF. Build each valid variant from LF rather
    // than doubling its CR, which would test malformed text on Windows only.
    const lf = new Map([...pages].map(([path, text]) => [path, text.replaceAll('\r\n', '\n')]));
    for (const ending of ['\n', '\r\n'])
        assert.deepEqual(contentErrors(new Map([...lf].map(([path, text]) => [path, text.replaceAll('\n', ending)]))), []);
});
test('documentation checks reject changed counts, missing IDs/languages/presets and stale contracts', () => {
    for (const suffix of ['', '.zh-CN']) {
        for (const [path, before, after] of [
            [`README${suffix}.md`, ITEMS.filter(item => item.scope === 'main' && !(NODE_TYPES as readonly string[]).includes(item.id)).length + ' ', '999 '],
            [`README${suffix}.md`, LANGUAGE_NAMES[LANGUAGES.at(-1)!], 'Missing language'],
            [`docs/USER_GUIDE${suffix}.md`, '`zh-HK`', '`missing-code`'],
            [`docs/USER_GUIDE${suffix}.md`, suffix ? '65 个主栏指标' : '65 main metrics', suffix ? '999 个主栏指标' : '999 main metrics'],
            [`docs/USER_GUIDE${suffix}.md`, suffix ? '5 个子代理条目' : '5 subagent items', suffix ? '6 个子代理条目' : '6 subagent items'],
            [`docs/USER_GUIDE${suffix}.md`, suffix ? '八套完整显示方案' : 'eight complete display schemes', suffix ? '九套完整显示方案' : 'nine complete display schemes'],
            [`docs/USER_GUIDE${suffix}.md`, '^22.0.0 || ^24.0.0', '^20.0.0 || ^24.0.0'],
            [`docs/USER_GUIDE${suffix}.md`, '2.1.205', '2.1.999'],
            [`docs/USER_GUIDE${suffix}.md`, '2.1.214', '2.1.999'],
            [`docs/USER_GUIDE${suffix}.md`, '2.1.258', '2.1.999'],
            [`docs/USER_GUIDE${suffix}.md`, '2.1.287', '2.1.999'],
            [`docs/USER_GUIDE${suffix}.md`, '2.1.289', '2.1.999'],
            [`docs/USER_GUIDE${suffix}.md`, suffix ? '完整 `config apply`' : 'complete `config apply`', suffix ? '独立 `config apply`' : 'standalone `config apply`'],
            [`docs/USER_GUIDE${suffix}.md`, 'config language reset', 'config language clear'],
            [`docs/USER_GUIDE${suffix}.md`, 'claude-statusline setup --dry-run', 'claude-statusline setup --check'],
            [`docs/EDITORS${suffix}.md`, '64×18', '63×18'],
            [`docs/EDITORS${suffix}.md`, '2.1.287+', '2.1.999+'],
            [`docs/SCHEMES${suffix}.md`, '`quota-cost`', '`wrong-scheme`'],
            [`docs/SCHEMES${suffix}.md`, '`repeated-metrics`', '`wrong-preset`'],
            [`docs/reference/cli${suffix}.md`, (suffix ? '显示 schema ' : 'display schema ') + SCHEMA_VERSION, (suffix ? '显示 schema 999' : 'display schema 999')],
            [`docs/reference/cli${suffix}.md`, (suffix ? '编辑器协议 ' : 'editor protocol ') + PROTOCOL_VERSION, (suffix ? '编辑器协议 999' : 'editor protocol 999')],
            [`docs/reference/cli${suffix}.md`, '"schema_version": ' + SCHEMA_VERSION, '"schema_version": ' + (SCHEMA_VERSION - 1)],
        ] as const) {
            const changed = new Map(pages), original = changed.get(path!)!;
            assert(original.includes(before!), path); changed.set(path!, original.replaceAll(before!, after!));
            assert(contentErrors(changed).some(error => error.startsWith(path! + ':')), path);
        }
        for (const [path, link] of [
            [`docs/COMPOSITION${suffix}.md`, suffix ? 'reference/cli.zh-CN.md#协议与-schema-版本' : 'reference/cli.md#protocol-and-schema-versions'],
            [`docs/EXTENSIONS${suffix}.md`, suffix ? 'reference/cli.zh-CN.md#协议与-schema-版本' : 'reference/cli.md#protocol-and-schema-versions'],
        ] as const) {
            const original = pages.get(path)!, changed = new Map(pages);
            assert(original.includes(link), path);
            changed.set(path, original.replace(link, suffix ? 'reference/cli.zh-CN.md' : 'reference/cli.md'));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':') && error.includes('Missing centralized version link')), path);
        }
        for (const [path, before, replacement] of [
            [`docs/reference/cli${suffix}.md`, (suffix ? '显示 schema ' : 'display schema ') + SCHEMA_VERSION, suffix ? '显示 schema' : 'display schema'],
            [`docs/reference/cli${suffix}.md`, (suffix ? '编辑器协议 ' : 'editor protocol ') + PROTOCOL_VERSION, suffix ? '编辑器协议' : 'editor protocol'],
        ] as const) {
            const original = pages.get(path)!, changed = new Map(pages);
            assert(original.includes(before), path);
            changed.set(path, original.replace(before, replacement));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':') && error.includes('Missing centralized current interface versions')), path);
        }
        const gateRows = suffix
            ? [
                '| 子代理行及生命周期 hooks | 2.1.205+；逐任务 effort 需 2.1.214+ |',
                '| 带参数 slash 命令的本地执行、外部入口 | 2.1.258+ |',
                '| 会话内 Client 编辑器 | 2.1.287+ |',
                '| 原生计时及高级实时指标采集 | 2.1.289+ |',
            ]
            : [
                '| Subagent rows and lifecycle hooks | 2.1.205+; per-task effort 2.1.214+ |',
                '| Local argument-based slash commands, external entry | 2.1.258+ |',
                '| In-session Client editor | 2.1.287+ |',
                '| Native timing and advanced live-metrics collection | 2.1.289+ |',
            ];
        for (const row of gateRows) {
            const path = `docs/USER_GUIDE${suffix}.md`, original = pages.get(path)!;
            assert(original.includes(row), path);
            const changed = new Map(pages); changed.set(path, original.replace(row, ''));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':') && error.includes('Missing requirements row')), path + ': ' + row);
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
test('CLI option tables reject missing, unknown and duplicate options in either language', () => {
    for (const suffix of ['', '.zh-CN']) {
        const path = `docs/reference/cli${suffix}.md`, original = pages.get(path)!.replaceAll('\r\n', '\n');
        const row = original.match(/^\| `powerline-padding` \|.*$/mu)![0];
        for (const replacement of ['', row.replace('`powerline-padding`', '`unknown-option`'), row + '\n' + row]) {
            const changed = new Map(pages); changed.set(path, original.replace(row, replacement));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':') && error.includes('Set option IDs differ from CLI')));
        }
        for (const replacement of ['', '<!-- docs-example: cli-order -->\n<!-- docs-example: cli-order -->']) {
            const changed = new Map(pages); changed.set(path, original.replace('<!-- docs-example: cli-order -->', replacement));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':') && error.includes('Expected one cli-order example')));
        }
    }
});
