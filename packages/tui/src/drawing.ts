import { clip, displayWidth, clusterWidth } from '@fbincon/statusline-core/unicode/index';
import { clipSpans, clusterSpans } from '@fbincon/statusline-core/terminal/spans';
import { terminalColor } from '@fbincon/statusline-core/rendering/colors';
import { fieldMessage } from '@fbincon/statusline-core/editor/forms';
import { guidanceLines } from '@fbincon/statusline-core/editor/guidance';
import { reviewRows } from '@fbincon/statusline-core/editor/import-review';
import { matchText, segments, snippet } from '@fbincon/statusline-core/editor/search';
import { t, renderMessage, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/messages';
import type { Span } from '@fbincon/statusline-core/contracts/ui';
import type { State, Row } from './state.js';
import { dimensions, formWindow, type Panel } from './layout.js';
import { paint, heading, type Paint } from './theme.js';
export type { Paint } from './theme.js';
export interface Frame {
    columns: number;
    rows: Paint[][];
}
const safe = (text: string) => text.replace(/[\p{Cc}\p{Cs}]/gu, ' ');
const groupKey = (group: string) => 'groups.' + group.toLowerCase().replaceAll(' / ', '.').replaceAll(' ', '-');
const col = (text: string, width: number) => {
    text = safe(text);
    if (displayWidth(text) > width) text = width > 0 ? clip(text, width - 1) + '…' : '';
    return text + ' '.repeat(Math.max(0, width - displayWidth(text)));
};
/** Fit whole bindings; a key and its action never get split between rows. */
export function shortcuts(hints: readonly [
    string,
    string
][], width: number): Paint[] {
    const spans: Paint[] = [];
    let used = 0;
    for (const [key, label] of hints) {
        const sep = spans.length ? ' · ' : '', size = displayWidth(sep + key + ' ' + label);
        if (used + size > width)
            break;
        if (sep)
            spans.push(paint(sep));
        spans.push(paint(key, true), paint(' ' + label));
        used += size;
    }
    return spans;
}
export function frame(state: State, columns: number, rows: number): Frame {
    columns = Math.max(1, Math.min(500, Math.trunc(columns)));
    rows = Math.max(1, Math.min(200, Math.trunc(rows)));
    const cells: (Paint | null)[][] = Array.from({ length: rows }, () => Array.from({ length: columns }, () => paint(' '))), e = state.editor;
    const result = (): Frame => ({ columns, rows: cells.map(row => {
            const spans: Paint[] = [];
            for (const cell of row)
                if (cell) {
                    const last = spans.at(-1);
                    if (last && last.bold === cell.bold && last.reverse === cell.reverse && last.foreground === cell.foreground && last.background === cell.background)
                        last.text += cell.text;
                    else
                        spans.push({ ...cell });
                }
            return spans;
        }) });
    const tr = (key: string, params: Record<string, unknown> = {}, fallback?: string) => t(key, state.language, params, fallback);
    const put = (y: number, x: number, spans: readonly Paint[], width = columns - x) => {
        if (y < 0 || y >= rows || x < 0 || x >= columns)
            return;
        for (const span of clusterSpans(clipSpans(spans, Math.min(width, columns - x)))) {
            const size = clusterWidth(span.text);
            if (!size)
                continue;
            cells[y]![x] = span;
            for (let offset = 1; offset < size; offset++)
                cells[y]![x + offset] = null;
            x += size;
        }
    };
    const line = (y: number, text: string, bold = false, reverse = false, x = 0, width = columns - x) => put(y, x, [paint(text, bold, reverse)], width);
    const size = dimensions(columns, rows);
    if (!size.available) {
        line(0, tr('ui.drawing.terminal_too_small_need_x_current_x', { MIN_TERMINAL_WIDTH: 64, MIN_TERMINAL_HEIGHT: 18, width: columns, height: rows }));
        put(Math.min(rows - 1, 2), 0, shortcuts([['Esc', tr('ui.hints.cancel')], ['Ctrl+C', tr('ui.hints.interrupt')]], columns));
        return result();
    }
    state.ensureVisible(size.listHeight);
    put(0, 0, [heading(tr('ui.drawing.configure_status_line') + (e.modified ? ' *' : ''))]);
    line(1, e.detail ? tr('ui.drawing.edit_item_format') + e.instanceLabel(e.detail.scope, e.detail.id, state.language) : tr(e.page === 'layout' ? 'ui.drawing.set_explicit_rows_priorities_and_widths' : e.page === 'main' ? 'ui.drawing.choose_main_status_line_items_and_their' : e.page === 'subagents' ? 'ui.drawing.choose_subagent_row_items_and_their_order' : 'ui.drawing.adjust_display_and_tool_refresh_settings'));
    let tabX = 0;
    for (const page of ['main', 'subagents', 'settings', 'layout']) {
        const label = tr('ui.drawing.' + page);
        put(2, tabX, [paint(label, page === e.page, page === e.page)]);
        tabX += displayWidth(label) + 2;
    }
    const notice = renderMessage(state.localized.message ?? state.message, state.language) || (e.review ? tr('review.intro') : state.form ? tr(e.detail ? 'ui.drawing.item_format_ctrl_g_back' : e.page === 'layout' ? 'ui.drawing.explicit_rows_priority_width' : 'ui.drawing.use_arrows_to_change_values_enter_edits') : `Ctrl+F ${tr('catalog.categories.' + e.category[state.scope])} · / ${tr('ui.drawing.type_to_search')}${e.search[state.scope]}${state.input?.kind === 'search' ? ' _' : ''}`);
    line(3, notice);
    const panel = (p: Panel, title: string) => {
        line(p.y, p.framed ? '┌' + '─'.repeat(p.width - 2) + '┐' : '─'.repeat(p.width));
        put(p.y, p.framed ? 2 : 1, [heading(' ' + col(title, Math.max(0, p.width - (p.framed ? 6 : 4))).trimEnd() + ' ')], p.width - (p.framed ? 4 : 2));
        if (p.framed) {
            for (let y = p.y + 1; y < p.y + p.height - 1; y++) {
                line(y, '│');
                line(y, '│', false, false, columns - 1);
            }
            line(p.y + p.height - 1, '└' + '─'.repeat(p.width - 2) + '┘');
        }
    };
    const p = size.content;
    const title = e.review ? tr('review.title') : e.guidanceScroll !== null ? tr('guidance.title') : state.input?.kind === 'category' ? tr('catalog.search.categories') : e.adding ? tr('composition.picker') : e.detail ? tr('ui.drawing.item_format_2') + e.instanceLabel(e.detail.scope, e.detail.id, state.language) : tr(e.page === 'layout' ? 'ui.drawing.layout_rows_and_fitting' : e.page === 'settings' ? 'ui.drawing.settings_global_options' : e.page === 'subagents' ? 'ui.drawing.subagent_items' : 'ui.drawing.main_items');
    panel(p, title);
    const contentSpans = (offset: number, spans: readonly Paint[], selected = false) => {
        if (selected) line(p.innerY + offset, ' '.repeat(p.innerWidth), false, true, p.innerX, p.innerWidth);
        put(p.innerY + offset, p.innerX, spans, p.innerWidth);
    };
    const content = (offset: number, text: string, bold = false, selected = false) => contentSpans(offset, [paint(text, bold, selected)], selected);
    let summary = '';
    if (e.review || e.guidanceScroll !== null) {
        const review = e.review, capacity = Math.max(1, p.innerHeight - 1);
        const values = review ? reviewRows(review, state.language, p.innerWidth) : guidanceLines(e.definition(e.detail!.scope, e.detail!.id)!, state.language, p.innerWidth).map(text => ({ text, heading: false, section: '' }));
        const start = Math.min(review?.scroll ?? e.guidanceScroll ?? 0, Math.max(0, values.length - capacity));
        if (review)
            review.scroll = start;
        else
            e.guidanceScroll = start;
        values.slice(start, start + capacity).forEach((row, i) => {
            const selected = row.heading && row.section === review?.selected;
            contentSpans(i, [row.heading ? heading(row.text, selected) : paint(row.text)], selected);
        });
        summary = `${start + 1}–${Math.min(values.length, start + capacity)}/${values.length}`;
    }
    else if (state.input?.kind === 'category') {
        const input = state.input, values = e.categories(state.scope), capacity = p.innerHeight - 1, index = values.indexOf(input.selected), start = Math.max(0, index - capacity + 1);
        values.slice(start, start + capacity).forEach((value, i) => content(i, (value === input.selected ? '› ' : '  ') + tr('catalog.categories.' + value), false, value === input.selected));
        summary = `${index + 1}/${values.length}`;
    }
    else if (state.form) {
        const values = state.rows(), window = formWindow(values, values.findIndex(r => r.key === e.setting), state.scroll[e.detail ? 'detail' : e.page] ?? 0, size.listHeight);
        const label = (row: Row) => {
            const key = row.key === 'custom-subagent-rows' ? 'settings-subagent-statusline' : row.key === 'layout-mode' ? 'layout.mode' : row.key;
            const message = fieldMessage({ ...row, key }, state);
            return t(message.key, state.language, message.params, row.label);
        };
        const labelWidth = Math.min(44, Math.max(24, Math.floor(p.innerWidth / 2)), Math.max(...values.map(row => displayWidth(label(row)) + 1)));
        content(0, '  ' + col(tr('ui.drawing.option').trim(), labelWidth) + '  ' + tr('ui.drawing.value').trim(), true);
        window.lines.forEach((entry, i) => {
            if (entry.index === undefined) {
                const label = '─ ' + col(tr(groupKey(entry.group), {}, entry.group), p.innerWidth - 3).trimEnd() + ' ';
                contentSpans(i + 1, [heading(label), paint('─'.repeat(Math.max(0, p.innerWidth - displayWidth(label))))]);
            }
            else {
                const row = values[entry.index]!;
                let value = row.value;
                if (row.key === 'field:statusline_language')
                    value = LANGUAGE_NAMES[e.draft.display.statusline_language];
                else if (row.key === 'preset-select')
                    value = tr('presets.' + value);
                else if (row.kind === 'action')
                    value = tr('native.actions.' + row.key, {}, value);
                else if (!row.key.endsWith(':text') && !row.key.endsWith(':label') && !row.key.endsWith(':icon') && !row.key.endsWith('base_ref'))
                    value = tr('values.' + value, {}, value);
                const input = state.input;
                if (input && (input.kind === 'field' || input.kind === 'path') && input.key === row.key)
                    value = input.buffer + ' _';
                if (input?.kind === 'numeric' && input.field === row.key)
                    value = input.buffer + ' _';
                const prefix = (row.key === e.setting ? '› ' : '  ') + col(label(row) + ':', labelWidth) + '  ';
                if (row.kind === 'action')
                    contentSpans(i + 1, [paint(prefix, false, row.key === e.setting), paint('Enter', true, row.key === e.setting), paint(' ' + value, false, row.key === e.setting)], row.key === e.setting);
                else
                    content(i + 1, prefix + value, false, row.key === e.setting);
            }
        });
        summary = tr('ui.drawing.fields', { value0: window.start + 1, end: window.end, value2: values.length });
    }
    else {
        const scope = state.scope, values = e.matches(scope), start = state.scroll[scope] ?? 0;
        const itemWidth = Math.min(30, Math.max(18, Math.floor(p.innerWidth / 3)));
        content(0, '  ' + col(tr('ui.drawing.on').trim(), 5) + col(tr('ui.drawing.item').trim(), itemWidth) + ' ' + tr('ui.drawing.description').trim(), true);
        values.slice(start, start + size.listHeight).forEach(({ item, match }, i) => {
            const selected = item.id === e.selected[scope], enabled = e.items(scope).includes(item.id);
            const label = e.adding ? tr(`items.${scope}.${item.id}.label`, {}, item.label) : e.instanceLabel(scope, item.id, state.language);
            const description = tr(`items.${scope}.${item.type_id ?? item.id}.description`, {}, item.description);
            const query = e.search[scope], labelMatch = query ? matchText(label, query) : null;
            const hint = !!query && (!labelMatch || labelMatch.rank > match.rank), shown = col(label, itemWidth);
            const points = [...shown], positions = labelMatch?.positions.filter(index => points[index] === [...label][index]) ?? [];
            const styled = (value: string, marked: number[]) => segments(value, marked).map(span => paint(span.text, span.highlighted, selected));
            const matchHint = snippet(match);
            contentSpans(i + 1, [paint((selected ? '› ' : '  ') + (enabled ? '[x]  ' : '[ ]  '), false, selected), ...styled(shown, positions), paint(' ', false, selected), ...(hint ? styled(matchHint.text, matchHint.positions) : [paint(description, false, selected)])], selected);
        });
        if (!values.length)
            content(1, tr('ui.drawing.no_matching_items'));
        summary = tr('ui.drawing.items_enabled', { value0: values.length ? start + 1 : 0, value1: Math.min(values.length, start + size.listHeight), value2: values.length, value3: e.items(scope).length });
    }
    content(p.innerHeight - 1, summary);
    const draft = e.review?.result.draft ?? e.draft;
    panel(size.preview, e.review ? tr('review.preview', { scope: tr('review.sections.' + e.review.previewScope) }) : tr('ui.drawing.preview_sample_data') + (draft.display.use_colors ? tr('ui.drawing.palette') + draft.display.palette : tr('ui.drawing.colors_off')));
    const sample = state.preview ? (e.review ? e.review.previewScope === 'subagent' : e.page === 'subagents') ? state.preview.subagents : state.preview.main : [];
    const capacity = size.preview.innerHeight, overflow = sample.length > capacity, count = overflow && capacity > 1 ? capacity - 1 : capacity;
    for (let i = 0; i < count; i++)
        put(size.preview.innerY + i, size.preview.innerX, sample[i] ?? [paint(i === 0 && !sample.length ? tr('ui.drawing.no_enabled_items') : '')], size.preview.innerWidth);
    if (overflow && capacity > 1)
        line(size.preview.innerY + count, tr('ui.drawing.more_line', { remaining: sample.length - count }), false, false, size.preview.innerX, size.preview.innerWidth);
    let actions: [
        string,
        string
    ][] = [['Ctrl+S', 'save'], ['Esc', 'cancel'], ['Ctrl+C', 'interrupt']];
    let help: [
        string,
        string
    ][] = [['Tab', 'page'], ['↑↓', 'select'], ['←→', state.form ? 'adjust' : 'order'], ['Enter', state.form ? 'edit_save' : 'save']];
    if (!state.form)
        help = [['Tab', 'page'], ['Space', 'toggle'], ['Ctrl+E', 'format'], ['↑↓', 'select'], ['←→', 'order'], ['Ctrl+A/D/X', 'add_copy_remove']];
    if (e.review) {
        actions = [['A', 'accept_draft'], ['Esc/Ctrl+G', 'cancel_review']];
        help = [['Enter', 'details'], ['↑↓', 'section'], ['PgUp/PgDn', 'scroll'], ['Tab', 'preview']];
    }
    else if (e.guidanceScroll !== null) {
        actions = [['Ctrl+G/Esc', 'back']];
        help = [['↑↓', 'scroll'], ['PgUp/PgDn', 'page'], ['Home/End', 'scroll']];
    }
    else if (state.input) {
        actions = [['Enter', 'accept'], ['Ctrl+G/Esc', 'restore']];
        help = [['Ctrl+U', 'clear'], ['Backspace', 'delete']];
    }
    else if (e.adding) {
        actions = [['Enter', 'accept'], ['Ctrl+G/Esc', 'back']];
        help = [['↑↓', 'select'], ['/', 'search'], ['Ctrl+F', 'category']];
    }
    put(size.actionsY, 0, shortcuts(actions.map(([key, hint]) => [key, tr('ui.hints.' + hint)]), columns));
    put(size.helpY, 0, shortcuts(help.map(([key, hint]) => [key, tr('ui.hints.' + hint)]), columns));
    return result();
}
export function ansiFrame(value: Frame, colors = 256): string {
    const color = (value: Span['foreground'], background: boolean): string => {
        if (!value || colors < 8)
            return '';
        const index = terminalColor(value.kind === 'rgb' && typeof value.value === 'string' ? ['rgb', value.value] : value.kind === 'ansi' && typeof value.value === 'number' ? ['ansi', value.value] : null, colors);
        if (index === null)
            return '';
        return colors >= 256 ? `\x1b[${background ? 48 : 38};5;${index}m` : `\x1b[${(background ? 40 : 30) + index % 8 + (index >= 8 ? 60 : 0)}m`;
    };
    let output = '\x1b[H';
    for (let y = 0; y < value.rows.length; y++) {
        output += `\x1b[${y + 1};1H\x1b[0m\x1b[2K`;
        for (const span of value.rows[y]!)
            output += '\x1b[0m' + (span.bold ? '\x1b[1m' : '') + (span.reverse ? '\x1b[7m' : '') + color(span.foreground, false) + color(span.background, true) + safe(span.text);
    }
    return output + '\x1b[0m';
}
