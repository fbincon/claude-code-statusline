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
  terminalBackground = false,
): RenderElement {
  const edge = { ...styles.muted, backgroundColor: styles.text.backgroundColor };
  const label = clip(title, Math.max(1, width - 5));
  const titleSpans: TextSpan[] = [{ text: ' ' + label + ' ', style: { ...styles.accent, bold: true } }];
  const used = titleSpans.reduce((n, s) => n + displayWidth(s.text), 0);
  const top = spanLine(ui, [
    { text: framed ? '╭─' : '─', style: edge },
    ...titleSpans,
    { text: '─'.repeat(Math.max(0, width - used - (framed ? 3 : 1))) + (framed ? '╮' : ''), style: edge },
  ], width);
  const bodyHeight = Math.max(0, height - (framed ? 2 : 1));
  const body = children.slice(0, bodyHeight);
  const side = () => ui.Box({ width: 1, height: bodyHeight, flexShrink: 0, children: [
    ui.Text({ ...edge, wrap: 'truncate', children: ['│\n'.repeat(bodyHeight).trimEnd()] }),
  ] });
  return ui.Box({
    key,
    ...(terminalBackground ? {} : { backgroundColor: styles.text.backgroundColor }),
    width,
    height,
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
    children: [
      top,
      ui.Box({
        flexDirection: 'row', flexShrink: 0, height: bodyHeight, width,
        children: [
          ...(framed ? [side()] : []),
          ui.Box({ width: width - (framed ? 2 : 0), height: bodyHeight, flexDirection: 'column', flexShrink: 0, overflow: 'hidden', children: body }),
          ...(framed ? [side()] : []),
        ],
      }),
      ...(framed ? [ui.Text({ ...edge, wrap: 'truncate', children: ['╰' + '─'.repeat(Math.max(0, width - 2)) + '╯'] })] : []),
    ],
  });
}
