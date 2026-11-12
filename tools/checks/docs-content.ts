/** Inspect maintained Markdown, never execute its code fences. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS, NODE_TYPES } from '@fbincon/statusline-core/config/catalog';
import { SCHEMA_VERSION, isSchema, validateDisplay } from '@fbincon/statusline-core/config/display';
import { COMPLETE_SCHEMES, PRESET_PRESENTATION } from '@fbincon/statusline-core/config/presets';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { definition } from '@fbincon/statusline-core/extensions/model';
import { LANGUAGES, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/registry';
import { readJson } from '@fbincon/statusline-core/json-read';
import { DOCUMENT_CONTENT_PATHS } from './impact-documentation.js';
import { OPTIONS } from '@fbincon/statusline-cli/config/operations';

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

export function contentErrors(pages: Documents): string[] {
    const errors: string[] = [];
    const page = (path: string) => { const value = pages.get(path); assert(value !== undefined, 'Missing page'); return value; };
    const check = (path: string, verify: (body: string) => void) => {
        try { verify(page(path)); } catch (error) { errors.push(path + ': ' + (error instanceof Error ? error.message : String(error))); }
    };
    const metricCounts = ['main', 'subagent'].map(scope => ITEMS.filter(item => item.scope === scope && !(NODE_TYPES as readonly string[]).includes(item.id)).length);
    const originals = PRESET_PRESENTATION.filter(preset => !(COMPLETE_SCHEMES as readonly string[]).includes(preset.id));
    for (const suffix of ['', '.zh-CN']) {
        const readme = `README${suffix}.md`, metrics = `docs/DISPLAY_ITEMS${suffix}.md`, guide = `docs/USER_GUIDE${suffix}.md`, schemes = `docs/SCHEMES${suffix}.md`;
        for (const path of [readme, metrics]) check(path, body => {
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
            if (['docs/COMPOSITION', 'docs/EXTENSIONS'].includes(base)) assert(schemas.length && protocols.length, 'Missing current interface versions');
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
    return errors;
}
