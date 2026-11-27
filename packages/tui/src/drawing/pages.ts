import { changesView } from '@fbincon/statusline-core/editor/change-review';
import { reuseView } from '@fbincon/statusline-core/editor/reuse-manager';
import { packageView } from '@fbincon/statusline-core/editor/package-manager';
import { diagnosisPage } from '@fbincon/statusline-core/editor/diagnosis-view';
import { colorsView } from '@fbincon/statusline-core/editor/color-manager';
import { alignmentsView } from '@fbincon/statusline-core/editor/alignment-manager';
import { groupsView } from '@fbincon/statusline-core/editor/group-manager';
import { sourcesView } from '@fbincon/statusline-core/editor/source-manager';
import { explanationLines } from '@fbincon/statusline-core/editor/explanation';
import { profilesView } from '@fbincon/statusline-core/editor/profile-manager';
import { quickView } from '@fbincon/statusline-core/editor/quick-setup';
/** Page content, using one bounded canvas and shared terminal geometry. */
import { clip, displayWidth } from '@fbincon/statusline-core/unicode/index';
import { catalogMarker } from '@fbincon/statusline-core/editor/instances';
import { guidanceLines } from '@fbincon/statusline-core/editor/guidance';
import { reviewRows } from '@fbincon/statusline-core/editor/import-review';
import { matchText, segments, snippet } from '@fbincon/statusline-core/editor/search';
import { renderMessage, t } from '@fbincon/statusline-core/i18n/messages';
import { formWindow, type dimensions, type Panel } from '../layout.js';
import { externalTaskRows, packageRefreshError, packageRefreshInterval } from '../report-refresh.js';
import { paint, heading } from '../theme.js';
import type { State } from '../state.js';
import { Canvas, column } from './canvas.js';
import { fieldLabel, fieldValue, groupKey, taskReportStatus } from './presentation.js';

export function drawPage(canvas: Canvas, state: State, size: ReturnType<typeof dimensions>, panel: Panel): string {
    const e = state.editor;
    const width = panel.innerWidth;
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, state.language, params);
    if(e.changeReview||e.reuse){(e.changeReview?changesView(e,state.language,width,panel.innerHeight-1):reuseView(e,state.language,width,panel.innerHeight-1)).forEach((row,index)=>canvas.content(panel,index,[paint(row.text,false,row.selected)],row.selected));return ''; }
    if (e.packages) {
        packageView(e.packages, state.language, width, panel.innerHeight - 1, e.shortcuts, true)
            .forEach((row, index) => canvas.content(panel, index, [paint(row.text, false, row.selected)], row.selected));
        const error = packageRefreshError(e.packages);
        if (error) return renderMessage(error, state.language);
        return packageRefreshInterval(e.packages) === null ? '' : tr('ui.refresh.auto');
    }
    if (e.taskViewer) {
        externalTaskRows(e.taskViewer, width, panel.innerHeight - 1)
            .forEach((row, index) => canvas.content(panel, index, [paint(row.text, false, row.selected)], row.selected));
        return taskReportStatus(e.taskViewer);
    }
    if (e.diagnosis) {
        const page = diagnosisPage(e, state.language, width, panel.innerHeight - 1);
        page.lines.forEach((line, index) => canvas.content(panel, index, [paint(line)]));
        return page.summary;
    }
    if(e.colors){colorsView(e,state.language,width,panel.innerHeight-1).forEach((row,index)=>canvas.content(panel,index,row.spans.map(span=>({...span,reverse:row.selected && span.foreground === null})),row.selected));return ''; }
    if (e.alignmentManager) {
        alignmentsView(e,state.language,width,panel.innerHeight-1).forEach((row,index)=>canvas.content(panel,index,[paint(row.text,false,row.selected)],row.selected));
        return '';
    }
    if (e.groupManager) {
        groupsView(e,state.language,width,panel.innerHeight-1).forEach((row,index)=>canvas.content(panel,index,[paint(row.text,false,row.selected)],row.selected));
        return tr('composition.groups.help');
    }
    if (e.sources) {
        sourcesView(e,state.language,width,panel.innerHeight-1).forEach((row,index)=>canvas.content(panel,index,[paint(row.text,false,row.selected)],row.selected));
        return tr('sources.help');
    }
    if (e.profiles) {
        profilesView(e, state.language, width, panel.innerHeight - 1).forEach((row,index) => canvas.content(panel,index,[paint(row.text,false,row.selected)],row.selected));
        return tr('profiles.sample');
    }

    if(e.explanation) {
        const lines=explanationLines(e,state.language,width), count=Math.max(1,panel.innerHeight-1);
        const start=Math.min(e.explanation.scroll,Math.max(0,lines.length-count));e.explanation.scroll=start;
        lines.slice(start,start+count).forEach((text,index)=>canvas.content(panel,index,[paint(text)]));
        return `${start+1}–${Math.min(lines.length,start+count)}/${lines.length}`;
    }
    if (e.quick) {
        quickView(e.quick,state.language,width,panel.innerHeight-1,e.baseline.configuration?.shared_projects).forEach((row,index)=>canvas.content(panel,index,[paint(row.text,false,row.selected)],row.selected));
        return tr('quick.steps');
    }
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
            const isInput = state.input && (state.input.kind === 'numeric' ? state.input.field === row.key : (state.input.kind === 'field' || state.input.kind === 'path') && state.input.key === row.key);
            const value = isInput ? state.inputDisplay(Math.max(1, width - displayWidth(prefix))) : fieldValue(row, state);
            const editing = state.input && (state.input.kind === 'field' || state.input.kind === 'path') && state.input.key === row.key;
            const spans = row.kind === 'action' && !editing
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
    const itemWidth = Math.min(30, Math.max(18, Math.floor(width / 3)));
    canvas.content(panel, 0, [paint('  ' + column(tr('ui.drawing.on').trim(), 5) +
        column(tr('ui.drawing.item').trim(), itemWidth) + ' ' + tr('ui.drawing.description').trim(), true)]);
    values.slice(start, start + size.listHeight).forEach(({ item, match }, index) => {
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
    if (!values.length) {
        canvas.content(panel, 1, [paint(tr('ui.drawing.no_matching_items'))]);
    }
    const range = values.length > size.listHeight ? ` · ${start + 1}–${Math.min(values.length, start + size.listHeight)}/${values.length}` : '';
    if (types) return tr('composition.catalog_enabled', {
        enabled: values.filter(({ item }) => types.get(item.id)?.enabled).length, total: values.length,
    }) + range;
    if (category !== 'all') return tr('composition.category_counts', e.categoryCounts(scope)) + range;
    return tr('ui.drawing.items_enabled', {
        value0: values.length ? start + 1 : 0,
        value1: Math.min(values.length, start + size.listHeight),
        value2: values.length,
        value3: enabled!.size,
    });
}
