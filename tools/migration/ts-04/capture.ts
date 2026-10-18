/** Streaming acceptance oracle. It interprets terminal bytes independently of TUI drawing. */
import { StringDecoder } from 'node:string_decoder';
import { graphemes, clusterWidth } from '@fbincon/statusline-core/unicode/index';
import { advance, DEFAULT, type Style, type Color } from '@fbincon/statusline-core/rendering/styles';
import { dimensions } from '@fbincon/statusline-tui/layout';
export interface Cell {
    data: string;
    fg: string;
    bg: string;
    bold: boolean;
    reverse: boolean;
}
const names = ['black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'white', 'brightblack', 'brightred', 'brightgreen', 'brightyellow', 'brightblue', 'brightmagenta', 'brightcyan', 'brightwhite'];
export const XTERM_PALETTE: Record<string, string> = Object.fromEntries(names.map((name, i) => [name, ['000000', '800000', '008000', '808000', '000080', '800080', '008080', 'c0c0c0', '808080', 'ff0000', '00ff00', 'ffff00', '0000ff', 'ff00ff', '00ffff', 'ffffff'][i]!]));
export const TERMINAL_THEMES = { dark: ['#dedee7', '#17191e'], light: ['#17191e', '#ffffff'] } as const;
const COLORS: Record<string, string> = Object.fromEntries(names.map((name, i) => [name, ['202127', 'f08080', '85c99a', 'e5c07b', '87aade', 'cba2e5', '85d1db', 'dedee7', '858895', 'fca5a5', 'a6e3a1', 'f9e2af', '89b4fa', 'cba6f7', '94e2d5', 'ffffff'][i]!]));
function color(value: Color | null): string {
    if (!value)
        return 'default';
    if (value[0] === 'rgb')
        return value[1].slice(1);
    const index = value[1];
    if (index < 16)
        return names[index]!;
    const levels = [0, 95, 135, 175, 215, 255], n = index - 16;
    const rgb = index >= 232 ? [0, 0, 0].map(() => 8 + 10 * (index - 232)) : [levels[Math.floor(n / 36)]!, levels[Math.floor(n / 6) % 6]!, levels[n % 6]!];
    return rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}
export class Capture {
    private decoder = new StringDecoder('utf8');
    private pending = '';
    private style: Style = DEFAULT;
    private reverse = false;
    private last: {
        x: number;
        y: number;
    } | null = null;
    cursor = { x: 0, y: 0 };
    private savedCursor = { x: 0, y: 0 };
    buffer: Cell[][];
    lastAlternate: Cell[][] | null = null;
    constructor(readonly columns: number, readonly rows: number) { this.buffer = this.blank(); }
    private cell(data = ' '): Cell { return { data, fg: color(this.style.foreground), bg: color(this.style.background), bold: this.style.bold, reverse: this.reverse }; }
    private blank(): Cell[][] { return Array.from({ length: this.rows }, () => Array.from({ length: this.columns }, () => this.cell())); }
    feed(chunk: string | Uint8Array): void {
        this.pending += typeof chunk === 'string' ? chunk : this.decoder.write(Buffer.from(chunk));
        while (this.pending) {
            if (this.pending[0] === '\x1b') {
                if (this.pending.length === 1) break;
                // Host title/hyperlink queries and control strings carry no cells.
                // Preserve framing across chunks and never render their payload.
                if (']P_^'.includes(this.pending[1]!)) {
                    const end = /\x07|\x1b\\/u.exec(this.pending.slice(2));
                    if (!end) { if (this.pending.length > 8192) throw new Error('Unbounded terminal control string'); break; }
                    if (end.index > 8192) throw new Error('Unbounded terminal control string');
                    this.pending = this.pending.slice(2 + end.index + end[0].length); continue;
                }
                if (this.pending[1] !== '[') {
                    const op = this.pending[1]!;
                    if ('()'.includes(op)) { if (this.pending.length < 3) break; this.pending = this.pending.slice(3); continue; }
                    if (op === '7') this.savedCursor = { ...this.cursor };
                    else if (op === '8') this.cursor = { ...this.savedCursor };
                    else if (op === 'c') { this.style = DEFAULT; this.reverse = false; this.buffer = this.blank(); this.cursor = { x: 0, y: 0 }; }
                    else if (op === 'D' || op === 'E') { this.cursor.y++; if (op === 'E') this.cursor.x = 0; this.scroll(); }
                    else if (op === 'M') { if (this.cursor.y) this.cursor.y--; else { this.buffer.unshift(Array.from({ length: this.columns }, () => this.cell())); this.buffer.pop(); } }
                    else if (!'=>\\'.includes(op)) throw new Error('Unsupported terminal escape: ' + JSON.stringify(op));
                    this.last = null; this.pending = this.pending.slice(2); continue;
                }
                const match = this.pending.match(/^\x1b\[([\x30-\x3f]*)([\x20-\x2f]*)([\x40-\x7e])/u);
                if (!match) {
                    if (this.pending.length > 256)
                        throw new Error('Unbounded terminal escape sequence');
                    break;
                }
                this.pending = this.pending.slice(match[0].length);
                if (!match[2] && !/^[><=]/u.test(match[1]!)) this.control(match[1]!, match[3]!);
                continue;
            }
            const character = [...this.pending][0]!;
            this.pending = this.pending.slice(character.length);
            if (character === '\r') {
                this.cursor.x = 0;
                this.last = null;
            }
            else if (character === '\n') {
                this.cursor.y++;
                this.last = null;
                this.scroll();
            }
            else if (character === '\b') {
                this.cursor.x = Math.max(0, this.cursor.x - 1);
                this.last = null;
            }
            else if (character === '\t') { this.cursor.x = Math.min(this.columns - 1, this.cursor.x + 8 - this.cursor.x % 8); this.last = null; }
            else if (!/[\p{Cc}\p{Cs}]/u.test(character))
                this.write(character);
        }
    }
    private scroll(): void { if (this.cursor.y >= this.rows) {
        this.buffer.shift();
        this.buffer.push(Array.from({ length: this.columns }, () => this.cell()));
        this.cursor.y = this.rows - 1;
    } }
    private write(character: string): void {
        if (this.last) {
            const previous = this.buffer[this.last.y]![this.last.x]!;
            if (graphemes(previous.data + character).length === 1) {
                const old = clusterWidth(previous.data);
                previous.data += character;
                const width = clusterWidth(previous.data);
                for (let i = 1; i < width && this.last.x + i < this.columns; i++)
                    this.buffer[this.last.y]![this.last.x + i] = { ...previous, data: '' };
                this.cursor.x += width - old;
                return;
            }
        }
        const width = clusterWidth(character);
        if (this.cursor.x >= this.columns || this.cursor.x + width > this.columns) {
            this.cursor.x = 0;
            this.cursor.y++;
            this.scroll();
        }
        const { x, y } = this.cursor, value = this.cell(character);
        this.buffer[y]![x] = value;
        this.last = { x, y };
        for (let i = 1; i < width; i++)
            this.buffer[y]![x + i] = { ...value, data: '' };
        this.cursor.x += width;
    }
    private control(raw: string, op: string): void {
        const values = raw.replace(/^\?/u, '').split(/[;:]/u).map(value => Number(value || 0));
        if (op === 'm') {
            this.style = advance(this.style, `\x1b[${raw}m`);
            for (let i = 0; i < values.length; i++) {
                const n = values[i];
                if (n === 0 || n === 27)
                    this.reverse = false;
                else if (n === 7)
                    this.reverse = true;
                else if (n === 38 || n === 48)
                    i += values[i + 1] === 5 ? 2 : values[i + 1] === 2 ? 4 : 0;
            }
            return;
        }
        this.last = null;
        if (raw === '?1049' && op === 'l') {
            this.lastAlternate = structuredClone(this.buffer);
            this.style = DEFAULT;
            this.reverse = false;
            this.buffer = this.blank();
            this.cursor = { x: 0, y: 0 };
        }
        else if (raw === '?1049' && op === 'h') {
            this.buffer = this.blank();
            this.cursor = { x: 0, y: 0 };
        }
        else if (op === 'H' || op === 'f')
            this.cursor = { x: Math.max(0, Math.min(this.columns - 1, (values[1] || 1) - 1)), y: Math.max(0, Math.min(this.rows - 1, (values[0] || 1) - 1)) };
        else if (op === 'J' && values[0] === 2)
            this.buffer = this.blank();
        else if (op === 'K') {
            const start = values[0] === 1 || values[0] === 2 ? 0 : this.cursor.x, end = values[0] === 1 ? this.cursor.x + 1 : this.columns;
            for (let x = start; x < end; x++)
                this.buffer[this.cursor.y]![x] = this.cell();
        }
        else if (op === 'A')
            this.cursor.y = Math.max(0, this.cursor.y - (values[0] || 1));
        else if (op === 'B')
            this.cursor.y = Math.min(this.rows - 1, this.cursor.y + (values[0] || 1));
        else if (op === 'C')
            this.cursor.x = Math.min(this.columns - 1, this.cursor.x + (values[0] || 1));
        else if (op === 'D')
            this.cursor.x = Math.max(0, this.cursor.x - (values[0] || 1));
    }
}
export function cellColors(cell: Pick<Cell, 'fg' | 'bg' | 'reverse'>, foreground = '#dedee7', background = '#17191e', palette = COLORS): [
    string,
    string
] {
    const resolve = (value: string, fallback: string) => { value = (palette[value] ?? value).replace(/^#/u, ''); return /^[0-9a-f]{6}$/iu.test(value) ? '#' + value : fallback; };
    const fg = resolve(cell.fg, foreground), bg = resolve(cell.bg, background);
    return cell.reverse ? [bg, fg] : [fg, bg];
}
export function contrast(foreground: string, background: string): number {
    const light = (value: string) => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((total, c, i) => total + c * [0.2126, 0.7152, 0.0722][i]!, 0);
    const a = light(foreground), b = light(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function verifyColors(cells: Cell[][], columns: number, rows: number, foreground: string, background: string): number {
    const preview = dimensions(columns, rows).preview;
    let samples = 0;
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < columns; x++) {
            const cell = cells[y]![x]!;
            if (y >= preview.innerY && y < preview.innerY + preview.innerHeight && x >= preview.innerX && x < preview.innerX + preview.innerWidth) {
                if (cell.bg !== 'default')
                    throw new Error('Artificial preview background');
                if (cell.data.trim())
                    samples++;
            }
            else if (cell.data.trim()) {
                const accent = cell.fg === 'cyan' && cell.bold;
                if ((!accent && cell.fg !== 'default') || cell.bg !== 'default')
                    throw new Error('Fixed chrome color');
                if (contrast(...cellColors(cell, foreground, background, XTERM_PALETTE)) < (accent ? 3 : 4.5))
                    throw new Error('Unreadable chrome');
            }
        }
    return samples;
}
