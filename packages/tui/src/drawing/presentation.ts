/** External-editor labels and values; editable text remains canonical. */
import { fieldMessage } from '@fbincon/statusline-core/editor/forms';
import { t, renderMessage, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/messages';
import type { State, Row } from '../state.js';

export const groupKey = (group: string): string =>
    'groups.' + group.toLowerCase().replaceAll(' / ', '.').replaceAll(' ', '-');

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
    if (row.key === 'field:statusline_language') {
        return LANGUAGE_NAMES[editor.draft.display.statusline_language];
    }
    if (row.key === 'ui-language') {
        return LANGUAGE_NAMES[language];
    }
    if (row.key === 'preset-select') {
        return t('presets.' + row.value, language);
    }
    if (row.kind === 'action') {
        return t('ui.actions.' + row.key, language);
    }
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
    if (e.explanation) return tr('explain.title');
    if (e.quick) return tr('quick.title') + ' · ' + tr('quick.'+e.quick.step);
    if (e.review) return tr('review.title');
    if (e.guidanceScroll !== null) return tr('guidance.title');
    if (state.input?.kind === 'category') return tr('catalog.search.categories');
    if (e.adding) return tr('composition.picker');
    if (e.detail) {
        const scope = tr(e.detail.scope === 'main' ? 'ui.drawing.main_items' : 'ui.drawing.subagent_items');
        return tr('ui.drawing.item_format_2') + scope + ': ' +
            state.detailLabel;
    }
    const key = e.page === 'layout' ? 'layout_rows_and_fitting'
        : e.page === 'settings' ? 'settings_global_options'
            : e.page === 'subagents' ? 'subagent_items' : 'main_items';
    return tr('ui.drawing.' + key);
}
