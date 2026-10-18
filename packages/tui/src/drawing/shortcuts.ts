/** State-specific hints fitted as indivisible key/action pairs. */
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { t, renderMessage } from '@fbincon/statusline-core/i18n/messages';
import { paint, type Paint } from '../theme.js';
import type { State } from '../state.js';

export type Hint = readonly [key: string, label: string, short?: string];

export function shortcuts(hints: readonly Hint[], width: number): Paint[] {
    const compact = displayWidth(hints.map(([key, label]) => key + ' ' + label).join(' · ')) > width;
    const spans: Paint[] = [];
    let used = 0;
    for (const [key, full, short] of hints) {
        const label = compact ? short ?? full : full;
        const separator = spans.length ? ' · ' : '';
        const size = displayWidth(separator + key + ' ' + label);
        if (used + size > width) {
            break;
        }
        if (separator) spans.push(paint(separator));
        spans.push(paint(key, true), paint(' ' + label));
        used += size;
    }
    return spans;
}

export function footer(state: State): { actions: Hint[]; help: Hint[] } {
    const e = state.editor;
    const hint = (key: string, label: string, short?: string): Hint => [
        key, t('ui.hints.' + label, state.language),
        short ? t('ui.hints.' + short, state.language) : undefined,
    ];
    if (e.review) {
        return {
            actions: [hint('A', 'accept_draft'), hint('Esc/Ctrl+G', 'cancel_review')],
            help: [hint('Enter', 'details'), hint('↑↓', 'section'), hint('PgUp/PgDn', 'scroll'), hint('Tab', 'preview')],
        };
    }
    if (e.guidanceScroll !== null) {
        return {
            actions: [hint('Ctrl+G/Esc', 'back')],
            help: [hint('↑↓', 'scroll'), hint('PgUp/PgDn', 'page'), hint('Home/End', 'scroll')],
        };
    }
    if (state.input?.kind === 'category') {
        return {
            actions: [hint('Enter', 'accept'), hint('Ctrl+G/Esc', 'cancel')],
            help: [hint('↑↓', 'select'), hint('Home/End', 'select')],
        };
    }
    if (state.input?.kind === 'numeric') {
        return {
            actions: [hint('Enter', 'accept'), hint('Ctrl+G/Esc', 'restore')],
            help: [hint('Digits', 'edit'), hint('Backspace', 'delete')],
        };
    }
    if (state.input) {
        return {
            actions: [hint('Enter', 'accept'), hint('Ctrl+G/Esc', state.input.kind === 'search' ? 'cancel' : 'restore')],
            help: [hint('Ctrl+U', 'clear'), hint('Backspace', 'delete')],
        };
    }
    if (e.adding) {
        return {
            actions: [['Enter', t('composition.add', state.language)], hint('Ctrl+G/Esc', 'back')],
            help: [hint('↑↓', 'select'), hint('/', 'search'), hint('Ctrl+F', 'category')],
        };
    }
    const actions = [hint(state.form ? 'Ctrl+S' : 'Enter/Ctrl+S', 'save'), hint('Esc', 'cancel'), hint('Ctrl+C', 'interrupt')];
    if (e.detail) {
        return { actions, help: [hint('↑↓', 'select'), hint('←→', 'adjust'), hint('Enter', 'edit'), hint('Ctrl+G', 'back')] };
    }
    if (state.form) {
        return {
            actions,
            help: [hint('Tab', 'page'), hint('↑↓', 'select'), hint('←→', 'adjust'), hint('Enter', e.page === 'layout' ? 'edit' : 'edit_save')],
        };
    }
    const help = [hint('Ctrl+A/D/X', 'add_copy_remove', 'add_copy_remove_short'), hint('Tab', 'page'),
        hint('Space', 'toggle'), hint('Ctrl+E', 'format'), hint('↑↓', 'select')];
    if (!e.filtered(state.scope)) help.push(hint('←→', 'order'));
    return { actions, help };
}

export function notice(state: State, width: number): Paint[] {
    const e = state.editor;
    const tr = (key: string) => t(key, state.language);
    const message = renderMessage(state.localized.message ?? state.message, state.language);
    if (message) return [paint(message, true)];
    if (e.review) return [paint(tr('review.intro'))];
    if (state.input?.kind === 'category') return [paint(tr('catalog.search.choose_category'))];
    if (e.detail) {
        const prefix = tr('ui.drawing.item_format');
        return [paint(prefix), ...shortcuts([['Ctrl+G', tr('ui.hints.back')]], width - displayWidth(prefix))];
    }
    if (e.page === 'layout') return [paint(tr('ui.drawing.explicit_rows_priority_width'))];
    if (e.page === 'settings') {
        const prefix = tr('ui.drawing.use_arrows_to_change_values');
        return [paint(prefix), ...shortcuts([['Enter', tr('ui.hints.edits_new_fields'), tr('ui.hints.edit')]], width - displayWidth(prefix))];
    }
    return [paint('Ctrl+F', true), paint(' ' + tr('catalog.categories.' + e.category[state.scope]) + ' · '),
        paint('/', true), paint(' ' + tr('ui.drawing.type_to_search') + e.search[state.scope] +
            (state.input?.kind === 'search' ? ' _' : ''))];
}
