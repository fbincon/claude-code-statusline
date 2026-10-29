import * as fs from 'node:fs';
import { join, resolve, relative, dirname, basename, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rewriteLinks, GITHUB, RAW_GITHUB } from '../release/markdown.ts';
import { checkCommunity } from './community.ts';
const LOCAL_ONLY = new Set(['ROADMAP.md', 'ROADMAP.zh-CN.md', 'MACOS_VALIDATION.md']);
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
