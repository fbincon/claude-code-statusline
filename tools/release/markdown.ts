import { posix } from 'node:path';
export const REPOSITORY = 'fbincon/claude-code-statusline';
export const GITHUB = 'https://github.com/' + REPOSITORY;
export const RAW_GITHUB = 'https://raw.githubusercontent.com/' + REPOSITORY;
export const TAG = /^v\d+\.\d+\.\d+(?:(?:a|b|rc)\d+|-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
export function localDestination(target: string, source: string): [
    string,
    string
] {
    const match = /^([^?#]*)(\?[^#]*)?(?:#(.*))?$/u.exec(target)!;
    const path = decodeURIComponent(match[1]!), fragment = match[3];
    const destination = path ? posix.normalize(path.startsWith('/') ? path.slice(1) : posix.join(posix.dirname(source), path)) : source;
    if (destination === '..' || destination.startsWith('../') || destination.includes('\\'))
        throw new Error('Markdown destination leaves the repository');
    const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/gu, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    return [destination.split('/').map(encode).join('/'), (match[2] ?? '') + (fragment ? '#' + encode(decodeURIComponent(fragment)) : '')];
}
function destination(line: string, start: number): [
    number,
    number
] | null {
    while (/\s/u.test(line[start] ?? '') && start < line.length)
        start++;
    if (start >= line.length)
        return null;
    if (line[start] === '<') {
        const end = line.indexOf('>', start + 1);
        return end < 0 ? null : [start + 1, end];
    }
    let end = start, depth = 0;
    for (; end < line.length; end++) {
        const c = line[end];
        if (c === '\\') {
            end++;
            continue;
        }
        if (c === '(')
            depth++;
        else if (c === ')') {
            if (!depth)
                break;
            depth--;
        }
        else if (/\s/u.test(c!) && !depth)
            break;
    }
    return end > start ? [start, end] : null;
}
function labelStart(line: string, end: number): number | null {
    let depth = 1;
    for (let i = end - 1; i >= 0; i--) {
        if (i && line[i - 1] === '\\')
            continue;
        if (line[i] === ']')
            depth++;
        if (line[i] === '[' && --depth === 0)
            return i;
    }
    return null;
}
export function rewriteLinks(markdown: string, rewrite: (target: string, image: boolean) => string): string {
    const references = new Set([...markdown.matchAll(/!\[([^\]\n]*)\]\[([^\]\n]*)\]/gu)].map(m => (m[2] || m[1]!).trim().toLowerCase()));
    let fence = '';
    return (markdown.match(/[^\n]*\n|[^\n]+$/gu) ?? []).map(line => {
        const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
        if (fence) {
            if (marker && marker[0] === fence[0] && marker.length >= fence.length)
                fence = '';
            return line;
        }
        if (marker) {
            fence = marker;
            return line;
        }
        const masked = line.replace(/(`+)(?!`)(.*?)\1(?!`)/gu, value => ' '.repeat(value.length));
        const spans: [
            number,
            number,
            boolean
        ][] = [];
        for (const m of masked.matchAll(/\]\(/gu)) {
            const label = labelStart(masked, m.index), target = destination(masked, m.index + 2);
            if (label !== null && target)
                spans.push([...target, label > 0 && masked[label - 1] === '!']);
        }
        const reference = /^ {0,3}\[([^\]\n]+)\]:\s*/u.exec(masked);
        if (reference) {
            const target = destination(masked, reference[0].length);
            if (target)
                spans.push([...target, references.has(reference[1]!.trim().toLowerCase())]);
        }
        for (const m of masked.matchAll(/\b(href|src)\s*=\s*(["'])(.*?)\2/giu)) {
            const start = m.index + m[0].indexOf(m[2]!) + 1;
            spans.push([start, start + m[3]!.length, m[1]!.toLowerCase() === 'src']);
        }
        let cursor = 0, output = '';
        for (const [start, end, image] of spans.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
            if (start < cursor)
                continue;
            output += line.slice(cursor, start) + rewrite(line.slice(start, end), image);
            cursor = end;
        }
        return output + line.slice(cursor);
    }).join('');
}
export function packageReadme(markdown: string, ref: string): string {
    if (!TAG.test(ref) && !/^[a-f0-9]{40}$/u.test(ref))
        throw new Error('Use an immutable tag or commit');
    return rewriteLinks(markdown, (target, image) => {
        if (!target || /^[a-zA-Z][\w+.-]*:/u.test(target) || target.startsWith('//'))
            return target;
        const [path, suffix] = localDestination(target, 'README.md');
        return `${image ? RAW_GITHUB : GITHUB + '/blob'}/${ref}/${path}${suffix}`;
    });
}
