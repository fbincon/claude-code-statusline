import * as fs from 'node:fs';
import { join, resolve, relative, dirname, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rewriteLinks, GITHUB, RAW_GITHUB, TAG } from '../release/markdown.ts';
import { assessApprovalRegistry, assessStableApproval } from '../release/approval.ts';
import { checkCommunity } from './community.ts';
import { checkImageGalleries } from './impact-assets.ts';
import { DOCUMENT_CONTENT_PATHS } from './impact-documentation.ts';
const LOCAL_ONLY = new Set(['docs/ROADMAP.md', 'docs/ROADMAP.zh-CN.md', 'docs/MACOS_VALIDATION.md']);
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
const RELEASE_TEMPLATE_FROM = '3.16.4';
function releaseAtLeast(tag: string, minimum: string): boolean {
    return changelogVersionAtLeast(tag.slice(1), minimum);
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
        if (releaseAtLeast(tag, RELEASE_TEMPLATE_FROM)) {
            if (!body.includes('https://github.com/fbincon/claude-code-statusline/issues/96'))
                errors.push(`docs/releases/${name}: missing issue #96 gaps link`);
            if (!/(?:Node\s*22\s*[／/]\s*24|Node\s*22[^\n]*Node\s*24)/u.test(body))
                errors.push(`docs/releases/${name}: missing Node 22/24 platform block`);
            const delivery = language === 'en'
                ? /\]\(\.\.\/development\/history\/deliveries\/[^)]+\.md#final-release\)/u
                : /\]\(\.\.\/development\/history\/deliveries\/[^)]+\.zh-CN\.md#final-release\)/u;
            if (!delivery.test(body)) errors.push(`docs/releases/${name}: missing delivery record link`);
            if (!body.includes(language === 'en' ? '](../RELEASING.md)' : '](../RELEASING.zh-CN.md)'))
                errors.push(`docs/releases/${name}: missing release guide link`);
            if (!/Compatibility|兼容性/iu.test(body)) errors.push(`docs/releases/${name}: missing compatibility statement`);
            const lines = releaseText(body).split('\n');
            const dateIndex = lines.findIndex(line => language === 'en'
                ? /^Published on \*\*\d{4}-\d{2}-\d{2}\*\*/u.test(line)
                : /^已于 \*\*\d{4}-\d{2}-\d{2}\*\* 发布/u.test(line));
            const bulletIndex = lines.findIndex((line, index) => index > dateIndex && line.startsWith('- '));
            const summary = dateIndex >= 0 && lines.slice(dateIndex + 1, bulletIndex < 0 ? undefined : bulletIndex)
                .some(line => line.trim() && !line.trim().startsWith('|'));
            if (!summary) errors.push(`docs/releases/${name}: missing a summary paragraph before the change bullets`);
        }
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
interface ReleaseIndexRow {
    tag: string;
    target: string;
    date: string;
    status: string;
    summary: string;
    language: string;
}
function releaseIndexSection(body: string, language: 'en' | 'zh'): string | undefined {
    const heading = language === 'en' ? '## TypeScript v3.10 and later' : '## TypeScript v3.10 及后续版本';
    const start = body.indexOf(heading);
    return start < 0 ? undefined : body.slice(start + heading.length).split(/^## /mu)[0]!;
}
function releaseIndexRows(body: string, language: 'en' | 'zh'): ReleaseIndexRow[] {
    const section = releaseIndexSection(body, language);
    if (section === undefined) return [];
    const pattern = language === 'en'
        ? /^- \[\*\*(v[^\]]+)\*\*\]\(([^)]+)\) · (\d{4}-\d{2}-\d{2}) · (Latest|Stable|Preview) — (.+) · \[中文\]\(([^)]+)\)$/gmu
        : /^- \[\*\*(v[^\]]+)\*\*\]\(([^)]+)\) · (\d{4}-\d{2}-\d{2}) · (最新稳定版|正式版|预览版) — (.+) · \[English\]\(([^)]+)\)$/gmu;
    return [...section.matchAll(pattern)].map(match => ({
        tag: match[1]!, target: match[2]!, date: match[3]!, status: match[4]!, summary: match[5]!, language: match[6]!,
    }));
}
function releaseIndexRowCount(body: string, language: 'en' | 'zh'): number {
    return releaseIndexSection(body, language)?.split('\n').filter(line => line.startsWith('- ')).length ?? 0;
}
function checkReleaseIndexRows(english: string, chinese: string, englishDates: ReadonlyMap<string, string>,
    chineseDates: ReadonlyMap<string, string>, errors: string[]): void {
    const enRows = releaseIndexRows(english, 'en'), zhRows = releaseIndexRows(chinese, 'zh');
    if (!enRows.length && !zhRows.length) return;
    if (!enRows.length || !zhRows.length) {
        errors.push('docs/releases/README.md: current-era release index rows are missing in one language');
        return;
    }
    if (releaseIndexRowCount(english, 'en') !== enRows.length)
        errors.push('docs/releases/README.md: current-era release index contains a malformed row');
    if (releaseIndexRowCount(chinese, 'zh') !== zhRows.length)
        errors.push('docs/releases/README.zh-CN.md: current-era release index contains a malformed row');
    const enByTag = new Map(enRows.map(row => [row.tag, row])), zhByTag = new Map(zhRows.map(row => [row.tag, row]));
    const status: Record<string, string> = { Latest: '最新稳定版', Stable: '正式版', Preview: '预览版' };
    for (const row of enRows) {
        if (!releaseAtLeast(row.tag, RELEASE_TEMPLATE_FROM)) continue;
        const zh = zhByTag.get(row.tag);
        if (!zh) { errors.push(`docs/releases/README.zh-CN.md: missing row for ${row.tag}`); continue; }
        if (row.target !== `${row.tag}.md`) errors.push(`docs/releases/README.md: ${row.tag} row must target ${row.tag}.md`);
        if (row.language !== `${row.tag}.zh-CN.md`) errors.push(`docs/releases/README.md: ${row.tag} row must link ${row.tag}.zh-CN.md`);
        if (zh.target !== `${row.tag}.zh-CN.md`) errors.push(`docs/releases/README.zh-CN.md: ${row.tag} row must target ${row.tag}.zh-CN.md`);
        if (zh.language !== `${row.tag}.md`) errors.push(`docs/releases/README.zh-CN.md: ${row.tag} row must link ${row.tag}.md`);
        if (status[row.status] !== zh.status) errors.push(`docs/releases/README.zh-CN.md: ${row.tag} status differs between languages`);
        if (englishDates.get(row.tag) !== row.date) errors.push(`docs/releases/README.md: ${row.tag} date differs from its release note`);
        if (chineseDates.get(row.tag) !== zh.date) errors.push(`docs/releases/README.zh-CN.md: ${row.tag} date differs from its release note`);
        if (!row.summary.trim()) errors.push(`docs/releases/README.md: ${row.tag} row needs a summary`);
    }
    const latest = enRows.filter(row => row.status === 'Latest'), zhLatest = zhRows.filter(row => row.status === '最新稳定版');
    if (latest.length !== 1) errors.push(`docs/releases/README.md: expected exactly one Latest row, found ${latest.length}`);
    if (zhLatest.length !== 1) errors.push(`docs/releases/README.zh-CN.md: expected exactly one 最新稳定版 row, found ${zhLatest.length}`);
    if (latest.length === 1 && zhLatest.length === 1 && latest[0]!.tag !== zhLatest[0]!.tag)
        errors.push('docs/releases/README.md: Latest differs between languages');
    const newestStable = enRows.find(row => row.status === 'Latest' || row.status === 'Stable');
    if (latest.length === 1 && newestStable && latest[0]!.tag !== newestStable.tag)
        errors.push(`docs/releases/README.md: Latest row ${latest[0]!.tag} is not the newest stable ${newestStable.tag}`);
    const englishCallout = /Current stable: \[(v[^\]]+)\]/u.exec(english)?.[1];
    const chineseCallout = /当前正式版：\[(v[^\]]+)\]/u.exec(chinese)?.[1];
    if (latest.length === 1 && englishCallout !== latest[0]!.tag)
        errors.push(`docs/releases/README.md: current-stable callout must be ${latest[0]!.tag}`);
    if (zhLatest.length === 1 && chineseCallout !== zhLatest[0]!.tag)
        errors.push(`docs/releases/README.zh-CN.md: current-stable callout must be ${zhLatest[0]!.tag}`);
}
export function checkReleases(root: string): string[] {
    const directory = join(root, 'docs', 'releases');
    if (!fs.existsSync(directory)) return [];
    const errors: string[] = [], releases = new Map<string, { en?: string; zh?: string }>();
    const englishDates = new Map<string, string>(), chineseDates = new Map<string, string>();
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
        const englishDate = english ? releaseDate(english, 'en') : undefined;
        const chineseDate = chinese ? releaseDate(chinese, 'zh') : undefined;
        if (englishDate) englishDates.set(tag, englishDate);
        if (chineseDate) chineseDates.set(tag, chineseDate);
        if (current && english && chinese) {
            if (englishDate && chineseDate && englishDate !== chineseDate) errors.push(`docs/releases/${tag}.md: publication dates differ between languages`);
            const englishBullets = releaseBullets(english), chineseBullets = releaseBullets(chinese);
            if (englishBullets === 0 || chineseBullets === 0) errors.push(`docs/releases/${tag}.md: current release needs at least one change bullet`);
            else if (englishBullets !== chineseBullets) errors.push(`docs/releases/${tag}.md: change bullet counts differ between languages`);
        }
    }
    const readIndex = (name: string) => fs.existsSync(join(directory, name))
        ? fs.readFileSync(join(directory, name), 'utf8').replaceAll('\r\n', '\n') : '';
    const englishIndexBody = readIndex('README.md'), chineseIndexBody = readIndex('README.zh-CN.md');
    const englishIndex = releaseIndexTags(englishIndexBody), chineseIndex = releaseIndexTags(chineseIndexBody);
    for (const tag of releases.keys()) {
        if (englishIndex.filter(item => item === tag).length !== 1) errors.push(`docs/releases/README.md: ${tag} must appear exactly once`);
        if (chineseIndex.filter(item => item === tag).length !== 1) errors.push(`docs/releases/README.zh-CN.md: ${tag} must appear exactly once`);
    }
    for (const tag of new Set([...englishIndex, ...chineseIndex]))
        if (!releases.has(tag)) errors.push(`docs/releases/README.md: unknown release entry ${tag}`);
    checkReleaseIndexRows(englishIndexBody, chineseIndexBody, englishDates, chineseDates, errors);
    return errors;
}
const CHANGELOG_TEMPLATE_FROM = '3.16.4';
const CHANGELOG_VERSION = /^(\d+)\.(\d+)\.(\d+)((?:a|b|rc)\d+|-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
const CHANGELOG_HEADING = /^## (\S+) ([—-]) (\d{4})-(\d{2})-(\d{2})$/u;
interface ChangelogSection {
    version: string;
    date: string;
    separator: string;
    body: string;
    bullets: number;
    finalBullet: string;
}
interface ParsedChangelog {
    sections: ChangelogSection[];
    errors: string[];
}
function changelogVersionParts(version: string): { core: number[]; prerelease?: string } {
    const match = CHANGELOG_VERSION.exec(version)!;
    return { core: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] };
}
function compareChangelogVersions(left: string, right: string): number {
    const a = changelogVersionParts(left), b = changelogVersionParts(right);
    for (let index = 0; index < 3; index++)
        if (a.core[index] !== b.core[index]) return a.core[index]! - b.core[index]!;
    if (!a.prerelease && b.prerelease) return 1;
    if (a.prerelease && !b.prerelease) return -1;
    if (a.prerelease && b.prerelease) return a.prerelease.localeCompare(b.prerelease);
    return 0;
}
function changelogVersionAtLeast(version: string, minimum: string): boolean {
    return compareChangelogVersions(version, minimum) >= 0;
}
function changelogDate(year: string, month: string, day: string): string | undefined {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
        ? `${year}-${month}-${day}` : undefined;
}
function changelogReleaseTarget(version: string, language: 'en' | 'zh'): string {
    if (language === 'en') return `docs/releases/v${version}.md`;
    return changelogVersionAtLeast(version, '3.10.0')
        ? `docs/releases/v${version}.zh-CN.md`
        : `docs/releases/v${version}.md#简体中文`;
}
function parseChangelog(root: string, name: 'CHANGELOG.md' | 'CHANGELOG.zh-CN.md', language: 'en' | 'zh'): ParsedChangelog {
    const path = join(root, name), errors: string[] = [], sections: ChangelogSection[] = [];
    if (!fs.existsSync(path)) return { sections, errors };
    const lines = fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n').split('\n');
    const title = language === 'en' ? '# Changelog' : '# 变更日志';
    const h1 = lines.filter(line => /^# .+$/u.test(line));
    if (h1.length !== 1 || h1[0] !== title) errors.push(`${name}: expected exactly one ${title} H1`);
    const headings: { index: number; version: string; date: string; separator: string }[] = [];
    for (let index = 0; index < lines.length; index++) {
        if (!lines[index]!.startsWith('## ')) continue;
        const match = CHANGELOG_HEADING.exec(lines[index]!);
        if (!match || !CHANGELOG_VERSION.test(match[1]!)) {
            errors.push(`${name}: invalid changelog heading at line ${index + 1}`);
            continue;
        }
        const date = changelogDate(match[3]!, match[4]!, match[5]!);
        if (!date) {
            errors.push(`${name}: invalid changelog date for ${match[1]}`);
            continue;
        }
        headings.push({ index, version: match[1]!, date, separator: match[2]! });
    }
    for (let index = 0; index < headings.length; index++) {
        const heading = headings[index]!, end = headings[index + 1]?.index ?? lines.length;
        const bodyLines = lines.slice(heading.index + 1, end);
        const bullets = bodyLines.filter(line => line.startsWith('- '));
        sections.push({
            version: heading.version,
            date: heading.date,
            separator: heading.separator,
            body: bodyLines.join('\n'),
            bullets: bullets.length,
            finalBullet: bullets.at(-1)?.trim() ?? '',
        });
    }
    const versions = new Set<string>();
    for (let index = 0; index < sections.length; index++) {
        const section = sections[index]!;
        if (versions.has(section.version)) errors.push(`${name}: duplicate changelog version ${section.version}`);
        versions.add(section.version);
        if (index > 0) {
            const previous = sections[index - 1]!;
            if (compareChangelogVersions(previous.version, section.version) <= 0)
                errors.push(`${name}: changelog versions are not in descending order at ${section.version}`);
            if (previous.date < section.date)
                errors.push(`${name}: changelog dates are not in descending order at ${section.version}`);
        }
        if (Number(section.version.split('.')[0]) >= 3) {
            const target = changelogReleaseTarget(section.version, language);
            if (!section.body.includes(`](${target})`))
                errors.push(`${name}: ${section.version} missing release notes link ${target}`);
        }
        if (!changelogVersionAtLeast(section.version, CHANGELOG_TEMPLATE_FROM)) continue;
        if (section.separator !== '—')
            errors.push(`${name}: ${section.version} must use an em dash heading`);
        const firstLink = /\[([^\]]+)\]\(([^)]+)\)/u.exec(section.finalBullet);
        if (language === 'en') {
            if (!section.finalBullet.startsWith('- Published '))
                errors.push(`${name}: ${section.version} final bullet must start with Published`);
            if (!section.finalBullet.includes(section.date))
                errors.push(`${name}: ${section.version} publication date must match the heading date`);
            if (!firstLink || firstLink[1] !== 'Release notes' || firstLink[2] !== changelogReleaseTarget(section.version, 'en'))
                errors.push(`${name}: ${section.version} Release notes must be the first link in the final bullet`);
            if (!/\[Delivery record\]\(docs\/development\/history\/deliveries\/[^)]+\.md#final-release\)/u.test(section.finalBullet))
                errors.push(`${name}: ${section.version} final bullet must link the delivery record with #final-release`);
            if (!section.finalBullet.endsWith('.'))
                errors.push(`${name}: ${section.version} final bullet must end with a period`);
        } else {
            if (!section.finalBullet.startsWith('- 已于 '))
                errors.push(`${name}: ${section.version} final bullet must start with 已于`);
            if (!section.finalBullet.includes(section.date))
                errors.push(`${name}: ${section.version} publication date must match the heading date`);
            if (!firstLink || firstLink[1] !== '发布说明' || firstLink[2] !== changelogReleaseTarget(section.version, 'zh'))
                errors.push(`${name}: ${section.version} 发布说明 must be the first link in the final bullet`);
            if (!/\[交付记录\]\(docs\/development\/history\/deliveries\/[^)]+\.zh-CN\.md#final-release\)/u.test(section.finalBullet))
                errors.push(`${name}: ${section.version} final bullet must link the delivery record with #final-release`);
            if (!section.finalBullet.endsWith('。'))
                errors.push(`${name}: ${section.version} final bullet must end with 。`);
        }
    }
    return { sections, errors };
}
export function checkChangelog(root: string): string[] {
    const english = parseChangelog(root, 'CHANGELOG.md', 'en'), chinese = parseChangelog(root, 'CHANGELOG.zh-CN.md', 'zh');
    const errors = [...english.errors, ...chinese.errors];
    if (english.sections.length && chinese.sections.length) {
        if (english.sections.length !== chinese.sections.length)
            errors.push('CHANGELOG.md: version count differs between languages');
        for (let index = 0; index < Math.min(english.sections.length, chinese.sections.length); index++) {
            const en = english.sections[index]!, zh = chinese.sections[index]!;
            if (en.version !== zh.version)
                errors.push(`CHANGELOG.md: version differs between languages at entry ${index + 1}`);
            else {
                if (en.date !== zh.date) errors.push(`CHANGELOG.md: date differs between languages for ${en.version}`);
                if (en.bullets !== zh.bullets) errors.push(`CHANGELOG.md: bullet count differs between languages for ${en.version}`);
            }
        }
    }
    const releasePath = join(root, 'packages', 'core', 'src', 'release.ts');
    if (english.sections.length && fs.existsSync(releasePath)) {
        const version = /export const VERSION = '([^']+)'/u.exec(fs.readFileSync(releasePath, 'utf8'))?.[1];
        if (version && english.sections[0]!.version !== version)
            errors.push(`CHANGELOG.md: top version ${english.sections[0]!.version} differs from release.ts ${version}`);
    }
    return errors;
}
const DELIVERY_TEMPLATE_FROM = '2026-11-14';
const DELIVERY_HEADINGS = {
    en: ['## Changes', '## Source identities', '## Validation and limits'],
    zh: ['## 变更', '## 源码身份', '## 验证与限制'],
} as const;
function deliveryIntro(body: string, language: 'en' | 'zh'): { raw: string; date?: string } | undefined {
    const match = (language === 'en' ? /^This (\d{4})-(\d{2})-(\d{2})\b/mu : /^本次 (\d{4})-(\d{2})-(\d{2})\b/mu).exec(body);
    if (!match) return undefined;
    return { raw: `${match[1]}-${match[2]}-${match[3]}`, date: changelogDate(match[1]!, match[2]!, match[3]!) };
}
function deliveryIndexLinks(body: string): Set<string> {
    const links = new Set<string>();
    for (const match of body.matchAll(/\]\((deliveries\/[^)#]+)(?:#[^)]*)?\)/gu))
        links.add(match[1]!.slice('deliveries/'.length));
    return links;
}
export function checkDeliveryRecords(root: string): string[] {
    const directory = join(root, 'docs', 'development', 'history', 'deliveries');
    if (!fs.existsSync(directory)) return [];
    const errors: string[] = [];
    const indexPaths = [join(root, 'docs', 'development', 'history', 'README.md'),
        join(root, 'docs', 'development', 'history', 'README.zh-CN.md')];
    const indexes = indexPaths.map(path => fs.existsSync(path)
        ? deliveryIndexLinks(fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n')) : undefined);
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.md') && !name.endsWith('.zh-CN.md')).sort()) {
        const relative = `docs/development/history/deliveries/${name}`;
        const body = fs.readFileSync(join(directory, name), 'utf8').replaceAll('\r\n', '\n');
        const zhName = name.replace(/\.md$/u, '.zh-CN.md'), zhPath = join(directory, zhName);
        const zhBody = fs.existsSync(zhPath) ? fs.readFileSync(zhPath, 'utf8').replaceAll('\r\n', '\n') : undefined;
        const english = deliveryIntro(body, 'en'), chinese = zhBody ? deliveryIntro(zhBody, 'zh') : undefined;
        if ((english?.raw && english.raw >= DELIVERY_TEMPLATE_FROM) || (chinese?.raw && chinese.raw >= DELIVERY_TEMPLATE_FROM)) {
            const h1 = body.match(/^# .+$/gmu) ?? [];
            if (h1.length !== 1) errors.push(`${relative}: expected exactly one H1, found ${h1.length}`);
            if (!body.includes(`**English** | [简体中文](${zhName})`))
                errors.push(`${relative}: missing English language navigation`);
            if (!english?.date) errors.push(`${relative}: missing a valid dated intro (This YYYY-MM-DD)`);
            const headings: string[] = body.match(/^## .+$/gmu) ?? [];
            let last = -1;
            for (const heading of DELIVERY_HEADINGS.en) {
                const index = headings.indexOf(heading);
                if (index < 0) errors.push(`${relative}: missing ${heading}`);
                else if (index < last) errors.push(`${relative}: ${heading} is out of order`);
                else last = index;
            }
            if (zhBody) {
                const zhRelative = relative.replace(/\.md$/u, '.zh-CN.md');
                if (!zhBody.includes(`[English](${name}) | **简体中文**`))
                    errors.push(`${zhRelative}: missing Chinese language navigation`);
                if (!chinese?.date) errors.push(`${zhRelative}: missing a valid dated intro (本次 YYYY-MM-DD)`);
                if (english?.date && chinese?.date && english.date !== chinese.date)
                    errors.push(`${relative}: intro dates differ between languages`);
                const zhHeadings: string[] = zhBody.match(/^## .+$/gmu) ?? [];
                let zhLast = -1;
                for (const heading of DELIVERY_HEADINGS.zh) {
                    const index = zhHeadings.indexOf(heading);
                    if (index < 0) errors.push(`${zhRelative}: missing ${heading}`);
                    else if (index < zhLast) errors.push(`${zhRelative}: ${heading} is out of order`);
                    else zhLast = index;
                }
            }
        }
        if (indexes[0] && !indexes[0].has(name))
            errors.push(`docs/development/history/README.md: ${name} is not linked from the delivery index`);
        if (indexes[1] && !indexes[1].has(zhName))
            errors.push(`docs/development/history/README.zh-CN.md: ${zhName} is not linked from the delivery index`);
    }
    return errors;
}
export function checkApprovalData(root: string): string[] {
    const directory = join(root, 'docs', 'releases', 'approvals');
    const registryPath = join(directory, 'registry.json');
    if (!fs.existsSync(registryPath)) return [];
    const errors: string[] = [];
    let registry: ReturnType<typeof assessApprovalRegistry>;
    try {
        registry = assessApprovalRegistry(JSON.parse(fs.readFileSync(registryPath, 'utf8')));
    } catch (error) {
        return [`docs/releases/approvals/registry.json: ${error instanceof Error ? error.message : String(error)}`];
    }
    const registered = new Set<string>();
    for (const row of registry.approvals) {
        registered.add(row.path);
        const path = join(root, row.path);
        if (!fs.existsSync(path)) {
            errors.push(`docs/releases/approvals/registry.json: ${row.version} is missing ${row.path}`);
            continue;
        }
        try {
            assessStableApproval(JSON.parse(fs.readFileSync(path, 'utf8')), row.version, registry);
        } catch (error) {
            errors.push(`${row.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    for (const name of fs.readdirSync(directory).filter(name => /^v.*\.json$/u.test(name))) {
        const relative = `docs/releases/approvals/${name}`;
        if (!registered.has(relative)) errors.push(`${relative}: approval decision is not registered`);
    }
    return errors;
}
function indexLinkTargets(root: string, files: readonly string[]): Set<string> {
    const result = new Set<string>();
    for (const file of files) {
        const path = join(root, file);
        if (!fs.existsSync(path)) continue;
        const origin = dirname(path), body = fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
        for (const match of body.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/gu)) {
            const target = match[1]!;
            if (/^[a-zA-Z][\w+.-]*:/u.test(target) || target.startsWith('//') || target.startsWith('/')) continue;
            result.add(relative(root, resolve(origin, target.split('?')[0]!)).split(sep).join('/'));
        }
    }
    return result;
}
export function checkDocumentationPages(root: string): string[] {
    if (!fs.existsSync(join(root, 'docs', 'development', 'README.md'))) return [];
    const errors: string[] = [];
    const englishIndex = indexLinkTargets(root, ['docs/README.md', 'docs/development/README.md']);
    const chineseIndex = indexLinkTargets(root, ['docs/README.zh-CN.md', 'docs/development/README.zh-CN.md']);
    const indexPages = new Set(['docs/README.md', 'docs/README.zh-CN.md', 'docs/development/README.md', 'docs/development/README.zh-CN.md']);
    for (const path of DOCUMENT_CONTENT_PATHS) {
        const file = join(root, path);
        if (!fs.existsSync(file)) continue;
        const body = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), lines = body.split('\n');
        let index = 0;
        while (index < lines.length && (!lines[index]!.trim() || /^<a id="[^"]+"><\/a>$/u.test(lines[index]!.trim()))) index++;
        if (!/^# .+/u.test(lines[index] ?? '')) {
            errors.push(`${path}: missing a single H1 before content`);
            continue;
        }
        let nav = index + 1;
        while (nav < lines.length && !lines[nav]!.trim()) nav++;
        const line = lines[nav] ?? '', chinese = path.endsWith('.zh-CN.md');
        if (chinese) {
            if (!line.startsWith('[English](') || !line.includes('| **简体中文**'))
                errors.push(`${path}: missing Chinese language navigation`);
        } else if (!line.startsWith('**English** | [简体中文](')) {
            errors.push(`${path}: missing English language navigation`);
        }
        if (!indexPages.has(path) && !path.startsWith('README')) {
            const reachable = chinese ? chineseIndex : englishIndex;
            if (!reachable.has(path)) errors.push(`${path}: is not linked from the current documentation index`);
        }
    }
    return errors;
}
export function checkDocumentationRegistration(root: string): string[] {
    const directory = join(root, 'docs');
    if (!fs.existsSync(directory)) return [];
    const registered = new Set(DOCUMENT_CONTENT_PATHS
        .filter(path => path.startsWith('docs/') && path.split('/').length === 2)
        .map(path => path.replace(/\.zh-CN\.md$|\.md$/u, '')));
    const allowed = new Set(['docs/APPEARANCE', 'docs/DIAGNOSTICS', 'docs/PACKAGE_MANAGEMENT',
        'docs/PROFILES', 'docs/SHOWCASE', 'docs/TASK_DETAILS']);
    const excluded = /^(?:README|RELEASING|PREVIEW|ROADMAP|MACOS_VALIDATION|AGENTS)(?:\.zh-CN)?\.md$/u;
    const errors: string[] = [];
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.md') && !name.endsWith('.zh-CN.md'))) {
        if (excluded.test(name)) continue;
        const path = `docs/${name.replace(/\.md$/u, '')}`;
        if (!registered.has(path) && !allowed.has(path))
            errors.push(`${path}.md: current top-level guide is not registered or explicitly allowlisted`);
    }
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
    for (const page of pages) {
        const name = relative(root, page).split(sep).join('/');
        if (LOCAL_ONLY.has(name)) continue;
        const body = fs.readFileSync(page, 'utf8');
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
    errors.push(...checkChangelog(root));
    errors.push(...checkDeliveryRecords(root));
    errors.push(...checkApprovalData(root));
    errors.push(...checkImageGalleries(root));
    errors.push(...checkDocumentationPages(root));
    errors.push(...checkDocumentationRegistration(root));
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
