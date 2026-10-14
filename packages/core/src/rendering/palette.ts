import type { DisplayDraft } from '../contracts/ui.js';
import { themedPalette } from './appearance.js';
export const RESET = '\x1b[0m', SEPARATOR = '\x1b[90m | \x1b[0m', JOIN = '\x1b[90m · \x1b[0m';
export interface Palette extends Record<string, string> {
    reset: string;
    model: string;
    directory: string;
    branch: string;
    git_error: string;
    percentage: string;
    size: string;
    tokens: string;
    timer: string;
    separator: string;
}
export const DEFAULT: Palette = { reset: RESET, model: '\x1b[1;38;2;246;226;183m', directory: '\x1b[1;38;2;171;223;167m', branch: '\x1b[1;38;2;200;169;238m', git_error: '\x1b[1;38;2;242;134;134m', percentage: '\x1b[1;38;2;242;181;144m', size: '\x1b[1;38;2;242;181;144m', tokens: '\x1b[1;38;2;233;144;169m', timer: '\x1b[1;38;2;142;211;211m', separator: '\x1b[90m' };
export const ANSI: Palette = { reset: RESET, model: '\x1b[1;33m', directory: '\x1b[1;32m', branch: '\x1b[1;35m', git_error: '\x1b[1;31m', percentage: '\x1b[1;33m', size: '\x1b[1;33m', tokens: '\x1b[1;35m', timer: '\x1b[1;36m', separator: '\x1b[90m' };
export const NO_COLOR = Object.fromEntries(Object.keys(DEFAULT).map(key => [key, ''])) as Palette;
export function paletteFor(config: DisplayDraft): Palette { return !config.use_colors ? NO_COLOR : themedPalette(config.palette === 'ansi' ? ANSI : DEFAULT, config); }
export function styledSeparator(symbol: string, palette: Palette): string { return palette.reset ? `${palette.separator} ${symbol} ${palette.reset}` : ` ${symbol} `; }
export function separators(config: DisplayDraft, palette: Palette): readonly [
    string,
    string
] { return [styledSeparator(config.separator_style === 'compact' ? '·' : '|', palette), styledSeparator('·', palette)]; }
