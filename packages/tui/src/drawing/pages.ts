import { changesView } from '@fbincon/statusline-core/editor/change-review';
import { reuseView } from '@fbincon/statusline-core/editor/reuse-manager';
import { packageNotice, packageView } from '@fbincon/statusline-core/editor/package-view';
import { diagnosisPage } from '@fbincon/statusline-core/editor/diagnosis-view';
import { colorsView } from '@fbincon/statusline-core/editor/color-manager';
import { alignmentsView } from '@fbincon/statusline-core/editor/alignment-manager';
import { groupsView } from '@fbincon/statusline-core/editor/group-manager';
import { prependLine, sectionDivider, type EditorLine } from '@fbincon/statusline-core/editor/hints';
import { sourcesView } from '@fbincon/statusline-core/editor/source-manager';
import { profilesView } from '@fbincon/statusline-core/editor/profile-manager';
import { quickView } from '@fbincon/statusline-core/editor/quick-setup';
/** Page content, using one bounded canvas and shared terminal geometry. */
import { clip, displayWidth } from '@fbincon/statusline-core/unicode/index';
import { catalogMarker } from '@fbincon/statusline-core/editor/instances';
import { catalogEmptyLine } from '@fbincon/statusline-core/editor/navigation';
import { reviewRows } from '@fbincon/statusline-core/editor/import-review';
import { matchText, segments, snippet } from '@fbincon/statusline-core/editor/search';
import { renderMessage, t } from '@fbincon/statusline-core/i18n/messages';
import { formWindow, type dimensions, type Panel } from '../layout.js';
import { externalTaskRows, packageRefreshError, packageRefreshInterval } from '../report-refresh.js';
import { paint, heading } from '../theme.js';
import type { State } from '../state.js';
import { Canvas, column, paintLine } from './canvas.js';
import { fieldLabel, fieldValue, groupKey, itemExample, taskReportStatus } from './presentation.js';

export function drawPage(canvas: Canvas, state: State, size: ReturnType<typeof dimensions>, panel: Panel): string | EditorLine {
    const e = state.editor;
    const width = panel.innerWidth;
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, state.language, params);
    const drawRow = (row: EditorLine & { selected?: boolean }, index: number) =>
        canvas.content(panel, index, paintLine(row, width, row.selected), row.selected);
    const drawItemDetail = () => {
        const page = state.itemDetailPage(width, panel.innerHeight - 1);
        page.rows.forEach(({ kind, text }, index) => {
            canvas.content(panel, index, [kind === 'heading' ? heading(text) : paint(text)]);
        });
        return page.summary;
    };
    if (e.changeReview || e.reuse) {
        (e.changeReview ? changesView(e, state.language, width, panel.innerHeight - 1) : reuseView(e, state.language, width, panel.innerHeight - 1)).forEach(drawRow);
        return '';
    }
    if (e.packages) {
        packageView(e.packages, state.language, width, panel.innerHeight - 1, e.shortcuts, true).forEach((row, index) => {
            if (row.heading) canvas.content(panel, index, [heading(row.text)]);
            else drawRow(row, index);
        });
        const error = packageRefreshError(e.packages);
        if (error) return renderMessage(error, state.language);
        if (e.packages.message) return packageNotice(e.packages, state.language, e.shortcuts, true);
        return packageRefreshInterval(e.packages) === null ? '' : tr('ui.refresh.auto');
    }
    if (e.taskViewer) {
        externalTaskRows(e.taskViewer, width, panel.innerHeight - 1).forEach((row, index) => {
            if (row.heading) canvas.content(panel, index, [heading(row.text, row.selected)], row.selected);
            else drawRow(row, index);
        });
        return taskReportStatus(e.taskViewer);
    }
    if (e.diagnosis) {
        const page = diagnosisPage(e, state.language, width, panel.innerHeight - 1);
        page.lines.forEach((row, index) => {
            if (row.kind === 'heading') canvas.content(panel, index, [heading(row.text)]);
            else drawRow(row, index);
        });
        return page.summary;
    }
    if (e.colors) {
        colorsView(e, state.language, width, panel.innerHeight - 1).forEach((row, index) => {
            if ('spans' in row) {
                const spans = row.spans.map(span => ({ ...span, reverse: row.selected && span.foreground === null }));
                canvas.content(panel, index, spans, row.selected);
            } else drawRow(row, index);
        });
        return '';
    }
    if (e.alignmentManager) {
        alignmentsView(e, state.language, width, panel.innerHeight - 1).forEach(drawRow);
        return '';
    }
    if (e.groupManager) {
        groupsView(e, state.language, width, panel.innerHeight - 1).forEach(drawRow);
        return '';
    }
    if (e.sources) {
        sourcesView(e, state.language, width, panel.innerHeight - 1).forEach((row, index) => {
            if (row.heading) canvas.content(panel, index, [heading(row.text)]);
            else drawRow(row, index);
        });
        return '';
    }
    if (e.profiles) {
        profilesView(e, state.language, width, panel.innerHeight - 1).forEach(drawRow);
        return panel === size.content ? tr('profiles.sample') : '';
    }

    if (e.explanation) return drawItemDetail();
    if (e.quick) {
        quickView(e.quick, state.language, width, panel.innerHeight - 1, e.baseline.configuration?.shared_projects).forEach(drawRow);
        return tr('quick.steps');
    }
    if (e.review) {
        const review = e.review;
        const capacity = Math.max(1, panel.innerHeight - 1);
        const values = reviewRows(review, state.language, width);
        const start = Math.min(review.scroll, Math.max(0, values.length - capacity));
        review.scroll = start;
        values.slice(start, start + capacity).forEach((row, index) => {
            const selected = row.heading && row.section === review.selected;
            canvas.content(panel, index, [row.heading ? heading(row.text, selected) : paint(row.text)], selected);
        });
        return `${start + 1}–${Math.min(values.length, start + capacity)}/${values.length}`;
    }
    if (e.guidanceScroll !== null) return drawItemDetail();

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
            state.scroll[e.detail ? 'detail' : e.page] ?? 0, size.formHeight);
        const labelWidth = Math.min(44, Math.max(24, Math.floor(width / 2)),
            Math.max(...values.map(row => displayWidth(fieldLabel(row, state)) + 1)));
        canvas.content(panel, 0, [paint('  ' + column(tr('ui.drawing.option').trim(), labelWidth) +
            '  ' + tr('ui.drawing.value').trim(), true)]);
        window.lines.forEach((entry, index) => {
            if (entry.index === undefined) {
                canvas.content(panel, index + 1, [heading(sectionDivider(tr(groupKey(entry.group)), width))]);
                return;
            }
            const row = values[entry.index]!;
            const selected = row.key === e.setting;
            const prefix = (selected ? '› ' : '  ') + column(fieldLabel(row, state) + ':', labelWidth) + '  ';
            const isInput = state.input && (state.input.kind === 'numeric' ? state.input.field === row.key : (state.input.kind === 'field' || state.input.kind === 'path') && state.input.key === row.key);
            if (isInput) {
                const value = state.inputDisplay(width - displayWidth(prefix));
                drawRow({ ...prependLine(prefix, value), selected }, index + 1);
                return;
            }
            const value = fieldValue(row, state);
            const spans = row.kind === 'action'
                ? [paint(prefix, false, selected), paint('Enter', true, selected), paint(' ' + value, false, selected)]
                : [paint(prefix + value, false, selected)];
            canvas.content(panel, index + 1, spans, selected);
        });
        return tr('ui.drawing.fields', { value0: window.start + 1, end: window.end, value2: values.length });
    }

    const scope = state.scope;
    const { category, search: query, selected: selectedId } = e.listContext(scope);
    const values = e.matches(scope);
    const types = e.adding ? e.typeStates(scope) : null;
    const enabled = types ? null : new Set(e.items(scope));
    const start = state.scroll[state.listScrollKey] ?? 0;
    const end = Math.min(values.length, start + size.listHeight);
    const itemWidth = Math.min(30, Math.max(18, Math.floor(width / 3)));
    canvas.content(panel, 0, [paint('  ' + column(tr('ui.drawing.on').trim(), 5) +
        column(tr('ui.drawing.item').trim(), itemWidth) + ' ' + tr('ui.drawing.description').trim(), true)]);
    values.slice(start, end).forEach(({ item, match }, index) => {
        const selected = item.id === selectedId;
        const type = types?.get(item.id);
        const marker = types ? catalogMarker(type) : enabled?.has(item.id) ? 'x' : ' ';
        const label = types ? tr(`items.${scope}.${item.id}.label`) : e.instanceLabel(scope, item.id, state.language);
        const suffix = type && type.count > 1 ? ` (${type.count})` : '';
        const shown = column(clip(label, itemWidth - displayWidth(suffix)) + suffix, itemWidth);
        const description = tr(`items.${scope}.${item.type_id ?? item.id}.description`);
        const labelMatch = query ? matchText(label, query) : null;
        const hint = !!query && (!labelMatch || labelMatch.rank > match.rank);
        const points = [...shown];
        const positions = labelMatch?.positions.filter(position => points[position] === [...label][position]) ?? [];
        const styled = (value: string, marked: readonly number[]) => segments(value, [...marked])
            .map(span => paint(span.text, span.highlighted, selected));
        const detail = hint ? snippet(match) : query ? matchText(description, query) : null;
        const prefix = hint ? tr('catalog.search.match') : '';
        canvas.content(panel, index + 1, [
            paint((selected ? '› ' : '  ') + `[${marker}]  `, false, selected),
            ...styled(shown, positions),
            paint(' ' + prefix, false, selected),
            ...styled(hint ? detail!.text : description, detail?.positions ?? []),
        ], selected);
    });
    if (!values.length) drawRow(catalogEmptyLine(e, state.language), 1);
    const current = values.find(({ item }) => item.id === selectedId)?.item;
    if (current) canvas.content(panel, size.listHeight + 1, [paint(itemExample(current, state.language))]);
    const range = values.length > size.listHeight ? ` · ${start + 1}–${end}/${values.length}` : '';
    if (types) return tr('composition.catalog_enabled', {
        enabled: values.filter(({ item }) => types.get(item.id)?.enabled).length, total: values.length,
    }) + range;
    if (category !== 'all') return tr('composition.category_counts', e.categoryCounts(scope)) + range;
    return tr('ui.drawing.items_enabled', {
        value0: values.length ? start + 1 : 0,
        value1: end,
        value2: values.length,
        value3: enabled!.size,
    });
}
