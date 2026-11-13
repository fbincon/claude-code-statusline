import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { anchors, checkApprovalData, checkChangelog, checkDeliveryRecords, checkReleases, configurationSection } from '../docs.js';
function nextHeading(text: string, anchor: string): string | undefined {
    const lines = text.split(/\r?\n/u);
    const start = lines.findIndex(line => line.includes(`<a id="${anchor}"></a>`));
    if (start < 0) return undefined;
    for (let index = start + 1; index < lines.length; index++)
        if (/^#{1,6}\s/u.test(lines[index]!)) return lines[index]!.trim();
    return undefined;
}
test('USER_GUIDE preserves legacy section anchors after reorganization', () => {
    const expected: Record<string, readonly string[]> = {
        'docs/USER_GUIDE.md': [
            'native-configuration-editor',
            'standalone-interactive-tui',
            'external-terminal-statusline-configure',
            'external-tui-sections',
            'external-tui-sections-and-page-hierarchy',
            'external-terminal-colors',
            'quick-setup-and-explanation',
            'quick-setup-text-editing-and-explanation',
            'formatting-layout-presets',
            'formatting-layouts-and-presets-v160',
            'reset-display-defaults-while-keeping-the-installation',
            'page-hierarchy-and-pagination',
            'preview-background-and-colors',
            'unicode-text-and-terminal-widths',
            'task-total-and-execution-time',
            'macos-mouse-reporting-and-client-focus',
            'migrate-the-previous-distribution-name',
            'native-editor-preview',
            'phase-5-preview-installation',
            'phase-5-stable-installation',
            'item-discovery-import-review',
            '常用配置配方',
        ],
        'docs/USER_GUIDE.zh-CN.md': [
            '原生配置编辑器',
            '独立交互式-tui',
            '外部终端入口-statusline-configure',
            'external-tui-sections',
            '外部-tui-的分组与页面层级',
            '外部终端配色',
            'quick-setup-and-explanation',
            '快速配置文本编辑与说明',
            'formatting-layout-presets',
            '格式布局与预设',
            '格式布局与预设v160',
            '恢复出厂显示配置但保留安装',
            '页面层级与分页',
            '预览背景与颜色',
            'unicode-文本与终端列宽',
            '子-agent-行与三种作用域',
            '子-agent-行不显示或发生所有权冲突',
            '任务总耗时与执行耗时',
            'macos-鼠标报告与-client-焦点',
            '迁移旧分发名称',
            'native-editor-preview',
            '原生编辑器预览',
            'phase-5-预览安装',
            'phase-5-正式版安装',
            'item-discovery-import-review',
            '查找项目与审阅导入',
            '常用配置配方',
            '显式布局与子-agent-显示条件',
            '明确接管第三方子-agent-行',
        ],
    };
    const placements: Record<string, Record<string, string>> = {
        'docs/USER_GUIDE.md': {
            'native-configuration-editor': '## In-session editor (Client)',
            'standalone-interactive-tui': '### Standalone entry: `claude-statusline configure`',
            'external-terminal-statusline-configure': '### External entry: `/statusline-configure`',
            'external-tui-sections': '### Terminal editor sections and page hierarchy',
            'external-terminal-colors': '### Terminal editor colors',
            'item-discovery-import-review': '## Find items and review imports',
            'formatting-layout-presets': '## Formatting, layouts and presets',
            'quick-setup-and-explanation': '## Quick setup, text editing and explanation',
            'reset-display-defaults-while-keeping-the-installation': '### Reset display and host defaults while keeping the installation',
            'migrate-the-previous-distribution-name': '### Migrate from Python',
        },
        'docs/USER_GUIDE.zh-CN.md': {
            '原生配置编辑器': '## 会话内编辑器（Client）',
            '独立交互式-tui': '### 独立入口：`claude-statusline configure`',
            '外部终端入口-statusline-configure': '### 外部入口：`/statusline-configure`',
            'external-tui-sections': '### 终端编辑器的分组与页面层级',
            '外部终端配色': '### 终端编辑器配色',
            '查找项目与审阅导入': '## 查找显示项与审阅导入',
            'formatting-layout-presets': '## 格式、布局与预设',
            'quick-setup-and-explanation': '## 快速配置、文本编辑与说明',
            '恢复出厂显示配置但保留安装': '### 恢复显示与宿主默认值但保留安装',
            '迁移旧分发名称': '### 从 Python 迁移',
            '子-agent-行与三种作用域': '### 子代理行与三种作用域',
            '子-agent-行不显示或发生所有权冲突': '### 子代理行不显示或发生所有权冲突',
        },
    };
    for (const [file, ids] of Object.entries(expected)) {
        const text = readFileSync(join(process.cwd(), file), 'utf8'), found = anchors(text);
        for (const id of ids) assert(found.has(id), file + ': missing anchor ' + id);
        for (const [id, heading] of Object.entries(placements[file] ?? {}))
            assert.equal(nextHeading(text, id), heading, file + ': ' + id + ' should precede ' + heading);
    }
});
test('onboarding comes first and moved editor sections keep useful bilingual destinations', () => {
    for (const suffix of ['', '.zh-CN']) {
        const read = (path: string) => readFileSync(join(process.cwd(), path + suffix + '.md'), 'utf8').replaceAll('\r\n', '\n');
        const guide = read('docs/USER_GUIDE'), editors = read('docs/EDITORS'), native = read('docs/development/native');
        const quick = suffix ? '## 快速开始' : '## Quick start';
        const contents = suffix ? '## 文档导航' : '## Contents';
        assert.equal(guide.slice(guide.indexOf(contents) + contents.length).match(/^## .+$/mu)?.[0], quick);
        for (const source of [read('docs/README'), guide])
            assert(source.includes(`](EDITORS${suffix}.md)`), 'Editor operations must be reachable from both entry pages');
        const headingBody = (body: string, heading: string) => {
            const start = body.indexOf(heading + '\n');
            assert(start >= 0, heading);
            return body.slice(start + heading.length).split(/\n#{1,6} /u)[0]!;
        };
        for (const [heading, target] of [
            [suffix ? '### 终端编辑器的分组与页面层级' : '### Terminal editor sections and page hierarchy', 'terminal-page-regions-and-footer'],
            [suffix ? '### 页面层级与分页' : '### Page hierarchy and pagination', 'client-pagination-and-footer'],
            [suffix ? '### 预览背景与颜色' : '### Preview background and colors', 'client-preview-background'],
            [suffix ? '### 文本输入' : '### Text input', 'text-input'],
        ]) {
            assert(headingBody(guide, heading!).includes(`](EDITORS${suffix}.md#${target})`), heading);
            assert(anchors(editors).has(target!), target);
        }
        for (const [anchor, target] of [
            ['client-page-hierarchy-footer-and-pagination', 'client-pagination-and-footer'],
            ['external-terminal-editor-page-regions-and-footer', 'terminal-page-regions-and-footer'],
        ]) {
            const heading = nextHeading(native, anchor!);
            assert(heading, anchor);
            assert(headingBody(native, heading).includes(`](../EDITORS${suffix}.md#${target})`), anchor);
            assert(anchors(editors).has(target!), target);
        }
    }
});
test('README configuration checks preserve the same section under Windows CRLF and POSIX LF', () => {
    for (const heading of ['Common configuration', '常用配置']) {
        const text = `# Project\n\n## ${heading}\n\n/statusline-configure-native\n\n### Child\n\nclaude-statusline config\n\n## Following\n\nwrong section\n`;
        const expected = configurationSection(text, heading);
        assert(expected.includes('/statusline-configure-native')); assert(expected.includes('claude-statusline config'));
        assert(!expected.includes('wrong section')); assert.equal(configurationSection(text.replaceAll('\n', '\r\n'), heading), expected);
    }
});
function releaseFixture(t: TestContext): { root: string; files: Record<string, string> } {
    const root = mkdtempSync(join(tmpdir(), 'release notes '));
    t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    return { root, files: {
        'v1.0.0.md': '# v1.0.0\n\n[English](#english) | [简体中文](#简体中文)\n\n<a id="english"></a>\n\n<a id="简体中文"></a>\n\n<details>\n<summary>简体中文</summary>\n\n中文摘要。\n\n</details>\n',
        'v9.0.0.md': '# v9.0.0 — Test release\n\n**English** | [简体中文](v9.0.0.zh-CN.md)\n\nPublished on **2026-01-01**. Delivery evidence.\n\nThis release verifies the template.\n\n- Change one.\n\nCompatibility. Rerun `claude-statusline install`.\n\nSupported platforms/runtimes: Node 22/24.\n\nOnly the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted.\n\n[Delivery record](../development/history/deliveries/test.md#final-release) · [Version decision](approvals/v9.0.0.json) · [Release process](../RELEASING.md).\n',
        'v9.0.0.zh-CN.md': '# v9.0.0 — 测试发布\n\n[English](v9.0.0.md) | **简体中文**\n\n已于 **2026-01-01** 发布。交付证据。\n\n本版本验证模板。\n\n- 变更一。\n\n兼容性。运行 `claude-statusline install`。\n\n支持平台／运行时：Node 22／24。\n\n仅接受 [issue #96 六项既有缺口](https://github.com/fbincon/claude-code-statusline/issues/96)。\n\n[交付记录](../development/history/deliveries/test.zh-CN.md#final-release) · [版本决策](approvals/v9.0.0.json) · [发布流程](../RELEASING.zh-CN.md).\n',
        'README.md': '# Release notes\n\n> **Current stable: [v9.0.0](v9.0.0.md)** · 2026-01-01\n\n## TypeScript v3.10 and later\n\n- [**v9.0.0**](v9.0.0.md) · 2026-01-01 · Latest — Test release · [中文](v9.0.0.zh-CN.md)\n\n## TypeScript v3.0–v3.9\n\n- [**v1.0.0**](v1.0.0.md) · 2020-01-01 · Stable — Initial · [中文](v1.0.0.md#简体中文)\n',
        'README.zh-CN.md': '# 发布说明\n\n> **当前正式版：[v9.0.0](v9.0.0.zh-CN.md)** · 2026-01-01\n\n## TypeScript v3.10 及后续版本\n\n- [**v9.0.0**](v9.0.0.zh-CN.md) · 2026-01-01 · 最新稳定版 — 测试发布 · [English](v9.0.0.md)\n\n## TypeScript v3.0–v3.9\n\n- [**v1.0.0**](v1.0.0.md#简体中文) · 2020-01-01 · 正式版 — 初始 · [English](v1.0.0.md#english)\n',
    } };
}
function writeReleaseFixture(root: string, files: Record<string, string>): void {
    for (const [name, body] of Object.entries(files)) {
        const path = join(root, 'docs', 'releases', name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, body);
    }
}
test('release template accepts a historical note and a current pair', t => {
    const fixture = releaseFixture(t);
    writeReleaseFixture(fixture.root, fixture.files);
    assert.deepEqual(checkReleases(fixture.root), []);
});
const invalidReleases: readonly [string, (files: Record<string, string>) => void, RegExp][] = [
    ['current pair without Chinese page', files => { delete files['v9.0.0.zh-CN.md']; }, /missing Simplified Chinese counterpart/u],
    ['separate Chinese page before v3.10.0', files => { files['v1.0.0.zh-CN.md'] = files['v1.0.0.md']!; }, /separate Chinese note is not allowed/u],
    ['current H1 without tag', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('# v9.0.0 — Test release', '# Release'); }, /H1 must start with v9\.0\.0/u],
    ['current note without publication date', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('Published on **2026-01-01**. ', ''); }, /missing a valid Published on date/u],
    ['current note without install step', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace(' Rerun `claude-statusline install`.', ''); }, /missing claude-statusline install/u],
    ['current note without decision link', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('[Version decision](approvals/v9.0.0.json) · ', ''); }, /missing version decision link/u],
    ['historical note without navigation', files => { files['v1.0.0.md'] = files['v1.0.0.md']!.replace('[English](#english) | [简体中文](#简体中文)\n\n', ''); }, /missing historical language navigation/u],
    ['Chinese anchor inside details', files => { files['v1.0.0.md'] = files['v1.0.0.md']!.replace('<a id="简体中文"></a>\n\n<details>', '<details>\n<a id="简体中文"></a>'); }, /Chinese anchor must precede the details block/u],
    ['duplicate index entry', files => { files['README.md'] = files['README.md']! + '- [**v9.0.0**](v9.0.0.md) · duplicate\n'; }, /v9\.0\.0 must appear exactly once/u],
    ['reserved Gitee heading', files => { files['v9.0.0.md'] = files['v9.0.0.md']! + '\n## Gitee installation and downloads\n'; }, /contains a reserved Gitee heading/u],
    ['mismatched change bullets', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('- Change one.', '- Change one.\n- Change two.'); }, /change bullet counts differ/u],
    ['mismatched publication dates', files => { files['v9.0.0.zh-CN.md'] = files['v9.0.0.zh-CN.md']!.replace('2026-01-01', '2026-01-02'); }, /publication dates differ/u],
    ['current note without #96 gaps', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('[#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96)', '#96 gaps'); }, /issue #96/u],
    ['current note without platform block', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('Node 22/24', 'Node'); }, /Node 22\/24/u],
    ['current note without delivery link', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('[Delivery record](../development/history/deliveries/test.md#final-release) · ', ''); }, /delivery record/u],
    ['current note without release guide', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace(' · [Release process](../RELEASING.md)', ''); }, /release guide/u],
    ['current note without compatibility', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('Compatibility. ', ''); }, /compatibility/u],
    ['current note without summary', files => { files['v9.0.0.md'] = files['v9.0.0.md']!.replace('\nThis release verifies the template.\n', '\n'); }, /summary/u],
    ['index date mismatch', files => { files['README.md'] = files['README.md']!.replace('· 2026-01-01 · Latest', '· 2026-01-02 · Latest'); }, /date differs/u],
    ['index status mismatch', files => { files['README.zh-CN.md'] = files['README.zh-CN.md']!.replace('· 最新稳定版 —', '· 正式版 —'); }, /status differs|Latest/u],
    ['duplicate Latest row', files => { files['README.md'] = files['README.md']!.replace('- [**v9.0.0**](v9.0.0.md) · 2026-01-01 · Latest — Test release · [中文](v9.0.0.zh-CN.md)', '- [**v9.0.0**](v9.0.0.md) · 2026-01-01 · Latest — Test release · [中文](v9.0.0.zh-CN.md)\n- [**v9.0.1**](v9.0.1.md) · 2026-01-01 · Latest — Duplicate · [中文](v9.0.1.zh-CN.md)'); }, /exactly one Latest/u],
    ['callout mismatch', files => { files['README.md'] = files['README.md']!.replace('Current stable: [v9.0.0]', 'Current stable: [v9.0.1]'); }, /callout/u],
];
for (const [name, mutate, expected] of invalidReleases)
    test('release template rejects ' + name, t => {
        const fixture = releaseFixture(t);
        mutate(fixture.files);
        writeReleaseFixture(fixture.root, fixture.files);
        assert.match(checkReleases(fixture.root).join('\n'), expected);
    });
test('repository release notes satisfy the release template', () => {
    assert.deepEqual(checkReleases(process.cwd()), []);
});

function changelogFixture(t: TestContext): { root: string; en: string; zh: string; write: (en: string, zh?: string) => void } {
    const root = mkdtempSync(join(tmpdir(), 'changelog '));
    t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    mkdirSync(join(root, 'packages', 'core', 'src'), { recursive: true });
    writeFileSync(join(root, 'packages', 'core', 'src', 'release.ts'), "export const VERSION = '3.16.4';\n");
    const en = `# Changelog

**English** | [简体中文](CHANGELOG.zh-CN.md)

## 3.16.4 — 2026-01-02

- Add one behavior.

- Published on npm, GitHub and Gitee on 2026-01-02. [Release notes](docs/releases/v3.16.4.md) · [Delivery record](docs/development/history/deliveries/test.md#final-release).

## 3.0.0-beta.1 — 2026-01-01

- First preview.

- [Release notes](docs/releases/v3.0.0-beta.1.md) · [Implementation and validation](docs/development/test.md).

## 2.0.0 - 2026-01-01

- Historical entry.
`;
    const zh = `# 变更日志

[English](CHANGELOG.md) | **简体中文**

## 3.16.4 — 2026-01-02

- 新增一项行为。

- 已于 2026-01-02 在 npm、GitHub 和 Gitee 发布。[发布说明](docs/releases/v3.16.4.zh-CN.md) · [交付记录](docs/development/history/deliveries/test.zh-CN.md#final-release)。

## 3.0.0-beta.1 — 2026-01-01

- 首个预览版。

- [发布说明](docs/releases/v3.0.0-beta.1.md#简体中文) · [实现与验证](docs/development/test.zh-CN.md)。

## 2.0.0 - 2026-01-01

- 历史条目。
`;
    const write = (english: string, chinese = zh): void => {
        writeFileSync(join(root, 'CHANGELOG.md'), english);
        writeFileSync(join(root, 'CHANGELOG.zh-CN.md'), chinese);
    };
    write(en, zh);
    return { root, en, zh, write };
}
test('changelog accepts historical and current entries without rewriting history', t => {
    const fixture = changelogFixture(t);
    assert.deepEqual(checkChangelog(fixture.root), []);
});
const invalidChangelogs: readonly [string, (fixture: ReturnType<typeof changelogFixture>) => void, RegExp][] = [
    ['a duplicate version', fixture => fixture.write(fixture.en.replace('## 3.0.0-beta.1 — 2026-01-01', '## 3.16.4 — 2026-01-01'), fixture.zh), /duplicate/u],
    ['out-of-order versions', fixture => fixture.write(fixture.en.replace('## 3.0.0-beta.1 — 2026-01-01', '## 3.16.5 — 2026-01-01'), fixture.zh), /order/u],
    ['out-of-order dates', fixture => fixture.write(fixture.en.replace('## 3.0.0-beta.1 — 2026-01-01', '## 3.0.0-beta.1 — 2026-01-03'), fixture.zh), /date/u],
    ['a top version that differs from release.ts', fixture => {
        writeFileSync(join(fixture.root, 'packages', 'core', 'src', 'release.ts'), "export const VERSION = '3.16.3';\n");
    }, /top version/u],
    ['a missing release-notes link', fixture => fixture.write(fixture.en.replace('[Release notes](docs/releases/v3.16.4.md) · ', ''), fixture.zh), /release notes/u],
    ['mismatched bilingual bullet counts', fixture => fixture.write(fixture.en, fixture.zh.replace('- 新增一项行为。', '- 新增一项行为。\n- 额外条目。')), /bullet count/u],
    ['a future em dash violation', fixture => fixture.write(fixture.en.replace('## 3.16.4 — 2026-01-02', '## 3.16.4 - 2026-01-02'), fixture.zh), /em dash/u],
    ['a future missing publication line', fixture => fixture.write(fixture.en.replace('Published on npm, GitHub and Gitee on 2026-01-02. ', ''), fixture.zh), /Published/u],
    ['a future release-notes link that is not first', fixture => fixture.write(fixture.en.replace('[Release notes](docs/releases/v3.16.4.md) · [Delivery record](docs/development/history/deliveries/test.md#final-release)', '[Delivery record](docs/development/history/deliveries/test.md#final-release) · [Release notes](docs/releases/v3.16.4.md)'), fixture.zh), /Release notes.*first|first.*Release notes/u],
    ['a future missing English delivery link', fixture => fixture.write(fixture.en.replace(' · [Delivery record](docs/development/history/deliveries/test.md#final-release)', ''), fixture.zh), /delivery record/u],
    ['a future missing Chinese delivery link', fixture => fixture.write(fixture.en, fixture.zh.replace(' · [交付记录](docs/development/history/deliveries/test.zh-CN.md#final-release)', '')), /delivery record|交付记录/u],
];
for (const [name, mutate, expected] of invalidChangelogs)
    test('changelog rejects ' + name, t => {
        const fixture = changelogFixture(t);
        mutate(fixture);
        assert.match(checkChangelog(fixture.root).join('\n'), expected);
    });
test('repository changelog satisfies the changelog template', () => {
    assert.deepEqual(checkChangelog(process.cwd()), []);
});

function deliveryFixture(t: TestContext): { root: string; write: (name: string, body: string, zh: string, link?: boolean) => void } {
    const root = mkdtempSync(join(tmpdir(), 'delivery records '));
    t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    const directory = join(root, 'docs', 'development', 'history', 'deliveries');
    mkdirSync(directory, { recursive: true });
    const write = (name: string, body: string, zh: string, link = true): void => {
        const zhName = name.replace(/\.md$/u, '.zh-CN.md');
        writeFileSync(join(directory, name), body);
        writeFileSync(join(directory, zhName), zh);
        writeFileSync(join(root, 'docs', 'development', 'history', 'README.md'), link
            ? `# Development history\n\n## Delivery records by topic\n\n| Area | Delivery records |\n| --- | --- |\n| Test | [Record](deliveries/${name}) |\n`
            : '# Development history\n');
        writeFileSync(join(root, 'docs', 'development', 'history', 'README.zh-CN.md'), link
            ? `# 开发历史\n\n## 按主题查找交付记录\n\n| 领域 | 交付记录 |\n| --- | --- |\n| 测试 | [记录](deliveries/${zhName}) |\n`
            : '# 开发历史\n');
    };
    return { root, write };
}
const deliveryEnglish = `# Delivery record test\n\n**English** | [简体中文](record.zh-CN.md)\n\nThis 2026-11-15 documentation maintenance adds a fixture. Product behavior is unchanged; no version, tag, Release or npm publication is created.\n\n## Changes\n\n| Area | Result |\n| --- | --- |\n| Fixture | Added. |\n\n## Source identities\n\n- Baseline before the task: \`abc1234\`.\n\n## Validation and limits\n\n| Check | Actual result |\n| --- | --- |\n| \`npm run docs:check\` | Passed. |\n`;
const deliveryChinese = `# 交付记录测试\n\n[English](record.md) | **简体中文**\n\n本次 2026-11-15 的文档维护新增测试夹具。产品行为不变；不创建版本、标签、Release 或 npm 发布。\n\n## 变更\n\n| 领域 | 结果 |\n| --- | --- |\n| 夹具 | 已新增。 |\n\n## 源码身份\n\n- 任务前基线：\`abc1234\`。\n\n## 验证与限制\n\n| 检查 | 实际结果 |\n| --- | --- |\n| \`npm run docs:check\` | 通过。 |\n`;
test('delivery template accepts a current dated record and CRLF', t => {
    for (const ending of ['\n', '\r\n']) {
        const fixture = deliveryFixture(t);
        fixture.write('record.md', deliveryEnglish.replaceAll('\n', ending), deliveryChinese.replaceAll('\n', ending));
        assert.deepEqual(checkDeliveryRecords(fixture.root), []);
    }
});
test('delivery template accepts pre-boundary and date-less records', t => {
    const fixture = deliveryFixture(t);
    fixture.write('record.md', '# Legacy\n\n**English** | [简体中文](record.zh-CN.md)\n\nThis 2026-11-13 record predates the template.\n', '# 历史\n\n[English](record.md) | **简体中文**\n\n本次 2026-11-13 的记录早于模板。\n');
    assert.deepEqual(checkDeliveryRecords(fixture.root), []);
    fixture.write('record.md', '# Undated\n\n**English** | [简体中文](record.zh-CN.md)\n\nThis change has no dated intro.\n', '# 无日期\n\n[English](record.md) | **简体中文**\n\n本次变更未写日期。\n');
    assert.deepEqual(checkDeliveryRecords(fixture.root), []);
});
const invalidDeliveries: readonly [string, (body: string) => string, RegExp][] = [
    ['a missing Changes heading', body => body.replace('## Changes\n\n', ''), /missing ## Changes/u],
    ['headings out of order', body => body.replace(
        '## Source identities\n\n- Baseline before the task: `abc1234`.\n\n## Validation and limits\n\n| Check | Actual result |\n| --- | --- |\n| `npm run docs:check` | Passed. |',
        '## Validation and limits\n\n| Check | Actual result |\n| --- | --- |\n| `npm run docs:check` | Passed. |\n\n## Source identities\n\n- Baseline before the task: `abc1234`.'),
        /out of order/u],
    ['a malformed intro date', body => body.replace('2026-11-15', '2026-13-40'), /valid dated intro/u],
];
for (const [name, mutate, expected] of invalidDeliveries)
    test('delivery template rejects ' + name, t => {
        const fixture = deliveryFixture(t);
        fixture.write('record.md', mutate(deliveryEnglish), deliveryChinese);
        assert.match(checkDeliveryRecords(fixture.root).join('\n'), expected);
    });
test('delivery template rejects mismatched dates and missing index links', t => {
    const fixture = deliveryFixture(t);
    fixture.write('record.md', deliveryEnglish, deliveryChinese.replace('2026-11-15', '2026-11-16'));
    assert.match(checkDeliveryRecords(fixture.root).join('\n'), /intro dates differ/u);
    fixture.write('record.md', deliveryEnglish, deliveryChinese, false);
    assert.match(checkDeliveryRecords(fixture.root).join('\n'), /not linked from the delivery index/u);
});
test('repository delivery records satisfy the delivery template', () => {
    assert.deepEqual(checkDeliveryRecords(process.cwd()), []);
});

const acceptanceGaps = [
    'physical-macos-sleep', 'macos-14-intel-desktop-power', 'windows-10-desktop',
    'wsl-desktop-popup', 'remaining-target-power-and-human-visual', 'claude-2.1.296-exact-declarations',
];
function approvalFixture(t: TestContext): { root: string; write: (value: unknown, extra?: string) => void } {
    const root = mkdtempSync(join(tmpdir(), 'approvals '));
    t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    const directory = join(root, 'docs', 'releases', 'approvals');
    mkdirSync(directory, { recursive: true });
    const write = (value: unknown, extra?: string): void => {
        writeFileSync(join(directory, 'registry.json'), JSON.stringify({ schema_version: 1,
            approvals: [{ version: '9.9.9', path: 'docs/releases/approvals/v9.9.9.json', approved_on: '2026-01-01' }] }));
        writeFileSync(join(directory, 'v9.9.9.json'), JSON.stringify(value));
        if (extra) writeFileSync(join(directory, extra), '{}');
    };
    return { root, write };
}
const approval = {
    schema_version: 1, version: '9.9.9', decision: 'accept-known-gaps', approved_by: 'fbincon',
    approved_on: '2026-01-01', authority: 'Test approval',
    reference: 'https://github.com/fbincon/claude-code-statusline/issues/96', accepted_gaps: acceptanceGaps,
};
test('approval decisions match the registry template', t => {
    const fixture = approvalFixture(t);
    fixture.write(approval);
    assert.deepEqual(checkApprovalData(fixture.root), []);
    fixture.write({ ...approval, decision: 'all-passed' });
    assert.match(checkApprovalData(fixture.root).join('\n'), /all-passed/u);
    fixture.write({ ...approval, approved_on: '2026-01-02' });
    assert.match(checkApprovalData(fixture.root).join('\n'), /date differs/u);
    fixture.write(approval, 'v9.9.10.json');
    assert.match(checkApprovalData(fixture.root).join('\n'), /not registered/u);
});
test('approval check tolerates a repository without an approval registry', t => {
    const root = mkdtempSync(join(tmpdir(), 'approvals empty '));
    t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    assert.deepEqual(checkApprovalData(root), []);
});
test('repository approval decisions satisfy the registry template', () => {
    assert.deepEqual(checkApprovalData(process.cwd()), []);
});
