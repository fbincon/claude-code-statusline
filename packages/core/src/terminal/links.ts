declare const URL: {
    new (value: string): {
        protocol: string;
        username: string;
        password: string;
        hostname: string;
        href: string;
    };
};
export const OSC8_RE = /\x1b\]8;[^;\x07\x1b]*;([^\x07\x1b]*)(?:\x07|\x1b\\)/gu;
export const CLOSE_LINK = '\x1b]8;;\x1b\\';
export function safeLink(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 8192 || /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(value) || /%(?:00|07|0a|0d|1b|7f|9b|9d)/iu.test(value))
        return null;
    try {
        const url = new URL(value);
        if (!['https:', 'http:', 'file:'].includes(url.protocol) || url.username || url.password)
            return null;
        if (url.protocol === 'file:' && url.hostname && url.hostname !== 'localhost')
            return null;
        return url.href;
    }
    catch {
        return null;
    }
}
export function fileLink(path: unknown): string | null {
    if (typeof path !== 'string' || /[\p{Cc}\p{Cs}]/u.test(path))
        return null;
    const windows = /^[a-z]:[/\\]/iu.test(path);
    if (!windows && !path.startsWith('/') || path.startsWith('//') || path.startsWith('\\\\'))
        return null;
    const parts = (windows ? '/' + path.replaceAll('\\', '/') : path).split('/').map((part, index) => windows && index === 1 ? part : encodeURIComponent(part));
    return safeLink('file://' + parts.join('/'));
}
export function linkSequence(target: string): string { return '\x1b]8;;' + target + '\x1b\\'; }
export function supportsLinks(env: Readonly<Record<string, string | undefined>>): boolean {
    if (env.FORCE_HYPERLINK === '0' || env.TERM === 'dumb')
        return false;
    if (env.FORCE_HYPERLINK === '1')
        return true;
    if (env.TMUX || env.STY)
        return false;
    return Boolean(env.WT_SESSION || env.KITTY_WINDOW_ID || env.WEZTERM_PANE || Number(env.VTE_VERSION) >= 5000 || ['iTerm.app', 'WezTerm', 'vscode', 'ghostty'].includes(env.TERM_PROGRAM ?? ''));
}
