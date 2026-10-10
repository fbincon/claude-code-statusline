export const MIN_COLUMNS = 32;
export const MIN_ROWS = 12;

/** Budget a paged body between the header, preview and action rows. */
export function dimensions(columns: number, rows: number, footerRows = 2) {
  const framed = columns >= 64 && rows >= 20;
  const previewRows = Math.min(3, Math.max(1, Math.floor((rows - 8 - footerRows) / 4)));
  const previewHeight = previewRows + (framed ? 2 : 1);
  const bodyHeight = Math.max(1, rows - 3 - footerRows - previewHeight);
  const bodyRows = Math.max(1, bodyHeight - (framed ? 2 : 1));
  const tableHeading = columns >= 64 && bodyRows >= 4;
  const showSummary = bodyRows >= (tableHeading ? 4 : 3);
  const showDetails = bodyRows >= (tableHeading ? 5 : 4);
  return {
    columns,
    rows,
    framed,
    previewRows,
    previewHeight,
    bodyHeight,
    bodyRows,
    tableHeading,
    showSummary,
    showDetails,
    footerRows,
    itemCapacity: Math.max(1, bodyRows - 1 - Number(tableHeading) - Number(showSummary) - Number(showDetails)),
    formHeight: Math.max(1, bodyRows - Number(tableHeading) - Number(showSummary)),
    available: columns >= MIN_COLUMNS && rows >= MIN_ROWS,
  };
}

export { cellWidth, displayWidth } from '../lib/unicode.ts';
import { displayWidth, clip as clipGraphemes } from '../lib/unicode.ts';

/** Clip at complete graphemes after replacing single-line control input. */
export function clip(text: string, width: number): string {
  return clipGraphemes(text.replace(/[\x00-\x1f\x7f]/g, ' '), width);
}

/** Pad clipped labels by terminal cells, including wide and combining text. */
export function column(text: string, width: number): string {
  const label = clip(text, width);
  return label + ' '.repeat(Math.max(0, width - displayWidth(label)));
}
