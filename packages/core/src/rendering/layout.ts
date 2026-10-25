import { graphemes, displayWidth as plainWidth, clusterWidth, cellWidth } from '../unicode/index.js';
import * as styles from './styles.js';
import { OSC8_RE, CLOSE_LINK, safeLink, linkSequence } from '../terminal/links.js';
export const MIN_CONTENT_WIDTH = 2, DEFAULT_TERMINAL_COLUMNS = 120, STATUSLINE_WIDTH_MARGIN = 2;
export const ANSI_SGR_RE = styles.SGR_RE;
export interface LayoutSegment {
    text: string;
    prefer_slash_breaks?: boolean;
    paint?: (text: string, start: number) => string;
}
export interface StyledUnit {
    link?: string;
    text: string;
    width: number;
    style: string;
}
export function strip(text: string): string { return text.replace(ANSI_SGR_RE, '').replace(OSC8_RE, ''); }
export function withoutColors(text: string): string { return renderStyledUnits(styledUnits(text).map(unit => ({ ...unit, style: '' }))); }
export function withLink(text: string, target: string | null, mode: 'off' | 'auto' | 'on' | undefined, supported = false): string {
    const link = safeLink(target);
    if (!link || !mode || mode === 'off' || mode === 'auto' && !supported) return text;
    return renderStyledUnits(styledUnits(text).map(unit => ({ ...unit, link })));
}
export function displayWidth(text: string | null | undefined): number { return plainWidth(strip(text ?? '')); }
export function styledUnits(text: string): StyledUnit[] {
    let state = styles.DEFAULT, position = 0, link: string | undefined;
    const plain: string[] = [], states: string[] = [], links: (string | undefined)[] = [];
    const append = (part: string) => { const sgr = styles.serialize(state); for (const char of part) {
        plain.push(char);
        states.push(sgr);
        links.push(link);
    } };
    for (const match of text.matchAll(new RegExp(ANSI_SGR_RE.source + '|' + OSC8_RE.source, 'gu'))) {
        append(text.slice(position, match.index));
        if (match[0].startsWith('\x1b]8;')) link = safeLink(match[1]) ?? undefined;
        else state = styles.advance(state, match[0]);
        position = match.index + match[0].length;
    }
    append(text.slice(position));
    const visible = plain.join('');
    if (/^[\x20-\x7e]*$/u.test(visible))
        return plain.map((text, i) => ({ text, width: 1, style: states[i]!, ...(links[i] ? { link: links[i] } : {}) }));
    const result: StyledUnit[] = [];
    position = 0;
    for (const cluster of graphemes(visible)) {
        const chars = [...cluster], base = Math.max(0, chars.findIndex(c => cellWidth(c) !== 0));
        result.push({ text: cluster, width: clusterWidth(cluster), style: states[position + base]!, ...(links[position + base] ? { link: links[position + base] } : {}) });
        position += chars.length;
    }
    return result;
}
export function renderStyledUnits(units: readonly StyledUnit[]): string {
    const output: string[] = [];
    let active = '', activeLink: string | undefined;
    for (const unit of units) {
        if (unit.link !== activeLink) {
            if (activeLink) output.push(CLOSE_LINK);
            activeLink = safeLink(unit.link) ?? undefined;
            if (activeLink) output.push(linkSequence(activeLink));
        }
        if (unit.style !== active) {
            if (active)
                output.push(styles.RESET);
            if (unit.style)
                output.push(unit.style);
            active = unit.style;
        }
        output.push(unit.text);
    }
    if (activeLink) output.push(CLOSE_LINK);
    if (active)
        output.push(styles.RESET);
    return output.join('');
}
export function truncateStyled(text: string, width: number, ellipsis = '…'): string {
    width = Math.max(0, Math.trunc(width));
    if (!width)
        return '';
    const source = styledUnits(text);
    if (source.reduce((n, u) => n + u.width, 0) <= width)
        return renderStyledUnits(source);
    let suffix = displayWidth(ellipsis);
    if (suffix > width) {
        ellipsis = '';
        suffix = 0;
    }
    const units: StyledUnit[] = [];
    let used = 0;
    for (const unit of source) {
        if (used + unit.width > width - suffix)
            break;
        units.push(unit);
        used += unit.width;
    }
    if (ellipsis)
        units.push({ text: ellipsis, width: suffix, style: units.at(-1)?.style ?? '', ...(units.at(-1)?.link ? { link: units.at(-1)!.link } : {}) });
    return renderStyledUnits(units);
}
export function splitAnsiText(text: string, width: number, preferSlashes = false): string[] {
    width = Math.max(MIN_CONTENT_WIDTH, Math.trunc(width));
    let units = styledUnits(text);
    if (units.reduce((n, u) => n + u.width, 0) <= width)
        return [renderStyledUnits(units)];
    if (!units.length)
        return [text];
    units = units.map(u => u.width <= width ? u : { ...u, text: '…', width: 1 });
    const chunks: string[] = [];
    let start = 0;
    while (start < units.length) {
        let used = 0, end = start;
        while (end < units.length) {
            const next = units[end]!.width;
            if (end > start && used + next > width)
                break;
            if (end === start && next > width) {
                end++;
                break;
            }
            used += next;
            end++;
        }
        if (end >= units.length) {
            chunks.push(renderStyledUnits(units.slice(start)));
            break;
        }
        if (preferSlashes) {
            let slash: number | null = null;
            for (let i = start + 1; i < end; i++)
                if (/^[/\\]/u.test(units[i]!.text))
                    slash = i;
            if (slash !== null)
                end = slash;
        }
        if (end <= start)
            end = start + 1;
        chunks.push(renderStyledUnits(units.slice(start, end)));
        start = end;
    }
    return chunks;
}
export function ensureReset(text: string, reset = styles.RESET): string {
    if (!reset)
        return text;
    const plain = strip(text);
    if (!/^[\x20-\x7e]*$/u.test(plain)) {
        const boundaries = new Set([0]);
        let offset = 0;
        for (const cluster of graphemes(plain)) {
            offset += cluster.length;
            boundaries.add(offset);
        }
        let removed = 0;
        for (const match of text.matchAll(ANSI_SGR_RE)) {
            if (!boundaries.has(match.index - removed)) {
                text = renderStyledUnits(styledUnits(text));
                break;
            }
            removed += match[0].length;
        }
    }
    return text.endsWith(reset) ? text : text + reset;
}
export function layoutSegments(segments: readonly (LayoutSegment | string)[], width: number, separator = '\x1b[90m | \x1b[0m', reset = styles.RESET): string[] {
    width = Math.max(MIN_CONTENT_WIDTH, Math.trunc(width));
    const separatorWidth = displayWidth(separator), rows: string[] = [];
    let current = '', currentWidth = 0;
    for (const value of segments) {
        const segment = typeof value === 'string' ? { text: value } : value;
        if (!segment.text)
            continue;
        const size = displayWidth(segment.text);
        if (size <= width) {
            const text = segment.paint?.(segment.text, 0) ?? segment.text;
            if (current && currentWidth + separatorWidth + size <= width) {
                current += separator + text;
                currentWidth += separatorWidth + size;
            }
            else {
                if (current)
                    rows.push(ensureReset(current, reset));
                current = text;
                currentWidth = size;
            }
            continue;
        }
        if (current) {
            rows.push(ensureReset(current, reset));
            current = '';
            currentWidth = 0;
        }
        let offset = 0;
        const chunks = splitAnsiText(segment.text, width, segment.prefer_slash_breaks).map(chunk => {
            const painted = segment.paint?.(chunk, offset) ?? chunk;
            offset += styledUnits(chunk).length; return painted;
        });
        rows.push(...chunks.slice(0, -1).map(chunk => ensureReset(chunk, reset)));
        current = chunks.at(-1)!;
        currentWidth = displayWidth(current);
    }
    if (current)
        rows.push(ensureReset(current, reset));
    return rows;
}
