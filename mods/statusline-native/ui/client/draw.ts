import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { formWindow, pageWindow } from '../../lib/editor/navigation.ts';
import { spanColor } from '../../lib/backend.ts';
import { clip, column, dimensions, displayWidth } from '../layout.ts';
import { section } from '../components/section.ts';
import { shortcuts, shortcutSpans, spanLine } from '../components/shortcuts.ts';
import type { Shortcut, TextSpan } from '../components/shortcuts.ts';

export function draw(ui: ClientElements, view: View, columns: number, rows: number): RenderElement {
  const e = view.editor;
  const layout = dimensions(columns, rows);
  const inner = Math.max(1, columns - (layout.framed ? 2 : 0));
  const line = (label: string, style: TextProps = {}) =>
    ui.Text({ wrap: 'truncate', ...style, children: [clip(label, inner)] });
  if (!layout.available || !e)
    return ui.Box({
      width: columns, height: rows, flexDirection: 'column', overflow: 'hidden',
      children: [
        line(!layout.available ? 'Resize pane to 32x12. Draft kept.' : 'Loading configuration…'),
        shortcuts(ui, [{ key: 'q', label: 'Close' }], columns, ''),
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
  let titleHints: Shortcut[] = [];
  if (e.page === 'settings' || e.page === 'layout' || e.detail) {
    title = e.detail ? 'Item format: ' + e.detail.id : e.page === 'layout' ? 'Layout / fitting' : 'Tool settings';
    if (e.page === 'settings' && !e.detail) {
      if (e.advanced) title = columns < 64 ? 'Claude preferences' : 'Tool settings + Claude preferences';
      titleHints = [{ key: 'h', label: (e.advanced ? 'Hide' : 'Show') + ' Claude preferences', short: e.advanced ? (columns < 48 ? 'Hide' : 'Hide prefs') : 'Claude prefs' }];
      if (e.advanced) titleHints.push({ key: 'a', label: 'Apply separately', short: 'Apply' });
    }
    const settings = settingRows(view);
    const window = formWindow(settings, e.setting, layout.formHeight);
    const labelWidth = Math.max(10, Math.min(44, inner - 15,
      Math.max(10, ...settings.map((row) => displayWidth(row.label) + 1))));
    if (layout.tableHeading)
      content.push(line('  ' + column('OPTION', labelWidth) + ' VALUE', { bold: true, dimColor: true }));
    for (const entry of window.lines) {
      if (entry.index === null) {
        const group = clip('─ ' + entry.group + ' ', inner);
        content.push(line(group + '─'.repeat(Math.max(0, inner - displayWidth(group))), { bold: true, color: 'cyan' }));
        continue;
      }
      const row = settings[entry.index]!;
      const editing = (view.input?.kind === 'numeric' && view.input.field === row.key) ||
        (view.input?.kind === 'field' && view.input.key === row.key) ||
        (view.input?.kind === 'path' && row.key === view.input.action + '-file');
      const displayed = editing && (view.input?.kind === 'field' || view.input?.kind === 'path') ? view.input.buffer : row.value;
      const preference = view.preferences.find((p) => 'host-' + p.row.key === row.key);
      const label = `${e.setting === row.key ? '›' : ' '} ${column(row.label + ':', labelWidth)} `;
      const valueWidth = Math.max(0, inner - displayWidth(label));
      const spans: TextSpan[] = [{ text: label }];
      if (!editing && ['preset-apply', 'import-file', 'export-file'].includes(row.key))
        spans.push(...shortcutSpans([{ key: 'Enter', label: row.value.replace(/^Enter:?\s*/, ''), short: row.key === 'preset-apply' ? 'expand' : 'path' }], valueWidth));
      else spans.push({ text: displayed + (editing ? ' _' : '') + (preference && preferenceChanged(preference) ? ' *' : '') });
      content.push(ui.Box({
        key: 'setting-' + row.key, flexShrink: 0,
        children: [spanLine(ui, spans, inner, { inverse: e.setting === row.key, dimColor: !row.editable })],
      }));
    }
    while (content.length < layout.bodyRows - 1) content.push(line(' '));
    content.push(line(`Fields ${settings.length ? window.start + 1 : 0}-${window.end}/${settings.length} · ${window.page}/${window.pages}`, { dimColor: true }));
  } else {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const visible = e.visible(scope);
    const current = visible.find((item) => item.id === e.selected[scope]);
    title = scope === 'main' ? 'Main items' : 'Subagent items · custom rows ' + (e.draft.display.subagents.enabled ? 'on' : 'off');
    content.push(shortcuts(ui, [{ key: '/', label: 'search' }], inner,
      'Filter: ' + e.search[scope] + (view.input?.kind === 'search' ? ' _' : '') + '  '));
    if (layout.tableHeading) content.push(line('    ON  ITEM', { bold: true, dimColor: true }));
    const window = pageWindow(visible.map((item) => item.id), e.selected[scope], layout.itemCapacity);
    for (const item of visible.slice(window.start, window.end))
      content.push(ui.Box({
        key: 'item-' + scope + ':' + item.id, flexShrink: 0,
        children: [line(`${e.selected[scope] === item.id ? '›' : ' '} [${e.items(scope).includes(item.id) ? 'x' : ' '}] ${item.label}`, { inverse: e.selected[scope] === item.id })],
      }));
    if (!visible.length) content.push(shortcuts(ui, [{ key: '/', label: 'search' }, { key: 'Ctrl+U', label: 'clear' }], inner, 'No matching items. '));
    while (content.length < layout.bodyRows - 2) content.push(line(' '));
    content.push(line(current ? 'Detail: ' + current.description + ' · Example: ' + current.examples.join(' · ') : 'Detail: (empty selection)', { dimColor: true }));
    content.push(line(`${window.page}/${window.pages} · ${e.items(scope).length} enabled`, { dimColor: true }));
  }
  const sample = view.preview ? e.page === 'subagents' ? view.preview.subagents : view.preview.main : [];
  const overflow = sample.length > layout.previewRows;
  const shown = sample.slice(0, overflow ? layout.previewRows - 1 : layout.previewRows);
  const preview: RenderElement[] = shown.map((row) =>
    spanLine(ui, row.map((span) => ({ text: span.text, style: { bold: span.bold, color: spanColor(span) } })), inner));
  if (overflow) preview.push(line(`${sample.length - shown.length} more preview rows`, { dimColor: true }));
  if (!sample.length) preview.push(line(view.previewError || (view.preview ? '(empty preview)' : 'Loading sample preview…'), { dimColor: true }));
  while (preview.length < layout.previewRows) preview.push(line(' '));
  const contextual: Shortcut[] = view.input
    ? [{ key: 'Enter', label: 'accept' }, { key: 'Ctrl+G', label: 'cancel' }, { key: 'Ctrl+U', label: 'clear' }, { key: 'Backspace', label: 'delete', short: 'del' }]
    : e.detail
      ? [{ key: 'Ctrl+G', label: 'back' }, { key: '↑↓', label: 'select' }, { key: '←→', label: 'adjust' }, { key: 'Enter', label: 'edit' }, { key: 'Tab', label: 'page' }]
      : e.page === 'layout'
        ? [{ key: '↑↓', label: 'select' }, { key: '←→', label: 'adjust' }, { key: 'Enter', label: 'edit' }, { key: 'Tab', label: 'page' }]
        : e.page === 'settings'
          ? [...(e.advanced ? [{ key: 'a', label: 'Apply separately', short: 'Apply' }] : []),
             { key: '↑↓', label: 'select' }, { key: '←→', label: 'adjust' }, { key: 'Enter', label: 'edit' }, { key: 'r', label: 'Reload' }, { key: 'Tab', label: 'page' }]
          : [{ key: 'Space', label: 'toggle' }, { key: '↑↓', label: 'select' }, { key: '←→', label: 'order' }, { key: 'Ctrl+E', label: 'format' }, { key: 'Tab', label: 'page' }];
  const pages = ['main', 'subagents', 'settings', 'layout'];
  const labels = columns < 48 ? ['Main', 'Sub', 'Set', 'Lay'] : ['Main', 'Subagents', 'Settings', 'Layout'];
  const tabs: TextSpan[] = [];
  labels.forEach((label, i) => {
    if (i) tabs.push({ text: ' · ', style: { dimColor: true } });
    tabs.push({ text: String(i + 1), style: { color: 'white', bold: true } });
    tabs.push({ text: ' ' + (pages[i] === e.page ? '[' + label + ']' : label), style: { color: pages[i] === e.page ? 'cyan' : undefined, dimColor: pages[i] !== e.page, bold: false } });
  });
  return ui.Box({
    width: columns, height: rows, flexDirection: 'column', overflow: 'hidden',
    children: [
      line('Client TUI (experimental)' + (pending ? ' *' : ''), { bold: true }),
      spanLine(ui, tabs, columns),
      notice ? line(notice, { color: view.error || Object.keys(e.fieldErrors).length ? 'red' : undefined })
        : shortcuts(ui, [{ key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' }, { key: 'Esc', label: 'focus' }], columns, 'Click region for keys. '),
      section(ui, 'content-region', title, content, columns, layout.bodyHeight, layout.framed, titleHints),
      section(ui, 'preview-region', 'Preview · sample data' + (view.previewBusy ? ' …' : ''), preview, columns, layout.previewHeight, layout.framed),
      shortcuts(ui, view.uncertain
        ? [{ key: 'k', label: 'Check saved state', short: 'Check' }, { key: 'q', label: 'Close (blocked)', short: 'Blocked' }]
        : [{ key: 's', label: 'Save' }, { key: 'f', label: 'Finish' }, { key: 'q', label: pending ? 'Discard' : 'Close' }, { key: 'v', label: 'Preview' }], columns),
      shortcuts(ui, contextual, columns),
    ],
  });
}
