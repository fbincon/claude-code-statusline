import type { ClientElements, RenderElement } from 'claude-code';
import { clip } from '../layout.ts';

export function section(
  ui: ClientElements,
  key: string,
  title: string,
  children: RenderElement[],
  width: number,
  height: number,
  framed: boolean,
): RenderElement {
  const inner = Math.max(1, width - (framed ? 2 : 0));
  return ui.Box({
    key,
    width,
    height,
    flexDirection: 'column',
    flexShrink: 0,
    borderStyle: framed ? 'round' : undefined,
    borderColor: 'gray',
    overflow: 'hidden',
    children: [
      ui.Text({
        bold: true,
        color: 'cyan',
        wrap: 'truncate',
        children: [clip(framed ? title : '─ ' + title + ' ─', inner)],
      }),
      ...children,
    ],
  });
}
