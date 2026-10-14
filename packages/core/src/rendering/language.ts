import { string } from '../runtime/values.js';
export type Messages = Readonly<Record<string, string>>;
const VALUES: Record<string, ReadonlySet<string>> = {
    run: new Set(['main', 'queued', 'waiting agents', 'main wrap-up', 'completed', 'failed', 'interrupted', 'unknown', 'running', 'pending', 'waiting', 'paused', 'killed']),
    permission: new Set(['default', 'plan', 'acceptEdits', 'bypassPermissions', 'dontAsk', 'auto']), effort: new Set(['low', 'medium', 'high', 'xhigh', 'max']),
    tool: new Set(['started', 'success', 'error', 'denied', 'interrupted']), review: new Set(['approved', 'changes_requested', 'review_required', 'pending', 'commented', 'dismissed']), period: new Set(['daily', 'weekly', 'monthly']),
};
/** The application supplies only the selected small statusline pack and fallback. */
export class Presentation {
    constructor(public readonly language: string, public readonly messages: Messages, public readonly english: Messages = messages) { }
    private template(key: string, fallback: string): string { return (Object.hasOwn(this.messages, key) ? this.messages[key] : undefined) ?? (Object.hasOwn(this.english, key) ? this.english[key] : undefined) ?? fallback; }
    text(key: string, params: Record<string, unknown> = {}): string {
        const full = 'statusline.' + key;
        return this.template(full, full).replace(/\{\{|\}\}|\{(\w+)\}/gu, (match, name: string | undefined) => {
            if (name === undefined)
                return match === '{{' ? '{' : '}';
            if (!Object.hasOwn(params, name))
                throw new Error('Missing presentation argument: ' + name);
            return string(params[name]);
        });
    }
    value(domain: string, value: unknown): unknown {
        if (this.language === 'en' || typeof value !== 'string' || !VALUES[domain]?.has(value))
            return value;
        return this.text('values.' + domain + '.' + (domain === 'run' ? value.replaceAll(' ', '_').replaceAll('-', '_') : value));
    }
    prefix(scope: string, item: string): string { return this.template(`statusline.prefix.${scope}.${item}`, ''); }
    shortLabel(scope: string, item: string): string { return this.text(`short.${scope}.${item}`); }
}
