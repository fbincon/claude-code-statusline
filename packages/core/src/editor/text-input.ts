import { graphemes, displayWidth } from '../unicode/index.js';

/** Offsets always lie on extended-grapheme boundaries; values retain their original bytes. */
export interface TextInput { value: string; cursor: number; scroll: number }
export interface TextKey { key: string; ctrl?: boolean; meta?: boolean; paste?: boolean; text?: boolean; overflow?: boolean }
export type TextAction = { kind: 'insert'; value: string } | { kind: 'left' | 'right' | 'home' | 'end' | 'backspace' | 'delete' | 'clear' };
export function textInput(value: string): TextInput { return { value, cursor: value.length, scroll: 0 }; }
function boundaries(value: string): number[] {
  let position = 0;
  return [0, ...graphemes(value).map(cluster => position += cluster.length)];
}
export function textAction(event: TextKey): TextAction | null {
  if (event.paste || event.text) return { kind: 'insert', value: event.key };
  if (event.meta) return null;
  if (event.ctrl) return event.key.toLowerCase() === 'u' ? { kind: 'clear' } : null;
  if (['left', 'right', 'home', 'end', 'backspace', 'delete'].includes(event.key))
    return { kind: event.key as 'left' };
  return [...event.key].length === 1 ? { kind: 'insert', value: event.key } : null;
}
export function editText(state: TextInput, action: TextAction, limit: number): { state: TextInput; error?: 'invalid' | 'limit' } {
  const points = boundaries(state.value), index = Math.max(0, points.indexOf(state.cursor));
  let value = state.value, cursor = points[index]!;
  switch (action.kind) {
    case 'home': cursor = 0; break;
    case 'end': cursor = value.length; break;
    case 'left': cursor = points[Math.max(0, index - 1)]!; break;
    case 'right': cursor = points[Math.min(points.length - 1, index + 1)]!; break;
    case 'clear': value = ''; cursor = 0; break;
    case 'backspace': {
      const before = points[Math.max(0, index - 1)]!;
      value = value.slice(0, before) + value.slice(cursor); cursor = before; break;
    }
    case 'delete': value = value.slice(0, cursor) + value.slice(points[Math.min(points.length - 1, index + 1)]!); break;
    case 'insert':
      if (/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(action.value)) return { state, error: 'invalid' };
      value = value.slice(0, cursor) + action.value + value.slice(cursor);
      if ([...value].length > limit) return { state, error: 'limit' };
      cursor += action.value.length;
      break;
  }
  // Insertion/deletion can join adjacent clusters (combining marks, flags or ZWJ).
  cursor = boundaries(value).find(point => point >= cursor) ?? value.length;
  return { state: { value, cursor, scroll: Math.min(state.scroll, cursor) } };
}
export function inputKey(value: string, previous: TextInput | undefined, event: TextKey, limit: number) {
  const state = previous?.value === value ? previous : textInput(value), action = textAction(event);
  return action ? editText(state, action, limit) : { state };
}
/** A visible caret takes one cell; resize only adjusts the viewport, never the value. */
export function inputView(state: TextInput, width: number): string {
  width = Math.max(1, Math.trunc(width));
  const points = boundaries(state.value);
  let start = points.includes(state.scroll) ? Math.min(state.scroll, state.cursor) : 0;
  while (start < state.cursor && displayWidth(state.value.slice(start, state.cursor)) + 1 > width)
    start = points[points.indexOf(start) + 1]!;
  state.scroll = start;
  let output = '', used = 0;
  for (let index = points.indexOf(start); index < points.length; index++) {
    const point = points[index]!;
    if (point === state.cursor) { output += '▏'; used++; }
    if (index === points.length - 1) break;
    const cluster = state.value.slice(point, points[index + 1]), cells = displayWidth(cluster);
    if (used + cells > width) break;
    output += cluster; used += cells;
  }
  return output;
}
