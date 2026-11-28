import { previewWidth } from '@fbincon/statusline-core/editor/preview-settings';
import { editorPreviewDraft, samplePreview } from '@fbincon/statusline-core/editor/preview-view';
import { diagnosisOutput } from '@fbincon/statusline-core/editor/diagnosis-view';
/** External-editor frame composition. Existing drawing exports remain stable. */
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { targetLabel } from '@fbincon/statusline-core/editor/profile-manager';
import { EDITOR_PAGES } from '@fbincon/statusline-core/editor/draft';
import { usesFullEditorBody } from '@fbincon/statusline-core/editor/navigation';
import { wrapText } from '@fbincon/statusline-core/editor/text';
import { renderMessage, t } from '@fbincon/statusline-core/i18n/messages';
import type { State } from './state.js';
import { dimensions, MIN_COLUMNS, MIN_ROWS } from './layout.js';
import { paint, heading } from './theme.js';
import { Canvas, paintLine, type Frame } from './drawing/canvas.js';
import { drawPage } from './drawing/pages.js';
import { contentTitle } from './drawing/presentation.js';
import { footer, notice, shortcuts } from './drawing/shortcuts.js';
import {
    SHORTCUT_PANEL_MIN_COLUMNS, SHORTCUT_PANEL_MIN_ROWS, shortcutPanelFits, shortcutPanelView,
} from '@fbincon/statusline-core/editor/shortcut-settings';

export type { Paint } from './theme.js';
export type { Frame } from './drawing/canvas.js';
export { ansiFrame } from './drawing/canvas.js';
export { shortcuts } from './drawing/shortcuts.js';

function drawTabs(canvas: Canvas, language: State['language'], active: (typeof EDITOR_PAGES)[number], y: number): void {
    const labels = EDITOR_PAGES.map(page => t('ui.drawing.' + page, language));
    const gap = displayWidth(labels.join('  ')) > canvas.columns ? 1 : 2;
    let x = 0;
    for (const [index, page] of EDITOR_PAGES.entries()) {
        const label = labels[index]!;
        canvas.put(y, x, [paint(label, page === active, page === active)]);
        x += displayWidth(label) + gap;
    }
}

export function frame(state: State, columns: number, rows: number): Frame {
    const canvas = new Canvas(columns, rows);
    const e = state.editor;
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, state.language, params);
    const size = dimensions(canvas.columns, canvas.rows);
    const reportPage = usesFullEditorBody(e);
    const panel = reportPage ? size.report : size.content;

    if (state.exitChoice !== null) {
        const choices = ['keep', 'discard'] as const;
        const first = canvas.rows >= 3 ? 1 : 0;
        if (first) canvas.put(0, 0, [heading(tr('ui.exit.unsaved'))]);
        const visible = canvas.rows === 1 ? [state.exitChoice] : choices;
        visible.forEach((choice, index) => {
            const selected = choice === state.exitChoice;
            canvas.line(first + index, (selected ? '› ' : '  ') + tr('ui.exit.' + choice), false, selected);
        });
        if (canvas.rows >= 4) canvas.put(canvas.rows - 1, 0, shortcuts([
            ['↑↓', tr('ui.hints.select')], ['Enter', tr('ui.hints.accept')], ['Esc/Ctrl+G', tr('ui.hints.back')],
        ], canvas.columns));
        return canvas.frame();
    }

    const editorTitle = () => tr('ui.drawing.configure_status_line') + (state.modified ? ' *' : '') + ' · ' + targetLabel(e, state.language);
    if (e.shortcuts.panel && shortcutPanelFits(canvas.columns, canvas.rows)) {
        const view = shortcutPanelView(e.shortcuts, state.language, canvas.columns, canvas.rows);
        canvas.put(0, 0, [heading(view.fullTitle ? editorTitle() : tr('ui.drawing.settings'))]);
        const panel = {
            y: 1, width: canvas.columns, height: canvas.rows - 1 - view.footer.length,
            framed: view.framed, innerY: 2, innerX: (canvas.columns - view.innerWidth) / 2,
            innerWidth: view.innerWidth, innerHeight: view.bodyHeight,
        };
        canvas.panel(panel, tr('shortcuts.title'));
        view.toolbar.forEach((row, index) => canvas.content(panel, index, row.map(({ text, kind }) =>
            kind === 'button' ? heading(text) : paint(text, kind !== 'hint', kind === 'focused'))));
        const drawRow = (row: typeof view.body[number], index: number) => {
            const spans = row.kind === 'group' ? [heading(row.text)] : row.kind === 'columns' ? [paint(row.text, true)]
                : paintLine(row, view.innerWidth, row.selected);
            canvas.content(panel, index, spans, row.selected);
        };
        view.body.forEach((row, index) => drawRow(row, view.toolbar.length + index));
        view.bottom.forEach((row, index) => drawRow(row, view.bottomOffset + index));
        view.footer.forEach((row, index) => canvas.put(canvas.rows - view.footer.length + index, 0, paintLine(row, canvas.columns)));
        return canvas.frame();
    }

    if (!size.available) {
        canvas.put(0, 0, [heading(tr('ui.drawing.configure_status_line'))]);
        const message = tr('ui.drawing.terminal_too_small_need_x_current_x', {
            MIN_TERMINAL_WIDTH: e.shortcuts.panel ? SHORTCUT_PANEL_MIN_COLUMNS : MIN_COLUMNS,
            MIN_TERMINAL_HEIGHT: e.shortcuts.panel ? SHORTCUT_PANEL_MIN_ROWS : MIN_ROWS,
            width: canvas.columns, height: canvas.rows,
        });
        const start = canvas.rows > 3 ? 2 : 0;
        wrapText([message], canvas.columns).slice(0, Math.max(0, canvas.rows - start - 1))
            .forEach((line, offset) => canvas.line(start + offset, line));
        canvas.put(canvas.rows - 1, 0, shortcuts([
            e.saveState === 'unknown' ? ['Ctrl+K', tr('editor.check_saved')] : ['Esc', tr('ui.hints.cancel')],
            ['Ctrl+C', tr('ui.hints.interrupt')],
        ], canvas.columns));
        return canvas.frame();
    }

    if (!reportPage) state.ensureVisible(state.form ? size.formHeight : size.listHeight);
    canvas.put(0, 0, [heading(editorTitle())]);
    const pickerNotice = !state.input && !e.detail && !e.changeReview ? e.picker?.notice : null;
    const description = pickerNotice ? renderMessage(pickerNotice, state.language)
        : e.detail ? tr('ui.drawing.edit_item_format') + state.detailLabel
        : e.adding ? ''
        : tr('ui.drawing.' + (e.page === 'layout' ? 'set_explicit_rows_priorities_and_widths'
            : e.page === 'main' ? 'choose_main_status_line_items_and_their'
                : e.page === 'subagents' ? 'choose_subagent_row_items_and_their_order'
                    : 'adjust_display_and_tool_refresh_settings'));
    const { actions, help, primaryActions } = footer(state);
    const visibleHelp = shortcuts(help, canvas.columns);
    if (!reportPage) {
        const list = !state.form && !state.input && e.inDraftView && e.saveState === 'idle';
        const visibleKeys = visibleHelp.filter(span => span.bold).map(span => span.text);
        const add = e.shortcuts.hint('list', 'add-item');
        const format = e.shortcuts.hint('list', 'item-details');
        const start = list ? shortcuts([
            ...(visibleKeys.includes(e.shortcuts.hint('list', 'add-item', 'copy-item', 'remove-item'))
                ? [] : [[add, tr('ui.hints.catalog')] as const]),
            ...(!e.listContext(state.scope).selected || visibleKeys.includes(format)
                ? [] : [[format, tr('ui.hints.item_format'), tr('ui.hints.format')] as const]),
        ], canvas.columns) : [];
        canvas.put(1, 0, start.length ? start : [paint(description)]);
        drawTabs(canvas, state.language, e.page, 2);
    }
    canvas.put(reportPage ? 1 : 3, 0, notice(state, canvas.columns, visibleHelp));
    canvas.panel(panel, contentTitle(state));
    const summary = drawPage(canvas, state, size, panel);
    const summaryLine = typeof summary === 'string' ? { text: summary } : summary;
    const summaryHints = state.form && !e.diagnosis && !e.packages && !e.taskViewer && !e.profiles && !e.sources && !e.groupManager && !e.alignmentManager && !e.explanation && !e.quick && !e.review && e.guidanceScroll === null
        ? shortcuts([['↑↓', tr('ui.hints.select')]], panel.innerWidth - displayWidth(summaryLine.text + ' · '))
        : [];
    canvas.content(panel, panel.innerHeight - 1, [
        ...paintLine(summaryLine, panel.innerWidth), ...(summaryHints.length ? [paint(' · '), ...summaryHints] : []),
    ]);
    canvas.put(size.actionsY, 0, shortcuts(actions, canvas.columns, primaryActions));
    canvas.put(size.helpY, 0, visibleHelp);
    if (reportPage) return canvas.frame();

    const capacity = size.preview.innerHeight;
    const diagnostic = diagnosisOutput(e.diagnosis, state.language, canvas.columns - (size.preview.framed ? 6 : 4), capacity);
    if (diagnostic) {
        canvas.panel(size.preview, diagnostic.title);
        if (!diagnostic.rows.length) canvas.content(size.preview, 0, [paint(diagnostic.empty)]);
        diagnostic.rows.forEach((row, index) => canvas.content(size.preview, index, row));
        return canvas.frame();
    }

    const { display } = editorPreviewDraft(e);
    const previewTitle = e.colors ? tr('colors.candidate_preview') : e.review
        ? tr('review.preview', { scope: tr('review.sections.' + e.review.previewScope) })
        : tr('ui.drawing.preview_sample_data') + (display.use_colors
            ? tr('ui.drawing.palette') + display.palette : tr('ui.drawing.colors_off'));
    canvas.panel(size.preview, previewTitle + ' · ' + tr('preview.scenario.' + e.previewScenario) + ' · ' + previewWidth(size.preview.innerWidth, e.previewWidth) + 'c');
    const sample = samplePreview(e, display, state.preview, state.language, { error: renderMessage(state.previewError ?? '', state.language) });
    const overflow = sample.rows.length > capacity;
    const count = overflow && capacity > 1 ? capacity - 1 : capacity;
    if (!sample.rows.length) canvas.content(size.preview, 0, [paint(sample.empty)]);
    sample.rows.slice(0, count).forEach((row, index) => canvas.content(size.preview, index, row));
    if (overflow && capacity > 1) {
        const remaining = sample.rows.length - count;
        canvas.content(size.preview, count, [paint(tr(
            remaining === 1 ? 'ui.drawing.more_line' : 'ui.drawing.more_lines', { remaining },
        ))]);
    }
    return canvas.frame();
}
