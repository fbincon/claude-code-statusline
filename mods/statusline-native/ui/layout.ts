import { t, type Language } from '../lib/i18n/index.ts';
import { displayWidth, clip as clipGraphemes } from '../lib/unicode.ts';

export const MIN_COLUMNS = 32;
export const MIN_ROWS = 12;

export const RECOVERY_CONTROL_GAP = 1;
const TITLE_GAP = 1;
const MIN_TITLE_COLUMNS = 12;
const BUTTON_DECORATION = displayWidth('[  ]');

export function recoveryControls(columns: number, language: Language = 'en') {
  const retry = t('native.hooks.register.retry', language);
  const close = t('native.hooks.register.close', language);
  const available = columns - MIN_TITLE_COLUMNS - TITLE_GAP;
  const fullWidth = displayWidth(retry) + displayWidth(close) + 2 * BUTTON_DECORATION + RECOVERY_CONTROL_GAP;
  if (fullWidth <= available || columns < MIN_COLUMNS)
    return { retry, close, width: fullWidth, plain: false };

  const labels = available - RECOVERY_CONTROL_GAP;
  const retryWidth = Math.min(displayWidth(retry), Math.max(4, labels - displayWidth(close)));
  const compactRetry = clip(retry, retryWidth);
  const compactClose = clip(close, labels - displayWidth(compactRetry));
  return { retry: compactRetry, close: compactClose,
    width: displayWidth(compactRetry) + displayWidth(compactClose) + RECOVERY_CONTROL_GAP, plain: true };
}

/** Columns available inside the same frame used by editor drawing. */
export function contentColumns(columns: number, rows: number): number {
  return Math.max(1, columns - (columns >= 64 && rows >= 20 ? 2 : 0));
}

/** Header budget that keeps the title clear of the recovery controls. */
export function headerColumns(columns: number, rows: number, language: Language = 'en', paneColumns = columns): number {
  return Math.min(contentColumns(columns, rows), Math.max(0, paneColumns - recoveryControls(paneColumns, language).width - TITLE_GAP));
}

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

/** Clip at complete graphemes after replacing single-line control input. */
export function clip(text: string, width: number): string {
  return clipGraphemes(text.replace(/[\x00-\x1f\x7f]/g, ' '), width);
}

/** Pad clipped labels by terminal cells, including wide and combining text. */
export function column(text: string, width: number): string {
  const label = clip(text, width);
  return label + ' '.repeat(Math.max(0, width - displayWidth(label)));
}
