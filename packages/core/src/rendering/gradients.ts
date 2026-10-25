import type { DisplayDraft, GradientDraft } from '../contracts/ui.js';
import { styledUnits, renderStyledUnits, type StyledUnit } from './layout.js';
import { parse, serialize, sameColor, type Color } from './styles.js';
import { outputColor } from './appearance.js';

export type Paint = (text: string) => string;
export function interpolate(colors: GradientDraft, position: number): Color {
  const offset = Math.max(0, Math.min(1, position)) * (colors.length - 1), index = Math.min(colors.length - 2, Math.floor(offset));
  const a = colors[index]!, b = colors[index + 1]!, fraction = offset - index;
  return ['rgb', '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16) * (1-fraction) + parseInt(b.slice(i,i+2),16) * fraction).toString(16).padStart(2,'0')).join('')];
}
/** One color per grapheme, positioned by terminal cells; first/last visible graphemes reach the endpoints. */
export function paintGradient(text: string, colors: GradientDraft | null | undefined, channel: 'foreground' | 'background', config: DisplayDraft): string {
  if (!colors || !config.use_colors || channel === 'background' && config.separator_style !== 'powerline') return text;
  const units = styledUnits(text), total = units.reduce((sum, unit) => sum + unit.width, 0);
  const first = (units[0]?.width ?? 0) / 2, last = total - (units.at(-1)?.width ?? 0) / 2;
  let offset = 0;
  return renderStyledUnits(units.map(unit => {
    const center = offset + unit.width / 2; offset += unit.width;
    const state = parse(unit.style), color = outputColor(interpolate(colors, last > first ? (center-first)/(last-first) : 0), config);
    let background = channel === 'background' ? color : state.background;
    if (channel === 'background' && sameColor(background, state.foreground) && background !== null) {
      const foreground = state.foreground!;
      background = foreground[0] === 'ansi' ? ['ansi', foreground[1] === 0 ? 15 : 0]
        : ['rgb', [1,3,5].reduce((sum,index,i) => sum + parseInt(foreground[1].slice(index,index+2),16) * [0.2126,0.7152,0.0722][i]!,0) > 127 ? '#000000' : '#ffffff'];
    }
    return { ...unit, style: serialize({ ...state, foreground: channel === 'foreground' ? color : state.foreground, background }) };
  }));
}
export function foregroundPaint(colors: GradientDraft | null | undefined, config: DisplayDraft, risk: Color | null = null): Paint | undefined {
  return colors && config.use_colors && risk === null ? text => paintGradient(text, colors, 'foreground', config) : undefined;
}
export interface PaintedPart { text: string; paint?: Paint }
/** Preserve component boundaries when legacy semantic segments wrap across physical rows. */
export function segmentPaint(parts: readonly PaintedPart[]): ((text: string, start: number) => string) | undefined {
  if (!parts.some(part => part.paint)) return undefined;
  let position = 0;
  const ranges = parts.map(part => { const start = position; position += styledUnits(part.text).length; return { start, end: position, paint: part.paint }; });
  return (text, start) => {
    const units = styledUnits(text), output: StyledUnit[] = [];
    for (const range of ranges) {
      const from = Math.max(0, range.start-start), to = Math.min(units.length, range.end-start);
      if (to <= from) continue;
      const chunk = units.slice(from,to);
      output.push(...(range.paint ? styledUnits(range.paint(renderStyledUnits(chunk))) : chunk));
    }
    return renderStyledUnits(output);
  };
}
