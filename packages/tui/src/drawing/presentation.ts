/** External-editor labels and values; editable text remains canonical. */
import type { CatalogItem } from '@fbincon/statusline-core/contracts/ui';
import { fieldMessage, itemDecorationValue } from '@fbincon/statusline-core/editor/forms';
import { packageTitle } from '@fbincon/statusline-core/editor/package-view';
import { colorsTitle } from '@fbincon/statusline-core/editor/color-manager';
import { groupsTitle } from '@fbincon/statusline-core/editor/group-manager';
import { sourcesTitle } from '@fbincon/statusline-core/editor/source-manager';
import { profilesTitle } from '@fbincon/statusline-core/editor/profile-manager';
import type { TaskViewer } from '@fbincon/statusline-core/editor/task-viewer';
import { t, renderMessage, LANGUAGE_NAMES, type Language } from '@fbincon/statusline-core/i18n/messages';
import type { State, Row } from '../state.js';
import { taskRefreshInterval } from '../report-refresh.js';

export const groupKey = (group: string): string =>
    'groups.' + group.toLowerCase().replaceAll(' / ', '.').replaceAll(' ', '-');

export function itemExample(item: CatalogItem, language: Language): string {
    return item.examples.length ? t('ui.drawing.item_example', language, { examples: item.examples.join(' · ') }) : '';
}

export function taskReportStatus(view: TaskViewer): string {
    const readOnly = t('ui.refresh.read_only', view.language);
    return taskRefreshInterval(view) === null ? readOnly : readOnly + ' · ' + t('ui.refresh.auto', view.language);
}

export function fieldLabel(row: Row, state: State): string {
    if (/^(?:field|item|fit|break):/u.test(row.key)) {
        return renderMessage(fieldMessage(row, state), state.language);
    }
    return t('settings.' + row.key, state.language, {}, row.label);
}

export function fieldValue(row: Row, state: State): string {
    const { language, editor, input } = state;
    if (input?.kind === 'numeric' && input.field === row.key) {
        return '[' + input.buffer + '_]';
    }
    if (input && (input.kind === 'field' || input.kind === 'path') && input.key === row.key) {
        return input.buffer + ' _';
    }
    if (row.key === 'item:cost_rate_basis') return t('cost_rate.basis.' + row.value, language);
    if (row.key === 'item:effort_fallback' && row.value === 'session') return t('effort_fallback.session', language);
    if(row.key==='preview-scenario')return t('preview.scenario.'+row.value,language);
    if(row.key==='preview-width')return row.value==='auto'?t('preview.auto',language):row.value;
    if (row.key === 'item:presentation') return t('indicators.presentation.' + row.value, language);
    if (row.key === 'field:statusline_language') {
        return LANGUAGE_NAMES[editor.draft.display.statusline_language];
    }
    if (row.key === 'ui-language') {
        return LANGUAGE_NAMES[language];
    }
    if (row.key === 'preset-select') {
        return t('presets.' + row.value, language);
    }
    if (row.key === 'keyboard-shortcuts') return '';
    if (row.kind === 'action') {
        return t('ui.actions.' + row.key, language);
    }
    if (row.form?.spec.key.endsWith('_gradient')) {
        return row.value === 'off' ? t('values.off', language) : t('gradients.preset.' + row.value, language, {}, row.value);
    }
    const decoration = itemDecorationValue(row.key, row.form?.valueRaw, language);
    if (decoration !== undefined) return decoration;
    if (row.form?.valueRaw === null) {
        return t('values.inherit', language);
    }
    if (row.kind === 'text') {
        return String(row.form?.valueRaw ?? row.value);
    }
    return t('values.' + row.value, language, {}, row.value);
}

export function contentTitle(state: State): string {
    const e = state.editor;
    const tr = (key: string) => t(key, state.language);
    if (e.changeReview) return tr(e.structureProposal?.confirmation ? 'layout.review_title' : 'history.title');
    if (e.reuse) return tr('reuse.' + e.reuse.kind);
    if (e.packages) return packageTitle(e.packages, state.language);
    if(e.taskViewer)return t('task.title',e.taskViewer.language);
    if(e.diagnosis)return tr('diagnosis.title');
    if (e.colors) return colorsTitle(e, state.language);
    if (e.alignmentManager) return tr('alignment.title');
    if (e.groupManager) return groupsTitle(e, state.language);
    if (e.sources) return sourcesTitle(e, state.language);
    if (e.profiles) return profilesTitle(e, state.language);
    if (e.explanation) return tr('explain.title');
    if (e.quick) return tr('quick.title') + ' · ' + tr('quick.'+e.quick.step);
    if (e.review) return tr(e.review.choosing ? 'review.selection_title' : 'review.title');
    if (e.guidanceScroll !== null) return tr('guidance.title');
    if (state.input?.kind === 'category') return tr('catalog.search.categories');
    if (e.adding) return tr('composition.picker');
    if (e.detail) {
        const scope = tr(e.detail.scope === 'main' ? 'ui.drawing.main_items' : 'ui.drawing.subagent_items');
        return tr('ui.drawing.item_format_2') + scope + ': ' +
            state.detailLabel;
    }
    if (e.page === 'layout') return tr('ui.drawing.layout_rows_and_fitting');
    if (e.page === 'settings') return tr('ui.drawing.settings_global_options');
    return tr('composition.configured_title');
}
