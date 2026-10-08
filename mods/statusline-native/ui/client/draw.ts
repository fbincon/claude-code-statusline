import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { formWindow, pageWindow } from '../../lib/editor/navigation.ts';
import { spanColor } from '../../lib/backend.ts';
import { clip, column, displayWidth } from '../layout.ts';
import { editorLayout } from './help.ts';
import { previewRow, rowStyle, styles } from '../theme.ts';
import { section } from '../components/section.ts';
import { shortcuts, spanLine } from '../components/shortcuts.ts';
import type { TextSpan } from '../components/shortcuts.ts';

export function draw(ui: ClientElements, view: View, columns: number, rows: number): RenderElement {
  const e = view.editor;
  const layout = editorLayout(view, columns, rows);
  const inner = Math.max(1, columns - (layout.framed ? 2 : 0));
  const line = (label: string, style: TextProps = {}) =>
    ui.Text({ wrap: 'truncate', ...styles.text, ...style, children: [clip(label, inner)] });
  if (!layout.available || !e)
    return ui.Box({
      backgroundColor: styles.text.backgroundColor,
      width: columns, height: rows, flexDirection: 'column', overflow: 'hidden',
      children: [
        line(!layout.available ? 'Resize pane to 32x12. Draft kept.' : 'Loading configuration…'),
        shortcuts(ui, [{ key: 'Q', label: 'close' }], columns, ''),
      ],
    });
  const pending = e.modified || view.preferences.some(preferenceChanged);
  const selectedPreference = view.preferences.find((p) => 'host-' + p.row.key === e.setting);
  const notice =
    Object.entries(e.fieldErrors).map(([key, error]) => `${key}: ${error}`).join(' · ') ||
    view.busy || view.error || view.message ||
    (e.advanced
      ? view.preferencesError ||
        (selectedPreference?.result ? selectedPreference.row.label + ': ' + selectedPreference.result : '') ||
        view.preferences.map((p) => p.result ? p.row.label + ': ' + p.result : '').filter(Boolean).join(' · ')
      : '');
  const content: RenderElement[] = [];
  let title = '';
  if (e.page === 'settings' || e.page === 'layout' || e.detail) {
    title = e.detail ? 'Item format: ' + e.detail.id : e.page === 'layout' ? 'Layout / fitting' : 'Tool settings';
    if (e.page === 'settings' && !e.detail) {
      if (e.advanced) title = columns < 64 ? 'Claude preferences' : 'Tool settings + Claude preferences';
    }
    const settings = settingRows(view);
    const window = formWindow(settings, e.setting, layout.formHeight);
    const labelWidth = Math.max(10, Math.min(44, inner - 15,
      Math.max(10, ...settings.map((row) => displayWidth(row.label) + 1))));
    if (layout.tableHeading)
      content.push(line('  ' + column('OPTION', labelWidth) + ' VALUE', { ...styles.muted, bold: true }));
    for (const entry of window.lines) {
      if (entry.index === null) {
        const group = clip('─ ' + entry.group + ' ', inner);
        content.push(line(group + '─'.repeat(Math.max(0, inner - displayWidth(group))), { ...styles.accent, bold: true }));
        continue;
      }
      const row = settings[entry.index]!;
      const editing = (view.input?.kind === 'numeric' && view.input.field === row.key) ||
        (view.input?.kind === 'field' && view.input.key === row.key) ||
        (view.input?.kind === 'path' && row.key === view.input.action + '-file');
      const displayed = editing && (view.input?.kind === 'field' || view.input?.kind === 'path') ? view.input.buffer : row.value;
      const preference = view.preferences.find((p) => 'host-' + p.row.key === row.key);
      const label = `${e.setting === row.key ? '›' : ' '} ${column(row.label + ':', labelWidth)} `;
      const spans: TextSpan[] = [
        { text: label },
        { text: displayed + (editing ? ' _' : '') + (preference && preferenceChanged(preference) ? ' *' : '') },
      ];
      content.push(ui.Box({
        key: 'setting-' + row.key, flexShrink: 0,
        children: [spanLine(ui, spans, inner, rowStyle(e.setting === row.key, row.editable))],
      }));
    }
    while (content.length < layout.bodyRows - Number(layout.showSummary)) content.push(line(' '));
    if (layout.showSummary) content.push(line(`Fields ${settings.length ? window.start + 1 : 0}-${window.end}/${settings.length} · ${window.page}/${window.pages}`, styles.muted));
  } else {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const visible = e.visible(scope);
    const current = visible.find((item) => item.id === e.selected[scope]);
    title = scope === 'main' ? 'Main items' : 'Subagent items · custom rows ' + (e.draft.display.subagents.enabled ? 'on' : 'off');
    content.push(shortcuts(ui, [{ key: '/', label: 'search' }], inner,
      'Filter: ' + e.search[scope] + (view.input?.kind === 'search' ? ' _' : '') + '  '));
    if (layout.tableHeading) content.push(line('    ON  ITEM', { ...styles.muted, bold: true }));
    const window = pageWindow(visible.map((item) => item.id), e.selected[scope], layout.itemCapacity);
    for (const item of visible.slice(window.start, window.end))
      content.push(ui.Box({
        key: 'item-' + scope + ':' + item.id, flexShrink: 0,
        children: [line(`${e.selected[scope] === item.id ? '›' : ' '} [${e.items(scope).includes(item.id) ? 'x' : ' '}] ${item.label}`, rowStyle(e.selected[scope] === item.id))],
      }));
    if (!visible.length) content.push(line('No matching items.', styles.muted));
    while (content.length < layout.bodyRows - Number(layout.showDetails) - Number(layout.showSummary)) content.push(line(' '));
    if (layout.showDetails) content.push(line(current ? 'Detail: ' + current.description + ' · Example: ' + current.examples.join(' · ') : 'Detail: (empty selection)', styles.muted));
    if (layout.showSummary) content.push(line(`${window.page}/${window.pages} · ${e.items(scope).length} enabled`, styles.muted));
  }
  const sample = view.preview ? e.page === 'subagents' ? view.preview.subagents : view.preview.main : [];
  const overflow = layout.previewRows > 1 && sample.length > layout.previewRows;
  const shown = sample.slice(0, overflow ? layout.previewRows - 1 : layout.previewRows);
  const preview: RenderElement[] = shown.map((row) =>
    spanLine(ui, row.map((span) => ({ text: span.text, style: { bold: span.bold, color: spanColor(span) } })), inner, styles.preview));
  if (overflow) preview.push(line(`${sample.length - shown.length} more preview rows`, styles.preview));
  if (!sample.length) preview.push(line(view.previewError || (view.preview ? '(empty preview)' : 'Loading sample preview…'), styles.preview));
  while (preview.length < layout.previewRows) preview.push(line(' ', styles.preview));
  const pages = ['main', 'subagents', 'settings', 'layout'];
  const labels = columns < 48 ? ['Main', 'Sub', 'Set', 'Lay'] : ['Main', 'Subagents', 'Settings', 'Layout'];
  const tabs: TextSpan[] = [];
  labels.forEach((label, i) => {
    if (i) tabs.push({ text: ' · ', style: styles.muted });
    tabs.push({ text: String(i + 1), style: styles.key });
    tabs.push({ text: ' ' + (pages[i] === e.page ? '[' + label + ']' : label), style: { ...(pages[i] === e.page ? styles.accent : styles.muted), bold: false } });
  });
  return ui.Box({
    backgroundColor: styles.text.backgroundColor,
    width: columns, height: rows, flexDirection: 'column', overflow: 'hidden',
    children: [
      line('Configure Status Line' + (pending ? ' *' : ''), { ...styles.accent, bold: true }),
      spanLine(ui, tabs, columns),
      notice ? line(notice, view.error || Object.keys(e.fieldErrors).length ? styles.error : styles.text)
        : line('Click region for keys.', styles.muted),
      section(ui, 'content-region', title, content, columns, layout.bodyHeight, layout.framed),
      section(ui, 'preview-region', 'Preview · sample data' + (view.previewBusy ? ' …' : ''), preview.map((child) => previewRow(ui, child, inner)), columns, layout.previewHeight, layout.framed),
      ui.Box({
        key: 'shortcut-region', width: columns, height: layout.footerRows,
        flexDirection: 'column', flexShrink: 0,
        children: layout.footer.map((hints) => shortcuts(ui, hints, columns)),
      }),
    ],
  });
}
