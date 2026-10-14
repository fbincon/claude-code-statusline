import type { DisplayDraft } from '../contracts/ui.js';
import * as styles from './styles.js';
import * as layout from './layout.js';
export interface Block {
    text: string;
    priority?: number;
    prefer_slash_breaks?: boolean;
}
function edge(text: string, last = false): styles.Style { const units = layout.styledUnits(text); return units.length ? styles.parse(units[last ? units.length - 1 : 0]!.style) : styles.DEFAULT; }
function separator(left: string, right: string, config: DisplayDraft): string {
    if (!config.use_colors)
        return '>';
    const a = edge(left, true), b = edge(right), arrow = config.powerline_glyph === 'powerline' && a.background !== null && !styles.sameColor(a.background, b.background);
    return styles.serialize({ bold: false, foreground: arrow ? a.background : a.foreground, background: b.background }) + (arrow ? '\ue0b0' : '>') + styles.RESET;
}
export function width(blocks: readonly Block[], padding = 1, cap = true): number { return blocks.reduce((sum, b) => sum + layout.displayWidth(b.text) + 2 * padding, 0) + Math.max(0, blocks.length - 1) + Number(blocks.length > 0 && cap); }
export function row(blocks: readonly Block[], config: DisplayDraft, padding = 1, cap = true): string {
    const result: string[] = [];
    let previous: Block | null = null;
    for (const block of blocks) {
        if (previous)
            result.push(separator(previous.text, block.text, config));
        if (padding) {
            const left = styles.serialize(edge(block.text)) + ' '.repeat(padding) + (config.use_colors ? styles.RESET : ''), right = styles.serialize(edge(block.text, true)) + ' '.repeat(padding) + (config.use_colors ? styles.RESET : '');
            result.push(left + block.text + right);
        }
        else
            result.push(block.text);
        previous = block;
    }
    if (blocks.length && cap)
        result.push(separator(blocks.at(-1)!.text, '', config));
    return layout.ensureReset(result.join(''), config.use_colors ? styles.RESET : '');
}
export function fit(values: readonly Block[], columns: number, config: DisplayDraft): string {
    const blocks = [...values];
    if (!blocks.length || columns < 1)
        return '';
    let padding = 1, cap = true;
    if (width(blocks, padding, cap) > columns)
        padding = 0;
    if (width(blocks, padding, cap) > columns)
        cap = false;
    while (blocks.length > 1 && width(blocks, padding, cap) > columns) {
        let victim = 0;
        for (let i = 1; i < blocks.length; i++)
            if ((blocks[i]!.priority ?? 50) <= (blocks[victim]!.priority ?? 50))
                victim = i;
        blocks.splice(victim, 1);
    }
    if (width(blocks, padding, cap) > columns)
        blocks[0] = { ...blocks[0]!, text: layout.truncateStyled(blocks[0]!.text, columns) };
    return row(blocks, config, padding, cap);
}
export function wrap(blocks: readonly Block[], columns: number, config: DisplayDraft): string[] {
    columns = Math.max(2, columns);
    const result: string[] = [];
    let current: Block[] = [], padding = columns >= 4 ? 1 : 0, cap = columns >= 4, body = columns - 2 * padding - Number(cap);
    if (body < 2) {
        padding = 0;
        cap = false;
        body = columns;
    }
    for (const block of blocks) {
        if (current.length && width([...current, block], padding, cap) > columns) {
            result.push(row(current, config, padding, cap));
            current = [];
        }
        if (width([block], padding, cap) > columns) {
            const chunks = layout.splitAnsiText(block.text, body, block.prefer_slash_breaks);
            for (const chunk of chunks.slice(0, -1))
                result.push(row([{ ...block, text: chunk }], config, padding, cap));
            current = [{ ...block, text: chunks.at(-1)! }];
        }
        else
            current.push(block);
    }
    if (current.length)
        result.push(row(current, config, padding, cap));
    return result;
}
