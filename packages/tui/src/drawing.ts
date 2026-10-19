/** External-editor frame composition. Existing drawing exports remain stable. */
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { wrapText } from '@fbincon/statusline-core/editor/text';
import { t } from '@fbincon/statusline-core/i18n/messages';
import type { State } from './state.js';
import { dimensions } from './layout.js';
import { paint, heading } from './theme.js';
import { Canvas, type Frame } from './drawing/canvas.js';
import { drawPage } from './drawing/pages.js';
import { contentTitle } from './drawing/presentation.js';
import { footer, notice, shortcuts } from './drawing/shortcuts.js';

export type { Paint } from './theme.js';
export type { Frame } from './drawing/canvas.js';
export { ansiFrame } from './drawing/canvas.js';
export { shortcuts } from './drawing/shortcuts.js';

export function frame(state: State, columns: number, rows: number): Frame {
    const canvas = new Canvas(columns, rows);
    const e = state.editor;
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, state.language, params);
    const size = dimensions(canvas.columns, canvas.rows);

    if (!size.available) {
        canvas.put(0, 0, [heading(tr('ui.drawing.configure_status_line'))]);
        const message = tr('ui.drawing.terminal_too_small_need_x_current_x', {
            MIN_TERMINAL_WIDTH: 64, MIN_TERMINAL_HEIGHT: 18, width: canvas.columns, height: canvas.rows,
        });
        const start = canvas.rows > 3 ? 2 : 0;
        wrapText([message], canvas.columns).slice(0, Math.max(0, canvas.rows - start - 1))
            .forEach((line, offset) => canvas.line(start + offset, line));
        canvas.put(canvas.rows - 1, 0, shortcuts([
            ['Esc', tr('ui.hints.cancel')], ['Ctrl+C', tr('ui.hints.interrupt')],
        ], canvas.columns));
        return canvas.frame();
    }

    state.ensureVisible(size.listHeight);
    canvas.put(0, 0, [heading(tr('ui.drawing.configure_status_line') + (state.modified ? ' *' : ''))]);
    const description = e.detail
        ? tr('ui.drawing.edit_item_format') + state.detailLabel
        : tr('ui.drawing.' + (e.page === 'layout' ? 'set_explicit_rows_priorities_and_widths'
            : e.page === 'main' ? 'choose_main_status_line_items_and_their'
                : e.page === 'subagents' ? 'choose_subagent_row_items_and_their_order'
                    : 'adjust_display_and_tool_refresh_settings'));
    canvas.line(1, description);
    let tabX = 0;
    for (const page of ['main', 'subagents', 'settings', 'layout']) {
        const label = tr('ui.drawing.' + page);
        canvas.put(2, tabX, [paint(label, page === e.page, page === e.page)]);
        tabX += displayWidth(label) + 2;
    }
    canvas.put(3, 0, notice(state, canvas.columns));
    canvas.panel(size.content, contentTitle(state));
    const summary = drawPage(canvas, state, size);
    const summaryHints = state.form && !e.explanation && !e.quick && !e.review && e.guidanceScroll === null
        ? shortcuts([['↑↓', tr('ui.hints.select')]], size.content.innerWidth - displayWidth(summary + ' · '))
        : [];
    canvas.content(size.content, size.content.innerHeight - 1, [
        paint(summary + (summaryHints.length ? ' · ' : '')), ...summaryHints,
    ]);

    const draft = e.quick?.candidate ?? e.review?.result.draft ?? e.draft;
    const previewTitle = e.review
        ? tr('review.preview', { scope: tr('review.sections.' + e.review.previewScope) })
        : tr('ui.drawing.preview_sample_data') + (draft.display.use_colors
            ? tr('ui.drawing.palette') + draft.display.palette : tr('ui.drawing.colors_off'));
    canvas.panel(size.preview, previewTitle);
    const subagents = e.quick ? e.quick.previewScope === 'subagent' : e.review ? e.review.previewScope === 'subagent' : e.page === 'subagents';
    const sample = state.preview ? subagents ? state.preview.subagents : state.preview.main : [];
    const capacity = size.preview.innerHeight;
    const overflow = sample.length > capacity;
    const count = overflow && capacity > 1 ? capacity - 1 : capacity;
    for (let index = 0; index < count; index++) {
        canvas.content(size.preview, index, sample[index] ?? [paint(
            index === 0 && !sample.length ? tr('ui.drawing.no_enabled_items') : '',
        )]);
    }
    if (overflow && capacity > 1) {
        const remaining = sample.length - count;
        canvas.content(size.preview, count, [paint(tr(
            remaining === 1 ? 'ui.drawing.more_line' : 'ui.drawing.more_lines', { remaining },
        ))]);
    }
    const { actions, help } = footer(state);
    canvas.put(size.actionsY, 0, shortcuts(actions, canvas.columns));
    canvas.put(size.helpY, 0, shortcuts(help, canvas.columns));
    return canvas.frame();
}
