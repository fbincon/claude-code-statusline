/** Bounded terminal cells and ANSI serialization, independent of editor state. */
import { clip, clusterWidth, displayWidth } from '@fbincon/statusline-core/unicode/index';
import { clipSpans, clusterSpans } from '@fbincon/statusline-core/terminal/spans';
import { terminalColor } from '@fbincon/statusline-core/rendering/colors';
import type { Span } from '@fbincon/statusline-core/contracts/ui';
import { paint, heading, type Paint } from '../theme.js';
import type { Panel } from '../layout.js';

export interface Frame {
    columns: number;
    rows: Paint[][];
}

export const safe = (text: string): string => text.replace(/[\p{Cc}\p{Cs}]/gu, ' ');

export function column(text: string, width: number): string {
    const visible = clip(safe(text), width);
    return visible + ' '.repeat(Math.max(0, width - displayWidth(visible)));
}

export class Canvas {
    readonly columns: number;
    readonly rows: number;
    private readonly cells: (Paint | null)[][];

    constructor(columns: number, rows: number) {
        this.columns = Math.max(1, Math.min(500, Math.trunc(columns)));
        this.rows = Math.max(1, Math.min(200, Math.trunc(rows)));
        this.cells = Array.from({ length: this.rows }, () =>
            Array.from({ length: this.columns }, () => paint(' ')));
    }

    put(y: number, x: number, spans: readonly Paint[], width = this.columns - x): void {
        if (y < 0 || y >= this.rows || x < 0 || x >= this.columns) {
            return;
        }
        const visible = clipSpans(spans, Math.min(width, this.columns - x));
        for (const span of clusterSpans(visible)) {
            const size = clusterWidth(span.text);
            if (!size) {
                continue;
            }
            this.cells[y]![x] = span;
            for (let offset = 1; offset < size; offset++) {
                this.cells[y]![x + offset] = null;
            }
            x += size;
        }
    }

    line(y: number, text: string, bold = false, reverse = false, x = 0, width = this.columns - x): void {
        this.put(y, x, [paint(text, bold, reverse)], width);
    }

    panel(panel: Panel, title: string): void {
        const { y, width, height, framed } = panel;
        this.line(y, framed ? '┌' + '─'.repeat(width - 2) + '┐' : '─'.repeat(width));
        const caption = column(title, width - (framed ? 6 : 4)).trimEnd();
        this.put(y, framed ? 2 : 1, [heading(' ' + caption + ' ')], width - (framed ? 4 : 2));
        if (!framed) {
            return;
        }
        for (let row = y + 1; row < y + height - 1; row++) {
            this.line(row, '│');
            this.line(row, '│', false, false, width - 1);
        }
        this.line(y + height - 1, '└' + '─'.repeat(width - 2) + '┘');
    }

    content(panel: Panel, offset: number, spans: readonly Paint[], selected = false): void {
        const y = panel.innerY + offset;
        if (selected) {
            this.line(y, ' '.repeat(panel.innerWidth), false, true, panel.innerX, panel.innerWidth);
        }
        this.put(y, panel.innerX, spans, panel.innerWidth);
    }

    frame(): Frame {
        return {
            columns: this.columns,
            rows: this.cells.map(row => {
                const spans: Paint[] = [];
                for (const cell of row) {
                    if (!cell) {
                        continue;
                    }
                    const last = spans.at(-1);
                    if (last && last.bold === cell.bold && last.reverse === cell.reverse &&
                        last.foreground === cell.foreground && last.background === cell.background) {
                        last.text += cell.text;
                    } else {
                        spans.push({ ...cell });
                    }
                }
                return spans;
            }),
        };
    }
}

export function ansiFrame(value: Frame, colors = 256): string {
    const color = (value: Span['foreground'], background: boolean): string => {
        if (!value || colors < 8) {
            return '';
        }
        const source = value.kind === 'rgb' && typeof value.value === 'string'
            ? ['rgb', value.value] as const
            : value.kind === 'ansi' && typeof value.value === 'number'
                ? ['ansi', value.value] as const
                : null;
        const index = terminalColor(source, colors);
        if (index === null) {
            return '';
        }
        if (colors >= 256) {
            return `\x1b[${background ? 48 : 38};5;${index}m`;
        }
        return `\x1b[${(background ? 40 : 30) + index % 8 + (index >= 8 ? 60 : 0)}m`;
    };
    let output = '\x1b[H';
    for (const [y, row] of value.rows.entries()) {
        output += `\x1b[${y + 1};1H\x1b[0m\x1b[2K`;
        for (const span of row) {
            const foreground = span.foreground;
            const bright = colors === 8 && foreground?.kind === 'ansi' &&
                typeof foreground.value === 'number' && foreground.value >= 8 && foreground.value < 16;
            output += '\x1b[0m' + (span.bold || bright ? '\x1b[1m' : '') +
                (span.reverse ? '\x1b[7m' : '') + color(foreground, false) +
                color(span.background, true) + safe(span.text);
        }
    }
    return output + '\x1b[0m';
}
