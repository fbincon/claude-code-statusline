import { memo, type Color } from './styles.js';
const BASE = [[0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0], [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192], [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]];
const LEVELS = [0, 95, 135, 175, 215, 255];
const RGB = [...BASE, ...LEVELS.flatMap(r => LEVELS.flatMap(g => LEVELS.map(b => [r, g, b]))), ...Array.from({ length: 24 }, (_, i) => Array(3).fill(8 + 10 * i) as number[])];
const nearest = memo<string, number | null>(2048, key => {
    const [red, green, blue, colors] = JSON.parse(key) as [
        number,
        number,
        number,
        number
    ];
    if (colors < 8)
        return null;
    const limit = colors >= 256 ? 256 : colors >= 16 ? 16 : 8;
    let best = 0, distance = Infinity;
    for (let i = 0; i < limit; i++) {
        const [r, g, b] = RGB[i]!, d = (r! - red) ** 2 + (g! - green) ** 2 + (b! - blue) ** 2;
        if (d < distance) {
            best = i;
            distance = d;
        }
    }
    return best;
});
export function nearestTerminalColor(red: number, green: number, blue: number, colors: number): number | null { return nearest(JSON.stringify([red, green, blue, colors])); }
export function terminalColor(color: Color | null, colors: number): number | null {
    if (color === null || colors < 8)
        return null;
    let rgb: number[];
    if (color[0] === 'ansi') {
        if (color[1] < Math.min(colors, 256))
            return color[1];
        if (color[1] < 16 && colors === 8)
            return color[1] % 8;
        rgb = RGB[color[1]]!;
    }
    else
        rgb = [1, 3, 5].map(i => parseInt(color[1].slice(i, i + 2), 16));
    return nearestTerminalColor(rgb[0]!, rgb[1]!, rgb[2]!, colors);
}

/** Standard terminal RGB values for the same palette used by quantization. */
export function colorRgb(color: Color): string {
    return color[0] === 'rgb' ? color[1] : '#' + RGB[color[1]]!.map(value => value.toString(16).padStart(2, '0')).join('');
}
