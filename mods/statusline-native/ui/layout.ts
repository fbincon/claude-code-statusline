export const MIN_COLUMNS = 32;
export const MIN_ROWS = 12;

/** Budget a paged body between the header, preview and action rows. */
export function dimensions(columns: number, rows: number) {
  const framed = columns >= 64 && rows >= 20;
  const previewRows = Math.min(3, Math.max(1, Math.floor((rows - 10) / 4)));
  const previewHeight = previewRows + 1 + (framed ? 2 : 0);
  const bodyHeight = Math.max(1, rows - 5 - previewHeight);
  const bodyRows = Math.max(1, bodyHeight - (framed ? 2 : 0) - 1);
  return {
    columns,
    rows,
    framed,
    previewRows,
    previewHeight,
    bodyHeight,
    bodyRows,
    itemCapacity: Math.max(1, bodyRows - (framed ? 4 : 3)),
    settingCapacity: Math.max(1, bodyRows - 4),
    available: columns >= MIN_COLUMNS && rows >= MIN_ROWS,
  };
}

export function cellWidth(char: string): number {
  const code = char.codePointAt(0)!;
  if (
    /\p{Mark}/u.test(char) ||
    code === 0x200d ||
    (code >= 0xfe00 && code <= 0xfe0f)
  )
    return 0;
  return code >= 0x1100 &&
    (code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faff) ||
      code >= 0x20000)
    ? 2
    : 1;
}

/** Clip labels by cells without splitting UTF-16 pairs or combining marks. */
export function clip(text: string, width: number): string {
  const characters = [...text.replace(/[\x00-\x1f\x7f]/g, ' ')];
  if (characters.reduce((size, char) => size + cellWidth(char), 0) <= width)
    return characters.join('');
  let result = '';
  let used = 0;
  for (const char of characters) {
    const size = cellWidth(char);
    if (used + size > Math.max(0, width - 1)) break;
    result += char;
    used += size;
  }
  return width > 0 ? result + '…' : '';
}
