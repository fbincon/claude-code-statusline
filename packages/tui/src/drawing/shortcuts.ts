import { importShortcutHelp, reviewShortcutContext } from '@fbincon/statusline-core/editor/import-review';
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
    const keys = e.shortcuts;
    if(e.changeReview||e.reuse)return {actions:[['Ctrl+G',t('ui.hints.back',state.language)]],help:[['↑↓ PgUp/PgDn',t('ui.hints.scroll',state.language)]]};
    if (e.packages) {
        const actions = [hint('Enter', 'select'), hint('Esc/Ctrl+G', 'back')], help = [hint('↑↓ PgUp/PgDn', 'scroll')];
        if (!e.packages.input) {
            actions.splice(1, 0, [keys.hint('packages', 'refresh-package'), t('profiles.refresh', state.language)]);
            actions[2] = [keys.hint('packages', 'close-packages') + '/Esc', t('task.close', state.language)];
            help.unshift(hint(keys.hint('packages', 'reload-packages'), 'reload'));
            if (e.packages.job && !e.packages.execution) help.unshift(hint(keys.hint('packages', 'cancel-package-review'), 'cancel'));
        }
        return { actions, help };
    }
    if (e.taskViewer) {
        const lang = e.taskViewer.language;
        if (e.taskViewer.input) return { actions: [hint('Enter', 'accept'), hint('Esc/Ctrl+G', 'back')], help: [hint('←→', 'move_cursor'), hint('Ctrl+U', 'clear')] };
        return {
            actions: [[keys.hint('tasks', 'reload-tasks'), t('profiles.refresh', lang)], [keys.hint('tasks', 'close-tasks') + '/Esc', t('task.close', lang)]],
            help: [hint('↑↓ PgUp/PgDn', 'scroll'), [(['task-search', 'task-filter', 'task-evidence', 'task-identity'] as const).map(action =>
                keys.hint('tasks', action)).join(' ') + ' ←→', t('task.viewer.keys', lang)]],
        };
    }
    if (e.colors) return { actions: e.colors.input ? [hint('Enter', 'accept'), hint('Esc/Ctrl+G', 'back')] :
        [[keys.hint('colors', 'apply-color'), t('colors.apply', state.language)], hint('Esc/Ctrl+G', 'back')], help: [hint('↑↓', 'select'), hint('Enter', 'edit')] };
    if (e.diagnosis) {
        if (e.diagnosis.report) return { actions: [hint('Esc/Ctrl+G', 'back')], help: [hint('↑↓ PgUp/PgDn', 'scroll')] };
        return { actions: [hint('Enter', 'accept'), hint('Esc/Ctrl+G', 'back')],
            help: e.diagnosis.input ? [hint('←→ Home/End', 'edit'), hint('Ctrl+U', 'clear')] : [hint('↑↓', 'select')] };
    }
    if(e.saveState==='unknown')return {actions:[['Ctrl+K',t('editor.check_saved',state.language)]],help:[[keys.hint(state.shortcutContext, 'sources'),t('sources.title',state.language)]]};
    if (e.groupManager || e.alignmentManager) return { actions: [hint('Enter','accept'),hint('Esc/Ctrl+G','back')], help: [hint('↑↓','select'),hint('←→','adjust')] };
    if (e.sources) {
        const help: Hint[] = [hint('↑↓','select')];
        if (e.sources.page === 'form') help.push([keys.hint('source-form', 'save-source'),t('sources.save',state.language)]);
        if (e.sources.page === 'list') help.push([keys.hint('sources', 'reload-sources'),t('sources.reload',state.language)]);
        return { actions:[hint('Enter','accept'),hint('Esc/Ctrl+G','back')], help };
    }
    if (e.profiles) return { actions: [hint('Enter','accept'),hint('Esc/Ctrl+G','back')], help: [
        hint('↑↓','select'), ...(e.profiles.page === 'form' ? [] : [[e.profiles.uncertain ? 'R' : keys.hint('profiles', 'reload-profiles'), t('profiles.refresh', state.language)] as Hint]),
    ] };
    if (e.quick) return {
        actions: [hint('Enter','accept'),hint('Backspace','back'),hint('Esc/Ctrl+G','cancel')],
        help: [hint('↑↓','select'),hint('←→','adjust'),hint('Tab','preview'),hint('PgUp/PgDn','scroll'),
            [keys.hint('quick', 'preview-scenario', 'preview-width', 'preview-row'),t('preview.controls',state.language)]],
    };
    if (e.review) {
        const context = reviewShortcutContext(e.review);
        return {
            actions: [...(e.review.choosing ? [] : [hint(keys.hint(context, 'accept-import'), 'accept_draft')]),
                hint(keys.hint(context, 'cancel-import') + '/Esc', 'cancel_review')],
            help: [hint('Enter', e.review.choosing ? 'accept' : 'details'), hint('↑↓', 'section'), hint('PgUp/PgDn', 'scroll'), hint('Tab', 'preview'),
                [keys.hint(context, 'preview-scenario', 'preview-width', 'preview-row'),t('preview.controls',state.language)]],
        };
    }
    if (e.guidanceScroll !== null || e.explanation) {
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
            help: [hint('←→ Home/End', 'move_cursor'), hint('Backspace/Delete', 'delete')],
        };
    }
    if (state.input) {
        return {
            actions: [hint('Enter', 'accept'), hint('Ctrl+G/Esc', state.input.kind === 'search' ? 'cancel' : 'restore')],
            help: [hint('←→ Home/End', 'move_cursor'), hint('Ctrl+U', 'clear'), hint('Backspace/Delete', 'delete')],
        };
    }
    if (e.adding) {
        return {
            actions: [hint('Enter/Space', 'add_enable'), hint('Ctrl+G/Esc', 'back')],
            help: [hint(keys.hint('picker', 'search'), 'search'), hint('↑↓', 'select'), hint(keys.hint('picker', 'category'), 'category'),
                hint('Ctrl+U', 'clear'), hint(keys.hint('picker', 'item-details'), 'details')],
        };
    }
    const context = state.shortcutContext;
    const actions: Hint[] = [hint(keys.aliases(context, 'save'), 'save'),
        hint(keys.aliases(context, 'close'), 'cancel'), hint('Ctrl+C', 'interrupt')];
    actions.push([keys.hint(context, 'undo', 'redo'),t('history.undo_redo',state.language)], [keys.hint(context, 'history'),t('history.title',state.language)]);
    if(!e.detail) actions.push([keys.hint(context, 'quick-setup'),t('quick.title',state.language)]);
    actions.push([keys.hint(context, 'preview-scenario', 'preview-width', 'preview-row'),t('preview.controls',state.language)]);
    if (e.detail) {
        return { actions, help: [hint('↑↓', 'select'), hint('←→', 'adjust'), hint('Enter', 'edit'), hint('Ctrl+G', 'back')] };
    }
    if (state.form) {
        const enter = ['legacy-settings', 'numeric-settings', 'refresh-settings'].includes(context) ? [] : [hint('Enter', 'edit')];
        return {
            actions,
            help: [hint('Tab', 'page'), hint('↑↓', 'select'), hint('←→', 'adjust'), ...enter],
        };
    }
    const filtered = e.filtered(state.scope);
    const help = [hint(keys.hint(context, 'search'), 'search')];
    if (filtered) {
        help.push(hint('Ctrl+G', 'clear_filters'));
        if (e.category[state.scope] !== 'all') help.push(hint(keys.hint(context, 'add-item'), 'catalog'));
    }
    help.push(hint(keys.hint(context, 'add-item', 'copy-item', 'remove-item'), 'add_copy_remove', 'add_copy_remove_short'), hint('Tab', 'page'),
        hint(keys.hint(context, 'toggle-item'), 'toggle'), hint(keys.hint(context, 'item-details'), 'format'), hint('↑↓', 'select'));
    if (!filtered) help.push(hint(keys.hint(context, 'move-left', 'move-right'), 'order'));
    return { actions, help };
}

export function notice(state: State, width: number): Paint[] {
    const e = state.editor;
    const tr = (key: string) => t(key, state.language);
    const message = renderMessage(state.localized.message ?? state.message, state.language);
    if(e.saveState==='unknown')return [paint(tr('editor.save_unknown'),true)];
    if (e.quick) return [paint(t('quick.sample',state.language))];
    if (message) return [paint(message, true)];
    if (e.review) return [paint(importShortcutHelp(e.review, e.shortcuts, state.language))];
    if (state.input?.kind === 'category') return [paint(tr('catalog.search.choose_category'))];
    if (state.input?.kind === 'search') return [paint(state.inputDisplay(width))];
    if (e.detail) {
        const prefix = tr('ui.drawing.item_format');
        return [paint(prefix), ...shortcuts([['Ctrl+G', tr('ui.hints.back')]], width - displayWidth(prefix))];
    }
    if (e.page === 'layout') return [paint(tr('ui.drawing.explicit_rows_priority_width'))];
    if (e.page === 'settings') {
        const prefix = tr('ui.drawing.use_arrows_to_change_values');
        return [paint(prefix), ...shortcuts([['Enter', tr('ui.hints.edits_new_fields'), tr('ui.hints.edit')]], width - displayWidth(prefix))];
    }
    const { category, search } = e.listContext(state.scope);
    const context = e.adding ? 'picker' : 'list';
    return [paint(e.shortcuts.hint(context, 'category'), true), paint(' ' + tr('catalog.categories.' + category) + ' · '),
        paint(e.shortcuts.hint(context, 'search'), true), paint(' ' + tr('ui.drawing.type_to_search') + search)];
}
