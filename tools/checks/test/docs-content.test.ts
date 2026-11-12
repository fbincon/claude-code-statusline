import test from 'node:test';
import assert from 'node:assert/strict';
import { contentDocuments, contentErrors, example, sourceExample } from '../docs-content.js';
import { ITEMS, NODE_TYPES } from '@fbincon/statusline-core/config/catalog';
import { SCHEMA_VERSION } from '@fbincon/statusline-core/config/display';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { LANGUAGES, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/registry';
import { developmentFacts, sourceReader, type SourceReader } from '../docs-source-facts.js';

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

test('development content checks reject changed current facts and historical framing', () => {
    for (const suffix of ['', '.zh-CN']) {
        for (const [path, before, after] of [
            [`docs/development/testing${suffix}.md`, suffix ? '27 类检查' : '27 check categories', suffix ? '20 类检查' : '20 check categories'],
            [`docs/development/testing${suffix}.md`, suffix ? '8 安装目标' : '8 installations', suffix ? '9 安装目标' : '9 installations'],
            [`docs/development/contracts${suffix}.md`, suffix ? '全部 41 项' : 'all 41 current `OPERATIONS`', suffix ? '全部 40 项' : 'all 40 current `OPERATIONS`'],
            [`docs/development/contracts${suffix}.md`, suffix ? '67 个主栏类型和 17 个子代理类型' : '67 main and 17 subagent types', suffix ? '66 个主栏类型和 17 个子代理类型' : '66 main and 17 subagent types'],
            [`docs/development/i18n${suffix}.md`, '`pt-BR`', '`xx-XX`'],
            [`docs/development/node-regional-languages${suffix}.md`, '`pt-BR`', '`xx-XX`'],
            [`docs/development/node-regional-languages${suffix}.md`, suffix ? '八个安装' : 'eight installations', suffix ? '七个安装' : 'nine installations'],
            [`docs/development/i18n-workflow${suffix}.md`, suffix ? '144 组语言组合' : '144 language combinations', suffix ? '143 组语言组合' : '143 language combinations'],
            [`docs/development/live${suffix}.md`, suffix ? '1,024 个工具' : '1,024 tools', suffix ? '2,024 个工具' : '2,024 tools'],
            [`docs/development/native${suffix}.md`, 'A/D/X', 'A/X/D'],
            [`docs/development/ci-maintenance${suffix}.md`, suffix ? '40 项逻辑' : '40 logical', suffix ? '41 项逻辑' : '41 logical'],
            [`docs/development/README${suffix}.md`, 'packages/cli/resources/statusline-config/SKILL.md', 'packages/cli/resources/statusline-config/SKILL-none.md'],
            [`docs/development/adaptive-row-scenarios${suffix}.md`, 'history/deliveries/adaptive-row-scenarios', 'history/missing-record'],
            [`docs/development/architecture${suffix}.md`, 'benchmarks/', 'benchmarkz/'],
            [`docs/development/skill-workflows${suffix}.md`, suffix ? '`show`、`list-items`' : '`show`, `list-items`', suffix ? '`show`、`missing-action`' : '`show`, `missing-action`'],
            [`docs/development/source-command-package-management${suffix}.md`, suffix ? '300 秒' : '300 seconds', suffix ? '600 秒' : '600 seconds'],
        ] as const) {
            const original = pages.get(path)!, changed = new Map(pages);
            assert(original.includes(before), path);
            changed.set(path, original.replaceAll(before, after));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':')), path + ': ' + before);
        }
        const path = `docs/development/architecture${suffix}.md`, original = pages.get(path)!;
        for (const injection of suffix
            ? ['> **历史记录（冻结于 v3.0.0，2026-01-01）。**\n\n', '本次交付中，页面为当前状态。\n\n', '显示 schema 8 为当前版本。\n\n', '运行 `npm run docs:checkk`。\n\n']
            : ['> **Historical record (frozen at v3.0.0, 2026-01-01).**\n\n', 'At this delivery, the page was current.\n\n', 'Display schema 8 is current.\n\n', 'Run `npm run docs:checkk`.\n\n']) {
            const changed = new Map(pages); changed.set(path, injection + original);
            assert(contentErrors(changed).some(error => error.startsWith(path + ':')), injection);
        }
    }
});

test('numeric declarations reject larger suffix matches, malformed values and conflicting duplicates', () => {
    for (const suffix of ['', '.zh-CN']) {
        const zh = Boolean(suffix);
        for (const [base, before, after] of [
            ['testing', zh ? '8 安装目标' : '8 installations', zh ? '18 安装目标' : '18 installations'],
            ['testing', zh ? '32 个 Node 场景' : '32 Node cases', zh ? '132 个 Node 场景' : '132 Node cases'],
            ['testing', zh ? '16 宿主' : '16 hosts', zh ? '116 宿主' : '116 hosts'],
            ['testing', zh ? '27 类检查' : '27 check categories', zh ? '127 类检查' : '127 check categories'],
            ['contracts', zh ? '67 个主栏类型和 17 个子代理类型' : '67 main and 17 subagent types', zh ? '167 个主栏类型和 17 个子代理类型' : '167 main and 17 subagent types'],
            ['i18n-workflow', zh ? '144 组语言组合' : '144 language combinations', zh ? '1144 组语言组合' : '1144 language combinations'],
            ['live', zh ? '1,024 个工具' : '1,024 tools', zh ? '11,024 个工具' : '11,024 tools'],
            ['live', zh ? '1,024 个工具' : '1,024 tools', zh ? '1,02 个工具' : '1,02 tools'],
            ['ci-maintenance', zh ? '40 项逻辑' : '40 logical', zh ? '140 项逻辑' : '140 logical'],
            ['source-command-package-management', zh ? '300 秒' : '300 seconds', zh ? '1300 秒' : '1300 seconds'],
            ['source-command-package-management', '60–86400', '160–86400'],
            ['source-command-package-management', '60–86400', '60–186400'],
            ['source-command-package-management', zh ? '五秒续租' : 'every five seconds', zh ? '五五秒续租' : 'every fifty-five seconds'],
        ]) {
            const path = `docs/development/${base}${suffix}.md`, original = pages.get(path)!;
            assert(original.includes(before!));
            const changed = new Map(pages); changed.set(path, original.replaceAll(before!, after!));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':')), path + ': ' + after);
        }
        const path = `docs/development/testing${suffix}.md`, original = pages.get(path)!;
        for (const addition of [zh ? '另需 18 安装目标。' : 'Also require 18 installations.', zh ? '另需 9 安装目标。' : 'Also require 9 installations.']) {
            const changed = new Map(pages); changed.set(path, original + '\n' + addition);
            assert(contentErrors(changed).some(error => error.startsWith(path + ':')), addition);
        }
    }
});

test('current live protocol declarations are required while explicit history and compatibility remain valid', () => {
    for (const suffix of ['', '.zh-CN']) {
        const zh = Boolean(suffix), path = `docs/development/live${suffix}.md`, original = pages.get(path)!;
        for (const [before, after] of [
            [zh ? '运行协议 **3**' : 'Runtime protocol **3**', zh ? '运行协议 **999**' : 'Runtime protocol **999**'],
            [zh ? '当前运行协议 v3' : 'Current runtime protocol v3', zh ? '当前运行协议 v999' : 'Current runtime protocol v999'],
            [zh ? '运行协议 **3**' : 'Runtime protocol **3**', zh ? '接口' : 'The interface'],
            [zh ? '当前运行协议 v3' : 'Current runtime protocol v3', zh ? '该接口' : 'The interface'],
        ]) {
            assert(original.includes(before!));
            const changed = new Map(pages); changed.set(path, original.replace(before!, after!));
            assert(contentErrors(changed).some(error => error.startsWith(path + ':')), after);
        }
        const compatible = new Map(pages);
        compatible.set(path, original + (zh
            ? '\n运行协议 v2 引入历史能力。读取兼容显示 schema v1–v17。\n\n## 协议历史\n\n| 引入 | 版本 |\n| --- | --- |\n| 运行协议 2 | 历史 |\n'
            : '\nRuntime protocol v2 introduced a historical capability. Read-compatible display schema v1–v17.\n\n## Protocol history\n\n| Introduction | Version |\n| --- | --- |\n| Runtime protocol 2 | Historical |\n'));
        assert.deepEqual(contentErrors(compatible), []);
        const duplicate = new Map(pages);
        duplicate.set(path, original + '\n' + (zh ? '当前运行协议 v3 保留兼容行为。' : 'Current runtime protocol v3 retains compatibility.'));
        assert(contentErrors(duplicate).some(error => error.startsWith(path + ':')));
        const currentTable = new Map(pages);
        currentTable.set(path, original + '\n## Current interface\n\n| Current | Version |\n| --- | --- |\n| runtime protocol 999 | Current |\n');
        assert(contentErrors(currentTable).some(error => error.startsWith(path + ':')));
    }
});

test('npm scripts are checked in literal inline commands, supported fences, arguments and continuations without execution', () => {
    for (const suffix of ['', '.zh-CN']) {
        const path = `docs/development/README${suffix}.md`, original = pages.get(path)!.replaceAll('\r\n', '\n');
        for (const ending of ['\n', '\r\n']) {
            const checkout = original.replaceAll('\n', ending), before = 'npm run build' + ending;
            assert(checkout.includes(before), 'Missing build command mutation target');
            const changed = new Map(pages); changed.set(path, checkout.replace(before, 'npm run builx' + ending));
            assert(contentErrors(changed).some(error => error.includes('Unknown npm script builx')), suffix + ': ' + JSON.stringify(ending));
        }
        for (const language of ['bash', 'sh', 'shell', 'powershell', 'ps1', 'console', 'text']) {
            const fence = (text: string) => '\n```' + language + '\n' + text + '\n```\n';
            const continuation = ['powershell', 'ps1'].includes(language) ? '`' : '\\';
            for (const command of ['npm run no-such-script -- --argument', 'npm run ' + continuation + '\n no-such-script -- --argument',
                'npm run build && npm run no-such-script', 'npm run --prefix mods/statusline-native no-such-script']) {
                const invalid = new Map(pages); invalid.set(path, original + fence(command));
                assert(contentErrors(invalid).some(error => error.startsWith(path + ':') && error.includes('Unknown npm script no-such-script')), language + ': ' + command);
            }
            const valid = new Map(pages);
            valid.set(path, original + fence('# npm run comment-is-not-a-command\necho "npm run quoted-prose"\nnpm run "build" -- --literal "x;y"\nnpm run ' + continuation + '\n clean -- --dry-run\nnpm run --prefix mods/statusline-native typecheck'));
            assert.deepEqual(contentErrors(valid), []);
        }
        for (const command of ['npm run no-such-script -- --argument', 'npm.cmd run no-such-script']) {
            const invalid = new Map(pages); invalid.set(path, original + '\n`' + command + '`\n');
            assert(contentErrors(invalid).some(error => error.includes('Unknown npm script no-such-script')));
        }
    }
});

type Patch = readonly [path: string, before: string, after: string];
function patchedSources(patches: readonly Patch[]): SourceReader {
    const read = sourceReader(process.cwd()), changed = new Map<string, string>();
    for (const [path, before, after] of patches) {
        const original = changed.get(path) ?? read(path); assert(original.includes(before), path + ': ' + before);
        changed.set(path, original.replaceAll(before, after));
    }
    return path => changed.get(path) ?? read(path);
}
test('source changes invalidate old docs and accept corrected docs through the same production fact reader', () => {
    const service = 'packages/cli/src/sources/service.ts', state = 'packages/cli/src/sources/automatic-state.ts';
    const registry = 'packages/core/src/extensions/model.ts', observer = 'mods/statusline-runtime/hooks/observe.ts';
    const cases: { patches: Patch[]; documents: [base: string, enBefore: string, enAfter: string, zhBefore: string, zhAfter: string][] }[] = [
        { patches: [service, state].map(path => [path, "kind === 'command' ? 300", "kind === 'command' ? 600"]),
            documents: [['source-command-package-management', '300 seconds', '600 seconds', '300 秒', '600 秒']] },
        { patches: [
            ...[service, state].map((path): Patch => [path, 'Math.max(60, Math.min(86400', 'Math.max(90, Math.min(86400']),
            ...[service, registry].map((path): Patch => [path, ", 60, 86400, 'interval_seconds'", ", 90, 86400, 'interval_seconds'"]),
        ], documents: [['source-command-package-management', '60–86400', '90–86400', '60–86400', '90–86400']] },
        { patches: [
            ...[service, state].map((path): Patch => [path, 'Math.min(86400,', 'Math.min(43200,']),
            ...[service, registry].map((path): Patch => [path, ", 60, 86400, 'interval_seconds'", ", 60, 43200, 'interval_seconds'"]),
        ], documents: [['source-command-package-management', '60–86400', '60–43200', '60–86400', '60–43200']] },
        { patches: [[observer, '$.clock.every(5000,', '$.clock.every(7000,']],
            documents: [['source-command-package-management', 'every five seconds', 'every seven seconds', '五秒续租', '七秒续租']] },
        { patches: [[state, 'LEASE_MS = 15000', 'LEASE_MS = 30000']],
            documents: [['source-command-package-management', 'expire after fifteen', 'expire after thirty', '十五秒过期', '三十秒过期']] },
        { patches: [['tools/migration/ts-04/test/installed.test.ts', 'i18n_workflow: false }', 'i18n_workflow: false, extra_category: false }']],
            documents: [['testing', '27 check categories', '28 check categories', '27 类检查', '28 类检查']] },
        { patches: [
            ['tools/checks/ci-coverage.ts', "'24.0.0', '24.x'];", "'24.0.0', '24.x', '24.1.0'];"],
            ['tools/checks/runtime-inputs.ts', "'24.x': latest(24)", "'24.x': latest(24), '24.1.0': '24.1.0'"],
        ], documents: [
            ['testing', '32 Node cases', '40 Node cases', '32 个 Node 场景', '40 个 Node 场景'],
            ['node-regional-languages', '32 Node cases', '40 Node cases', '32 个 Node 用例', '40 个 Node 用例'],
            ['ci-maintenance', '40 logical', '48 logical', '40 项逻辑', '48 项逻辑'],
        ] },
    ];
    for (const { patches, documents } of cases) {
        const read = patchedSources(patches);
        assert(contentErrors(pages, process.cwd(), read).length > 0, patches[0]![1]);
        const corrected = new Map(pages);
        for (const [base, enBefore, enAfter, zhBefore, zhAfter] of documents) for (const suffix of ['', '.zh-CN']) {
            const path = `docs/development/${base}${suffix}.md`, original = corrected.get(path)!;
            const before = suffix ? zhBefore : enBefore, after = suffix ? zhAfter : enAfter;
            assert(original.includes(before)); corrected.set(path, original.replaceAll(before, after));
        }
        for (const ending of ['\n', '\r\n']) assert.deepEqual(contentErrors(new Map([...corrected].map(([path, body]) =>
            [path, body.replaceAll('\r\n', '\n').replaceAll('\n', ending)])), process.cwd(), read), [], patches[0]![1]);
    }
});

test('missing, ambiguous, unparsable and inconsistent production definitions fail closed', () => {
    for (const patches of [
        [['packages/cli/src/sources/automatic-state.ts', 'LEASE_MS = 15000', 'OTHER_LEASE_MS = 15000']],
        [['packages/cli/src/sources/automatic-state.ts', 'LEASE_MS = 15000', 'LEASE_MS = 15000; const LEASE_MS = 15000']],
        [['packages/cli/src/sources/automatic-state.ts', 'LEASE_MS = 15000', 'LEASE_MS = ;']],
        [['packages/cli/src/sources/automatic-state.ts', 'LEASE_MS = 15000', 'LEASE_MS = calculateLease()']],
        [['packages/cli/src/sources/service.ts', "kind === 'command' ? 300", "kind === 'command' ? 600"]],
        [['packages/core/src/extensions/model.ts', ", 60, 86400, 'interval_seconds'", ", 90, 86400, 'interval_seconds'"]],
        [['mods/statusline-runtime/hooks/observe.ts', '$.clock.every(5000,', '$.clock.after(5000,']],
        [['tools/migration/ts-04/test/installed.test.ts', 'i18n_workflow: false }', 'i18n_workflow: false, ...otherChecks }']],
        [['tools/checks/ci-coverage.ts', "'24.0.0', '24.x'];", "'24.0.0', '24.x', '24.1.0'];"]],
    ] as const) {
        const read = patchedSources(patches);
        assert.throws(() => developmentFacts(process.cwd(), read), patches[0][1]);
        assert.throws(() => contentErrors(pages, process.cwd(), read), patches[0][1]);
    }
    assert.throws(() => developmentFacts(process.cwd(), () => { throw new Error('Unavailable source'); }), /Unavailable source/u);
});
