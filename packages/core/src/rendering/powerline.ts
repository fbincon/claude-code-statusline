import type { RenderTrace } from './trace.js';
import type { FitObserver } from './trace.js';
import type { DisplayDraft, Scope } from '../contracts/ui.js';
import * as styles from './styles.js';
import * as layout from './layout.js';
import { sequence } from './appearance.js';
import { paintGradient, type Paint } from './gradients.js';
import type { GradientDraft } from '../contracts/ui.js';
import { adapt, type Representation } from './fitting.js';

export interface Block {
    adaptive?: readonly Representation[];
    onAdapt?: (stage: Representation['stage']) => void;
    background_override?: boolean;
    id?: string;
    onContrast?:()=>void;
    text: string;
    priority?: number;
    prefer_slash_breaks?: boolean;
    sequence?: false;
    continuation?: boolean;
    paint?: Paint;
    background_gradient?: GradientDraft | null;
}
/** Owned by one main or subagent render, never retained between payloads. */
export interface ColorCursor { index: number; scope: Scope; trace?:RenderTrace; capture?: RowChunk[] }
interface Body { text: string; override: boolean; onContrast?: () => void }
export interface RowChunk { bodies?: Body[]; padding?: boolean; caps?: boolean; gap?: string; boundary?: boolean }
export const cursor = (scope: Scope = 'main',trace?:RenderTrace): ColorCursor => ({ index: 0, scope,trace });
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
export function row(blocks: readonly Block[], config: DisplayDraft, padding = true, caps = true, colors = cursor(), capture = false): string {
    if (config.powerline.row_background_gradient && config.use_colors) {
        const [left, right] = sides(config, padding);
        let index = config.powerline.color_mode === 'restart' ? 0 : colors.index;
        const bodies = blocks.filter(b => b.text).map(block => {
            const node = block.id ? (colors.scope === 'main' ? config.instances : config.subagents.instances).find(node => node.id === block.id) : undefined;
            const continued = block.continuation && config.powerline.color_mode === 'continuous';
            let text = block.id && block.sequence !== false ? sequence(block.text, config, block.id, colors.scope, continued ? index - 1 : index++) : block.text;
            text = block.paint?.(text) ?? text;
            text = (left ? styles.serialize(edge(text)) + ' ' + styles.RESET : '') + text + (right ? styles.serialize(edge(text, true)) + ' ' + styles.RESET : '');
            const gradient = block.background_gradient ?? node?.options.background_gradient;
            const onContrast = block.onContrast ?? (block.id ? () => colors.trace?.style(colors.scope, block.id!, 'contrast_protected') : undefined);
            return { text: paintGradient(text, gradient, 'background', config, onContrast), override: block.background_override ?? Boolean(node && node.options.background !== null || gradient), onContrast };
        });
        const chunk = { bodies, caps };
        if (capture) colors.capture?.push(chunk);
        return finishRow([chunk], config);
    }
    const result: string[] = [], [left, right] = sides(config, padding);
    let previous: string | null = null, index = config.powerline.color_mode === 'restart' ? 0 : colors.index;
    for (const block of blocks.filter(b => b.text)) {
        const continued = block.continuation && config.powerline.color_mode === 'continuous';
        let text = block.id && block.sequence !== false ? sequence(block.text, config, block.id, colors.scope, continued ? index - 1 : index++) : block.text;
        text = block.paint?.(text) ?? text;
        const gradient = block.background_gradient ?? (block.id ? (colors.scope === 'main' ? config.instances : config.subagents.instances).find(node => node.id === block.id)?.options.background_gradient : undefined);
        if (gradient && config.use_colors) {
            const body = paintGradient((left ? styles.serialize(edge(text)) + ' ' + styles.RESET : '') + text +
                (right ? styles.serialize(edge(text, true)) + ' ' + styles.RESET : ''), gradient, 'background', config,block.onContrast ?? (block.id?()=>colors.trace?.style(colors.scope,block.id!,'contrast_protected'):undefined));
            if (previous !== null) result.push(separator(previous, body, config));
            else if (caps && config.powerline.start_cap) result.push(separator('', body, config, true));
            result.push(body); previous = body; continue;
        }
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
/** Paint only final bodies. Alignment gaps consume no gradient cells; spacers restart it. */
export function finishRow(chunks: readonly RowChunk[], config: DisplayDraft): string {
    const copy = chunks.map(chunk => ({ ...chunk, bodies: chunk.bodies?.map(body => ({ ...body })) }));
    let run: Body[] = [];
    const paint = () => {
        if (!run.length) return;
        const sizes = run.map(body => layout.styledUnits(body.text).length);
        const painted = layout.styledUnits(paintGradient(run.map(body => body.text).join(''), config.powerline.row_background_gradient, 'background', config, index => { let end = 0; const owner = run.find((_, i) => { end += sizes[i]!; return index < end; }); owner?.onContrast?.(); }, true));
        let start = 0;
        run.forEach((body, i) => { body.text = layout.renderStyledUnits(painted.slice(start, start + sizes[i]!)); start += sizes[i]!; });
        run = [];
    };
    for (const chunk of copy) {
        if (chunk.boundary) paint();
        for (const body of chunk.bodies ?? []) { if (body.override) paint(); else run.push(body); }
    }
    paint();
    const output = copy.map(chunk => {
        if (!chunk.bodies) return chunk.gap ?? '';
        let previous = '';
        return chunk.bodies.map((body, index) => {
            const prefix = index ? separator(previous, body.text, config) : chunk.caps && config.powerline.start_cap ? separator('', body.text, config, true) : '';
            previous = body.text; return prefix + body.text;
        }).join('') + (previous && chunk.caps && config.powerline.end_cap ? separator(previous, '', config) : '');
    }).join('');
    return layout.ensureReset(output, config.use_colors ? styles.RESET : '');
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
    adapt(blocks, columns, () => width(blocks, config, padding, caps));
    while (blocks.length > 1 && width(blocks, config, padding, caps) > columns) {
        let victim = 0;
        for (let i = 1; i < blocks.length; i++)
            if ((blocks[i]!.priority ?? 50) <= (blocks[victim]!.priority ?? 50)) victim = i;
        if (blocks[victim]!.id) observe?.(blocks[victim]!.id!, 'priority_omitted');
        blocks.splice(victim, 1);
    }
    if (width(blocks, config, padding, caps) > columns) {
        if (blocks[0]!.id) observe?.(blocks[0]!.id!, 'truncated');
        blocks[0]!.text = blocks[0]!.adaptive ? '' : layout.truncateStyled(blocks[0]!.text, columns);
    }
    const text = row(blocks, config, padding, caps, colors, true);
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
    const emit = (values: Block[]) => { const text = row(values, config, padding, caps, colors, true); if (text) result.push(text); advance(values, colors); };
    for (const original of blocks.filter(b => b.text)) {
        const block = { ...original };
        if (block.adaptive && width([block], config, padding, caps) > columns) { adapt([block], bodyWidth(), () => layout.displayWidth(block.text)); if (width([block], config, padding, caps) > columns) continue; }
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
