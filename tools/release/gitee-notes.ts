import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { GITHUB, RAW_GITHUB, REPOSITORY, TAG, localDestination, rewriteLinks } from './markdown.js';
export const GITEE = 'https://gitee.com/' + REPOSITORY;
export interface Release {
    tag_name: string;
    prerelease: boolean;
    draft?: boolean;
    body?: string;
    html_url?: string;
    published_at?: string;
    assets: {
        name: string;
        browser_download_url?: string;
    }[];
}
function require(value: unknown, message: string): asserts value { if (!value)
    throw new Error(message); }
export function assetCatalog(releases: Release[]): Map<string, string> {
    const result = new Map<string, string>();
    for (const release of releases) {
        require(TAG.test(release.tag_name), 'Unexpected Gitee tag');
        for (const asset of release.assets) {
            if (!/\.(?:whl|tgz|tar\.gz|json)$|^SHA256SUMS$/u.test(asset.name))
                continue;
            const url = asset.browser_download_url;
            require(typeof url === 'string', 'Missing Gitee asset URL');
            if (new URL(url).pathname.includes('/archive/'))
                continue;
            const key = release.tag_name + '/' + asset.name;
            require(!/[\\/\r\n]/u.test(asset.name) && url === `${GITEE}/releases/download/${encodeURIComponent(release.tag_name)}/${encodeURIComponent(asset.name)}`, 'Unexpected Gitee asset URL');
            require(!result.has(key), 'Duplicate Gitee asset');
            result.set(key, url);
        }
    }
    return result;
}
export function renderGitee(tag: string, source: Release, targets: Release[]): string {
    require(TAG.test(tag), 'Use an exact version tag');
    require(source.tag_name === tag && !source.draft, 'Source tag differs or is unpublished');
    const matching = targets.filter(row => row.tag_name === tag);
    require(matching.length === 1, 'Gitee target Release is missing or duplicated');
    require(matching[0]!.prerelease === source.prerelease, 'Prerelease status differs');
    const catalog = assetCatalog(targets), names = source.assets.map(row => row.name), wheels = names.filter(n => n.endsWith('.whl')), npm = names.filter(n => n.endsWith('.tgz'));
    require(names.length === new Set(names).size && names.includes('SHA256SUMS'), 'Duplicate assets or missing SHA256SUMS');
    const legacy = wheels.length === 1;
    if (legacy) {
        require(names.length === 3 && npm.length === 0 && names.filter(n => n.endsWith('.tar.gz')).length === 1, 'Source must contain one wheel, one sdist and SHA256SUMS');
        const suffix = `-${tag.slice(1)}-py3-none-any.whl`, prefix = wheels[0]!.endsWith(suffix) ? wheels[0]!.slice(0, -suffix.length) : '';
        require(['claude_code_statusline', 'fbincon_claude_code_statusline'].includes(prefix) && names.includes(`${prefix}-${tag.slice(1)}.tar.gz`), 'Package asset identity differs');
    }
    else
        require(wheels.length === 0 && npm.length === 1 && /^fbincon-statusline-[a-z0-9.-]+\.tgz$/u.test(npm[0]!), 'Expected one verified npm package');
    for (const name of names)
        require(catalog.has(tag + '/' + name), 'Missing matching Gitee asset: ' + tag + '/' + name);
    const packageName = (legacy ? wheels[0] : npm[0])!, local = './' + packageName;
    const rewrite = (target: string, image = false): string => {
        if (!target || target.startsWith('#'))
            return target;
        if (target.startsWith(GITHUB + '/releases/download/')) {
            const key = decodeURIComponent(target.slice((GITHUB + '/releases/download/').length));
            require(catalog.has(key), 'Missing matching Gitee asset: ' + key);
            return catalog.get(key)!;
        }
        for (const [base, route] of [[GITHUB + '/blob/', 'blob'], [GITHUB + '/raw/', 'raw'], [RAW_GITHUB + '/', 'raw']])
            if (target.startsWith(base!)) {
                const rest = target.slice(base!.length), ref = rest.split('/')[0]!;
                require(rest.includes('/') && (ref === 'main' || TAG.test(ref)), 'Unsupported documentation ref');
                return `${GITEE}/${route}/${rest}`;
            }
        if (target === GITHUB + '/releases' || target.startsWith(GITHUB + '/releases/tag/'))
            return target.replace(GITHUB, GITEE);
        if (/^[a-zA-Z][\w+.-]*:/u.test(target) || target.startsWith('//'))
            return target;
        const [path, suffix] = localDestination(target, `docs/releases/${tag}.md`);
        return `${GITEE}/${image ? 'raw' : 'blob'}/${tag}/${path}${suffix}`;
    };
    let body = rewriteLinks(source.body ?? '', rewrite);
    body = body.replace(/https:\/\/github\.com\/fbincon\/claude-code-statusline\/releases\/download\/[^\s"'`<>]+/gu, target => rewrite(target));
    body = body.replace(/git\+https:\/\/github\.com\/fbincon\/claude-code-statusline\.git@([^\s"'`<>]+)/gu, (_all, ref) => `git+${GITEE}.git@${ref}`);
    if (legacy) {
        body = body.replace(/\bpipx\s+(?:install|upgrade)\s+(?:--force\s+)?(?:fbincon-)?claude-code-statusline(?![\w-])(?:==([A-Za-z0-9.]+))?/gu, (_all, version) => {
            require(!version || version === tag.slice(1), 'Pinned installation version differs');
            return `pipx install --force "${local}"`;
        });
        body = body.replace(/(\bpipx\s+install(?:\s+--force)?)\s+(["']?)(https:\/\/gitee\.com\/fbincon\/claude-code-statusline\/releases\/download\/[^\s"'`<>]+\.whl)\2/gu, (_all, command, _quote, url) => {
            require([...catalog.values()].includes(url), 'Unknown Gitee wheel installation URL');
            return `${command} "./${decodeURIComponent(url.split('/').at(-1))}"`;
        });
    }
    const original = `${GITHUB}/releases/tag/${tag}`;
    require(source.html_url === original, 'Original GitHub Release URL differs');
    require(typeof source.published_at === 'string' && source.published_at.length > 0 && !/[\r\n]/u.test(source.published_at), 'Missing original publication time');
    const command = legacy ? `pipx install --force "${local}"` : `npm install --global --offline --ignore-scripts "${local}"`;
    return body.trimEnd() + `\n\n## Gitee installation and downloads / Gitee 安装与下载\n\nDownload the package and SHA256SUMS, verify the checksum, then install from the download directory. / 下载包和 SHA256SUMS，核验后在下载目录安装。\n\n\`\`\`text\n${command}\nclaude-statusline install --dry-run\nclaude-statusline install\nclaude-statusline doctor\n\`\`\`\n\n${names.map(name => `[${name}](${catalog.get(tag + '/' + name)})`).join('\n')}\n\n## Original publication / 原始发布信息\n\n[Original GitHub Release / GitHub 原始发行版](${original})\n\nOriginal GitHub publication time / GitHub 原始发布时间: ${source.published_at}\n`;
}
export function writeNotes(tag: string, source: string, targets: string, output: string): void {
    const body = renderGitee(tag, JSON.parse(readFileSync(source, 'utf8')), JSON.parse(readFileSync(targets, 'utf8')));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, body);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: Object.fromEntries(['tag', 'github-release-json', 'gitee-releases-json', 'output'].map(key => [key, { type: 'string' as const }])) });
    if (Object.values(values).length !== 4)
        throw new Error('Require --tag, --github-release-json, --gitee-releases-json and --output');
    writeNotes(values.tag!, values['github-release-json']!, values['gitee-releases-json']!, values.output!);
}
