import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { pageWindow } from '../../lib/editor/navigation.ts';
import { spanColor } from '../../lib/backend.ts';
import { clip, dimensions } from '../layout.ts';
import { section } from '../components/section.ts';

export function draw(
  ui: ClientElements,
  view: View,
  columns: number,
  rows: number,
): RenderElement {
  const e = view.editor;
  const layout = dimensions(columns, rows);
  const inner = Math.max(1, columns - (layout.framed ? 2 : 0));
  const line = (label: string, style: TextProps = {}) =>
    ui.Text({
      wrap: 'truncate',
      ...style,
      children: [clip(label, inner)],
    });
  if (!layout.available || !e)
    return ui.Box({
      width: columns,
      height: rows,
      flexDirection: 'column',
      overflow: 'hidden',
      children: [
        line(
          !layout.available
            ? 'Resize pane to 32x12. Draft kept.'
            : 'Loading configuration…',
        ),
        line('q Close · click region for keys'),
      ],
    });
  const pending = e.modified || view.preferences.some(preferenceChanged);
  const notice =
    Object.entries(e.fieldErrors)
      .map(([key, error]) => `${key}: ${error}`)
      .join(' · ') ||
    view.busy ||
    view.error ||
    view.message ||
    (e.advanced
      ? view.preferencesError ||
        view.preferences
          .map((p) => p.result)
          .filter(Boolean)
          .join(' · ')
      : '') ||
    'Click this region once for keyboard input. Ctrl+G cancels editing; Esc returns focus.';
  const content: RenderElement[] = [];
  let title = '';
  if (e.page === 'settings') {
    title =
      'Tool settings' +
      (e.advanced ? ' + Claude preferences' : ' · h Advanced');
    const settings = settingRows(view);
    const window = pageWindow(
      settings.map((row) => row.key),
      e.setting,
      layout.settingCapacity,
    );
    let group = '';
    for (const row of settings.slice(window.start, window.end)) {
      if (group !== row.group) {
        group = row.group;
        content.push(line(group, { bold: true, color: 'cyan' }));
      }
      const editing =
        view.input?.kind === 'numeric' && view.input.field === row.key;
      const preference = view.preferences.find(
        (p) => 'host-' + p.row.key === row.key,
      );
      content.push(
        ui.Box({
          key: 'setting-' + row.key,
          flexShrink: 0,
          children: [
            line(
              `${e.setting === row.key ? '›' : ' '} ${row.label.padEnd(layout.framed ? 21 : 10)} ${row.value}${editing ? ' _' : ''}${preferenceChangedSafe(preference) ? ' *' : ''}`,
              { inverse: e.setting === row.key, dimColor: !row.editable },
            ),
          ],
        }),
      );
    }
    while (content.length < layout.bodyRows - 1) content.push(line(' '));
    content.push(
      line(`Settings ${window.page}/${window.pages} · ↑↓ select · Enter edit`),
    );
  } else {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const visible = e.visible(scope);
    const current = visible.find((item) => item.id === e.selected[scope]);
    title =
      scope === 'main'
        ? 'Main items'
        : 'Subagent items · custom rows ' +
          (e.draft.display.subagents.enabled ? 'on' : 'off');
    content.push(
      line(
        'Filter: ' +
          e.search[scope] +
          (view.input?.kind === 'search' ? ' _' : '') +
          '  [/ search]',
      ),
    );
    if (layout.framed)
      content.push(line('    ON  ITEM', { bold: true, dimColor: true }));
    const window = pageWindow(
      visible.map((item) => item.id),
      e.selected[scope],
      layout.itemCapacity,
    );
    for (const item of visible.slice(window.start, window.end))
      content.push(
        ui.Box({
          key: 'item-' + scope + ':' + item.id,
          flexShrink: 0,
          children: [
            line(
              `${e.selected[scope] === item.id ? '›' : ' '} [${e.items(scope).includes(item.id) ? 'x' : ' '}] ${item.label}`,
              { inverse: e.selected[scope] === item.id },
            ),
          ],
        }),
      );
    if (!visible.length)
      content.push(line('No matching items. / search, Ctrl+U clear.'));
    while (content.length < layout.bodyRows - 2) content.push(line(' '));
    content.push(
      line(
        current
          ? 'Detail: ' +
              current.description +
              ' · Example: ' +
              current.examples.join(' · ')
          : 'Detail: (empty selection)',
        { dimColor: true },
      ),
    );
    content.push(
      line(
        `${window.page}/${window.pages} · ${e.items(scope).length} enabled · ←→ reorder`,
      ),
    );
  }
  const sample = view.preview
    ? e.page === 'subagents'
      ? view.preview.subagents
      : view.preview.main
    : [];
  const overflow = sample.length > layout.previewRows;
  const shown = sample.slice(
    0,
    overflow ? layout.previewRows - 1 : layout.previewRows,
  );
  const preview: RenderElement[] = shown.map((row) =>
    ui.Box({
      flexDirection: 'row',
      flexShrink: 0,
      overflow: 'hidden',
      children: row.map((span) =>
        ui.Text({
          wrap: 'truncate',
          bold: span.bold,
          color: spanColor(span),
          children: [span.text],
        }),
      ),
    }),
  );
  if (overflow)
    preview.push(
      line(`${sample.length - shown.length} more preview rows`, {
        dimColor: true,
      }),
    );
  if (!sample.length)
    preview.push(
      line(
        view.previewError ||
          (view.preview ? '(empty preview)' : 'Loading sample preview…'),
        { dimColor: true },
      ),
    );
  while (preview.length < layout.previewRows) preview.push(line(' '));
  const contextual = view.input
    ? 'Enter accept · Ctrl+G cancel · Ctrl+U clear'
    : e.page === 'settings'
      ? 'Tab page · ↑↓ select · ←→ adjust · h Advanced · a Apply · r Reload'
      : 'Tab page · ↑↓ select · Space toggle · ←→ order · / search · r Reload';
  return ui.Box({
    width: columns,
    height: rows,
    flexDirection: 'column',
    overflow: 'hidden',
    children: [
      line(
        clip(
          'Client TUI (experimental)' + (pending ? ' *' : ''),
          Math.max(1, columns - 20),
        ),
        { bold: true },
      ),
      line(
        (['Main', 'Subagents', 'Settings'] as const)
          .map(
            (page, i) =>
              `${i + 1} ${['main', 'subagents', 'settings'][i] === e.page ? '[' + page + ']' : page}`,
          )
          .join(' · '),
        { bold: true },
      ),
      line(notice, {
        color:
          view.error || Object.keys(e.fieldErrors).length ? 'red' : undefined,
      }),
      section(
        ui,
        'content-region',
        title,
        content,
        columns,
        layout.bodyHeight,
        layout.framed,
      ),
      section(
        ui,
        'preview-region',
        'Preview · sample data' + (view.previewBusy ? ' …' : ''),
        preview,
        columns,
        layout.previewHeight,
        layout.framed,
      ),
      line(
        view.uncertain
          ? 'k Check saved state · q Close (blocked)'
          : `s Save · f Finish · q ${pending ? 'Discard' : 'Close'} · v Preview`,
        { bold: true },
      ),
      line(contextual, { dimColor: true }),
    ],
  });
}

function preferenceChangedSafe(
  preference: View['preferences'][number] | undefined,
): boolean {
  return !!preference && preferenceChanged(preference);
}
