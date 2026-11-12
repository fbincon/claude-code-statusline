/** Inspect maintained Markdown, never execute its code fences. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS, NODE_TYPES } from '@fbincon/statusline-core/config/catalog';
import { SCHEMA_VERSION, defaultDisplay, isSchema, validateDisplay } from '@fbincon/statusline-core/config/display';
import { COMPLETE_SCHEMES, PRESET_PRESENTATION } from '@fbincon/statusline-core/config/presets';
import { OPERATIONS, PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { PROTOCOL_VERSION as RUNTIME_PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/runtime';
import { definition } from '@fbincon/statusline-core/extensions/model';
import { LANGUAGES, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/registry';
import { readJson } from '@fbincon/statusline-core/json-read';
import { MAX_REQUESTS, MAX_TASKS, MAX_TOOLS, MAX_TURNS } from '@fbincon/statusline-core/runtime/live/model';
import { DEVELOPMENT_CONTENT_PATHS, DOCUMENT_CONTENT_PATHS } from './impact-documentation.js';
import { HOSTS, TARGETS } from './runtime-inputs.js';
import { OPTIONS } from '@fbincon/statusline-cli/config/operations';
import { NATIVE } from '@fbincon/statusline-cli/integration/model';
import { MIN_COLUMNS, MIN_ROWS } from '@fbincon/statusline-tui/layout';

export type Documents = ReadonlyMap<string, string>;
export function contentDocuments(root: string): Documents {
    return new Map(DOCUMENT_CONTENT_PATHS.map(path => [path, readFileSync(join(root, path), 'utf8')]));
}
export function example(markdown: string, id: string, language: string): string {
    assert(/^[a-z-]+$/u.test(id));
    const marker = `<!-- docs-example: ${id} -->`;
    assert.equal(markdown.split(marker).length - 1, 1, `Expected one ${id} example`);
    const tail = markdown.split(marker)[1]!.replaceAll('\r\n', '\n');
    const match = tail.match(/^\n(?:[ \t]*\n)*```([^\n]+)\n([\s\S]*?)\n```(?:\n|$)/u);
    assert(match && match[1] === language, `Missing ${language} fence for ${id}`);
    return match[2]!;
}
export function sourceExample(markdown: string, id: 'local' | 'github' | 'command') {
    const value = exampleJson(markdown, id + '-source');
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Source must be an object');
    // Registration owns these fields; the documented definition must not set them.
    for (const field of ['id', 'enabled', 'revision']) assert(!Object.hasOwn(value, field), 'Registration owns ' + field);
    const parsed = definition({ ...value, id: 'docs-example', enabled: false, revision: 'docs-review' });
    assert.equal(parsed.kind, id === 'local' ? 'json' : id);
    return value;
}
export function displayExample(markdown: string) {
    const value = exampleJson(markdown, 'display-config');
    assert(value && typeof value === 'object' && 'schema_version' in value && isSchema(value.schema_version, SCHEMA_VERSION), 'Example must use the current display schema');
    return validateDisplay(value);
}
export function configSetOptions(markdown: string): string[] {
    const start = '<!-- cli-set-options:start -->', end = '<!-- cli-set-options:end -->';
    assert.equal(markdown.split(start).length, 2, 'Expected one set-options table start');
    assert.equal(markdown.split(end).length, 2, 'Expected one set-options table end');
    const tail = markdown.split(start)[1]!;
    assert(tail.includes(end), 'Set-options table end must follow its start');
    return [...tail.split(end)[0]!.replaceAll('\r\n', '\n').matchAll(/^\| `([^`]+)` \|/gmu)].map(match => match[1]!);
}
function exampleJson(markdown: string, id: string): unknown {
    return readJson(example(markdown, id, 'json'), { duplicate: key => assert.fail('Duplicate field ' + key), constant: token => assert.fail('Non-finite value ' + token) });
}
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const han = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
function count(value: string): number { return /^\d+$/u.test(value) ? Number(value) : Math.max(words.indexOf(value.toLowerCase()), han.indexOf(value)); }

export function contentErrors(pages: Documents, root = process.cwd()): string[] {
    const errors: string[] = [];
    const page = (path: string) => { const value = pages.get(path); assert(value !== undefined, 'Missing page'); return value; };
    const check = (path: string, verify: (body: string) => void) => {
        try { verify(page(path)); } catch (error) { errors.push(path + ': ' + (error instanceof Error ? error.message : String(error))); }
    };
    const metricCounts = ['main', 'subagent'].map(scope => ITEMS.filter(item => item.scope === scope && !(NODE_TYPES as readonly string[]).includes(item.id)).length);
    const defaults = defaultDisplay();
    const defaultCounts = [defaults.instances, defaults.subagents.instances].map(instances => instances.filter(item => item.enabled && !(NODE_TYPES as readonly string[]).includes(item.type_id)).length);
    const originals = PRESET_PRESENTATION.filter(preset => !(COMPLETE_SCHEMES as readonly string[]).includes(preset.id));
    const scripts = new Set(Object.keys(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<string, string>));
    const skillActions = readFileSync(join(root, 'packages/cli/resources/statusline-config/SKILL.md'), 'utf8')
        .match(/argument-hint: "\[([^\]]+)\]"/u)?.[1]?.split('|') ?? [];
    const toolDirs = readdirSync(join(root, 'tools'), { withFileTypes: true })
        .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    for (const suffix of ['', '.zh-CN']) {
        const readme = `README${suffix}.md`, metrics = `docs/DISPLAY_ITEMS${suffix}.md`, guide = `docs/USER_GUIDE${suffix}.md`, schemes = `docs/SCHEMES${suffix}.md`;
        for (const path of [readme, metrics, guide]) check(path, body => {
            const counts = body.match(/(\d+)\s*(?:main metrics|个主栏指标)[^\n.。]*?(\d+)\s*(?:subagent metrics|个子(?:代理| Agent )指标)/u);
            assert(counts, 'Missing metric counts');
            assert.deepEqual(counts.slice(1).map(Number), metricCounts, 'Metric counts differ from the catalog');
        });
        check(metrics, body => {
            const descriptions = body + page(guide);
            for (const item of ITEMS) assert(descriptions.includes('`' + item.id + '`'), 'Missing metric ID ' + item.id);
        });
        check(readme, body => {
            const languages = body.split('\n').find(line => /languages independently|分别选择界面与输出语言/u.test(line));
            assert(languages, 'Missing language list');
            for (const language of LANGUAGES) assert(languages.includes(LANGUAGE_NAMES[language]), 'Missing language ' + language);
            const counts = body.match(suffix ? /跨([^\s]+?)种语言/u : /across (\w+) languages/u);
            assert.equal(count(counts?.[1] ?? ''), LANGUAGES.length, 'Language count differs from registry');
            const presetCounts = body.match(suffix ? /([^\s]+?)套完整显示方案与([^\s]+?)种原有预设/u : /(\w+) complete display schemes and (\w+) original presets/u);
            assert(presetCounts, 'Missing scheme/preset counts');
            assert.deepEqual(presetCounts.slice(1).map(count), [COMPLETE_SCHEMES.length, originals.length]);
        });
        check(guide, body => {
            const declaration = body.match(/^(?:Supported codes are|语言代码为) (.+)$/mu)?.[1]?.split(/[.。]/u)[0];
            assert(declaration, 'Missing supported language declaration');
            assert.deepEqual([...declaration.matchAll(/`([^`]+)`/gu)].map(match => match[1]), [...LANGUAGES], 'Supported language codes differ from registry');
            const defaultMatches = body.match(/Defaults enable (\w+) main items and (\w+) subagent items|默认启用 ([0-9]+|[零一二三四五六七八九十]+) 个主栏条目和 ([0-9]+|[零一二三四五六七八九十]+) 个子代理条目/u);
            assert(defaultMatches, 'Missing default item counts');
            assert.deepEqual(defaultMatches.slice(1).filter((value): value is string => value !== undefined).map(count), defaultCounts, 'Default item counts differ from production defaults');
            const presetMatches = body.match(/(\w+) complete display schemes and (\w+) original presets|([0-9]+|[零一二三四五六七八九十]+)套完整显示方案与([0-9]+|[零一二三四五六七八九十]+)种原有预设/u);
            assert(presetMatches, 'Missing scheme/preset counts');
            assert.deepEqual(presetMatches.slice(1).filter((value): value is string => value !== undefined).map(count), [COMPLETE_SCHEMES.length, originals.length], 'Scheme/preset counts differ from the catalog');
            const requiredRows = suffix
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
            for (const row of requiredRows) assert(body.includes(row), 'Missing requirements row: ' + row);
            assert(body.includes('^22.0.0 || ^24.0.0'), 'Missing runtime Node range');
            assert(body.includes('complete `config apply`') || body.includes('完整 `config apply`'), 'Missing complete apply guidance');
            assert(body.includes('config language reset') && body.includes('config set statusline-language en'), 'Missing language downgrade guidance');
            assert(/claude-statusline setup --dry-run/u.test(body), 'Missing setup dry-run command');
            assert(/claude-statusline setup(?![ \t]+--dry-run)/u.test(body), 'Missing setup command');
        });
        check(`docs/EDITORS${suffix}.md`, body => {
            const rows = body.split(/\r?\n/u);
            const terminal = rows.find(row => row.startsWith('| `claude-statusline configure` |'));
            const dimensions = terminal?.match(/(\d+)×(\d+)/u);
            assert(dimensions, 'Missing terminal editor minimum size');
            assert.deepEqual(dimensions.slice(1).map(Number), [MIN_COLUMNS, MIN_ROWS], 'Terminal editor minimum size differs from production layout');
            const client = rows.find(row => row.startsWith('| `/statusline-configure-native` |'));
            assert.equal(client?.match(/(\d+\.\d+\.\d+)\+/u)?.[1], NATIVE.minimum.join('.'), 'Client minimum host differs from integration');
        });
        check(schemes, body => {
            const counts = body.match(suffix ? /下方([^\s]+?)套完整方案/u : /The (\w+) complete schemes below/u);
            assert.equal(count(counts?.[1] ?? ''), COMPLETE_SCHEMES.length, 'Scheme count differs from registry');
            const ids = [...body.matchAll(/^\| \[`([^`]+)`\]\(\.\.\/examples\/schemes\/[^)]+\)/gmu)].map(match => match[1]);
            assert.deepEqual(ids, [...COMPLETE_SCHEMES], 'Scheme IDs differ from registry');
            const originalLine = body.split('\n').find(line => /original preset IDs|种原有预设也继续可用/u.test(line));
            assert(originalLine, 'Missing original preset IDs');
            const originalCount = originalLine.match(suffix ? /^([^\s]+?)种原有预设/u : /^The (\w+) original preset IDs/u);
            assert.equal(count(originalCount?.[1] ?? ''), originals.length, 'Original preset count differs from registry');
            const declared = [...originalLine.matchAll(/`([^`]+)`/gu)].map(match => match[1]);
            assert.deepEqual(declared.sort(), originals.map(preset => preset.id).sort(), 'Original preset IDs differ from registry');
        });
        for (const base of ['docs/COMPOSITION', 'docs/EXTENSIONS', 'docs/SCHEMES', 'docs/reference/cli', 'docs/USER_GUIDE', 'docs/DISPLAY_ITEMS']) check(base + suffix + '.md', body => {
            // A compatibility range such as v1–v17 is not a current-version claim.
            const schemas = [...body.matchAll(/(?:display schema|显示 schema)\s*v?(\d+)(?![\d–-])/giu)];
            const protocols = [...body.matchAll(/(?:editor protocol|编辑器协议)\s*(\d+)/giu)];
            if (base === 'docs/reference/cli') assert(schemas.length && protocols.length, 'Missing centralized current interface versions');
            if (['docs/COMPOSITION', 'docs/EXTENSIONS'].includes(base)) {
                const link = suffix ? 'reference/cli.zh-CN.md#协议与-schema-版本' : 'reference/cli.md#protocol-and-schema-versions';
                assert(body.includes(link), 'Missing centralized version link');
            }
            for (const match of schemas) assert.equal(Number(match[1]), SCHEMA_VERSION, 'Display schema differs from core');
            for (const match of protocols) assert.equal(Number(match[1]), PROTOCOL_VERSION, 'Editor protocol differs from core');
        });
        check(`docs/EXTENSIONS${suffix}.md`, body => {
            for (const kind of ['local', 'github', 'command'] as const) sourceExample(body, kind);
            for (const id of ['github-workflow', 'command-workflow']) example(body, id, 'text');
            example(body, 'source-powershell', 'powershell');
        });
        for (const base of ['docs/COMPOSITION', 'docs/DRAFT_HISTORY']) check(base + suffix + '.md', body => { example(body, 'alignment-review', 'text'); });
        check(`docs/SETUP${suffix}.md`, body => { example(body, 'setup-powershell', 'powershell'); });
        check(`docs/reference/cli${suffix}.md`, body => {
            displayExample(body);
            assert.deepEqual(configSetOptions(body).sort(), [...OPTIONS].sort(), 'Set option IDs differ from CLI');
            for (const id of ['cli-order', 'cli-layout', 'cli-profile-target', 'cli-recover', 'cli-style-reuse', 'cli-group-reuse', 'cli-diagnose', 'cli-task'])
                example(body, id, 'text');
        });
    }
    const mainTypeCount = metricCounts[0]! + 2, subagentTypeCount = metricCounts[1]! + 2;
    for (const suffix of ['', '.zh-CN']) {
        const zh = suffix === '.zh-CN';
        for (const base of DEVELOPMENT_CONTENT_PATHS) check(base + suffix + '.md', body => {
            const expected = (value: string, message: string) => assert(body.includes(value), message);
            assert(!/Historical record \(frozen|历史记录（冻结/u.test(body), 'Current development page retains a historical banner');
            assert(!/^At this delivery\b|^本次交付中[，,]/mu.test(body), 'Current development page uses historical delivery framing');
            const prose = body.split(/\r?\n/u).filter(line => !/^\s*\|/u.test(line)).join('\n');
            const stale = /(?:display schema|显示 schema)\s*(?:8|9|10|16)\b|(?:editor protocol|编辑器协议)\s*(?:13|15|16|17|26|27|28|30)\b|(?:runtime protocol|运行协议)\s*2\b/u;
            assert(!stale.test(prose), 'Current development page states a historical interface version');
            for (const match of prose.matchAll(/(?:display schema|显示 schema)\s*v?(\d+)(?![\d–-])/giu))
                assert.equal(Number(match[1]), SCHEMA_VERSION, 'Display schema differs from core');
            for (const match of prose.matchAll(/(?:editor protocol|编辑器协议)\s*(\d+)/giu))
                assert.equal(Number(match[1]), PROTOCOL_VERSION, 'Editor protocol differs from core');
            if (base !== 'docs/development/live')
                for (const match of prose.matchAll(/(?:runtime protocol|运行协议)\s*v?(\d+)/giu))
                    assert.equal(Number(match[1]), RUNTIME_PROTOCOL_VERSION, 'Runtime protocol differs from core');
            for (const match of body.matchAll(/`npm run ([a-z][a-z0-9:_-]*)`/gu))
                assert(scripts.has(match[1]!), 'Unknown npm script ' + match[1]);
            const relative = base.slice('docs/development/'.length);
            if (existsSync(join(root, 'docs/development/history/deliveries', relative + '.md')))
                assert(body.includes('history/deliveries/' + relative), 'Missing delivery record link');
            switch (base) {
                case 'docs/development/testing':
                    if (zh) {
                        expected('8 安装目标', 'Installed target count differs from the matrix');
                        expected('32 个 Node 场景', 'Node case count differs from the matrix');
                        expected('16 宿主', 'Host count differs from the matrix');
                        expected('27 类检查', 'Installed check category count differs');
                    } else {
                        expected(`${TARGETS.length} installations`, 'Installed target count differs from the matrix');
                        expected(`${TARGETS.length * 4} Node cases`, 'Node case count differs from the matrix');
                        expected(`${HOSTS.length} hosts`, 'Host count differs from the matrix');
                        expected('27 check categories', 'Installed check category count differs');
                    }
                    break;
                case 'docs/development/contracts':
                    if (zh) {
                        expected(`全部 ${OPERATIONS.length} 项`, 'Operation count differs from core');
                        expected(`${mainTypeCount} 个主栏类型和 ${subagentTypeCount} 个子代理类型`, 'Catalog type count differs from core');
                        expected(`显示 schema ${SCHEMA_VERSION}`, 'Display schema differs from core');
                        expected(`协议 ${PROTOCOL_VERSION}`, 'Editor protocol differs from core');
                    } else {
                        expected(`all ${OPERATIONS.length} current \`OPERATIONS\``, 'Operation count differs from core');
                        expected(`${mainTypeCount} main and ${subagentTypeCount} subagent types`, 'Catalog type count differs from core');
                        expected(`Display schema ${SCHEMA_VERSION}`, 'Display schema differs from core');
                        expected(`Protocol ${PROTOCOL_VERSION}`, 'Editor protocol differs from core');
                    }
                    break;
                case 'docs/development/i18n':
                    for (const code of LANGUAGES) expected('`' + code + '`', 'Missing language ' + code);
                    break;
                case 'docs/development/node-regional-languages':
                    for (const code of LANGUAGES) expected('`' + code + '`', 'Missing language ' + code);
                    if (zh) {
                        expected('八个安装', 'Installed target count differs from the matrix');
                        expected(`${TARGETS.length * 4} 个 Node 用例`, 'Node case count differs from the matrix');
                        expected('十六个固定宿主', 'Host count differs from the matrix');
                    } else {
                        expected('eight installations', 'Installed target count differs from the matrix');
                        expected(`${TARGETS.length * 4} Node cases`, 'Node case count differs from the matrix');
                        expected('sixteen fixed hosts', 'Host count differs from the matrix');
                    }
                    break;
                case 'docs/development/i18n-workflow':
                    expected(zh ? `${LANGUAGES.length ** 2} 组语言组合` : `${LANGUAGES.length ** 2} language combinations`, 'Language combination count differs from registry');
                    break;
                case 'docs/development/live':
                    if (zh) {
                        expected(`${MAX_TURNS} 个 turn`, 'Turn bound differs from core');
                        expected(`${MAX_TOOLS.toLocaleString('en-US')} 个工具`, 'Tool bound differs from core');
                        expected(`${MAX_TASKS.toLocaleString('en-US')} 个任务`, 'Task bound differs from core');
                        expected(`${MAX_REQUESTS.toLocaleString('en-US')} 个请求`, 'Request bound differs from core');
                    } else {
                        expected(`${MAX_TURNS} turns`, 'Turn bound differs from core');
                        expected(`${MAX_TOOLS.toLocaleString('en-US')} tools`, 'Tool bound differs from core');
                        expected(`${MAX_TASKS.toLocaleString('en-US')} tasks`, 'Task bound differs from core');
                        expected(`${MAX_REQUESTS.toLocaleString('en-US')} requests`, 'Request bound differs from core');
                    }
                    break;
                case 'docs/development/native':
                    expected(zh ? '## 外部 TUI' : '## External TUI', 'Missing current External TUI section');
                    expected('A/D/X', 'Missing native control order');
                    break;
                case 'docs/development/ci-maintenance':
                    if (zh) {
                        expected(`${TARGETS.length * 5} 项逻辑`, 'Logical obligation count differs from the matrix');
                        expected(`${HOSTS.length} 个宿主`, 'Host count differs from the matrix');
                        expected('8 条完整／8 条短历史', 'Host history split differs from the matrix');
                    } else {
                        expected(`${TARGETS.length * 5} logical`, 'Logical obligation count differs from the matrix');
                        expected(`${HOSTS.length} fixed hosts`, 'Host count differs from the matrix');
                        expected('eight full / eight short', 'Host history split differs from the matrix');
                    }
                    break;
                case 'docs/development/README':
                    expected('packages/cli/resources/statusline-config/SKILL.md', 'Missing canonical skill path');
                    expected('packages/cli/resources/statusline-configure/SKILL.md', 'Missing canonical skill path');
                    break;
                case 'docs/development/architecture':
                    for (const name of toolDirs) expected(name + '/', 'Missing tools directory ' + name);
                    break;
                case 'docs/development/skill-workflows': {
                    const segment = zh ? body.match(/顶层动作：(.+?)。/u)?.[1] : body.match(/top-level actions are (.+?)\./u)?.[1];
                    assert(segment, 'Missing skill action list');
                    assert.deepEqual([...segment.matchAll(/`([^`]+)`/gu)].map(match => match[1]), skillActions, 'Skill actions differ from the canonical template');
                    break;
                }
                case 'docs/development/source-command-package-management':
                    if (zh) {
                        expected('300 秒', 'Automatic interval default differs from source');
                        expected('60–86400 秒', 'Automatic interval range differs from source');
                        expected('五秒续租、十五秒过期', 'Lease timing differs from source');
                    } else {
                        expected('300 seconds', 'Automatic interval default differs from source');
                        expected('60–86400', 'Automatic interval range differs from source');
                        expected('renew every five seconds and expire after fifteen', 'Lease timing differs from source');
                    }
                    break;
            }
        });
    }
    return errors;
}
