/** Unicode 18.0 cells and extended graphemes; mirrors rendering/text.py. */
import * as data from './generated-unicode.ts';

type Ranges = readonly (readonly [number, number])[];
function contains(code: number, ranges: Ranges): boolean {
  let low = 0, high = ranges.length;
  while (low < high) {
    const middle = (low + high) >>> 1, [start, end] = ranges[middle]!;
    if (code < start) high = middle;
    else if (code > end) low = middle + 1;
    else return true;
  }
  return false;
}
export function cellWidth(character: string): number {
  if (!character) return 0;
  const code = character.codePointAt(0)!;
  if (32 <= code && code < 127) return 1;
  if (code < 32 || (0x7f <= code && code < 0xa0) || (0xd800 <= code && code <= 0xdfff)) return 0;
  if (contains(code, data.ZERO_WIDTH)) return 0;
  return contains(code, data.WIDE_EASTASIAN) ? 2 : 1;
}
function property(code: number): number {
  if (32 <= code && code < 127) return 0;
  if (0xac00 <= code && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? 12 : 13;
  let low = 0, high = data.BREAK_PROPERTIES.length;
  while (low < high) {
    const middle = (low + high) >>> 1, [start, end, value] = data.BREAK_PROPERTIES[middle]!;
    if (code < start) high = middle;
    else if (code > end) low = middle + 1;
    else return value;
  }
  return 0;
}
export function graphemes(text: string): string[] {
  if (/^[\x20-\x7e]*$/.test(text)) return [...text];
  const chars = [...text], codes = chars.map(c => c.codePointAt(0)!);
  if (!chars.length) return [];
  const groups: string[] = [];
  let start = 0, previous = property(codes[0]!), regional = Number(previous === 6);
  for (let index = 1; index < chars.length; index++) {
    const code = codes[index]!, current = property(code);
    let boundary = true;
    if (previous === 1 && current === 2) boundary = false;
    else if ([1, 2, 3].includes(previous) || [1, 2, 3].includes(current)) { /* GB4/5 */ }
    else if ((previous === 9 && [9, 10, 12, 13].includes(current)) ||
      ([10, 12].includes(previous) && [10, 11].includes(current)) ||
      ([11, 13].includes(previous) && current === 11)) boundary = false;
    else if ([4, 5, 8].includes(current) || previous === 7) boundary = false;
    else if (contains(code, data.INCB_CONSONANT)) {
      let cursor = index - 1;
      while (cursor >= start && contains(codes[cursor]!, data.INCB_EXTEND)) cursor--;
      if (cursor >= start && contains(codes[cursor]!, data.INCB_LINKER)) boundary = false;
    }
    if (boundary && previous === 5 && contains(code, data.EXTENDED_PICTOGRAPHIC)) {
      let cursor = index - 2;
      while (cursor >= start && property(codes[cursor]!) === 4) cursor--;
      if (cursor >= start && contains(codes[cursor]!, data.EXTENDED_PICTOGRAPHIC)) boundary = false;
    }
    if (previous === 6 && current === 6) boundary = regional % 2 === 0;
    if (boundary) { groups.push(chars.slice(start, index).join('')); start = index; }
    regional = current === 6 && previous === 6 ? regional + 1 : Number(current === 6);
    previous = current;
  }
  groups.push(chars.slice(start).join(''));
  return groups;
}
export function clusterWidth(cluster: string): number {
  const chars = [...cluster];
  if (chars.length === 1) return cellWidth(chars[0]!);
  let total = 0, pending = 0, lastCode = -1, lastWidth = 0, base = false, virama = false, regional = 0;
  for (let index = 0; index < chars.length; index++) {
    const code = chars[index]!.codePointAt(0)!;
    if (code === 0x200d) {
      if (!virama && index + 1 < chars.length) index++;
      if (!virama) lastWidth = 0;
      continue;
    }
    if (code === 0xfe0f && base) {
      if (contains(lastCode, data.VS16_NARROW_TO_WIDE)) pending = 2;
      base = false; continue;
    }
    if (code === 0xfe0e && base) {
      if (contains(lastCode, data.VS15_WIDE_TO_NARROW) && lastWidth === 2) pending = Math.max(0, pending - 1);
      base = false; continue;
    }
    if (code >= 0x1f1e6 && code <= 0x1f1ff) {
      regional++;
      if (regional % 2 === 0) { lastCode = code; continue; }
    } else if (code >= 0x1f3fb && code <= 0x1f3ff &&
      (contains(lastCode, data.EXTENDED_PICTOGRAPHIC) || (lastCode >= 0x1f1e6 && lastCode <= 0x1f1ff))) continue;
    const width = cellWidth(chars[index]!);
    if (width) {
      if (virama) pending = 2;
      else { total += pending; pending = width; }
      lastCode = code; lastWidth = width; base = true; virama = false;
    } else if (contains(code, data.VIRAMA)) virama = true;
    else if (base && contains(code, data.CATEGORY_MC)) { pending = 2; base = false; virama = false; }
    else virama = false;
  }
  return total + pending;
}
export function displayWidth(text: string): number {
  if (/^[\x20-\x7e]*$/.test(text)) return text.length;
  return graphemes(text).reduce((width, cluster) => width + clusterWidth(cluster), 0);
}
export function clip(text: string, width: number, ellipsis = '…'): string {
  width = Math.max(0, Math.floor(width));
  if (!width) return '';
  if (displayWidth(text) <= width) return text;
  let suffixWidth = displayWidth(ellipsis);
  if (suffixWidth > width) { ellipsis = ''; suffixWidth = 0; }
  let used = 0, result = '';
  for (const cluster of graphemes(text)) {
    const size = clusterWidth(cluster);
    if (used + size > width - suffixWidth) break;
    result += cluster; used += size;
  }
  return result + ellipsis;
}
