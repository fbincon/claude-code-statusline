import type { ClientElements, RenderElement } from 'claude-code';
import { clip, displayWidth } from '../layout.ts';
import { styles } from '../theme.ts';
import { spanLine } from './shortcuts.ts';
import type { TextSpan } from './shortcuts.ts';

/** Draw a cell-sized frame: the title occupies the top edge, not a body row. */
export function section(
  ui: ClientElements,
  key: string,
  title: string,
  children: RenderElement[],
  width: number,
  height: number,
  framed: boolean,
): RenderElement {
  const edge = styles.muted;
  const label = clip(title, Math.max(1, width - 5));
  const titleSpans: TextSpan[] = [{ text: ' ' + label + ' ', style: { ...styles.accent, bold: true } }];
  const used = titleSpans.reduce((n, s) => n + displayWidth(s.text), 0);
  const top = spanLine(ui, [
    { text: framed ? '╭─' : '─', style: edge },
    ...titleSpans,
    { text: '─'.repeat(Math.max(0, width - used - (framed ? 3 : 1))) + (framed ? '╮' : ''), style: edge },
  ], width);
  const body = children.slice(0, Math.max(0, height - (framed ? 2 : 1)));
  return ui.Box({
    key,
    width,
    height,
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
    children: [
      top,
      ...body.map((child) => framed ? ui.Box({
        flexDirection: 'row', flexShrink: 0, height: 1, width,
        children: [
          ui.Text({ ...edge, children: ['│'] }),
          ui.Box({ width: width - 2, height: 1, flexShrink: 0, overflow: 'hidden', children: [child] }),
          ui.Text({ ...edge, children: ['│'] }),
        ],
      }) : child),
      ...(framed ? [ui.Text({ ...edge, wrap: 'truncate', children: ['╰' + '─'.repeat(Math.max(0, width - 2)) + '╯'] })] : []),
    ],
  });
}
