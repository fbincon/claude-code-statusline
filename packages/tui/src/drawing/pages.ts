/** Page content, using one bounded canvas and shared terminal geometry. */
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { guidanceLines } from '@fbincon/statusline-core/editor/guidance';
import { reviewRows } from '@fbincon/statusline-core/editor/import-review';
import { matchText, segments, snippet } from '@fbincon/statusline-core/editor/search';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { formWindow, type dimensions } from '../layout.js';
import { paint, heading } from '../theme.js';
import type { State } from '../state.js';
import { Canvas, column } from './canvas.js';
import { fieldLabel, fieldValue, groupKey } from './presentation.js';

export function drawPage(canvas: Canvas, state: State, size: ReturnType<typeof dimensions>): string {
    const e = state.editor;
    const panel = size.content;
    const width = panel.innerWidth;
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, state.language, params);

    if (e.review || e.guidanceScroll !== null) {
        const review = e.review;
        const capacity = Math.max(1, panel.innerHeight - 1);
        const values = review ? reviewRows(review, state.language, width)
            : (state.detailItem ? guidanceLines(state.detailItem, state.language, width) : [])
                .map(text => ({ text, heading: false, section: '' }));
        const start = Math.min(review?.scroll ?? e.guidanceScroll ?? 0, Math.max(0, values.length - capacity));
        if (review) {
            review.scroll = start;
        } else {
            e.guidanceScroll = start;
        }
        values.slice(start, start + capacity).forEach((row, index) => {
            const selected = row.heading && row.section === review?.selected;
            canvas.content(panel, index, [row.heading ? heading(row.text, selected) : paint(row.text)], selected);
        });
        return `${start + 1}–${Math.min(values.length, start + capacity)}/${values.length}`;
    }

    if (state.input?.kind === 'category') {
        const input = state.input;
        const values = e.categories(state.scope);
        const capacity = Math.max(1, panel.innerHeight - 1);
        const selected = values.indexOf(input.selected);
        const start = Math.max(0, selected - capacity + 1);
        values.slice(start, start + capacity).forEach((value, index) => {
            const active = value === input.selected;
            canvas.content(panel, index, [paint((active ? '› ' : '  ') + tr('catalog.categories.' + value), false, active)], active);
        });
        return `${selected + 1}/${values.length}`;
    }

    if (state.form) {
        const values = state.rows();
        const window = formWindow(values, values.findIndex(row => row.key === e.setting),
            state.scroll[e.detail ? 'detail' : e.page] ?? 0, size.listHeight);
        const labelWidth = Math.min(44, Math.max(24, Math.floor(width / 2)),
            Math.max(...values.map(row => displayWidth(fieldLabel(row, state)) + 1)));
        canvas.content(panel, 0, [paint('  ' + column(tr('ui.drawing.option').trim(), labelWidth) +
            '  ' + tr('ui.drawing.value').trim(), true)]);
        window.lines.forEach((entry, index) => {
            if (entry.index === undefined) {
                const title = '─ ' + column(tr(groupKey(entry.group)), width - 3).trimEnd() + ' ';
                canvas.content(panel, index + 1, [heading(title + '─'.repeat(Math.max(0, width - displayWidth(title))))]);
                return;
            }
            const row = values[entry.index]!;
            const selected = row.key === e.setting;
            const prefix = (selected ? '› ' : '  ') + column(fieldLabel(row, state) + ':', labelWidth) + '  ';
            const value = fieldValue(row, state);
            const editing = state.input && (state.input.kind === 'field' || state.input.kind === 'path') && state.input.key === row.key;
            const spans = row.kind === 'action' && !editing
                ? [paint(prefix, false, selected), paint('Enter', true, selected), paint(' ' + value, false, selected)]
                : [paint(prefix + value, false, selected)];
            canvas.content(panel, index + 1, spans, selected);
        });
        return tr('ui.drawing.fields', { value0: window.start + 1, end: window.end, value2: values.length });
    }

    const scope = state.scope;
    const values = e.matches(scope);
    const start = state.scroll[scope] ?? 0;
    const itemWidth = Math.min(30, Math.max(18, Math.floor(width / 3)));
    canvas.content(panel, 0, [paint('  ' + column(tr('ui.drawing.on').trim(), 5) +
        column(tr('ui.drawing.item').trim(), itemWidth) + ' ' + tr('ui.drawing.description').trim(), true)]);
    values.slice(start, start + size.listHeight).forEach(({ item, match }, index) => {
        const selected = item.id === e.selected[scope];
        const enabled = e.items(scope).includes(item.id);
        const label = e.adding ? tr(`items.${scope}.${item.id}.label`) : e.instanceLabel(scope, item.id, state.language);
        const description = tr(`items.${scope}.${item.type_id ?? item.id}.description`);
        const query = e.search[scope];
        const labelMatch = query ? matchText(label, query) : null;
        const hint = !!query && (!labelMatch || labelMatch.rank > match.rank);
        const shown = column(label, itemWidth);
        const points = [...shown];
        const positions = labelMatch?.positions.filter(position => points[position] === [...label][position]) ?? [];
        const styled = (value: string, marked: readonly number[]) => segments(value, [...marked])
            .map(span => paint(span.text, span.highlighted, selected));
        const detail = hint ? snippet(match) : query ? matchText(description, query) : null;
        const prefix = hint ? tr('catalog.search.match') : '';
        canvas.content(panel, index + 1, [
            paint((selected ? '› ' : '  ') + (enabled ? '[x]  ' : '[ ]  '), false, selected),
            ...styled(shown, positions),
            paint(' ' + prefix, false, selected),
            ...styled(hint ? detail!.text : description, detail?.positions ?? []),
        ], selected);
    });
    if (!values.length) {
        canvas.content(panel, 1, [paint(tr('ui.drawing.no_matching_items'))]);
    }
    return tr('ui.drawing.items_enabled', {
        value0: values.length ? start + 1 : 0,
        value1: Math.min(values.length, start + size.listHeight),
        value2: values.length,
        value3: e.items(scope).length,
    });
}
