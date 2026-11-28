/** Inspect maintained Markdown, never execute its code fences. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BY_SCOPE, ITEMS, NODE_TYPES } from '@fbincon/statusline-core/config/catalog';
import { SCHEMA_VERSION, defaultDisplay, isSchema, validateDisplay } from '@fbincon/statusline-core/config/display';
import { COMPLETE_SCHEMES, PRESET_PRESENTATION } from '@fbincon/statusline-core/config/presets';
import { EDITOR_SHORTCUTS_FILENAME, EDITOR_SHORTCUTS_SCHEMA_VERSION, OPERATIONS, PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { PROTOCOL_VERSION as RUNTIME_PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/runtime';
import { EDITOR_PAGES } from '@fbincon/statusline-core/editor/draft';
import { reservedNativeKeys, shortcutAliases } from '@fbincon/statusline-core/editor/shortcut-map';
import { definition } from '@fbincon/statusline-core/extensions/model';
import { LANGUAGES, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/registry';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { readJson } from '@fbincon/statusline-core/json-read';
import { PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { AGENT_ROW_MINIMUM, LEGACY_ROW_RANGES } from '@fbincon/statusline-core/integration/agent-row-capabilities';
import { MAX_REQUESTS, MAX_TASKS, MAX_TOOLS, MAX_TURNS } from '@fbincon/statusline-core/runtime/live/model';
import { DEVELOPMENT_CONTENT_PATHS, DOCUMENT_CONTENT_PATHS } from './impact-documentation.js';
import { developmentFacts, sourceReader, type SourceReader } from './docs-source-facts.js';
import { checkInterfaceVersions, checkNpmScripts, documentationProse, NUMBER, numericClaims } from './docs-markdown.js';
import { OPTIONS } from '@fbincon/statusline-cli/config/operations';
import { AGENT_ROWS, NATIVE } from '@fbincon/statusline-cli/integration/model';
import { DEADLINE_SECONDS, HOOK_TIMEOUT_SECONDS } from '@fbincon/statusline-platform/terminal/bridge';
import { ACTIVE_REFRESH_MS, IDLE_REFRESH_MS, MAX_REFRESH_BACKOFF_MS } from '@fbincon/statusline-tui/foreground-refresh';
import { MIN_COLUMNS, MIN_ROWS } from '@fbincon/statusline-tui/layout';
import { candidateCasesForNode } from './release-ci-policy.js';
import { AGENT_ROWS_MANIFEST } from './runtime-inputs.js';
import { SCOPED_HOSTED_JOB_MS } from './impact-budget.js';

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
    if (id === 'github') assert.equal(parsed.settings.branch, null, 'The GitHub example should follow the current branch');
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

export function contentErrors(pages: Documents, root = process.cwd(), readSource: SourceReader = sourceReader(root)): string[] {
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
    const facts = developmentFacts(root, readSource);
    const releaseCases = candidateCasesForNode(readFileSync(join(root, '.node-version'), 'utf8').trim(), existsSync(join(root, AGENT_ROWS_MANIFEST)));
    const tabNames = EDITOR_PAGES.map(page => t('native.tabs.' + page));
    for (const suffix of ['', '.zh-CN']) {
        const readme = `README${suffix}.md`, metrics = `docs/DISPLAY_ITEMS${suffix}.md`, guide = `docs/USER_GUIDE${suffix}.md`, schemes = `docs/SCHEMES${suffix}.md`;
        const tabOrder = suffix ? tabNames.join('、') : tabNames.slice(0, -1).join(', ') + ' and ' + tabNames.at(-1);
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
            assert(body.includes(tabOrder), 'Editor page order differs from the shared editor');
            const declaration = body.match(/^(?:Supported codes are|语言代码为) (.+)$/mu)?.[1]?.split(/[.。]/u)[0];
            assert(declaration, 'Missing supported language declaration');
            assert.deepEqual([...declaration.matchAll(/`([^`]+)`/gu)].map(match => match[1]), [...LANGUAGES], 'Supported language codes differ from registry');
            const defaultMatches = body.match(/Defaults enable (\w+) main items and (\w+) subagent items|默认启用 ([0-9]+|[零一二三四五六七八九十]+) 个主栏条目和 ([0-9]+|[零一二三四五六七八九十]+) 个子代理条目/u);
            assert(defaultMatches, 'Missing default item counts');
            assert.deepEqual(defaultMatches.slice(1).filter((value): value is string => value !== undefined).map(count), defaultCounts, 'Default item counts differ from production defaults');
            const presetMatches = body.match(/(\w+) complete display schemes and (\w+) original presets|([0-9]+|[零一二三四五六七八九十]+)套完整显示方案与([0-9]+|[零一二三四五六七八九十]+)种原有预设/u);
            assert(presetMatches, 'Missing scheme/preset counts');
            assert.deepEqual(presetMatches.slice(1).filter((value): value is string => value !== undefined).map(count), [COMPLETE_SCHEMES.length, originals.length], 'Scheme/preset counts differ from the catalog');
            const listSeparator = suffix ? '、' : ', ';
            const legacyRanges = LEGACY_ROW_RANGES.map(([first, last]) => first.join('.') + '–' + last.join('.')).join(listSeparator);
            const agentRowRange = AGENT_ROW_MINIMUM.join('.') + '+';
            const effortRange = BY_SCOPE.subagent.get('effort')!.minimum_version + '–' + LEGACY_ROW_RANGES[0][1].join('.') + listSeparator + agentRowRange;
            const requiredRows = suffix
                ? [
                    `| 通过命令回调自定义子代理行 | ${legacyRanges} |`,
                    `| 通过 AgentRow Mod 自定义子代理行 | ${agentRowRange} |`,
                    '| 子代理生命周期 hooks | 2.1.205+ |',
                    `| 自定义子代理行中的显式强度 | ${effortRange} |`,
                    '| 带参数 slash 命令的本地执行、外部入口 | 2.1.258+ |',
                    '| 会话内 Client 编辑器 | 2.1.287+ |',
                    '| 原生计时及高级实时指标采集 | 2.1.289+ |',
                ]
                : [
                    `| Custom subagent rows via the command callback | ${legacyRanges} |`,
                    `| Custom subagent rows via the AgentRow Mod | ${agentRowRange} |`,
                    '| Subagent lifecycle hooks | 2.1.205+ |',
                    `| Configured effort in custom subagent rows | ${effortRange} |`,
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
            numericClaims(documentationProse(body), suffix
                ? 'Claude Code hook 为编辑器启动、编辑和清理共预留 ' + NUMBER + ' 分钟'
                : 'The Claude Code hook allows ' + NUMBER + ' minutes for editor startup, editing and cleanup',
            [HOOK_TIMEOUT_SECONDS / 60], 'Claude Code hook timeout differs from the installed integration');
        });
        check(`docs/EDITORS${suffix}.md`, body => {
            const rows = body.split(/\r?\n/u);
            const terminal = rows.find(row => row.startsWith('| `claude-statusline configure` |'));
            const dimensions = terminal?.match(/(\d+)×(\d+)/u);
            assert(dimensions, 'Missing terminal editor minimum size');
            assert.deepEqual(dimensions.slice(1).map(Number), [MIN_COLUMNS, MIN_ROWS], 'Terminal editor minimum size differs from production layout');
            const client = rows.find(row => row.startsWith('| `/statusline-configure-native` |'));
            assert.equal(client?.match(/(\d+\.\d+\.\d+)\+/u)?.[1], NATIVE.minimum.join('.'), 'Client minimum host differs from integration');
            numericClaims(documentationProse(body), suffix
                ? 'slash 启动的编辑器在 ' + NUMBER + ' 分钟后取消且不保存'
                : 'The slash-launched editor cancels without saving after ' + NUMBER + ' minutes',
            [DEADLINE_SECONDS / 60], 'Slash-launched editor timeout differs from the terminal bridge');
            const undo = rows.find(row => row.startsWith(suffix ? '| 撤销 |' : '| Undo |'));
            const keyboard = body.split('<a id="keyboard-controls"></a>')[1]?.split('### ', 3);
            for (const [index, surface] of (['terminal', 'native'] as const).entries()) {
                const tabs = keyboard?.[index + 1]?.split(/\r?\n/u).find(row => row.startsWith('| Tab / Shift+Tab'));
                assert(tabs && tabs.includes(tabOrder), surface + ' page order differs from the shared editor');
                if (surface === 'native')
                    assert(tabs.includes(EDITOR_PAGES.map((_, i) => i + 1).join(' / ')), 'Client page numbers differ from the shared editor');
                const key = shortcutAliases(surface, 'list', {}, 'undo');
                assert(undo?.includes(key), 'Missing editor undo preset ' + key);
                const toggle = shortcutAliases(surface, 'list', {}, 'toggle-item').replaceAll('/', ' / ');
                assert(keyboard?.[index + 1]?.includes('| ' + toggle + ' |'), 'Missing ' + surface + ' component toggle presets ' + toggle);
            }
            const eventRefresh = shortcutAliases('terminal', 'refresh-settings', {}, 'event-refresh');
            assert(keyboard?.[1]?.includes('| ' + eventRefresh + ' |'), 'Missing terminal event-only refresh preset ' + eventRefresh);
            const customization = body.split('<a id="customize-keyboard-shortcuts"></a>')[1]?.split('<a id="text-input"></a>')[0];
            for (const key of reservedNativeKeys('save'))
                assert(customization?.includes(key), 'Missing Claude host restriction ' + key);
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
            if (base === 'docs/reference/cli') {
                assert(schemas.length && protocols.length, 'Missing centralized current interface versions');
                const rowLabel = suffix ? 'AgentRow Mod 协议' : 'AgentRow Mod protocol';
                assert(body.includes(`| ${rowLabel} | ${AGENT_ROWS.protocol} |`), 'AgentRow protocol differs from the plugin integration');
                const declared = body.match(/`agent_rows_protocol`\s+(\d+)\b/gu) ?? [];
                assert.deepEqual(declared, [`\`agent_rows_protocol\` ${PACKAGE_COMPATIBILITY.agent_rows_protocol}`], 'AgentRow protocol differs from package compatibility');
            }
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
            const shortcuts = body.split(/\r?\n/u).find(line => line.startsWith(suffix ? '| 编辑器快捷键偏好 |' : '| Editor shortcut preferences |'));
            assert.equal(Number(shortcuts?.split('|')[2]?.trim()), EDITOR_SHORTCUTS_SCHEMA_VERSION, 'Editor shortcut preference schema differs from core');
            assert(body.includes('| `' + EDITOR_SHORTCUTS_FILENAME + '` |'), 'Missing the canonical editor shortcut preference filename');
            const sourceRange = body.split(/\r?\n/u).filter(row => row.startsWith('| ') && row.includes('`sources`'));
            assert.equal(sourceRange.length, 1, 'Expected one source registry read range');
            const bounds = /^\| [^|]+\| `\[(\d+), (\d+)\]` \|$/u.exec(sourceRange[0]!);
            assert.deepEqual(bounds?.slice(1).map(Number), PACKAGE_COMPATIBILITY.read.sources, 'Source registry read range differs from package compatibility');
            assert.deepEqual(configSetOptions(body).sort(), [...OPTIONS].sort(), 'Set option IDs differ from CLI');
            for (const id of ['cli-order', 'cli-layout', 'cli-semantic-separators', 'cli-profile-target', 'cli-recover', 'cli-style-reuse', 'cli-group-reuse', 'cli-diagnose', 'cli-task'])
                example(body, id, 'text');
        });
    }
    const [mainTypeCount, subagentTypeCount] = ['main', 'subagent'].map(scope => ITEMS.filter(item => item.scope === scope).length);
    for (const suffix of ['', '.zh-CN']) {
        const zh = suffix === '.zh-CN';
        for (const base of DEVELOPMENT_CONTENT_PATHS) check(base + suffix + '.md', body => {
            const expected = (value: string, message: string) => assert(body.includes(value), message);
            const prose = documentationProse(body);
            const numeric = (pattern: string, values: number[], message: string) => numericClaims(prose, pattern, values, message);
            assert(!/Historical record \(frozen|历史记录（冻结/u.test(body), 'Current development page retains a historical banner');
            assert(!/^At this delivery\b|^本次交付中[，,]/mu.test(body), 'Current development page uses historical delivery framing');
            checkInterfaceVersions(body, { schema: SCHEMA_VERSION, editor: PROTOCOL_VERSION, runtime: RUNTIME_PROTOCOL_VERSION }, base === 'docs/development/live');
            checkNpmScripts(body, scripts);
            const relative = base.slice('docs/development/'.length);
            if (existsSync(join(root, 'docs/development/history/deliveries', relative + '.md')))
                assert(body.includes('history/deliveries/' + relative), 'Missing delivery record link');
            switch (base) {
                case 'docs/development/testing':
                    numeric(NUMBER + (zh ? ' 安装目标' : ' installations'), [facts.installations], 'Installed target count differs from the matrix');
                    numeric(NUMBER + (zh ? ' 个 Node 场景' : ' Node cases'), [facts.nodeCases], 'Node case count differs from the matrix');
                    numeric(NUMBER + (zh ? ' 宿主' : ' hosts'), [facts.hosts], 'Host count differs from the matrix');
                    numeric(NUMBER + (zh ? ' 类检查' : ' check categories'), [facts.installedCategories], 'Installed check category count differs');
                    break;
                case 'docs/development/contracts':
                    numeric(zh ? '全部 ' + NUMBER + ' 项' : 'all ' + NUMBER + ' current OPERATIONS', [OPERATIONS.length], 'Operation count differs from core');
                    for (const operation of OPERATIONS.filter(name => name.endsWith('_editor_shortcuts'))) expected('`' + operation + '`', 'Missing shortcut operation ' + operation);
                    numeric(NUMBER + (zh ? ' 个主栏类型和 ' : ' main and ') + NUMBER + (zh ? ' 个子代理类型' : ' subagent types'),
                        [mainTypeCount!, subagentTypeCount!], 'Catalog type count differs from core');
                    numeric((zh ? '显示 schema ' : 'Display schema ') + NUMBER, [SCHEMA_VERSION], 'Display schema differs from core');
                    numeric((zh ? '协议 ' : 'Protocol ') + NUMBER + (zh ? ' 要求' : ' requires'), [PROTOCOL_VERSION], 'Editor protocol differs from core');
                    break;
                case 'docs/development/i18n':
                    for (const code of LANGUAGES) expected('`' + code + '`', 'Missing language ' + code);
                    break;
                case 'docs/development/node-regional-languages':
                    for (const code of LANGUAGES) expected('`' + code + '`', 'Missing language ' + code);
                    numeric(NUMBER + (zh ? '个安装' : ' installations'), [facts.installations], 'Installed target count differs from the matrix');
                    numeric(NUMBER + (zh ? ' 个 Node 用例' : ' Node cases'), [facts.nodeCases], 'Node case count differs from the matrix');
                    numeric(NUMBER + (zh ? '个固定宿主' : ' fixed hosts'), [facts.hosts], 'Host count differs from the matrix');
                    break;
                case 'docs/development/i18n-workflow':
                    numeric(NUMBER + (zh ? ' 组语言组合' : ' language combinations'), [LANGUAGES.length ** 2], 'Language combination count differs from registry');
                    break;
                case 'docs/development/impact-checks':
                    numeric(zh ? NUMBER + ' 分钟的托管作业上限' : 'hosted job limit of ' + NUMBER + ' minutes',
                        [SCOPED_HOSTED_JOB_MS / 60_000], 'Scoped job limit differs from the scheduling policy');
                    break;
                case 'docs/development/live':
                    for (const [unit, bound] of [[zh ? ' 个 turn' : ' turns', MAX_TURNS], [zh ? ' 个工具' : ' tools', MAX_TOOLS],
                        [zh ? ' 个任务' : ' tasks', MAX_TASKS], [zh ? ' 个请求' : ' requests', MAX_REQUESTS]] as const)
                        numeric(NUMBER + unit, [bound], 'Runtime bound differs from core: ' + unit);
                    break;
                case 'docs/development/native':
                    expected(zh ? '## 外部 TUI' : '## External TUI', 'Missing current External TUI section');
                    expected('A/D/X', 'Missing native control order');
                    break;
                case 'docs/development/ci-maintenance':
                    numeric(NUMBER + (zh ? ' 项发版 PR 作业' : ' release PR jobs'), [releaseCases.length + 2], 'Release PR job count differs from the matrix');
                    numeric(NUMBER + (zh ? ' 项逻辑' : ' logical'), [facts.logical], 'Logical obligation count differs from the matrix');
                    numeric(NUMBER + (zh ? ' 条完整和 ' : ' full and ') + NUMBER + (zh ? ' 条短历史' : ' short histories'),
                        [facts.fullHistory, facts.shortHistory], 'Installation and Node history split differs from the matrix');
                    numeric(NUMBER + (zh ? ' 个宿主' : ' fixed hosts'), [facts.hosts], 'Host count differs from the matrix');
                    numeric(NUMBER + (zh ? ' 条完整／' : ' full / ') + NUMBER + (zh ? ' 条短历史' : ' short'),
                        [facts.fullHosts, facts.shortHosts], 'Host history split differs from the matrix');
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
                    numeric((zh ? '命令默认自动间隔 ' : 'Commands start automatic policy at ') + NUMBER + (zh ? ' 秒' : ' seconds'),
                        [facts.initial], 'Automatic interval default differs from source');
                    numeric((zh ? '允许 ' : 'adjustable ') + NUMBER + '–' + NUMBER + (zh ? ' 秒' : ' separately'),
                        [facts.minimum, facts.maximum], 'Automatic interval range differs from source');
                    numeric(zh ? NUMBER + '秒续租、' + NUMBER + '秒过期' : 'renew every ' + NUMBER + ' seconds and expire after ' + NUMBER,
                        [facts.renewalSeconds, facts.leaseSeconds], 'Lease timing differs from source');
                    break;
                case 'docs/development/task-version-review':
                    numeric(zh ? '每 ' + NUMBER + ' 秒读取运行中的任务或作业' : 'checks a running task or job every ' + NUMBER + ' seconds',
                        [ACTIVE_REFRESH_MS / 1000], 'Active terminal refresh interval differs from the scheduler');
                    numeric(zh ? '每 ' + NUMBER + ' 秒读取一次' : 'checks an idle task or an uncertain job every ' + NUMBER + ' seconds',
                        [IDLE_REFRESH_MS / 1000], 'Idle terminal refresh interval differs from the scheduler');
                    numeric(zh ? '重试间隔，最长 ' + NUMBER + ' 秒' : 'retry interval to a maximum of ' + NUMBER + ' seconds',
                        [MAX_REFRESH_BACKOFF_MS / 1000], 'Terminal read retry limit differs from the scheduler');
                    break;
            }
        });
    }
    return errors;
}
