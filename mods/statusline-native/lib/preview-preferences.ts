/** Editor appearance only; never part of a display draft or portable export. */
export type PreviewBackground = 'dark' | 'light';
export const PREVIEW_BACKGROUND_KEY = 'preview-background';
export const DEFAULT_PREVIEW_BACKGROUND: PreviewBackground = 'dark';

export function previewBackground(value: unknown): PreviewBackground {
  return value === 'light' ? 'light' : DEFAULT_PREVIEW_BACKGROUND;
}
