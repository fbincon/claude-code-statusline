import type { DisplayDraft, FormattingDraft, ItemOptionsDraft, Scope } from '../contracts/ui.js';
import { DEFAULT_ITEM } from '../config/defaults.js';
import { BY_SCOPE } from '../config/catalog.js';
import { int, numeric } from '../runtime/values.js';
import { fixed } from '../numbers.js';
import { grouped } from './numeric-format.js';
import { humanizeTokens } from './formatters.js';
import * as layout from './layout.js';
import type { Presentation } from './language.js';
export function modelName(value: string | null, fmt: FormattingDraft): string | null {
    if (!value || fmt.model_name === 'original')
        return value;
    const match = value.match(/^(?:claude-)?(opus|sonnet|haiku)(?:-(\d+(?:-\d+)*))?$/iu);
    if (!match)
        return value;
    const versions = (match[2] ?? '').split('-').filter(v => v && !/^\d{8}$/u.test(v)), kind = match[1]!.toLowerCase();
    return kind[0]!.toUpperCase() + kind.slice(1) + (versions.length ? ' ' + versions.join('.') : '');
}
export function number(value: unknown, fmt: FormattingDraft, legacy: (value: unknown) => string | null = humanizeTokens): string | null {
    if (fmt.number_format === 'legacy')
        return legacy(value);
    const whole = int(value);
    if (whole === null || whole < 0n)
        return null;
    if (fmt.number_format === 'compact')
        return humanizeTokens(value);
    return fmt.number_format === 'grouped' ? grouped(String(whole)) : String(whole);
}
export function money(value: number, fmt: FormattingDraft): string {
    if (fmt.number_format === 'grouped')
        return grouped(fixed(value, 2));
    if (fmt.number_format === 'compact' && value >= 1000)
        return fixed(value / (value >= 1000000 ? 1000000 : 1000), 2).replace(/0+$/u, '').replace(/\.$/u, '') + (value >= 1000000 ? 'M' : 'K');
    return fixed(value, 2);
}
export type DateFormatter = (seconds: number, utc: boolean, withDate: boolean) => string | null;
export function resetTime(expires: unknown, now: number, fmt: FormattingDraft, countdown: (expires: unknown, now: number) => string | null, formatDate: DateFormatter): string | null {
    const remaining = countdown(expires, now);
    if (remaining === null || fmt.reset_format === 'countdown')
        return remaining;
    return formatDate(numeric(expires)!, fmt.reset_timezone === 'UTC', fmt.reset_format !== 'time');
}
const SYMBOLS = '✓⏱✗■…⏳⚡', ICONS: Record<string, readonly [
    string,
    string
]> = { model: ['◆', 'M'], location: ['⌂', 'D'], repo: ['↗', 'G'], context: ['◉', 'C'], limits: ['◷', 'L'], usage: ['∑', 'U'], task: ['›', '>'] };
export function decorate(text: string, item: string, scope: Scope, fmt: FormattingDraft, options: ItemOptionsDraft, language: Presentation): string {
    if (fmt.labels === 'legacy' && fmt.icons === 'legacy' && options.label === null && options.icon === null)
        return text;
    const ownsIcon = (scope === 'main' ? ['task-timer'] : ['status', 'status-elapsed']).includes(item), custom = options.label !== null;
    const prefix = custom || fmt.labels !== 'legacy' ? language.prefix(scope, item) : null;
    let plain = layout.strip(text);
    const removesIcon = ownsIcon && (fmt.icons !== 'legacy' || options.icon !== null) && SYMBOLS.includes([...plain][0] ?? '\0'), removesLabel = prefix && plain.startsWith(prefix + ' ');
    const getIcon = () => {
        if (options.icon !== null)
            return options.icon;
        if (fmt.icons === 'unicode' || fmt.icons === 'ascii')
            return (ICONS[BY_SCOPE[scope].get(item)!.group] ?? ['·', ':'])[fmt.icons === 'ascii' ? 1 : 0];
        return null;
    };
    const label = custom ? options.label! : fmt.labels === 'short' ? language.shortLabel(scope, item) : '';
    if (!removesIcon && !removesLabel) {
        const icon = getIcon();
        let value = (icon ? icon + ' ' : '') + (label ? label + ' ' : '') + text;
        if (text.includes('\x1b[') && !text.endsWith('\x1b[0m'))
            value += '\x1b[0m';
        return value;
    }
    let units = layout.styledUnits(text);
    if (removesIcon) {
        units = units.slice(1 + Number([...plain][1] === ' '));
        plain = units.map(u => u.text).join('');
    }
    if (custom || fmt.labels !== 'legacy') {
        const owned = language.prefix(scope, item);
        if (owned && plain.startsWith(owned + ' '))
            units = units.slice([...owned].length + 1);
        if (label)
            units = [...layout.styledUnits(label + ' '), ...units];
    }
    const icon = getIcon();
    if (icon)
        units = [...layout.styledUnits(icon + ' '), ...units];
    return layout.renderStyledUnits(units);
}
export function threshold(text: string, used: number | null, fmt: FormattingDraft, config: DisplayDraft, normal: string): string {
    if (!config.use_colors || !fmt.thresholds.enabled || used === null)
        return text;
    const level = fmt.thresholds;
    let color: string;
    if (used >= level.critical)
        color = config.palette === 'ansi' ? '\x1b[1;31m' : '\x1b[1;38;2;242;134;134m';
    else if (used >= level.warning)
        color = config.palette === 'ansi' ? '\x1b[1;33m' : '\x1b[1;38;2;242;181;80m';
    else
        return text;
    return normal ? text.replaceAll(normal, color) : text;
}
export function optionsFor(config: DisplayDraft, id: string, scope: Scope = 'main'): readonly [
    FormattingDraft,
    ItemOptionsDraft
] {
    const options = (scope === 'main' ? config.instances : config.subagents.instances).find(node => node.id === id)?.options ?? DEFAULT_ITEM;
    return [{ ...config.formatting, ...options.formatting } as FormattingDraft, options];
}
export function legacyFitting(options: readonly ItemOptionsDraft[]): boolean { return options.some(o => o.label !== null || o.icon !== null || Object.keys(o.formatting).length > 0 || o.priority !== 50 || o.max_width !== null); }
