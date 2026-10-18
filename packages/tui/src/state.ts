import { Editor, copyDraft } from '@fbincon/statusline-core/editor/draft';
import { formRows, setFormValue, adjustForm, type FormRow, type SettingRow } from '@fbincon/statusline-core/editor/forms';
import { navigateReview } from '@fbincon/statusline-core/editor/import-review';
import { graphemes } from '@fbincon/statusline-core/unicode/index';
import { LANGUAGES, LANGUAGE_NAMES, text, type Language, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import type { DescribeResult, ReadResult, PreviewResult, Scope } from '@fbincon/statusline-core/contracts/ui';
import type { Key } from '@fbincon/statusline-core/terminal/key';
import { dimensions, formWindow } from './layout.js';
export type Effect = 'save' | 'cancel' | 'interrupt' | 'language' | 'transfer' | null;
type Input = {
    kind: 'search';
    original: string;
    selected: string;
} | {
    kind: 'category';
    selected: string;
} | {
    kind: 'field' | 'path';
    key: string;
    buffer: string;
    original?: string;
} | {
    kind: 'numeric';
    field: 'padding' | 'refresh_interval';
    before: number | 'event';
    buffer: string;
};
export interface Row extends SettingRow {
    kind: 'legacy' | 'action' | 'choice' | 'integer' | 'text' | 'boolean';
    form?: FormRow;
}
const pages = ['main', 'subagents', 'settings', 'layout'] as const;
const groups = ['Appearance', 'Refresh / behavior', 'Git metrics', 'Formatting', 'Risk colors', 'Subagent visibility', 'Presets / portable files', 'Interface'];
const backspace = (value: string) => graphemes(value).slice(0, -1).join('');
const printable = (key: Key) => !key.ctrl && !key.meta && [...key.key].length === 1 && !/[\p{Cc}\p{Cs}]/u.test(key.key);
/** External-editor navigation and drafts. All persistence is supplied by Session. */
export class State {
    editor: Editor;
    input: Input | null = null;
    preview: PreviewResult | null = null;
    message = '';
    localized: {
        message?: LocalizedText;
    } = {};
    pendingLanguage: Language | null = null;
    scroll: Record<string, number> = {};
    constructor(description: DescribeResult, current: ReadResult, public language: Language = 'en') { this.editor = new Editor(description, current); }
    get scope(): Scope { return this.editor.page === 'subagents' ? 'subagent' : 'main'; }
    get form(): boolean { return !!this.editor.detail || ['settings', 'layout'].includes(this.editor.page); }
    get modified(): boolean {
        const input = this.input;
        return this.editor.modified || (input?.kind === 'field' && input.buffer !== input.original);
    }
    notice(value: string | LocalizedText): void { this.message = typeof value === 'string' ? value : value.fallback; this.localized = typeof value === 'string' ? {} : { message: value }; }
    rows(): Row[] {
        const e = this.editor, d = e.draft.display, h = e.draft.host;
        const fields = formRows(this).map(form => ({ ...form, key: form.key === 'layout.mode' ? 'layout-mode' : form.key, form, kind: form.spec.kind }));
        const row = (key: string, label: string, value: string, group: string, kind: Row['kind'] = 'legacy'): Row => ({ key, label, value, group, kind, editable: true });
        if (e.detail)
            return [row('item-guidance', 'Sources and requirements', '', 'Item format', 'action'), ...fields];
        if (e.page === 'layout')
            return fields;
        const result: Row[] = [
            row('colors', 'Use colors', d.use_colors ? 'on' : 'off', 'Appearance'), row('palette', 'Palette', d.palette, 'Appearance'),
            row('directory-style', 'Directory style', d.directory_style, 'Appearance'), row('separator-style', 'Separator style', d.separator_style, 'Appearance'),
            row('padding', 'Padding', e.buffers.padding, 'Refresh / behavior'), row('refresh_interval', 'Refresh interval', e.buffers.refresh_interval, 'Refresh / behavior'),
            row('vim-indicator', 'Built-in Vim indicator', h.hide_vim_mode_indicator ? 'hide' : 'show', 'Refresh / behavior'),
            row('scope-labels', 'Scope labels', d.scope_labels, 'Appearance'), row('custom-subagent-rows', 'Custom subagent rows', d.subagents.enabled ? 'on' : 'off', 'Refresh / behavior'),
            ...fields,
            row('preset-select', 'Preset', e.preset, 'Presets / portable files', 'choice'),
            ...['preset-apply', 'import-file', 'export-file'].map(key => row(key, key, '', 'Presets / portable files', 'action')),
            row('ui-language', 'Interface language (saved immediately)', LANGUAGE_NAMES[this.language], 'Interface', 'choice'),
        ];
        return result.sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group));
    }
    selectedRow(): Row { const rows = this.rows(); return rows.find(row => row.key === this.editor.setting) ?? rows[0]!; }
    ensureVisible(height: number): void {
        const e = this.editor, slot = this.form ? e.detail ? 'detail' : e.page : this.scope;
        if (this.form) {
            const rows = this.rows(), index = Math.max(0, rows.findIndex(row => row.key === e.setting));
            e.setting = rows[index]?.key ?? '';
            this.scroll[slot] = formWindow(rows, index, this.scroll[slot] ?? 0, height).start;
        }
        else {
            const ids = e.visible(this.scope).map(row => row.id), index = Math.max(0, ids.indexOf(e.selected[this.scope]));
            e.selected[this.scope] = ids[index] ?? '';
            const start = this.scroll[slot] ?? 0;
            this.scroll[slot] = Math.max(0, Math.min(start, index, Math.max(0, ids.length - height)));
            if (index >= this.scroll[slot]! + height)
                this.scroll[slot] = index - height + 1;
        }
    }
    search(value: string): void { this.editor.filter(this.scope, [...value].slice(0, 256).join('')); }
    adjust(delta: -1 | 1): Effect {
        const e = this.editor, row = this.selectedRow(), d = e.draft.display;
        if (row.form) {
            adjustForm(this, row.form, delta);
            return null;
        }
        const cycle = <T>(values: readonly T[], value: T): T => values[(values.indexOf(value) + delta + values.length) % values.length]!;
        switch (row.key) {
            case 'ui-language':
                this.pendingLanguage = cycle(LANGUAGES, this.language);
                return 'language';
            case 'preset-select':
                e.preset = cycle(e.description.presets.map(p => p.id), e.preset);
                break;
            case 'colors':
                d.use_colors = !d.use_colors;
                break;
            case 'palette':
                d.palette = cycle(e.description.options.palette.choices, d.palette) as typeof d.palette;
                break;
            case 'directory-style':
                d.directory_style = cycle(e.description.options['directory-style'].choices, d.directory_style) as typeof d.directory_style;
                break;
            case 'separator-style':
                d.separator_style = cycle(e.description.options['separator-style'].choices, d.separator_style) as typeof d.separator_style;
                break;
            case 'scope-labels':
                d.scope_labels = cycle(e.description.options['scope-labels'].choices, d.scope_labels) as typeof d.scope_labels;
                break;
            case 'vim-indicator':
                e.draft.host.hide_vim_mode_indicator = !e.draft.host.hide_vim_mode_indicator;
                break;
            case 'custom-subagent-rows':
                d.subagents.enabled = !d.subagents.enabled;
                break;
            case 'padding':
                e.draft.host.padding = Math.max(0, Math.min(32, e.draft.host.padding + delta));
                e.cancelNumeric('padding');
                break;
            case 'refresh_interval': {
                const current = e.draft.host.refresh_interval;
                const choices: (number | 'event')[] = ['event', ...[...new Set([1, 2, 5, 10, 30, 60, 300, 600, 3600, ...(current === 'event' ? [] : [current])])].sort((a, b) => a - b)];
                e.draft.host.refresh_interval = cycle(choices, current);
                e.cancelNumeric('refresh_interval');
                break;
            }
        }
        return null;
    }
    private numeric(field: 'padding' | 'refresh_interval', value: string): void {
        const e = this.editor;
        if (this.input?.kind !== 'numeric')
            this.input = { kind: 'numeric', field, before: e.draft.host[field], buffer: '' };
        const input = this.input;
        input.buffer = value;
        e.setBuffer(field, value);
        // Preserve the last valid number while showing an invalid partial edit.
        if (e.acceptNumeric(field)) {
            e.setBuffer(field, value);
            this.notice('');
        }
        else
            this.notice(e.fieldErrorMessages[field] ?? e.fieldErrors[field] ?? '');
    }
    key(event: Key, columns = 80, rows = 24): Effect {
        const e = this.editor, k = event.key, ctrl = event.ctrl === true, cancel = k === 'escape' || (ctrl && k === 'g');
        const size = dimensions(columns, rows), height = size.listHeight;
        if (ctrl && k === 'c')
            return 'interrupt';
        if (!size.available)
            return k === 'escape' ? 'cancel' : null;
        if (event.paste && !this.input && this.form)
            return null;
        if (e.review) {
            if (cancel || (!ctrl && k.toLowerCase() === 'q')) {
                e.review = null;
                this.notice(text('review.cancelled'));
            }
            else if (!ctrl && k.toLowerCase() === 'a') {
                e.replaceDraft(copyDraft(e.review.result.draft));
                this.notice(text('review.accepted'));
            }
            else if (!ctrl)
                navigateReview(e.review, k, this.language, size.content.innerWidth, size.content.innerHeight - 1);
            return null;
        }
        if (e.guidanceScroll !== null) {
            if (cancel) {
                e.guidanceScroll = null;
                if (e.adding)
                    e.detail = null;
            }
            else if (k === 'up' || k === 'pageup')
                e.guidanceScroll = Math.max(0, e.guidanceScroll - (k === 'up' ? 1 : height));
            else if (k === 'down' || k === 'pagedown')
                e.guidanceScroll += k === 'down' ? 1 : height;
            else if (k === 'home')
                e.guidanceScroll = 0;
            else if (k === 'end')
                e.guidanceScroll = 1000000;
            return null;
        }
        const input = this.input;
        if (input) {
            if (cancel) {
                if (input.kind === 'search') {
                    e.filter(this.scope, input.original);
                    e.selected[this.scope] = input.selected;
                }
                if (input.kind === 'numeric') {
                    if (input.field === 'padding')
                        e.draft.host.padding = input.before as number;
                    else
                        e.draft.host.refresh_interval = input.before;
                    e.cancelNumeric(input.field);
                }
                this.input = null;
                this.notice('');
                return null;
            }
            if (input.kind === 'category') {
                const categories = e.categories(this.scope), index = categories.indexOf(input.selected);
                if (k === 'return') {
                    e.chooseCategory(this.scope, input.selected);
                    this.input = null;
                }
                else if (['up', 'left', 'down', 'right', 'home', 'pageup', 'end', 'pagedown'].includes(k))
                    input.selected = categories[k === 'home' || k === 'pageup' ? 0 : k === 'end' || k === 'pagedown' ? categories.length - 1 : Math.max(0, Math.min(categories.length - 1, index + (k === 'up' || k === 'left' ? -1 : 1)))]!;
            }
            else if (input.kind === 'search') {
                if (k === 'return')
                    this.input = null;
                else if (ctrl && k === 'u')
                    this.search('');
                else if (k === 'backspace')
                    this.search(backspace(e.search[this.scope]));
                else if (printable(event))
                    this.search(e.search[this.scope] + k);
            }
            else if (input.kind === 'numeric') {
                if (k === 'return' && e.acceptNumeric(input.field)) {
                    this.input = null;
                    this.notice('');
                }
                else if (k === 'backspace')
                    this.numeric(input.field, input.buffer.slice(0, -1));
                else if (!ctrl && /^\d$/u.test(k) && input.buffer.length < 32)
                    this.numeric(input.field, input.buffer + k);
            }
            else {
                if (ctrl && k === 'u')
                    input.buffer = '';
                else if (k === 'backspace' || k === 'delete')
                    input.buffer = backspace(input.buffer);
                else if (k === 'return') {
                    if (input.kind === 'path') {
                        if (!input.buffer.trim()) {
                            this.notice(text('native.lib.client.keys.enter_a_file_path'));
                            return null;
                        }
                        e.path = input.buffer;
                        e.pendingTransfer = input.key === 'import-file' ? 'import' : 'export';
                        this.input = null;
                        return 'transfer';
                    }
                    const field = this.rows().find(row => row.key === input.key)?.form;
                    if (field && setFormValue(this, field, input.buffer)) {
                        this.input = null;
                        this.notice('');
                    }
                }
                else if (printable(event) && [...input.buffer].length < 4096)
                    input.buffer += k;
            }
            this.ensureVisible(height);
            return null;
        }
        if (e.adding && cancel) {
            e.closePicker(this.scope);
            return null;
        }
        if (ctrl && k === 'g' && e.detail) {
            e.detail = null;
            return null;
        }
        if (!this.form) {
            if (ctrl && k === 'a' && !e.adding) {
                e.openPicker(this.scope);
                return null;
            }
            if (ctrl && (k === 'd' || k === 'x') && !e.adding) {
                if (!e.instanceAction(this.scope, k === 'd' ? 'copy' : 'remove'))
                    this.notice(text('composition.invalid'));
                this.ensureVisible(height);
                return null;
            }
            if (ctrl && k === 'f') {
                this.input = { kind: 'category', selected: e.category[this.scope] };
                return null;
            }
            if (k === '/') {
                this.input = { kind: 'search', original: e.search[this.scope], selected: e.selected[this.scope] };
                return null;
            }
            if (ctrl && k === 'e' && e.selected[this.scope]) {
                e.detail = { scope: this.scope, id: e.selected[this.scope] };
                e.setting = 'item:label';
                if (e.adding)
                    e.guidanceScroll = 0;
                return null;
            }
            if (e.adding && k === 'return') {
                if (!e.toggle(this.scope, e.selected[this.scope]))
                    this.notice(text('composition.invalid'));
                return null;
            }
        }
        if (ctrl && k === 's')
            return 'save';
        if (k === 'escape')
            return 'cancel';
        if (k === 'return') {
            if (!this.form || this.selectedRow().kind === 'legacy')
                return 'save';
            const row = this.selectedRow();
            if (row.key === 'item-guidance')
                e.guidanceScroll = 0;
            else if (row.key === 'preset-apply') {
                e.pendingTransfer = 'preset';
                return 'transfer';
            }
            else if (row.key === 'import-file' || row.key === 'export-file')
                this.input = { kind: 'path', key: row.key, buffer: e.path };
            else if (row.kind === 'integer' || row.kind === 'text')
                this.input = { kind: 'field', key: row.key, buffer: row.value, original: row.value };
            else
                return this.adjust(1);
            return null;
        }
        if (k === 'tab' && !e.adding) {
            e.page = pages[(pages.indexOf(e.page) + (event.shift ? 3 : 1)) % 4]!;
            e.detail = null;
        }
        else if (['up', 'down', 'home', 'end', 'pageup', 'pagedown'].includes(k)) {
            const ids = this.form ? this.rows().map(row => row.key) : e.visible(this.scope).map(row => row.id);
            let index = Math.max(0, ids.indexOf(this.form ? e.setting : e.selected[this.scope]));
            index = k === 'home' ? 0 : k === 'end' ? ids.length - 1 : index + (k === 'up' || k === 'pageup' ? -1 : 1) * (k === 'pageup' || k === 'pagedown' ? height : 1);
            const next = ids[Math.max(0, Math.min(ids.length - 1, index))] ?? '';
            if (this.form)
                e.setting = next;
            else
                e.selected[this.scope] = next;
        }
        else if (k === 'left' || k === 'right' || k === ' ') {
            if (this.form) {
                const effect = this.adjust(k === 'left' ? -1 : 1);
                if (effect)
                    return effect;
            }
            else if (!(k === ' ' ? e.toggle(this.scope, e.selected[this.scope]) : e.move(this.scope, k === 'left' ? -1 : 1))) {
                if (e.visible(this.scope).length)
                    this.notice(text(e.filtered(this.scope) && k !== ' ' ? 'catalog.search.order_disabled' : 'composition.invalid'));
            }
        }
        else if (!this.form) {
            if (ctrl && k === 'u')
                this.search('');
            else if (k === 'backspace')
                this.search(backspace(e.search[this.scope]));
            else if (printable(event))
                this.search(e.search[this.scope] + k);
        }
        else if (!e.detail && e.page === 'settings' && !ctrl) {
            const row = this.selectedRow();
            if (k === 'e' && row.key === 'refresh_interval') {
                e.draft.host.refresh_interval = 'event';
                e.cancelNumeric('refresh_interval');
            }
            else if (/^\d$/u.test(k) && (row.key === 'padding' || row.key === 'refresh_interval'))
                this.numeric(row.key, k);
        }
        this.ensureVisible(height);
        return null;
    }
}
