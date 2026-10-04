import type { PreviewResult } from '../../lib/generated-contracts.ts';
import { spanColor } from '../../lib/backend.ts';
import type { Actions, Controls } from '../controls.ts';

export function preview(
  ui: Controls,
  result: PreviewResult | null,
  subagents: boolean,
  capacity: number,
  busy: boolean,
  error: string,
  actions: Actions,
) {
  const rows = result ? (subagents ? result.subagents : result.main) : [];
  const overflow = rows.length > capacity;
  const shown = rows.slice(0, overflow ? Math.max(0, capacity - 1) : capacity);
  return [
    error
      ? ui.Button({
          key: 'retry',
          plain: true,
          label: 'Retry sample preview',
          hotkey: 'v',
          onPress: actions.retry,
        })
      : ui.Text({
          bold: true,
          children: ['Preview (sample data)' + (busy ? ' …' : '')],
        }),
    ...shown.map((row) =>
      ui.Box({
        flexDirection: 'row',
        children: row.map((span) =>
          ui.Text({
            bold: span.bold,
            color: spanColor(span),
            children: [span.text],
          }),
        ),
      }),
    ),
    ...(overflow
      ? [
          ui.Text({
            dimColor: true,
            children: [`${rows.length - shown.length} more preview rows`],
          }),
        ]
      : []),
    ...(!rows.length
      ? [
          ui.Text({
            dimColor: true,
            wrap: 'truncate',
            children: [
              error || (result ? '(empty preview)' : 'Loading sample preview…'),
            ],
          }),
        ]
      : []),
    ...Array.from(
      {
        length: Math.max(
          0,
          capacity - (overflow ? shown.length + 1 : Math.max(1, shown.length)),
        ),
      },
      () => ui.Text({ children: [' '] }),
    ),
  ];
}
