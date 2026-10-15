/** Reconstruct captured terminal cells. This is never described as an OS screenshot. */
import * as fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import { cellColors, type Cell } from '../migration/ts-04/capture.js';
export interface TerminalCapture {
    columns: number;
    rows: number;
    cells: Cell[][];
    terminal_foreground?: string;
    terminal_background?: string;
    terminal_palette?: Record<string, string>;
}
const escape = (value: string) => value.replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const sha = (raw: Buffer | string) => createHash('sha256').update(raw).digest('hex');
export function renderCapture(capture: TerminalCapture, bounds: readonly number[], fonts: string[] = []) {
    const [left, top, columns, rows] = bounds;
    if (bounds.length !== 4 || !bounds.every(Number.isInteger) || left! < 0 || top! < 0 || columns! < 1 || rows! < 1 || columns! > 1000 || rows! > 1000 || left! + columns! > capture.columns || top! + rows! > capture.rows)
        throw new Error('Crop must fit captured terminal');
    if (capture.cells.length !== capture.rows || capture.cells.some(row => row.length !== capture.columns))
        throw new Error('Invalid cell matrix');
    const foreground = capture.terminal_foreground ?? '#dedee7', background = capture.terminal_background ?? '#17191e';
    if (!/^#[0-9a-f]{6}$/iu.test(foreground) || !/^#[0-9a-f]{6}$/iu.test(background))
        throw new Error('Invalid terminal background/foreground');
    const width = columns! * 12 + 24, height = rows! * 24 + 24, rectangles: string[] = [], texts: string[] = [];
    for (let y = 0; y < rows!; y++)
        for (let x = 0; x < columns!; x++) {
            const cell = capture.cells[top! + y]![left! + x]!;
            if (typeof cell.data !== 'string' || typeof cell.fg !== 'string' || typeof cell.bg !== 'string' || typeof cell.reverse !== 'boolean' || typeof cell.bold !== 'boolean')
                throw new Error('Invalid captured cell');
            const [fg, bg] = cellColors(cell, foreground, background, capture.terminal_palette);
            rectangles.push(`<rect x="${12 + x * 12}" y="${12 + y * 24}" width="12" height="24" fill="${bg}"/>`);
            if (cell.data)
                texts.push(`<text x="${12 + x * 12}" y="${31 + y * 24}" fill="${fg}" font-weight="${cell.bold ? 'bold' : 'normal'}">${escape(cell.data.replace(/[\p{Cc}\p{Cs}]/gu, ''))}</text>`);
        }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${background}"/><g font-family="DejaVu Sans Mono,Noto Sans CJK SC,Noto Sans Symbols 2,monospace" font-size="20">${rectangles.join('')}${texts.join('')}</g></svg>`;
    const renderer = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: fonts } }), image = renderer.render();
    return { svg, png: image.asPng(), width: image.width, height: image.height, pixels: image.pixels };
}
export function writeCapture(input: string, output: string, commit: string, bounds: number[], fonts: string[]) {
    if (!/^[a-f0-9]{40}$/u.test(commit) || !fonts.length)
        throw new Error('Require exact --commit and at least one --font');
    const raw = fs.readFileSync(input), fontHashes = Object.fromEntries(fonts.map(path => [resolve(path), sha(fs.readFileSync(path))]));
    const rendered = renderCapture(JSON.parse(raw.toString('utf8')), bounds, fonts);
    fs.mkdirSync(dirname(output), { recursive: true });
    fs.writeFileSync(output, rendered.png, { flag: 'wx' });
    fs.writeFileSync(output + '.json', JSON.stringify({ kind: 'terminal-cell reconstruction; not an OS screenshot', commit, capture_sha256: sha(raw), png_sha256: sha(rendered.png), font_hashes: fontHashes, bounds, width: rendered.width, height: rendered.height }, null, 2) + '\n', { flag: 'wx' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { commit: { type: 'string' }, bounds: { type: 'string' }, font: { type: 'string', multiple: true } } });
    if (positionals.length !== 2 || !values.commit || !values.bounds)
        throw new Error('Usage: render-capture INPUT OUTPUT --commit SHA --bounds X,Y,WIDTH,HEIGHT --font PATH');
    writeCapture(positionals[0]!, positionals[1]!, values.commit, values.bounds.split(',').map(Number), values.font ?? []);
}
