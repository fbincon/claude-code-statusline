import { canAcceptImport, importShortcutHelp, reviewShortcutContext } from '@fbincon/statusline-core/editor/import-review';
import { packageControls } from '@fbincon/statusline-core/editor/package-manager';
import { diagnosisControls } from '@fbincon/statusline-core/editor/diagnosis-view';
import { sourcesControls } from '@fbincon/statusline-core/editor/source-manager';
import { profileControls } from '@fbincon/statusline-core/editor/profile-manager';
import { shortcutHint, type ShortcutAction } from '@fbincon/statusline-core/editor/shortcut-map';
import { automaticRowBoundary, itemDecorationKind, itemDecorationNotice, layoutFormNotice } from '@fbincon/statusline-core/editor/forms';
import { colorControls } from '@fbincon/statusline-core/editor/color-manager';
import { hintLine } from '@fbincon/statusline-core/editor/hints';
import { quickAction, quickAdjusts, quickSampleHelp } from '@fbincon/statusline-core/editor/quick-setup';
import { groupControls } from '@fbincon/statusline-core/editor/group-manager';
import type { EditorShortcuts } from '@fbincon/statusline-core/editor/shortcut-settings';
import type { TaskViewer } from '@fbincon/statusline-core/editor/task-viewer';
/** State-specific hints fitted as indivisible key/action pairs. */
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { t, renderMessage } from '@fbincon/statusline-core/i18n/messages';
import { paint, type Paint } from '../theme.js';
import type { State } from '../state.js';
import { paintLine } from './canvas.js';

export type Hint = readonly [key: string, label: string, short?: string];

export function taskFooter(view: TaskViewer, keys?: EditorShortcuts): { actions: Hint[]; help: Hint[] } {
    const tr = (key: string) => t(key, view.language);
    const binding = (action: ShortcutAction) => keys?.hint('tasks', action) ?? shortcutHint('terminal', 'tasks', {}, action);
    const identity = view.input === 'session' || view.input === 'prompt';
    if (view.input) return {
        actions: [['Enter', tr(identity ? 'ui.refresh.read_now' : 'ui.hints.accept')], ['Esc/Ctrl+G', tr('ui.hints.back')]],
        help: [...(identity ? [['Tab', tr('task.viewer.switch_id')] as const] : []),
            ['←→', tr('ui.hints.move_cursor')], ['Ctrl+U', tr('ui.hints.clear')]],
    };
    const editId: Hint = [binding('task-identity'), tr('task.controls.identity')];
    const close: Hint = [binding('close-tasks') + '/Esc', tr('task.close')];
    const read: Hint = [binding('reload-tasks'), tr('ui.refresh.read_now')];
    if (!view.session) return { actions: [editId, close], help: [] };
    const scroll: Hint = ['↑↓ PgUp/PgDn', tr('ui.hints.scroll')];
    if (!view.report) return { actions: [read, close], help: [editId, scroll] };
    return { actions: [read, close], help: [
        scroll, editId, [binding('task-evidence'), tr('task.controls.evidence')],
        [binding('task-search'), tr('ui.hints.search')], [binding('task-filter'), tr('statusline.short.subagent.status')],
        ['←→', tr('task.controls.fold')],
    ] };
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

interface EditorFooter {
    actions: Hint[];
    help: Hint[];
    primaryActions?: number;
}

export function footer(state: State): EditorFooter {
    const page = pageFooter(state);
    if (state.editor.saveState !== 'unknown') return page;
    const check: Hint = ['Ctrl+K', t('editor.check_saved', state.language)];
    return { ...page, actions: [check, ...page.actions] };
}

function pageFooter(state: State): EditorFooter {
    const e = state.editor;
    const hint = (key: string, label: string, short?: string): Hint => [
        key, t('ui.hints.' + label, state.language),
        short ? t('ui.hints.' + short, state.language) : undefined,
    ];
    const keys = e.shortcuts;
    const saveAndExit = (context: State['shortcutContext']) => hint(keys.aliases(context, 'save'), 'save_and_exit', 'save');
    if (e.changeReview?.input || e.reuse?.page === 'path') return {
        actions: [hint('Enter', e.changeReview ? 'export_new_file' : 'read_file'), hint('Esc/Ctrl+G', 'back')],
        help: [hint('←→ Home/End', 'move_cursor'), hint('Ctrl+U', 'clear'),
            ...(e.changeReview?.message || e.reuse?.message ? [hint('PgUp/PgDn', 'scroll')] : [])],
    };
    if (e.changeReview?.kind === 'structure') return {
        actions: [hint(keys.hint('repair', 'accept-repair'), 'accept_draft'), hint('Esc/Ctrl+G', 'back')],
        help: [hint('Enter', 'details'), hint('↑↓ PgUp/PgDn', 'scroll')],
    };
    if (e.changeReview || e.reuse) return { actions: [hint('Ctrl+G', 'back')], help: [hint('↑↓ PgUp/PgDn', 'scroll')] };
    if (e.packages) {
        if (e.packages.input) return {
            actions: [hint('Enter', e.packages.editing === 'export_path' ? 'export_new_file' : 'accept'), hint('Esc/Ctrl+G', 'back')],
            help: [hint('←→', 'move_cursor'), hint('Ctrl+U', 'clear'), ...(e.packages.message ? [hint('PgUp/PgDn', 'scroll')] : [])],
        };
        const { pick, refresh, reload, cancel, scroll } = packageControls(e.packages);
        const actions: Hint[] = [
            ...(pick ? [hint('Enter', 'select')] : []),
            hint(keys.hint('packages', 'close-packages') + '/Esc', e.packages.mode === 'status' ? 'close' : 'back'),
        ];
        if (refresh) actions.push([keys.hint('packages', 'refresh-package'), t('ui.refresh.read_now', state.language)]);
        const help = [];
        if (cancel) help.push(hint(keys.hint('packages', 'cancel-package-review'), 'cancel'));
        if (reload) help.push(hint(keys.hint('packages', 'reload-packages'), 'reload'));
        if (pick || scroll) help.push(hint('↑↓ PgUp/PgDn', e.packages.mode === 'channel' ? 'select' : 'scroll'));
        return { actions, help };
    }
    if (e.taskViewer) return taskFooter(e.taskViewer, keys);
    if (e.colors) {
        const { apply, enter } = colorControls(e);
        return {
            actions: [...(apply ? [[keys.hint('colors', 'apply-color'), t('colors.apply', state.language)] as Hint] : []),
                ...(e.colors.input && enter ? [hint('Enter', enter)] : []), hint('Esc/Ctrl+G', 'back')],
            help: e.colors.input ? [hint('←→ Home/End', 'move_cursor'), hint('Ctrl+U', 'clear')]
                : [...(enter ? [hint('Enter', enter, enter === 'choose_candidate' ? 'choose' : undefined)] : []), hint('↑↓ PgUp/PgDn', 'browse')],
        };
    }
    if (e.diagnosis) {
        const { enter, tab } = diagnosisControls(e.diagnosis);
        if (e.diagnosis.report) return {
            actions: [hint('Esc/Ctrl+G', 'back'), ...(tab ? [hint('Tab', tab.replaceAll(' ', '_'))] : [])],
            help: [hint('↑↓ PgUp/PgDn', 'scroll'), hint('Home/End', 'scroll')],
        };
        return { actions: [...(enter ? [hint('Enter', enter.replaceAll(' ', '_'))] : []), hint('Esc/Ctrl+G', 'back')],
            help: e.diagnosis.input ? [hint('←→ Home/End', 'edit'), hint('Ctrl+U', 'clear')] : [hint('↑↓', 'select')] };
    }
    if (e.groupManager) {
        const controls = groupControls(e), groupAction = controls.enter;
        return {
            actions: [...(groupAction ? [['Enter', t(groupAction, state.language), t('ui.hints.accept', state.language)] as Hint] : []),
                hint('Esc/Ctrl+G', 'back')],
            help: [hint('↑↓', 'select'), ...(controls.adjust ? [hint('←→', 'adjust')] : [])],
        };
    }
    if (e.alignmentManager) return { actions: [hint('Enter','accept'),hint('Esc/Ctrl+G','back')], help: [hint('↑↓','select'),hint('←→','adjust')] };
    if (e.sources) {
        const control = sourcesControls(e);
        const actions: Hint[] = [hint('Esc/Ctrl+G', control.back)];
        if (control.enter) actions.push(['Enter', t(control.enter, state.language), t('ui.hints.select', state.language)]);
        if (control.movement === 'fields') actions.push([keys.hint('source-form', 'save-source'), t('sources.save', state.language)]);
        const help: Hint[] = [];
        if (control.movement === 'select') help.push(hint('↑↓', 'select'));
        if (control.movement === 'scroll') help.push(hint('↑↓ PgUp/PgDn', 'scroll'));
        if (control.movement === 'fields') help.push(hint('Tab/↑↓', 'next_field'), hint('←→', 'move_cursor'));
        if (control.page) help.push(hint('←→', 'page'));
        if (control.adjust) help.push(hint('←→', 'adjust'));
        if (control.reload) help.push([keys.hint('sources', 'reload-sources'),
            t(control.reload === 'registry' ? 'sources.reload' : 'ui.refresh.read_now', state.language)]);
        return { actions, help };
    }
    if (e.profiles) {
        const control = profileControls(e);
        const labels = { next: 'next_field', review: 'review', read: 'read_file', select: 'select', confirm: 'confirm' } as const;
        return { actions: [
            ...(control.enter ? [hint('Enter', labels[control.enter])] : []),
            ...(control.back ? [hint('Esc/Ctrl+G', 'back')] : []),
            ...(control.refresh ? [[control.refresh, t('profiles.refresh', state.language)] as Hint] : []),
        ], help: [
            ...(control.select ? [hint('↑↓', 'select')] : []),
            ...(control.nextField ? [hint('Tab', 'next_field')] : []),
            ...(control.input ? [hint('←→', 'move_cursor')] : []),
            ...(control.scroll ? [hint('PgUp/PgDn', 'scroll')] : []),
        ] };
    }
    if (e.quick) return {
        actions: [['Enter', t(quickAction(e.quick), state.language), t('ui.hints.accept', state.language)],
            hint('Esc/Ctrl+G','cancel'), hint('Backspace', e.quick.step === 'scenario' ? 'cancel' : 'back')],
        help: [hint('↑↓','select'), ...(quickAdjusts(e.quick) ? [hint('←→','adjust')] : []), hint('Tab','preview'),hint('PgUp/PgDn','scroll'),
            [keys.hint('quick', 'preview-scenario', 'preview-width', 'preview-row'),t('preview.controls',state.language)]],
    };
    if (e.review) {
        const review = e.review, context = reviewShortcutContext(review);
        const setup: Hint[] = review.choosing ? [hint('Space', 'toggle'), hint('Enter', 'details')]
            : canAcceptImport(review) ? [hint(keys.hint(context, 'accept-import'), 'accept_draft')]
                : review.base ? [[keys.hint(context, 'select-import'), t('review.select_scope', state.language)]] : [];
        return {
            actions: [...setup, hint(keys.hint(context, 'cancel-import') + '/Esc', 'cancel_review')],
            help: [...(!review.choosing && review.result.changes.length ? [hint('Enter', 'details')] : []),
                ...(review.choosing || review.result.changes.length ? [hint('↑↓', review.choosing ? 'select' : 'section')] : []),
                hint('PgUp/PgDn', review.choosing ? 'page' : 'scroll'),
                ...(review.choosing ? [] : [hint('Tab', 'preview')]),
                [keys.hint(context, 'preview-scenario', 'preview-width', 'preview-row'), t('preview.controls', state.language)]],
        };
    }
    if (e.guidanceScroll !== null || e.explanation) {
        return {
            actions: [hint('Ctrl+G/Esc', 'back')],
            help: [hint('↑↓', 'scroll'), hint('PgUp/PgDn', 'page'), hint('Home/End', 'scroll')],
        };
    }
    if (e.saveState === 'unknown') return { actions: [], help: e.inDraftView && !state.input
        ? [[keys.hint(state.shortcutContext, 'sources'), t('sources.title', state.language)]] : [] };
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
        const submit = state.input.kind === 'path' ? state.input.key === 'import-file' ? 'read_file' : 'export_new_file' : 'accept';
        return {
            actions: [hint('Enter', submit), hint('Ctrl+G/Esc', state.input.kind === 'field' ? 'restore' : 'cancel')],
            help: [hint('←→ Home/End', 'move_cursor'), hint('Ctrl+U', 'clear'), hint('Backspace/Delete', 'delete')],
        };
    }
    if (e.adding) {
        const selected = e.listContext(state.scope).selected;
        return {
            actions: [...(selected ? [hint('Enter/Space', 'add_enable')] : []), hint('Ctrl+G/Esc', 'back'), saveAndExit('picker')],
            help: [...(selected ? [hint('↑↓', 'select')] : []), hint(keys.hint('picker', 'search'), 'search'),
                hint(keys.hint('picker', 'category'), 'category'), hint('Ctrl+U', 'clear'),
                ...(selected ? [hint(keys.hint('picker', 'item-details'), 'details')] : [])],
        };
    }
    const context = state.shortcutContext;
    const actions: Hint[] = [saveAndExit(context), hint(keys.aliases(context, 'close'), 'close'), hint('Ctrl+C', 'interrupt')];
    const primaryActions = actions.length;
    actions.push([keys.hint(context, 'undo', 'redo'),t('history.undo_redo',state.language)], [keys.hint(context, 'history'),t('history.title',state.language)]);
    if(!e.detail) actions.push([keys.hint(context, 'quick-setup'),t('quick.title',state.language)]);
    actions.push([keys.hint(context, 'preview-scenario', 'preview-width', 'preview-row'),t('preview.controls',state.language)]);
    if (e.detail) {
        const kind = itemDecorationKind(e.setting);
        const control = kind === 'preset' ? [hint('←→/Enter', 'switch_preset')] : kind === 'custom' ? [hint('Enter', 'edit')] : [hint('←→', 'adjust'), hint('Enter', 'edit')];
        return { actions, primaryActions, help: [hint('↑↓', 'select'), ...control, hint('Ctrl+G', 'back')] };
    }
    if (state.form) {
        const row = state.selectedRow();
        const activate = row.kind === 'boolean' ? 'toggle' : row.kind === 'choice' && !row.form ? 'adjust' : 'edit';
        if (automaticRowBoundary(state)) return { actions, primaryActions, help: [
            ['Enter', t('ui.hints.review_layout', state.language)], hint('↑↓', 'select'), hint('Tab', 'page'),
        ] };
        const help = [hint('Tab', 'page'), hint('↑↓', 'select'), hint('Enter', activate)];
        if (context === 'refresh-settings') help.push([
            keys.hint(context, 'event-refresh'), t('shortcuts.action.event-refresh', state.language), t('values.event', state.language),
        ]);
        help.push(hint('←→', 'adjust'));
        return { actions, primaryActions, help };
    }
    const filtered = e.filtered(state.scope), selected = e.listContext(state.scope).selected;
    const help = [hint('Tab', 'page'), ...(selected ? [hint('↑↓', 'select'), hint(keys.aliases(context, 'toggle-item'), 'toggle')] : []),
        hint(keys.hint(context, 'search'), 'search')];
    if (filtered) help.push(hint('Ctrl+G', 'clear_filters', 'clear_filters_short'));
    help.push(hint(keys.hint(context, 'category'), 'category'));
    if (selected) {
        help.push(hint(keys.hint(context, 'add-item', 'copy-item', 'remove-item'), 'add_copy_remove', 'add_copy_remove_short'));
        if (!filtered) help.push(hint(keys.hint(context, 'move-left', 'move-right'), 'order'));
        help.push(hint(keys.hint(context, 'item-details'), 'item_format', 'format'));
    }
    return { actions, primaryActions, help };
}

export function notice(state: State, width: number, visibleHelp: readonly Paint[]): Paint[] {
    const e = state.editor;
    const tr = (key: string) => t(key, state.language);
    const message = renderMessage(state.localized.message ?? state.message, state.language);
    const messageKey = state.localized.message?.key;
    if (messageKey === 'editor.still_unknown' || messageKey === 'editor.saved' ||
        messageKey === 'editor.not_committed' || messageKey === 'editor.conflict') return [paint(message, true)];
    if (e.saveState === 'unknown') return [paint(tr('editor.save_unconfirmed'), true)];
    if (e.sources || e.profiles || e.reuse || e.changeReview) return [];
    if (e.quick) return message ? paintLine({ text: message }, width)
        : e.quick.step === 'appearance' ? [paint(tr('quick.preset-ready'))] : paintLine(quickSampleHelp(state.language), width);
    const localized = state.localized.message;
    if (localized?.key === 'shortcuts.preset-expanded' && typeof localized.params.key === 'string')
        return paintLine(hintLine(localized.key, state.language, { key: localized.params.key }), width);
    if (localized?.key === 'colors.staged' && typeof localized.params.save === 'string')
        return paintLine(hintLine(localized.key, state.language, { save: localized.params.save }), width);
    if (message) return [paint(message, true)];
    const decorationNotice = itemDecorationNotice(state);
    if (e.review) return paintLine(importShortcutHelp(e.review, e.shortcuts, state.language), width);
    if (e.packages || e.taskViewer) return [];
    if (state.input?.kind === 'category') return [paint(tr('catalog.search.choose_category'))];
    if (state.input?.kind === 'search') return paintLine(state.inputDisplay(width), width);
    if (e.detail) {
        const prefix = tr('ui.drawing.item_format');
        if (state.input && decorationNotice) return [paint(decorationNotice)];
        const back = shortcuts([['Ctrl+G', tr('ui.hints.back')]], width - displayWidth(prefix));
        return [paint(prefix), ...back, ...(decorationNotice ? [paint(' · ' + decorationNotice)] : [])];
    }
    if (e.page === 'layout') return paintLine(layoutFormNotice(state) ?? { text: tr('ui.drawing.explicit_rows_priority_width') }, width);
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
