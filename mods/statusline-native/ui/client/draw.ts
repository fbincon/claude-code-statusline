import { changesView } from '../../lib/editor/change-review.ts';
import { reuseView } from '../../lib/editor/reuse-manager.ts';
import { packageNotice, packageTitle, packageView } from '../../lib/editor/package-view.ts';
import { diagnosisOutput, diagnosisPage } from '../../lib/editor/diagnosis-view.ts';
import { previewWidth } from '../../lib/editor/preview-settings.ts';
import { editorPreviewDraft, samplePreview } from '../../lib/editor/preview-view.ts';
import { colorsTitle, colorsView } from '../../lib/editor/color-manager.ts';
import { EDITOR_PAGES } from '../../lib/editor/draft.ts';
import { alignmentsView } from '../../lib/editor/alignment-manager.ts';
import { groupsTitle, groupsView } from '../../lib/editor/group-manager.ts';
import { sourcesTitle, sourcesView } from '../../lib/editor/source-manager.ts';
import { explanationRows } from '../../lib/editor/explanation.ts';
import { quickNextHelp, quickView } from '../../lib/editor/quick-setup.ts';
import { inputView, textInput } from '../../lib/editor/text-input.ts';
import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import type { View } from '../../lib/session.ts';
import { preferenceChanged, preferenceForKey } from '../../lib/preferences.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { catalogEmptyLine, formWindow, pageWindow } from '../../lib/editor/navigation.ts';
import { clip, column, displayWidth, contentColumns, editorBodySizeLines, headerColumns, MIN_COLUMNS, MIN_ROWS } from '../layout.ts';
import { editorLayout } from './help.ts';
import { chromeRow, rowStyle, styles } from '../theme.ts';
import { section } from '../components/section.ts';
import { previewLine, previewText, previewTitle } from '../components/preview.ts';
import { editorLine, inputSpans, shortcuts, spanLine } from '../components/shortcuts.ts';
import type { TextSpan } from '../components/shortcuts.ts';
import { t, renderMessage } from '../../lib/i18n/index.ts';
import { viewMessage, preferenceResult } from '../../lib/i18n/messages.ts';
import { settingPresentation, preferenceLabel } from '../../lib/i18n/presentation.ts';
import { itemSpans } from '../components/catalog.ts';
import { catalogMarker } from '../../lib/editor/instances.ts';
import { guidanceRows } from '../../lib/editor/guidance.ts';
import { itemDetailWindow, type ItemDetailRow } from '../../lib/editor/item-detail.ts';
import { importShortcutHelp, reviewRows } from '../../lib/editor/import-review.ts';
import { profilesTitle, profilesView, targetLabel } from '../../lib/editor/profile-manager.ts';
import { shortcutPanelView } from '../../lib/editor/shortcut-settings.ts';
import { editorLineSpans, hintLine, prependLine, sectionDivider, type EditorLine } from '../../lib/editor/hints.ts';
import { itemDecorationNotice, layoutFormNotice } from '../../lib/editor/forms.ts';

const itemDetailStyles = {
  heading: { ...styles.accent, bold: true },
  body: { bold: false },
  example: { ...styles.accent, bold: false },
  note: { ...styles.muted, bold: false },
  error: { ...styles.error, bold: false },
} satisfies Record<ItemDetailRow['kind'], TextProps>;

function tabSpans(labels: readonly string[], active: (typeof EDITOR_PAGES)[number], numbered: boolean): TextSpan[] {
  const tabs: TextSpan[] = [];
  labels.forEach((label, i) => {
    const selected = EDITOR_PAGES[i] === active;
    const number = String(i + 1);
    if (numbered) {
      tabs.push({ text: (i ? ' ' : '') + (selected ? '[' + number + ']' : number), style: selected ? styles.accent : styles.key });
      return;
    }
    if (i) tabs.push({ text: ' · ', style: styles.muted });
    tabs.push({ text: number, style: styles.key });
    tabs.push({ text: ' ' + (selected ? '[' + label + ']' : label), style: { ...(selected ? styles.accent : styles.muted), bold: false } });
  });
  return tabs;
}

export function draw(ui: ClientElements, view: View, columns: number, rows: number, capacityNotice = '', paneColumns = columns): RenderElement {
  const language = view.language ?? 'en';
  const tr = (key: string, params: Record<string, unknown> = {}) => t(key, language, params);
  const e = view.editor;
  const available = columns >= MIN_COLUMNS && rows >= MIN_ROWS;
  const inner = contentColumns(columns, rows);
  const line = (value: string | EditorLine, style: TextProps = {}, width = inner) => {
    if (typeof value !== 'string' && (value.caret || value.keys?.length)) return editorLine(ui, value, width, style);
    return ui.Text({ wrap: 'truncate', ...styles.text, ...style, children: [clip(typeof value === 'string' ? value : value.text, width)] });
  };
  if (!available || !e)
    return ui.Box({
      backgroundColor: styles.text.backgroundColor,
      width: columns, height: rows, flexDirection: 'column', overflow: 'hidden',
      children: [
        ...(!available
          ? [...editorBodySizeLines(columns, rows, language), tr('native.capacity.retained')].map(value => line(value))
          : [line(tr('native.ui.client.draw.loading_configuration'))]),
        shortcuts(ui, [{ key: 'Q', label: tr("native.ui.client.draw.close") }], columns, ''),
      ],
    });
  const pending = (view.input?.kind === 'field' && view.input.original !== undefined && view.input.buffer !== view.input.original) || e.modified || view.preferences.some(preferenceChanged);
  const header = (title: string) => chromeRow(ui, line(title, { ...styles.accent, bold: true },
    headerColumns(columns, rows, language, paneColumns)), columns);
  const editorTitle = tr("native.ui.client.draw.configure_status_line") + (pending ? ' *' : '') +
    (e.baseline.configuration ? ' · ' + targetLabel(e, language) : '');
  if (e.shortcuts.panel) {
    const shortcuts = shortcutPanelView(e.shortcuts, language, columns, rows);
    const toolbarStyle = {
      button: { ...styles.accent, bold: true }, focused: { ...styles.selected, bold: true }, key: styles.key, hint: styles.muted,
    };
    const content = shortcuts.toolbar.map(row => spanLine(ui, row.map(({ text, kind }) => ({
      text, style: toolbarStyle[kind],
    })), shortcuts.innerWidth));
    const drawRow = (row: typeof shortcuts.body[number]) => line(row, row.kind === 'group' ? { ...styles.accent, bold: true }
      : row.kind === 'columns' ? { ...styles.muted, bold: true } : rowStyle(row.selected === true, row.kind !== 'detail'), shortcuts.innerWidth);
    content.push(...shortcuts.body.map(drawRow));
    if (shortcuts.bottom.length) {
      const gap = shortcuts.bottomOffset - content.length;
      if (gap > 0) content.push(ui.Box({ height: gap, flexShrink: 0, children: [] }));
      content.push(...shortcuts.bottom.map(drawRow));
    }
    const title = tr('shortcuts.title') + (capacityNotice ? ' · ' + capacityNotice : '');
    return ui.Box({ width: columns, height: rows, flexDirection: 'column', overflow: 'hidden', children: [
      header(shortcuts.fullTitle ? editorTitle : tr('native.tabs.settings')),
      section(ui, 'content-region', title, content, columns, rows - 1 - shortcuts.footer.length, shortcuts.framed),
      ...shortcuts.footer.map(row => chromeRow(ui, line(row, styles.muted, columns), columns)),
    ] });
  }
  const labels = EDITOR_PAGES.map(key => tr((columns < 48 ? 'native.tabs.short.' : 'native.tabs.') + key));
  const tabWidth = displayWidth(labels.map((label, i) => String(i + 1) + ' ' + label).join(' · ')) + 2; // Selected tab brackets.
  const layout = editorLayout(view, columns, rows);
  const inputDisplay = (width: number): EditorLine => {
    const input = view.input;
    if (!input || input.kind === 'category') return { text: '' };
    const value = input.kind === 'search' ? e.listContext(input.scope).search : input.kind === 'numeric' ? e.buffers[input.field] : input.buffer;
    const edit = input.edit?.value === value ? {...input.edit} : textInput(value);
    return inputView(edit, width);
  };
  const selectedPreference = preferenceForKey(view.preferences, e.setting);
  const pickerNotice = !view.input && !e.detail && !e.changeReview ? e.picker?.notice : null;
  const message = view.localized?.message;
  const messageBindings = message?.fallback === view.message && message.key === 'shortcuts.native-preset-applied' ? ['save', 'close']
    : message?.fallback === view.message && message.key === 'shortcuts.host-preferences-pending' ? ['apply', 'finish', 'close']
      : message?.fallback === view.message && message.key === 'colors.staged' ? ['save'] : [];
  const editorMessage = messageBindings.length && message
    ? hintLine(message.key, language, Object.fromEntries(messageBindings.map(key => [key, String(message.params[key])])))
    : viewMessage(view, 'message');
  let notice: string | EditorLine = e.review ? editorMessage || importShortcutHelp(e.review, e.shortcuts, language) :
    (view.input?.kind === 'path' && editorMessage) ||
    Object.entries(e.fieldErrors).map(([key, error]) => `${key}: ${renderMessage(e.fieldErrorMessages[key as keyof typeof e.fieldErrorMessages] ?? error ?? '', view.language ?? 'en')}`).join(' · ') ||
    viewMessage(view, 'busy') || (view.uncertain && e.sources ? tr('editor.save_check_from_editor') : viewMessage(view, 'error')) ||
    (view.uncertain ? tr('editor.save_unconfirmed') : '') ||
    (pickerNotice ? renderMessage(pickerNotice, view.language) : '') || editorMessage ||
    (e.advanced
      ? viewMessage(view, 'preferencesError') ||
        (selectedPreference?.result ? preferenceLabel(selectedPreference, view.language) + ': ' + preferenceResult(selectedPreference, view.language) : '') ||
        view.preferences.map((p) => p.result ? preferenceLabel(p, view.language) + ': ' + preferenceResult(p, view.language) : '').filter(Boolean).join(' · ')
      : '') || (layout.hostRows ? tr('native.host_applies_separately') : '') || itemDecorationNotice(view) || layoutFormNotice(view) || '';
  const content: RenderElement[] = [];
  let title = '';
  if(e.changeReview||e.reuse){title=tr(e.changeReview?(e.structureProposal?.confirmation?'layout.review_title':'history.title'):'reuse.'+e.reuse!.kind);content.push(...(e.changeReview?changesView(e,language,inner,layout.bodyRows):reuseView(e,language,inner,layout.bodyRows)).map(row=>line(row,rowStyle(row.selected===true))));
  } else if (e.packages) {
    title = packageTitle(e.packages, language);
    if (e.packages.message) notice = packageNotice(e.packages, language, e.shortcuts);
    const packages = { ...e.packages, input: e.packages.input ? { ...e.packages.input } : null };
    content.push(...packageView(packages, language, inner, layout.bodyRows, e.shortcuts)
      .map(row => line(row, row.heading ? styles.accent : rowStyle(row.selected === true))));
  } else if (e.diagnosis) {
    title = tr('diagnosis.title');
    const page = diagnosisPage(e, view.language ?? 'en', inner, layout.bodyRows - 1);
    content.push(...page.lines.map(row => row.kind ? line(row.text || ' ', itemDetailStyles[row.kind]) : line(row)));
    if (layout.bodyRows > 1) content.push(line(page.summary, styles.muted));
  } else if (e.colors) {
    title = colorsTitle(e, language);
    content.push(...colorsView(e, language, inner, layout.bodyRows).map(row => 'spans' in row
      ? previewLine(ui, row.spans, inner, view.previewBackground ?? 'dark') : line(row, row.selected ? rowStyle(true) : styles.muted)));
  } else if(e.alignmentManager) {
    title=tr('alignment.title');
    content.push(...alignmentsView(e,language,inner,layout.bodyRows).map(row=>line(row,rowStyle(row.selected === true))));
  } else if(e.groupManager) {
    title=groupsTitle(e,language);
    content.push(...groupsView(e,language,inner,layout.bodyRows).map(row=>line(row,rowStyle(row.selected === true))));
  } else if(e.sources) {
    title = sourcesTitle(e, language);
    content.push(...sourcesView(e, language, inner, layout.bodyRows).map(row => line(row,
      row.heading ? { ...styles.accent, bold: true } : rowStyle(row.selected))));
  } else if(e.profiles) {
    title = profilesTitle(e, language);
    content.push(...profilesView(e,language,inner,layout.bodyRows).map(row=>line(row,rowStyle(row.selected))));
  } else if (e.explanation || e.guidanceScroll !== null && e.detail) {
    title = tr(e.explanation ? 'explain.title' : 'guidance.title');
    const item = e.detailItem;
    const detailRows = e.explanation ? explanationRows(e, language, inner) : item ? guidanceRows(item, language, inner) : [];
    const page = itemDetailWindow(detailRows, e.explanation?.scroll ?? e.guidanceScroll ?? 0, layout.bodyRows - 1);
    // Empty host Text nodes have zero height.
    content.push(...page.rows.map(row => row.text ? line(row.text, itemDetailStyles[row.kind])
      : ui.Box({ height: 1, flexShrink: 0, children: [] })));
    if (page.summary && layout.bodyRows > 1) content.push(line(page.summary, itemDetailStyles.note));
  } else if (e.quick) {
    title=tr('quick.title')+' · '+tr('quick.'+e.quick.step);
    if (e.quick.step === 'appearance' && (!notice || notice === editorMessage && message?.fallback === view.message && message?.key === 'quick.preset-ready'))
      notice = quickNextHelp(language);
    content.push(...quickView(e.quick,language,inner,layout.bodyRows,e.baseline.configuration?.shared_projects).map(row=>line(row,rowStyle(row.selected))));
  } else if (e.review) {
    title = tr(e.review.choosing ? 'review.selection_title' : 'review.title');
    const review = e.review, lines = reviewRows(review, view.language ?? 'en', inner), capacity = Math.max(1, layout.bodyRows - 1);
    const start = Math.min(review.scroll, Math.max(0, lines.length - capacity));
    content.push(...lines.slice(start, start + capacity).map(row => line(row.text, row.heading
      ? row.section === review.selected ? rowStyle(true) : { ...styles.accent, bold: true }
      : rowStyle(false))));
    content.push(line(`${start + 1}–${Math.min(lines.length, start + capacity)}/${lines.length}`, styles.muted));
  } else if (view.input?.kind === 'category') {
    title = tr('catalog.search.categories');
    const input = view.input, categories = e.categories(input.scope);
    const window = pageWindow(categories, input.selected, Math.max(1, layout.bodyRows - 1));
    for (const category of categories.slice(window.start, window.end))
      content.push(line(`${input.selected === category ? '› ' : '  '}${tr('catalog.categories.' + category)}`, rowStyle(input.selected === category)));
    content.push(line(`${categories.indexOf(input.selected) + 1}/${categories.length}`, styles.muted));
  } else if (e.page === 'settings' || e.page === 'layout' || e.detail) {
    title = e.detail ? tr("native.ui.client.draw.item_format") + e.instanceLabel(e.detail.scope,e.detail.id,view.language) : e.page === 'layout' ? tr("native.ui.client.draw.layout_fitting") : tr("native.ui.client.draw.tool_settings");
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
        content.push(line(sectionDivider(entry.group, inner), { ...styles.accent, bold: true }));
        continue;
      }
      const row = settings[entry.index]!;
      const editing = (view.input?.kind === 'numeric' && view.input.field === row.key) ||
        (view.input?.kind === 'field' && view.input.key === row.key) ||
        (view.input?.kind === 'path' && row.key === view.input.action + '-file');
      if (layout.hostRows && row.key === e.setting && row.host && !editing) {
        content.push(ui.Box({ key: 'setting-' + row.key, flexShrink: 0,
          children: [line('› ' + row.label, rowStyle(true, row.editable))],
        }));
        continue;
      }
      const label = `${e.setting === row.key ? '›' : ' '} ${column(row.label + ':', labelWidth)}`;
      const valueWidth = Math.max(1, inner - displayWidth(label + ' '));
      const valueSpans = editing ? inputSpans(inputDisplay(valueWidth), valueWidth)
        : row.valueHint ? editorLineSpans(row.valueHint, valueWidth).map(({ text, bold }) => ({ text, style: { bold } }))
          : [{ text: row.value }];
      // Keep a normal cell between the selected label and the caret in an empty field.
      const spans: TextSpan[] = [{ text: label }, { text: ' ', style: editing ? styles.text : undefined }, ...valueSpans];
      content.push(ui.Box({
        key: 'setting-' + row.key, flexShrink: 0,
        children: [spanLine(ui, spans, inner, rowStyle(e.setting === row.key, row.editable))],
      }));
    }
    const host = layout.hostRows ? settings.find(row => row.key === e.setting)?.host : undefined;
    if (host) {
      const pair = [host.current, host.pending].filter(Boolean).join(' · ');
      const values = host.pending && displayWidth(pair) <= inner ? [pair] : [host.current, host.pending];
      const details = [host.reason, ...values.filter(Boolean), host.result].filter(Boolean);
      content.push(...details.slice(0, layout.hostRows).map(value => line(value, styles.muted)));
    }
    const gap = layout.bodyRows - Number(layout.showSummary) - content.length;
    if (gap > 0) content.push(ui.Box({ height: gap, flexShrink: 0, children: [] }));
    if (layout.showSummary) content.push(line(tr("native.ui.client.draw.fields", {value0: settings.length ? window.start + 1 : 0, end: window.end, length: settings.length, page: window.page, pages: window.pages}), styles.muted));
  } else {
    const scope = e.page === 'main' ? 'main' : 'subagent';
    const { category, search, selected } = e.listContext(scope);
    const matches = e.matches(scope), visible = matches.map(result => result.item);
    const current = visible.find(item => item.id === selected);
    const types = e.adding ? e.typeStates(scope) : null;
    const enabled = types ? null : new Set(e.items(scope));
    title = types ? tr('composition.picker') : scope === 'main' ? tr('composition.configured_title')
      : tr('composition.configured_subagents', { state: tr('values.' + (e.draft.display.subagents.enabled ? 'on' : 'off')) });
    const filterLabel = tr('native.ui.client.draw.filter');
    const filterWidth = Math.max(1, inner - displayWidth(filterLabel));
    const filter = view.input?.kind === 'search'
      ? [{ text: filterLabel, style: styles.muted }, ...inputSpans(inputDisplay(filterWidth), filterWidth)]
      : filterLabel + search + '  ';
    content.push(shortcuts(ui, [
      {key: e.shortcuts.hint(e.adding ? 'picker' : 'list', 'category'), label: tr('catalog.categories.' + category), short: category === 'all' ? tr('values.all') : clip(tr('catalog.categories.' + category), 8)},
      {key: e.shortcuts.hint(e.adding ? 'picker' : 'list', 'search'), label: tr('native.ui.client.draw.search')},
    ], inner, filter));
    if (layout.tableHeading) content.push(line(tr("native.ui.client.draw.on_item"), { ...styles.muted, bold: true }));
    const window = pageWindow(visible.map(item => item.id), selected, layout.itemCapacity);
    for (const {item, match} of matches.slice(window.start, window.end)) {
      const type = types?.get(item.id);
      const marker = types ? catalogMarker(type) : enabled?.has(item.id) ? 'x' : ' ';
      const active = selected === item.id;
      content.push(ui.Box({
        key: 'item-' + scope + ':' + item.id, flexShrink: 0,
        children: [spanLine(ui, itemSpans(item, match, search, view.language ?? 'en', inner, active, marker, type?.count), inner, rowStyle(active))],
      }));
    }
    if (!visible.length) content.push(line(catalogEmptyLine(e, language), styles.muted));
    const gap = layout.bodyRows - Number(layout.showDetails) - Number(layout.showSummary) - content.length;
    if (gap > 0) content.push(ui.Box({ height: gap, flexShrink: 0, children: [] }));
    if (layout.showDetails) content.push(line(current ? tr('native.item_detail', {detail: tr('items.' + scope + '.' + (current.type_id ?? current.id) + '.description'), examples: current.examples.join(' · ')}) : tr('native.empty_detail'), styles.muted));
    const filteredSummary = types ? tr('composition.catalog_enabled', {
      enabled: visible.filter(item => types.get(item.id)?.enabled).length, total: visible.length,
    }) : category !== 'all' ? tr('composition.category_counts', e.categoryCounts(scope)) : '';
    if (layout.showSummary) {
      const pages = window.pages > 1 ? ` · ${window.page}/${window.pages}` : '';
      content.push(line(filteredSummary ? filteredSummary + pages : tr('native.ui.client.draw.enabled', {
        page: window.page, pages: window.pages, length: enabled?.size ?? 0,
      }), styles.muted));
    } else if (!notice) notice = filteredSummary;
  }
  if (capacityNotice) title = capacityNotice + ' · ' + title;
  const background = view.previewBackground ?? 'dark';
  const diagnostic = diagnosisOutput(e.diagnosis, language, columns - 5, layout.previewRows);
  const { display } = editorPreviewDraft(e);
  const sample = diagnostic ?? samplePreview(e, display, view.preview, language, { busy: view.previewBusy, error: viewMessage(view, 'previewError') });
  const overflow = !diagnostic && layout.previewRows > 1 && sample.rows.length > layout.previewRows;
  const shown = sample.rows.slice(0, overflow ? layout.previewRows - 1 : layout.previewRows);
  const preview: RenderElement[] = shown.map((row) => previewLine(ui, row, inner, background));
  if (overflow) preview.push(previewText(ui, tr('native.ui.client.draw.more_preview_rows', { value0: sample.rows.length - shown.length }), inner, background));
  if (!sample.rows.length) preview.push(previewText(ui, sample.empty, inner, background));
  while (preview.length < layout.previewRows) preview.push(previewText(ui, '', inner, background));
  const sampleTitle = e.colors ? tr('colors.candidate_preview') : e.review
    ? tr('review.preview', { scope: tr('review.sections.' + e.review.previewScope) })
    : previewTitle(display, columns, view.previewBusy, background, language);
  const previewCaption = diagnostic?.title ?? (e.review ? sampleTitle :
    sampleTitle + ' · ' + tr('preview.scenario.' + e.previewScenario) + ' · ' + previewWidth(inner, e.previewWidth) + 'c');
  const focusHint = hintLine('native.ui.client.draw.click_region_for_keys', language, { escape: 'Esc' });
  const shortFocusHint = { text: tr('native.ui.client.draw.click_body_short') };
  const focusForWidth = (width: number) => displayWidth(focusHint.text) <= width ? focusHint : shortFocusHint;
  const hasNotice = Boolean(notice || capacityNotice);
  // Keep both the notice and the click instruction. On narrow panes the numbered tabs suffice.
  const numberedTabs = hasNotice && tabWidth + 3 + displayWidth(shortFocusHint.text) > columns;
  const tabs = tabSpans(labels, e.page, numberedTabs);
  if (hasNotice) {
    const room = columns - displayWidth(tabs.map(span => span.text).join(''));
    const separator = numberedTabs ? ' ' : ' · ';
    const hint = prependLine(separator, focusForWidth(room - displayWidth(separator)));
    tabs.push(...editorLineSpans(hint, room).map(({ text, bold }) => ({ text, style: bold ? styles.key : styles.muted })));
  }
  return ui.Box({
    width: columns, height: rows, flexDirection: 'column', overflow: 'hidden',
    children: [
      header(editorTitle),
      ...(layout.previewHeight ? [chromeRow(ui, spanLine(ui, tabs, columns), columns)] : []),
      chromeRow(ui, notice ? line(notice, view.error || Object.keys(e.fieldErrors).length ? styles.error : styles.text)
        : line(capacityNotice || focusForWidth(inner), styles.muted), columns),
      section(ui, 'content-region', title, content, columns, layout.bodyHeight, layout.framed),
      ...(layout.previewHeight ? [section(ui, 'preview-region', previewCaption, preview, columns, layout.previewHeight, layout.framed, true)] : []),
      ui.Box({
        key: 'shortcut-region', width: columns, height: layout.footerRows,
        backgroundColor: styles.text.backgroundColor,
        flexDirection: 'column', flexShrink: 0,
        children: layout.footer.map((hints) => shortcuts(ui, hints, columns)),
      }),
    ],
  });
}
