import type { FitObserver } from './trace.js';
import type { DisplayDraft, Scope } from '../contracts/ui.js';
import * as styles from './styles.js';
import * as layout from './layout.js';
import { sequence } from './appearance.js';

export interface Block {
    id?: string;
    text: string;
    priority?: number;
    prefer_slash_breaks?: boolean;
    sequence?: false;
    continuation?: boolean;
}
/** Owned by one main or subagent render, never retained between payloads. */
export interface ColorCursor { index: number; scope: Scope }
export const cursor = (scope: Scope = 'main'): ColorCursor => ({ index: 0, scope });
function edge(text: string, last = false): styles.Style {
    const units = layout.styledUnits(text);
    return units.length ? styles.parse(units[last ? units.length - 1 : 0]!.style) : styles.DEFAULT;
}
function separator(left: string, right: string, config: DisplayDraft, start = false): string {
    const shape = config.powerline.separator;
    if (shape === 'none') return '';
    const plain = shape === 'arrow' ? start ? '<' : '>' : shape === 'slash' ? start ? '\\' : '/' : '|';
    if (!config.use_colors) return plain;
    const a = edge(left, true), b = edge(right);
    const source = start ? b : a, target = start ? a : b;
    const solid = config.powerline_glyph === 'powerline' && shape !== 'bar' && source.background !== null && !styles.sameColor(source.background, target.background);
    const glyph = solid ? shape === 'arrow' ? start ? '\ue0b2' : '\ue0b0' : start ? '\ue0ba' : '\ue0b8' : plain;
    return styles.serialize({ bold: false, foreground: solid ? source.background : source.foreground, background: solid ? target.background : b.background }) + glyph + styles.RESET;
}
function sides(config: DisplayDraft, padding: boolean): [number, number] {
    return padding ? [Number(['left', 'both'].includes(config.powerline.padding)), Number(['right', 'both'].includes(config.powerline.padding))] : [0, 0];
}
export function width(blocks: readonly Block[], config: DisplayDraft, padding = true, caps = true): number {
    const visible = blocks.filter(b => b.text), [left, right] = sides(config, padding);
    const separatorWidth = Number(config.powerline.separator !== 'none');
    return visible.reduce((sum, b) => sum + layout.displayWidth(b.text) + left + right, 0) +
        separatorWidth * (Math.max(0, visible.length - 1) + Number(visible.length > 0 && caps) * (Number(config.powerline.start_cap) + Number(config.powerline.end_cap)));
}
/** Pure drawing; measuring a candidate must not advance its color cursor. */
export function row(blocks: readonly Block[], config: DisplayDraft, padding = true, caps = true, colors = cursor()): string {
    const result: string[] = [], [left, right] = sides(config, padding);
    let previous: string | null = null, index = config.powerline.color_mode === 'restart' ? 0 : colors.index;
    for (const block of blocks.filter(b => b.text)) {
        const continued = block.continuation && config.powerline.color_mode === 'continuous';
        const text = block.id && block.sequence !== false ? sequence(block.text, config, block.id, colors.scope, continued ? index - 1 : index++) : block.text;
        if (previous !== null) result.push(separator(previous, text, config));
        else if (caps && config.powerline.start_cap) result.push(separator('', text, config, true));
        if (left) result.push((config.use_colors ? styles.serialize(edge(text)) : '') + ' ' + (config.use_colors ? styles.RESET : ''));
        result.push(config.use_colors ? text : layout.withoutColors(text));
        if (right) result.push((config.use_colors ? styles.serialize(edge(text, true)) : '') + ' ' + (config.use_colors ? styles.RESET : ''));
        previous = text;
    }
    if (previous !== null && caps && config.powerline.end_cap) result.push(separator(previous, '', config));
    return layout.ensureReset(result.join(''), config.use_colors ? styles.RESET : '');
}
export function advance(blocks: readonly Block[], colors: ColorCursor): void {
    colors.index += blocks.filter(block => block.text && block.id && block.sequence !== false && !block.continuation).length;
}
export function fit(values: readonly Block[], columns: number, config: DisplayDraft, observe?: FitObserver, colors = cursor()): string {
    const blocks = values.filter(b => b.text).map(b => ({ ...b }));
    if (!blocks.length || columns < 1) return '';
    let padding = true, caps = true;
    if (width(blocks, config, padding, caps) > columns) padding = false;
    if (width(blocks, config, padding, caps) > columns) caps = false;
    while (blocks.length > 1 && width(blocks, config, padding, caps) > columns) {
        let victim = 0;
        for (let i = 1; i < blocks.length; i++)
            if ((blocks[i]!.priority ?? 50) <= (blocks[victim]!.priority ?? 50)) victim = i;
        if (blocks[victim]!.id) observe?.(blocks[victim]!.id!, 'priority_omitted');
        blocks.splice(victim, 1);
    }
    if (width(blocks, config, padding, caps) > columns) {
        if (blocks[0]!.id) observe?.(blocks[0]!.id!, 'truncated');
        blocks[0]!.text = layout.truncateStyled(blocks[0]!.text, columns);
    }
    const text = row(blocks, config, padding, caps, colors);
    advance(blocks, colors);
    return text;
}
export function wrap(blocks: readonly Block[], columns: number, config: DisplayDraft, colors = cursor()): string[] {
    columns = Math.max(2, columns);
    const result: string[] = [];
    let current: Block[] = [], padding = true, caps = true;
    const bodyWidth = () => columns - width([{ text: 'xx' }], config, padding, caps) + 2;
    if (bodyWidth() < 2) padding = false;
    if (bodyWidth() < 2) caps = false;
    const emit = (values: Block[]) => { const text = row(values, config, padding, caps, colors); if (text) result.push(text); advance(values, colors); };
    for (const block of blocks.filter(b => b.text)) {
        if (current.length && width([...current, block], config, padding, caps) > columns) { emit(current); current = []; }
        if (width([block], config, padding, caps) > columns) {
            const chunks = layout.splitAnsiText(block.text, bodyWidth(), block.prefer_slash_breaks);
            chunks.slice(0, -1).forEach((chunk, index) => emit([{ ...block, text: chunk, continuation: index > 0 }]));
            current = [{ ...block, text: chunks.at(-1)!, continuation: chunks.length > 1 }];
        } else current.push(block);
    }
    if (current.length) emit(current);
    return result;
}
