import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import type { View } from '../../lib/session.ts';
import { preferenceChanged } from '../../lib/preferences.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { formWindow, pageWindow } from '../../lib/editor/navigation.ts';
import { clip, column, displayWidth } from '../layout.ts';
import { editorLayout } from './help.ts';
import { chromeRow, rowStyle, styles } from '../theme.ts';
import { section } from '../components/section.ts';
import { previewLine, previewText, previewTitle } from '../components/preview.ts';
import { shortcuts, spanLine } from '../components/shortcuts.ts';
import type { TextSpan } from '../components/shortcuts.ts';
import { t, renderMessage } from '../../lib/i18n/index.ts';
import { viewMessage, preferenceResult } from '../../lib/i18n/messages.ts';
import { settingPresentation, preferenceLabel } from '../../lib/i18n/presentation.ts';
import { itemSpans } from '../components/catalog.ts';
import { guidanceLines } from '../../lib/editor/guidance.ts';

export function draw(ui: ClientElements, view: View, columns: number, rows: number): RenderElement {
  const tr = (key: string, params: Record<string, unknown> = {}) => t(key, view.language ?? 'en', params);
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
        line(!layout.available ? tr("native.ui.client.draw.resize_pane_to_32x12_draft_kept") : tr("native.ui.client.draw.loading_configuration")),
        shortcuts(ui, [{ key: 'Q', label: tr("native.ui.client.draw.close") }], columns, ''),
      ],
    });
  const pending = e.modified || view.preferences.some(preferenceChanged);
  const selectedPreference = view.preferences.find((p) => 'host-' + p.row.key === e.setting);
  const notice =
    Object.entries(e.fieldErrors).map(([key, error]) => `${key}: ${renderMessage(e.fieldErrorMessages[key as keyof typeof e.fieldErrorMessages] ?? error ?? '', view.language ?? 'en')}`).join(' · ') ||
    viewMessage(view, 'busy') || viewMessage(view, 'error') || viewMessage(view, 'message') ||
    (e.advanced
      ? viewMessage(view, 'preferencesError') ||
        (selectedPreference?.result ? preferenceLabel(selectedPreference, view.language) + ': ' + preferenceResult(selectedPreference, view.language) : '') ||
        view.preferences.map((p) => p.result ? preferenceLabel(p, view.language) + ': ' + preferenceResult(p, view.language) : '').filter(Boolean).join(' · ')
      : '');
  const content: RenderElement[] = [];
  let title = '';
  if (e.guidanceScroll !== null && e.detail) {
    title = tr('guidance.title');
    const item = e.catalog(e.detail.scope).find(item => item.id === e.detail!.id)!;
    const lines = guidanceLines(item, view.language ?? 'en', inner), capacity = Math.max(1, layout.bodyRows - 1);
    const start = Math.min(e.guidanceScroll, Math.max(0, lines.length - capacity));
    content.push(...lines.slice(start, start + capacity).map(text => line(text)));
    content.push(line(`${start + 1}–${Math.min(lines.length, start + capacity)}/${lines.length}`, styles.muted));
  } else if (view.input?.kind === 'category') {
    title = tr('catalog.search.categories');
    const input = view.input, categories = e.categories(input.scope);
    const window = pageWindow(categories, input.selected, Math.max(1, layout.bodyRows - 1));
    for (const category of categories.slice(window.start, window.end))
      content.push(line(`${input.selected === category ? '› ' : '  '}${tr('catalog.categories.' + category)}`, rowStyle(input.selected === category)));
    content.push(line(`${categories.indexOf(input.selected) + 1}/${categories.length}`, styles.muted));
  } else if (e.page === 'settings' || e.page === 'layout' || e.detail) {
    title = e.detail ? tr("native.ui.client.draw.item_format") + e.detail.id : e.page === 'layout' ? tr("native.ui.client.draw.layout_fitting") : tr("native.ui.client.draw.tool_settings");
    if (e.page === 'settings' && !e.detail) {
      if (e.advanced) title = columns < 64 ? tr("native.ui.client.draw.claude_preferences") : tr("native.ui.client.draw.tool_settings_claude_preferences");
    }
    const settings = settingPresentation(view, settingRows(view));
    const window = formWindow(settings, e.setting, layout.formHeight);
    const labelWidth = Math.max(10, Math.min(44, inner - 15,
      Math.max(10, ...settings.map((row) => displayWidth(row.label) + 1))));
    if (layout.tableHeading)
      content.push(line('  ' + column(tr("native.ui.client.draw.option"), labelWidth) + tr("native.ui.client.draw.value"), { ...styles.muted, bold: true }));
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
    if (layout.showSummary) content.push(line(tr("native.ui.client.draw.fields", {value0: settings.length ? window.start + 1 : 0, end: window.end, length: settings.length, page: window.page, pages: window.pages}), styles.muted));
  } else {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const matches = e.matches(scope), visible = matches.map(result => result.item);
    const current = visible.find((item) => item.id === e.selected[scope]);
    title = scope === 'main' ? tr("native.ui.client.draw.main_items") : tr("native.ui.client.draw.subagent_items_custom_rows") + tr('values.' + (e.draft.display.subagents.enabled ? 'on' : 'off'));
    content.push(shortcuts(ui, [
      {key: 'Ctrl+F', label: tr('catalog.categories.' + e.category[scope]), short: e.category[scope] === 'all' ? tr('values.all') : clip(tr('catalog.categories.' + e.category[scope]), 8)},
      {key: '/', label: tr('native.ui.client.draw.search')},
    ], inner, tr('native.ui.client.draw.filter') + e.search[scope] + (view.input?.kind === 'search' ? ' _' : '') + '  '));
    if (layout.tableHeading) content.push(line(tr("native.ui.client.draw.on_item"), { ...styles.muted, bold: true }));
    const window = pageWindow(visible.map((item) => item.id), e.selected[scope], layout.itemCapacity);
    for (const {item, match} of matches.slice(window.start, window.end))
      content.push(ui.Box({
        key: 'item-' + scope + ':' + item.id, flexShrink: 0,
        children: [spanLine(ui, itemSpans(item, match, e.search[scope], view.language ?? 'en', inner, e.selected[scope] === item.id, e.items(scope).includes(item.id)), inner, rowStyle(e.selected[scope] === item.id))],
      }));
    if (!visible.length) content.push(line(tr("native.ui.client.draw.no_matching_items"), styles.muted));
    while (content.length < layout.bodyRows - Number(layout.showDetails) - Number(layout.showSummary)) content.push(line(' '));
    if (layout.showDetails) content.push(line(current ? tr('native.item_detail', {detail: tr('items.' + scope + '.' + current.id + '.description'), examples: current.examples.join(' · ')}) : tr('native.empty_detail'), styles.muted));
    if (layout.showSummary) content.push(line(tr("native.ui.client.draw.enabled", {page: window.page, pages: window.pages, length: e.items(scope).length}), styles.muted));
  }
  const sample = view.preview ? e.page === 'subagents' ? view.preview.subagents : view.preview.main : [];
  const overflow = layout.previewRows > 1 && sample.length > layout.previewRows;
  const shown = sample.slice(0, overflow ? layout.previewRows - 1 : layout.previewRows);
  const background = view.previewBackground ?? 'dark';
  const preview: RenderElement[] = shown.map((row) => previewLine(ui, row, inner, background));
  if (overflow) preview.push(previewText(ui, tr("native.ui.client.draw.more_preview_rows", {value0: sample.length - shown.length}), inner, background));
  if (!sample.length) preview.push(previewText(ui, viewMessage(view, 'previewError') || (view.preview ? tr("native.ui.client.draw.empty_preview") : tr("native.ui.client.draw.loading_sample_preview")), inner, background));
  while (preview.length < layout.previewRows) preview.push(previewText(ui, '', inner, background));
  const pages = ['main', 'subagents', 'settings', 'layout'];
  const labels = columns < 48 ? ['main','subagents','settings','layout'].map(key => tr('native.tabs.short.' + key))
    : ['main','subagents','settings','layout'].map(key => tr('native.tabs.' + key));
  const tabs: TextSpan[] = [];
  labels.forEach((label, i) => {
    if (i) tabs.push({ text: ' · ', style: styles.muted });
    tabs.push({ text: String(i + 1), style: styles.key });
    tabs.push({ text: ' ' + (pages[i] === e.page ? '[' + label + ']' : label), style: { ...(pages[i] === e.page ? styles.accent : styles.muted), bold: false } });
  });
  return ui.Box({
    width: columns, height: rows, flexDirection: 'column', overflow: 'hidden',
    children: [
      chromeRow(ui, line(tr("native.ui.client.draw.configure_status_line") + (pending ? ' *' : ''), { ...styles.accent, bold: true }), columns),
      chromeRow(ui, spanLine(ui, tabs, columns), columns),
      chromeRow(ui, notice ? line(notice, view.error || Object.keys(e.fieldErrors).length ? styles.error : styles.text)
        : line(tr("native.ui.client.draw.click_region_for_keys"), styles.muted), columns),
      section(ui, 'content-region', title, content, columns, layout.bodyHeight, layout.framed),
      section(ui, 'preview-region', previewTitle(e.draft.display, columns, view.previewBusy, background, view.language), preview, columns, layout.previewHeight, layout.framed, true),
      ui.Box({
        key: 'shortcut-region', width: columns, height: layout.footerRows,
        backgroundColor: styles.text.backgroundColor,
        flexDirection: 'column', flexShrink: 0,
        children: layout.footer.map((hints) => shortcuts(ui, hints, columns)),
      }),
    ],
  });
}
