import { importShortcutHelp, reviewShortcutContext } from '@fbincon/statusline-core/editor/import-review';
import { shortcutHint, type ShortcutAction } from '@fbincon/statusline-core/editor/shortcut-map';
import type { EditorShortcuts } from '@fbincon/statusline-core/editor/shortcut-settings';
import type { TaskViewer } from '@fbincon/statusline-core/editor/task-viewer';
/** State-specific hints fitted as indivisible key/action pairs. */
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { t, renderMessage } from '@fbincon/statusline-core/i18n/messages';
import { paint, type Paint } from '../theme.js';
import type { State } from '../state.js';
import { sourceObservationJob, sourceObservationPending } from '../manager-refresh.js';

export type Hint = readonly [key: string, label: string, short?: string];

export function taskFooter(view: TaskViewer, keys?: EditorShortcuts): { actions: Hint[]; help: Hint[] } {
    const tr = (key: string) => t(key, view.language);
    const binding = (action: ShortcutAction) => keys?.hint('tasks', action) ?? shortcutHint('terminal', 'tasks', {}, action);
    if (view.input) return {
        actions: [['Enter', tr('ui.hints.accept')], ['Esc/Ctrl+G', tr('ui.hints.back')]],
        help: [['←→', tr('ui.hints.move_cursor')], ['Ctrl+U', tr('ui.hints.clear')]],
    };
    const actions: Hint[] = [];
    if (view.session) actions.push([binding('reload-tasks'), tr('ui.refresh.read_now')]);
    actions.push([binding('close-tasks') + '/Esc', tr('task.close')]);
    const readingKeys = (['task-search', 'task-filter', 'task-evidence', 'task-identity'] as const).map(binding);
    return { actions, help: [['↑↓ PgUp/PgDn', tr('ui.hints.scroll')], [readingKeys.join(' ') + ' ←→', tr('task.viewer.keys')]] };
}

export function shortcuts(hints: readonly Hint[], width: number, primaryCount = hints.length): Paint[] {
    const fits = (values: readonly Hint[]) => displayWidth(values.map(([key, label]) => key + ' ' + label).join(' · ')) <= width;
    const compact = !fits(hints);
    const compactPrimary = compact && !fits(hints.slice(0, primaryCount));
    const spans: Paint[] = [];
    let used = 0;
    for (const [index, [key, full, short]] of hints.entries()) {
        const label = (index < primaryCount ? compactPrimary : compact) ? short ?? full : full;
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

export function footer(state: State): { actions: Hint[]; help: Hint[]; primaryActions?: number } {
    const e = state.editor;
    const hint = (key: string, label: string, short?: string): Hint => [
        key, t('ui.hints.' + label, state.language),
        short ? t('ui.hints.' + short, state.language) : undefined,
    ];
    const keys = e.shortcuts;
    const saveAndExit = (context: State['shortcutContext']) => hint(keys.aliases(context, 'save'), 'save_and_exit', 'save');
    if(e.changeReview||e.reuse)return {actions:[['Ctrl+G',t('ui.hints.back',state.language)]],help:[['↑↓ PgUp/PgDn',t('ui.hints.scroll',state.language)]]};
    if (e.packages) {
        if (e.packages.input) return {
            actions: [hint('Enter', 'accept'), hint('Esc/Ctrl+G', 'back')],
            help: [hint('←→', 'move_cursor'), hint('Ctrl+U', 'clear')],
        };
        const actions: Hint[] = [hint('Enter', 'select'),
            [keys.hint('packages', 'refresh-package'), t('ui.refresh.read_now', state.language)],
            [keys.hint('packages', 'close-packages') + '/Esc', t('task.close', state.language)]];
        const help = [hint(keys.hint('packages', 'reload-packages'), 'reload'), hint('↑↓ PgUp/PgDn', 'scroll')];
        if (e.packages.job && !e.packages.execution) help.unshift(hint(keys.hint('packages', 'cancel-package-review'), 'cancel'));
        return { actions, help };
    }
    if (e.taskViewer) return taskFooter(e.taskViewer, keys);
    if (e.colors) return {
        actions: [e.colors.input ? hint('Enter', 'accept') : [keys.hint('colors', 'apply-color'), t('colors.apply', state.language)], hint('Esc/Ctrl+G', 'back')],
        help: e.colors.input ? [hint('←→ Home/End', 'move_cursor'), hint('Ctrl+U', 'clear')] : [hint('↑↓', 'select'), hint('Enter', 'edit')],
    };
    if (e.diagnosis) {
        if (e.diagnosis.report) return { actions: [hint('Esc/Ctrl+G', 'back')], help: [hint('↑↓ PgUp/PgDn', 'scroll')] };
        return { actions: [hint('Enter', 'accept'), hint('Esc/Ctrl+G', 'back')],
            help: e.diagnosis.input ? [hint('←→ Home/End', 'edit'), hint('Ctrl+U', 'clear')] : [hint('↑↓', 'select')] };
    }
    if(e.saveState==='unknown')return {actions:[['Ctrl+K',t('editor.check_saved',state.language)]],help:[[keys.hint(state.shortcutContext, 'sources'),t('sources.title',state.language)]]};
    if (e.groupManager || e.alignmentManager) return { actions: [hint('Enter','accept'),hint('Esc/Ctrl+G','back')], help: [hint('↑↓','select'),hint('←→','adjust')] };
    if (e.sources) {
        const help: Hint[] = [hint('↑↓','select')];
        if (e.sources.page === 'checks' || e.sources.page === 'bindings') help.push(hint('←→','page'));
        if (e.sources.page === 'form') help.push([keys.hint('source-form', 'save-source'),t('sources.save',state.language)]);
        if (e.sources.page === 'list') help.push([keys.hint('sources', 'reload-sources'),t('sources.reload',state.language)]);
        else if (sourceObservationJob(e)) help.push([keys.hint('sources', 'reload-sources'), t('ui.refresh.read_now', state.language)]);
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
            help: [hint('←→ Home/End', 'move_cursor'), hint('Ctrl+U', 'clear'), hint('Backspace/Delete', 'delete')],
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
            actions: [hint('Enter/Space', 'add_enable'), hint('Ctrl+G/Esc', 'back'), saveAndExit('picker')],
            help: [hint('↑↓', 'select'), hint(keys.hint('picker', 'search'), 'search'), hint(keys.hint('picker', 'category'), 'category'),
                hint('Ctrl+U', 'clear'), hint(keys.hint('picker', 'item-details'), 'details')],
        };
    }
    const context = state.shortcutContext;
    const actions: Hint[] = [saveAndExit(context), hint(keys.aliases(context, 'close'), 'close'), hint('Ctrl+C', 'interrupt')];
    const primaryActions = actions.length;
    actions.push([keys.hint(context, 'undo', 'redo'),t('history.undo_redo',state.language)], [keys.hint(context, 'history'),t('history.title',state.language)]);
    if(!e.detail) actions.push([keys.hint(context, 'quick-setup'),t('quick.title',state.language)]);
    actions.push([keys.hint(context, 'preview-scenario', 'preview-width', 'preview-row'),t('preview.controls',state.language)]);
    if (e.detail) {
        return { actions, primaryActions, help: [hint('↑↓', 'select'), hint('←→', 'adjust'), hint('Enter', 'edit'), hint('Ctrl+G', 'back')] };
    }
    if (state.form) {
        const row = state.selectedRow();
        const activate = row.kind === 'boolean' ? 'toggle' : row.kind === 'choice' && !row.form ? 'adjust' : 'edit';
        const help = [hint('Tab', 'page'), hint('↑↓', 'select'), hint('Enter', activate)];
        if (context === 'refresh-settings') help.push([
            keys.hint(context, 'event-refresh'), t('shortcuts.action.event-refresh', state.language), t('values.event', state.language),
        ]);
        help.push(hint('←→', 'adjust'));
        return { actions, primaryActions, help };
    }
    const filtered = e.filtered(state.scope);
    const help = [hint('Tab', 'page'), hint('↑↓', 'select'), hint(keys.aliases(context, 'toggle-item'), 'toggle'),
        hint(keys.hint(context, 'search'), 'search')];
    if (filtered) help.push(hint('Ctrl+G', 'clear_filters', 'clear_filters_short'));
    help.push(hint(keys.hint(context, 'category'), 'category'),
        hint(keys.hint(context, 'add-item', 'copy-item', 'remove-item'), 'add_copy_remove', 'add_copy_remove_short'));
    if (!filtered) help.push(hint(keys.hint(context, 'move-left', 'move-right'), 'order'));
    help.push(hint(keys.hint(context, 'item-details'), 'details'));
    return { actions, primaryActions, help };
}

export function notice(state: State, width: number, visibleHelp: readonly Paint[]): Paint[] {
    const e = state.editor;
    const tr = (key: string) => t(key, state.language);
    const message = renderMessage(state.localized.message ?? state.message, state.language);
    if(e.saveState==='unknown')return [paint(tr('editor.save_unknown'),true)];
    if (e.sources) {
        const job = sourceObservationJob(e);
        if (job) {
            const pending = sourceObservationPending(job);
            const status = pending && job.state === 'failed' ? tr('ui.refresh.checking_timeout') : tr('sources.reason.' + job.state);
            const parts = [tr('sources.status'), status];
            if (pending && job.state === 'running') parts.push(tr('ui.refresh.auto'));
            if (!pending && job.reason !== job.state) parts.push(t('sources.error.' + job.reason, state.language, {},
                t('sources.reason.' + job.reason, state.language, {}, job.reason)));
            parts.push(job.id);
            return [paint(parts.join(' · '))];
        }
    }
    if (e.quick) return [paint(tr(e.quick.step === 'appearance' ? 'quick.preset-ready' : 'quick.sample'))];
    if (message) return [paint(message, true)];
    if (e.review) return [paint(importShortcutHelp(e.review, e.shortcuts, state.language))];
    if (state.input?.kind === 'category') return [paint(tr('catalog.search.choose_category'))];
    if (state.input?.kind === 'search') return [paint(state.inputDisplay(width))];
    if (e.detail) {
        const prefix = tr('ui.drawing.item_format');
        return [paint(prefix), ...shortcuts([['Ctrl+G', tr('ui.hints.back')]], width - displayWidth(prefix))];
    }
    if (e.page === 'layout') return [paint(tr('ui.drawing.explicit_rows_priority_width'))];
    if (e.page === 'settings') return [];
    const { category, search } = e.listContext(state.scope);
    const context = e.adding ? 'picker' : 'list';
    const keys = e.shortcuts;
    const hints: Hint[] = [[keys.hint(context, 'category'), tr('catalog.categories.' + category)]];
    if (e.inDraftView && !e.packageLocked && e.filtered(state.scope)) {
        const visible = (key: string) => visibleHelp.some(span => span.bold && span.text === key);
        if (!visible('Ctrl+G')) hints.push(['Ctrl+G', tr('ui.hints.clear_filters'), tr('ui.hints.clear_filters_short')]);
        if (category !== 'all' && !visible(keys.hint('list', 'add-item', 'copy-item', 'remove-item')))
            hints.push([keys.hint('list', 'add-item'), tr('ui.hints.catalog')]);
    }
    const status = shortcuts(hints, width);
    const separator = ' · ';
    const remaining = width - displayWidth(status.map(span => span.text).join('') + separator);
    const searchHint = shortcuts([[keys.hint(context, 'search'), tr('ui.drawing.type_to_search').trimEnd(), tr('ui.hints.search')]], remaining);
    return searchHint.length ? [...status, paint(separator), ...searchHint, paint(search ? ' ' + search : '')] : status;
}
