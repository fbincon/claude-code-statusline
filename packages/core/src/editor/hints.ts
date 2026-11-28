import { messageParts, type Language } from '../i18n/messages.js';
import { clip, displayWidth } from '../unicode/index.js';
import { wrapLineEnd, wrapText } from './text.js';

interface KeyRange { start: number; end: number }

export interface EditorLine {
  text: string;
  keys?: readonly KeyRange[];
}

export function sectionDivider(title: string, width: number): string {
  if (width < 4) return '─'.repeat(Math.max(0, width));
  const label = clip(title, width - 4).trimEnd();
  return '─ ' + label + ' ' + '─'.repeat(width - displayWidth(label) - 3);
}

/** Only the explicitly supplied parameters are keys, even when other text repeats them. */
export function hintLine(key: string, language: Language, keys: Record<string, string | EditorLine>, params: Record<string, unknown> = {}): EditorLine {
  const values = Object.fromEntries(Object.entries(keys).map(([name, value]) => [name, typeof value === 'string' ? value : value.text]));
  let text = '';
  const ranges: KeyRange[] = [];
  for (const part of messageParts(key, language, { ...params, ...values })) {
    if (part.text && part.parameter && Object.hasOwn(keys, part.parameter)) {
      const value = keys[part.parameter]!;
      if (typeof value === 'string') ranges.push({ start: text.length, end: text.length + part.text.length });
      else for (const range of value.keys ?? []) ranges.push({ start: range.start + text.length, end: range.end + text.length });
    }
    text += part.text;
  }
  return { text, keys: ranges };
}

export function prependLine(prefix: string, line: EditorLine): EditorLine {
  return { text: prefix + line.text, ...(line.keys && {
    keys: line.keys.map(({ start, end }) => ({ start: start + prefix.length, end: end + prefix.length })),
  }) };
}

function lineSlice(line: EditorLine, start: number, end: number): EditorLine {
  return { text: line.text.slice(start, end), keys: line.keys?.filter(key => start <= key.start && key.end <= end)
    .map(key => ({ start: key.start - start, end: key.end - start })) };
}

export function wrapEditorLine(line: EditorLine, width: number): EditorLine[] {
  if (!line.keys?.length) return wrapText([line.text], width).map(text => ({ text }));
  const result: EditorLine[] = [];
  let start = 0;
  while (start < line.text.length) {
    let end = start + wrapLineEnd(line.text.slice(start), width);
    const partial = line.keys.find(key => key.start < end && end < key.end);
    if (partial) {
      if (partial.start > start) end = partial.start;
      else if (displayWidth(line.text.slice(start, partial.end)) <= width) end = partial.end;
    }
    const row = lineSlice(line, start, end);
    result.push({ ...row, text: row.text.trimEnd() });
    start = end;
    while (line.text[start] === ' ') start++;
  }
  return result;
}

/** Keep the translated description beside its key when adjacent hints wrap. */
export function wrapEditorHints(line: EditorLine, width: number): EditorLine[] {
  const separator = ' · ';
  const rows: EditorLine[] = [];
  let start = 0;
  for (const part of line.text.split(separator)) {
    const hint = lineSlice(line, start, start + part.length);
    start += part.length + separator.length;
    const previous = rows.at(-1);
    if (previous && displayWidth(previous.text + separator + part) <= width) {
      const joined = prependLine(previous.text + separator, hint);
      rows[rows.length - 1] = { ...joined, keys: [...(previous.keys ?? []), ...(joined.keys ?? [])] };
    } else rows.push(...wrapEditorLine(hint, width));
  }
  return rows;
}

export function clipEditorLine(line: EditorLine, width: number): EditorLine {
  const clipped = clip(line.text, width);
  if (clipped === line.text) return line;
  let end = Math.max(0, clipped.length - 1);
  const partial = line.keys?.find(key => key.start < end && end < key.end);
  if (partial) end = partial.start;
  const prefix = lineSlice(line, 0, end);
  return { ...prefix, text: prefix.text + (width > 0 ? '…' : '') };
}

export function editorLineSpans(line: EditorLine, width: number): { text: string; bold: boolean }[] {
  const { text, keys } = clipEditorLine(line, width);
  const spans: { text: string; bold: boolean }[] = [];
  let start = 0;
  for (const key of keys ?? []) {
    if (key.start > start) spans.push({ text: text.slice(start, key.start), bold: false });
    spans.push({ text: text.slice(key.start, key.end), bold: true });
    start = key.end;
  }
  if (start < text.length) spans.push({ text: text.slice(start), bold: false });
  return spans;
}
