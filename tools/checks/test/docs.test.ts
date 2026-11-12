import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { anchors, configurationSection } from '../docs.js';
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
test('README configuration checks preserve the same section under Windows CRLF and POSIX LF', () => {
    for (const heading of ['Common configuration', '常用配置']) {
        const text = `# Project\n\n## ${heading}\n\n/statusline-configure-native\n\n### Child\n\nclaude-statusline config\n\n## Following\n\nwrong section\n`;
        const expected = configurationSection(text, heading);
        assert(expected.includes('/statusline-configure-native')); assert(expected.includes('claude-statusline config'));
        assert(!expected.includes('wrong section')); assert.equal(configurationSection(text.replaceAll('\n', '\r\n'), heading), expected);
    }
});
