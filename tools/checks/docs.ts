import * as fs from 'node:fs';
import { join, resolve, relative, dirname, basename, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rewriteLinks, GITHUB, RAW_GITHUB, TAG } from '../release/markdown.ts';
import { checkCommunity } from './community.ts';
const LOCAL_ONLY = new Set(['ROADMAP.md', 'ROADMAP.zh-CN.md', 'MACOS_VALIDATION.md']);
const RELEASE_FILE = /^(v\d+\.\d+\.\d+(?:(?:a|b|rc)\d+|-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)(\.zh-CN)?\.md$/u;
const RELEASE_FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const RESERVED_RELEASE_HEADING = /^## (?:Gitee installation and downloads|Original publication)$/mu;
export function configurationSection(markdown: string, heading: string): string {
    return markdown.replaceAll('\r\n', '\n').match(new RegExp('^## ' + heading + '\\n(.*?)(?=^## |$(?![\\s\\S]))', 'ms'))?.[1] ?? '';
}
export function anchors(body: string): Set<string> {
    const result = new Set([...body.matchAll(/<a\s+id="([^"]+)"/gu)].map(m => m[1]!)), counts = new Map<string, number>();
    for (const match of body.matchAll(/^#{1,6}\s+(.+)$/gmu)) {
        const slug = match[1]!.replace(/<[^>]+>|[*`]/gu, '').toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replaceAll(' ', '-');
        const count = counts.get(slug) ?? 0;
        result.add(slug + (count ? '-' + count : ''));
        counts.set(slug, count + 1);
    }
    return result;
}
function releaseCurrent(tag: string): boolean {
    const match = /^v(\d+)\.(\d+)\.(\d+)/u.exec(tag)!;
    return Number(match[1]) > 3 || Number(match[1]) === 3 && Number(match[2]) >= 10;
}
function releaseText(body: string): string {
    let fence = '';
    return body.split('\n').filter(line => {
        const marker = RELEASE_FENCE.exec(line)?.[1];
        if (fence) {
            if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = '';
            return false;
        }
        if (marker) {
            fence = marker;
            return false;
        }
        return true;
    }).join('\n');
}
function releaseDate(body: string, language: 'en' | 'zh'): string | undefined {
    const match = language === 'en'
        ? /^Published on \*\*(\d{4})-(\d{2})-(\d{2})\*\*/mu.exec(body)
        : /^已于 \*\*(\d{4})-(\d{2})-(\d{2})\*\* 发布/mu.exec(body);
    if (!match) return;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}
function releaseTitleStartsWith(title: string, tag: string): boolean {
    const prefix = `# ${tag}`;
    return title.startsWith(prefix) && (title[prefix.length] === undefined || /[\s:—–-]/u.test(title[prefix.length]!));
}
function releasePageErrors(tag: string, language: 'en' | 'zh', current: boolean, body: string): string[] {
    const errors: string[] = [], name = language === 'en' ? `${tag}.md` : `${tag}.zh-CN.md`;
    const headings = releaseText(body).match(/^# .+$/gmu) ?? [];
    if (headings.length !== 1) errors.push(`docs/releases/${name}: expected exactly one H1, found ${headings.length}`);
    if (current && headings[0] && !releaseTitleStartsWith(headings[0], tag)) errors.push(`docs/releases/${name}: H1 must start with ${tag}`);
    if (current) {
        if (language === 'en') {
            if (!body.includes(`**English** | [简体中文](${tag}.zh-CN.md)`)) errors.push(`docs/releases/${name}: missing English language navigation`);
            if (!releaseDate(body, 'en')) errors.push(`docs/releases/${name}: missing a valid Published on date`);
        } else {
            if (!body.includes(`[English](${tag}.md) | **简体中文**`)) errors.push(`docs/releases/${name}: missing Chinese language navigation`);
            if (!releaseDate(body, 'zh')) errors.push(`docs/releases/${name}: missing a valid Chinese publication date`);
        }
        if (!body.includes('claude-statusline install')) errors.push(`docs/releases/${name}: missing claude-statusline install`);
        if (!body.includes(`approvals/${tag}.json`)) errors.push(`docs/releases/${name}: missing version decision link`);
    } else if (language === 'en') {
        if (!body.includes('](#english)') || !body.includes('](#简体中文)')) errors.push(`docs/releases/${name}: missing historical language navigation`);
        const anchors = body.match(/<a id="english"><\/a>/gu) ?? [];
        if (anchors.length !== 1) errors.push(`docs/releases/${name}: expected exactly one english anchor, found ${anchors.length}`);
        const anchor = body.indexOf('<a id="简体中文"></a>'), heading = /^## 简体中文$/mu.test(body), details = body.indexOf('<details>');
        if (anchor < 0 && !heading) errors.push(`docs/releases/${name}: missing Chinese anchor or heading`);
        if (anchor >= 0 && heading) errors.push(`docs/releases/${name}: both Chinese anchor and heading present`);
        if (anchor >= 0 && details >= 0 && anchor > details) errors.push(`docs/releases/${name}: Chinese anchor must precede the details block`);
    }
    if (RESERVED_RELEASE_HEADING.test(body)) errors.push(`docs/releases/${name}: contains a reserved Gitee heading`);
    return errors;
}
function releaseBullets(body: string): number {
    return (body.match(/^- /gmu) ?? []).length;
}
function releaseIndexTags(body: string): string[] {
    const tags: string[] = [];
    for (const line of body.split('\n')) {
        const match = /^- \[[^\]]+\]\(([^)]+)\)/u.exec(line);
        if (!match) continue;
        const name = match[1]!.split('#')[0]!, tag = /^(v[^/]+?)(?:\.zh-CN)?\.md$/u.exec(name)?.[1];
        if (tag && TAG.test(tag)) tags.push(tag);
    }
    return tags;
}
export function checkReleases(root: string): string[] {
    const directory = join(root, 'docs', 'releases');
    if (!fs.existsSync(directory)) return [];
    const errors: string[] = [], releases = new Map<string, { en?: string; zh?: string }>();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md' || entry.name === 'README.zh-CN.md') continue;
        const match = RELEASE_FILE.exec(entry.name);
        if (!match) {
            errors.push(`docs/releases/${entry.name}: unexpected release note filename`);
            continue;
        }
        const tag = match[1]!, release = releases.get(tag) ?? {};
        if (match[2]) release.zh = entry.name;
        else release.en = entry.name;
        releases.set(tag, release);
    }
    for (const [tag, release] of releases) {
        const current = releaseCurrent(tag);
        if (current && !release.en) errors.push(`docs/releases/${tag}.zh-CN.md: missing English counterpart`);
        if (current && !release.zh) errors.push(`docs/releases/${tag}.md: missing Simplified Chinese counterpart`);
        if (!current && release.zh) errors.push(`docs/releases/${tag}.zh-CN.md: separate Chinese note is not allowed before v3.10.0`);
        const english = release.en ? fs.readFileSync(join(directory, release.en), 'utf8') : undefined;
        const chinese = release.zh ? fs.readFileSync(join(directory, release.zh), 'utf8') : undefined;
        if (english) errors.push(...releasePageErrors(tag, 'en', current, english));
        if (chinese) errors.push(...releasePageErrors(tag, 'zh', current, chinese));
        if (current && english && chinese) {
            const englishDate = releaseDate(english, 'en'), chineseDate = releaseDate(chinese, 'zh');
            if (englishDate && chineseDate && englishDate !== chineseDate) errors.push(`docs/releases/${tag}.md: publication dates differ between languages`);
            const englishBullets = releaseBullets(english), chineseBullets = releaseBullets(chinese);
            if (englishBullets === 0 || chineseBullets === 0) errors.push(`docs/releases/${tag}.md: current release needs at least one change bullet`);
            else if (englishBullets !== chineseBullets) errors.push(`docs/releases/${tag}.md: change bullet counts differ between languages`);
        }
    }
    const readIndex = (name: string) => fs.existsSync(join(directory, name)) ? fs.readFileSync(join(directory, name), 'utf8') : '';
    const englishIndex = releaseIndexTags(readIndex('README.md')), chineseIndex = releaseIndexTags(readIndex('README.zh-CN.md'));
    for (const tag of releases.keys()) {
        if (englishIndex.filter(item => item === tag).length !== 1) errors.push(`docs/releases/README.md: ${tag} must appear exactly once`);
        if (chineseIndex.filter(item => item === tag).length !== 1) errors.push(`docs/releases/README.zh-CN.md: ${tag} must appear exactly once`);
    }
    for (const tag of new Set([...englishIndex, ...chineseIndex]))
        if (!releases.has(tag)) errors.push(`docs/releases/README.md: unknown release entry ${tag}`);
    return errors;
}
export function checkDocs(root: string, additional: readonly string[] = []): {
    links: number;
    errors: string[];
} {
    const errors: string[] = [];
    let links = 0;
    const pages = fs.readdirSync(root).filter(n => n.endsWith('.md')).map(n => join(root, n));
    for (const name of fs.readdirSync(join(root, 'docs'), { recursive: true }).map(String))
        if (name.endsWith('.md'))
            pages.push(join(root, 'docs', name));
    const pullRequestTemplate = join(root, '.github', 'pull_request_template.md');
    if (fs.existsSync(pullRequestTemplate)) pages.push(pullRequestTemplate);
    for (const name of additional) {
        const page = resolve(root, name), local = relative(root, page);
        if (name.endsWith('.md') && !local.startsWith('..') && fs.existsSync(page) && !pages.includes(page)) pages.push(page);
    }
    for (const page of pages.filter(p => !LOCAL_ONLY.has(basename(p)))) {
        const body = fs.readFileSync(page, 'utf8'), name = relative(root, page).split(sep).join('/');
        const counterpart = page.endsWith('.zh-CN.md') ? page.replace(/\.zh-CN\.md$/u, '.md') : page.replace(/\.md$/u, '.zh-CN.md');
        if (name !== 'AGENTS.md' && page !== pullRequestTemplate && (!name.split('/').includes('releases') || page.endsWith('.zh-CN.md')) && !fs.existsSync(counterpart))
            errors.push(name + ': missing bilingual counterpart');
        checkLinks(page, name, body);
    }
    const community = checkCommunity(root);
    errors.push(...community.errors);
    for (const item of community.markdown) checkLinks(join(root, item.file), item.file, item.text);
    function checkLinks(page: string, name: string, body: string): void {
        rewriteLinks(body, target => {
            let origin = dirname(page);
            for (const prefix of [GITHUB + '/blob/main/', RAW_GITHUB + '/main/'])
                if (target.startsWith(prefix)) {
                    target = target.slice(prefix.length);
                    origin = root;
                    break;
                }
            if (/^[a-zA-Z][\w+.-]*:/u.test(target) || target.startsWith('//'))
                return target;
            const [path, fragment] = decodeURIComponent(target).split('#', 2), destination = path ? resolve(origin, path.split('?')[0]!) : page;
            links++;
            if (!fs.existsSync(destination))
                errors.push(name + ': missing ' + target);
            else if (fragment && extname(destination) === '.md' && !anchors(fs.readFileSync(destination, 'utf8')).has(fragment))
                errors.push(name + ': missing anchor ' + target);
            return target;
        });
    }
    for (const [suffix, heading, anchor] of [['', 'Common configuration', 'native-configuration-editor'], ['.zh-CN', '常用配置', '原生配置编辑器']]) {
        const readme = fs.readFileSync(join(root, `README${suffix}.md`), 'utf8'), guide = fs.readFileSync(join(root, `docs/USER_GUIDE${suffix}.md`), 'utf8');
        const section = configurationSection(readme, heading!);
        for (const command of ['/statusline-configure-native', '/statusline-configure', '/statusline-config', 'claude-statusline configure', 'claude-statusline config'])
            if (!new RegExp(command + '(?![\\w-])').test(section))
                errors.push(`README${suffix}.md: common configuration missing ${command}`);
        for (const required of [`](#${anchor})`, '2.1.287', '2.1.258', 'claude-statusline-native.json'])
            if (!guide.includes(required))
                errors.push(`docs/USER_GUIDE${suffix}.md: missing editor documentation ${required}`);
    }
    const legacy: Record<string, string> = { 'README.md': 'v130a2-external-tui-and-in-session-client', 'README.zh-CN.md': 'v130a2外部-tui-与会话内-client', 'docs/USER_GUIDE.md': 'v130a2-external-tui-and-in-session-client', 'docs/USER_GUIDE.zh-CN.md': 'v130a2外部-tui-与会话内-client', 'docs/RELEASING.md': 'v130-preview-rollout', 'docs/RELEASING.zh-CN.md': 'v130-预览推进' };
    for (const [name, fragment] of Object.entries(legacy))
        if (!anchors(fs.readFileSync(join(root, name), 'utf8')).has(fragment))
            errors.push(name + ': missing legacy anchor ' + fragment);
    errors.push(...checkReleases(root));
    return { links, errors };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--root'))
        throw new Error('Usage: docs [--root DIRECTORY]');
    const result = checkDocs(resolve(args[1] ?? '.'));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.errors.length ? 1 : 0;
}
