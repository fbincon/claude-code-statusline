import { homedir, hostname } from 'node:os';
import { win32 } from 'node:path';
/** Path presentation is lexical: '..' and symlinks must not be resolved. */
function parts(value: string, windows: boolean): {
    anchor: string;
    parts: string[];
} {
    if (!windows) {
        const anchor = value.startsWith('//') && !value.startsWith('///') ? '//' : value.startsWith('/') ? '/' : '';
        return { anchor, parts: value.slice(anchor.length).split('/').filter(part => part && part !== '.') };
    }
    value = value.replaceAll('/', '\\');
    const anchor = win32.parse(value).root;
    return { anchor, parts: value.slice(anchor.length).split('\\').filter(part => part && part !== '.') };
}
export function pathName(value: string, windows = process.platform === 'win32'): string { return parts(value, windows).parts.at(-1) ?? ''; }
export function directory(value: string, style: string, project?: string | null, home = homedir(), windows = process.platform === 'win32'): string {
    if (style === 'full')
        return value;
    const path = parts(value, windows);
    if (style === 'basename')
        return path.parts.at(-1) || path.anchor || value;
    const base = style === 'home' ? home : style === 'project-relative' ? project : null;
    if (!base)
        return value;
    const parent = parts(base, windows), equal = (a: string, b: string) => windows ? a.toLowerCase() === b.toLowerCase() : a === b;
    if (!equal(path.anchor, parent.anchor) || parent.parts.length > path.parts.length || parent.parts.some((part, i) => !equal(part, path.parts[i]!)))
        return value;
    const suffix = path.parts.slice(parent.parts.length).join('/');
    return style === 'home' ? '~' + (suffix ? '/' + suffix : '') : suffix || '.';
}
export function formatDate(seconds: number, utc: boolean, withDate: boolean): string | null {
    const date = new Date(seconds * 1000);
    if (!Number.isFinite(date.getTime()))
        return null;
    const year = utc ? date.getUTCFullYear() : date.getFullYear();
    if (year < 1 || year > 9999)
        return null;
    const pad = (value: number) => String(value).padStart(2, '0');
    const prefix = withDate ? `${year}-${pad((utc ? date.getUTCMonth() : date.getMonth()) + 1)}-${pad(utc ? date.getUTCDate() : date.getDate())} ` : '';
    return prefix + pad(utc ? date.getUTCHours() : date.getHours()) + ':' + pad(utc ? date.getUTCMinutes() : date.getMinutes()) + (utc ? ' UTC' : '');
}
export function hostName(): string | null { try {
    return hostname();
}
catch {
    return null;
} }
