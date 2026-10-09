import type { ClientElements, RenderElement } from 'claude-code';
import type { Draft, Span } from '../../lib/generated-contracts.ts';
import { spanColor } from '../../lib/backend.ts';
import type { PreviewBackground } from '../../lib/preview-preferences.ts';
import { clip, displayWidth } from '../layout.ts';

/** Production foregrounds on the chosen preview background, without host text roles. */
export function previewLine(ui: ClientElements, spans: readonly Span[], width: number, background: PreviewBackground = 'dark'): RenderElement {
  let remaining = Math.max(0, width);
  const children: RenderElement[] = [];
  for (const span of spans) {
    if (remaining <= 0) break;
    const text = clip(span.text, remaining);
    if (!text) continue;
    const color = spanColor(span);
    children.push(ui.Text({
      ...(color === undefined ? {} : { color }),
      bold: span.bold, dimColor: false, children: [text],
    }));
    remaining -= displayWidth(text);
  }
  // Explicit spaces erase old sample cells after a shorter or empty redraw.
  if (remaining) children.push(ui.Text({ children: [' '.repeat(remaining)] }));
  return ui.Box({
    width, height: 1, flexShrink: 0, overflow: 'hidden',
    backgroundColor: background === 'light' ? '#ffffff' : '#17191e',
    children: [ui.Text({ wrap: 'truncate', bold: false, dimColor: false, children })],
  });
}

export function previewText(ui: ClientElements, text: string, width: number, background: PreviewBackground = 'dark'): RenderElement {
  return previewLine(ui, [{ text, bold: false, foreground: null }], width, background);
}

export function previewTitle(display: Draft['display'], columns: number, busy: boolean, background: PreviewBackground = 'dark'): string {
  const choice = display.use_colors ? display.palette : 'off';
  const title = columns < 64 ? 'Preview · ' + choice + ' · ' + background
    : 'Preview · sample data · ' + (display.use_colors ? 'Palette: ' + choice : 'Colors: off') + ' · ' + background + ' bg';
  return title + (busy ? ' …' : '');
}
