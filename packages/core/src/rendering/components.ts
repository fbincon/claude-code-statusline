import type { FitObserver } from './trace.js';
import type { DisplayDraft, InstanceDraft, Scope } from '../contracts/ui.js';
import * as layout from './layout.js';
import * as appearance from './appearance.js';
import * as styles from './styles.js';
import * as powerline from './powerline.js';
export interface Cell<T = unknown> {
    id: string;
    text: string;
    priority: number;
    spacer?: boolean;
    payload?: T;
    sequence?: false;
}
export function literal(node: InstanceDraft, config: DisplayDraft, scope: Scope = 'main', truncated?: () => void): string {
    let text = node.text || '';
    if (!text)
        return '';
    const options = node.options;
    if (options.icon)
        text = options.icon + ' ' + text;
    if (options.label)
        text = options.label + ' ' + text;
    if (config.use_colors)
        text = appearance.apply(text, config, 'text', options, scope);
    if (options.max_width !== null) {
        if (layout.displayWidth(text) > options.max_width) truncated?.();
        text = layout.truncateStyled(text, options.max_width);
    }
    return text;
}
export function fitRow<T>(cells: readonly Cell<T>[], columns: number, config: DisplayDraft, join: (side: Cell<T>[]) => string, measure: (text: string) => number = layout.displayWidth, observe?: FitObserver, colors = powerline.cursor()): string {
    if (columns < 1)
        return '';
    const divider = cells.findIndex(cell => cell.spacer), left = (divider < 0 ? cells : cells.slice(0, divider)).filter(cell => cell.text), right = divider < 0 ? [] : cells.slice(divider + 1).filter(cell => cell.text);
    if (!left.length && !right.length)
        return '';
    if (config.powerline.color_mode === 'restart') colors.index = 0;
    const isPowerline = config.separator_style === 'powerline';
    let padding = true, cap = true;
    const text = (side: Cell<T>[]) => isPowerline ? powerline.row(side, config, padding, cap, colors) : join(side), occupied = () => measure(text(left)) + measure(text(right));
    if (isPowerline && occupied() > columns)
        padding = false;
    if (isPowerline && occupied() > columns)
        cap = false;
    while (left.length + right.length > 1 && occupied() > columns) {
        const ordered = [...left.map((cell, index) => ({ side: left, index, cell })), ...right.map((cell, index) => ({ side: right, index, cell }))];
        let victim = 0;
        for (let i = 1; i < ordered.length; i++)
            if (ordered[i]!.cell.priority <= ordered[victim]!.cell.priority)
                victim = i;
        const row = ordered[victim]!;
        observe?.(row.cell.id,'priority_omitted');
        row.side.splice(row.index, 1);
    }
    if (occupied() > columns) {
        const side = left.length ? left : right;
        observe?.(side[0]!.id,'truncated');
        side[0] = { ...side[0]!, text: layout.truncateStyled(side[0]!.text, columns) };
    }
    const a = text(left);
    if (isPowerline) powerline.advance(left, colors);
    // A spacer divides one physical row; restarting happens once for the whole row.
    const rightConfig = config.powerline.color_mode === 'restart' ? { ...config, powerline: { ...config.powerline, color_mode: 'continuous' as const } } : config;
    const b = isPowerline ? powerline.row(right, rightConfig, padding, cap, colors) : text(right);
    if (isPowerline) { powerline.advance(right, colors); if (config.powerline.color_mode === 'restart') colors.index = 0; }
    const gap = divider < 0 ? 0 : Math.max(0, columns - measure(a) - measure(b)), reset = config.use_colors ? styles.RESET : '';
    return layout.ensureReset(a + (gap ? reset + ' '.repeat(gap) : '') + b, reset);
}
