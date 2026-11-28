import type { Draft, Scope, Span } from '../contracts/ui.js';
import type { Editor } from './draft.js';
import { copyDraft } from './draft.js';
import { THEME_IDS, ANSI_ROLES, ANSI_BLOCKS, themeDefinition } from './themes.js';
import { GRADIENT_PRESETS, GRADIENT_SURFACES, parseGradient, gradientName } from './gradients.js';
import { normalizeColor, validColor } from './appearance.js';
import { inputKey, inputView, textInput, type TextInput, type TextKey } from './text-input.js';
import { t, text, type Language, type LocalizedText } from '../i18n/messages.js';
import { displayWidth } from '../unicode/index.js';
import { editorLineSpans, hintLine, type EditorLine } from './hints.js';
type ColorValue = string | string[] | null;
export interface ColorManager {
    kind: 'theme' | 'solid' | 'gradient';
    key: string;
    scope: Scope;
    id: string;
    cursor: number;
    candidate: ColorValue;
    generation: number;
    input: TextInput | null;
    editing: number | null;
    error: boolean;
}
interface Choice {
    id: string;
    label: string;
    value?: ColorValue;
    colors?: readonly string[];
    surface?: string;
}

function draftColor(draft: Draft, key: string, scope: Scope, id: string): ColorValue | undefined {
    if (key === 'field:theme') return draft.display.theme;
    if (key === 'field:powerline.row_background_gradient') return draft.display.powerline.row_background_gradient ?? null;
    const node = (scope === 'main' ? draft.display.instances : draft.display.subagents.instances).find(node => node.id === id);
    return node ? node.options[key.slice(5) as 'foreground' | 'background' | 'foreground_gradient' | 'background_gradient'] ?? null : undefined;
}

function sameColor(left: ColorValue | undefined, right: ColorValue | undefined): boolean {
    if (Array.isArray(left)) return Array.isArray(right) && left.length === right.length && left.every((stop, index) => stop === right[index]);
    return left === right;
}

export function openColors(e: Editor, key: string): boolean {
    if (!['field:powerline.row_background_gradient', 'field:theme', 'item:foreground', 'item:background', 'item:foreground_gradient', 'item:background_gradient'].includes(key))
        return false;
    if (!e.canMutateDraft())
        return true;
    const kind = key === 'field:theme' ? 'theme' : key.endsWith('_gradient') ? 'gradient' : 'solid';
    const scope = e.detail?.scope ?? 'main', id = e.detail?.id ?? '';
    const value = draftColor(e.draft, key, scope, id) ?? null;
    e.colors = { kind, key, scope, id, cursor: 0, candidate: Array.isArray(value) ? [...value] : value, generation: e.mutationGeneration, input: null, editing: null, error: false };
    e.colors.cursor = Math.max(0, choices(e, 'en').findIndex(row => Object.hasOwn(row, 'value') && sameColor(row.value, value)));
    return true;
}
function choices(e: Editor, language: Language): Choice[] {
    const m = e.colors!, tr = (key: string) => t('colors.' + key, language);
    let rows: Choice[];
    if (m.kind === 'theme')
        rows = THEME_IDS.map(id => ({ id, label: t('values.' + id, language), value: id, colors: id === 'terminal' ? (e.draft.display.separator_style === 'powerline' ? ANSI_BLOCKS : ANSI_ROLES).map(value => 'ansi:' + value) : e.draft.display.separator_style === 'powerline' ? themeDefinition(id).backgrounds : themeDefinition(id).foreground, surface: themeDefinition(id).surface }));
    else if (m.kind === 'solid') {
        const definition = themeDefinition(e.draft.display.theme);
        const values = [...new Set([...definition.foreground, ...definition.backgrounds])];
        rows = [{ id: 'inherit', label: tr('inherit'), value: null }, { id: 'default', label: tr('default'), value: 'default' },
            ...Array.from({ length: 16 }, (_, i) => ({ id: 'ansi:' + i, label: 'ANSI ' + i, value: 'ansi:' + i, colors: ['ansi:' + i] })),
            ...values.map(color => ({ id: color, label: color, value: color, colors: [color] })), { id: 'custom', label: tr('custom') }];
    }
    else {
        rows = [{ id: 'off', label: tr('off'), value: null }, ...Object.entries(GRADIENT_PRESETS).map(([id, colors]) => ({ id, label: t('gradients.preset.' + id, language), value: [...colors], colors, surface: GRADIENT_SURFACES[id as keyof typeof GRADIENT_PRESETS] })),
            { id: 'custom', label: tr('custom') }, { id: 'reverse', label: tr('reverse') },
            ...(Array.isArray(m.candidate) ? m.candidate.map((color, i) => ({ id: 'stop:' + i, label: tr('stop') + ' ' + (i + 1) + ' ' + color, colors: [color] })) : []),
            { id: 'add', label: tr('add') }, { id: 'remove', label: tr('remove') }];
    }
    return [...rows, { id: 'apply', label: tr('apply') }, { id: 'cancel', label: tr('cancel') }];
}
export function colorDraft(e: Editor): Draft {
    const m = e.colors;
    if (!m)
        return e.draft;
    const draft = copyDraft(e.draft);
    if (m.key === 'field:powerline.row_background_gradient') draft.display.powerline.row_background_gradient = Array.isArray(m.candidate) ? [...m.candidate] : null;
    else if (m.kind === 'theme')
        draft.display.theme = m.candidate as Draft['display']['theme'];
    else {
        const node = (m.scope === 'main' ? draft.display.instances : draft.display.subagents.instances).find(n => n.id === m.id);
        if (node)
            (node.options as unknown as Record<string, unknown>)[m.key.slice(5)] = Array.isArray(m.candidate) ? [...m.candidate] : m.candidate;
    }
    return draft;
}

export function colorControls(e: Editor): { apply: boolean; enter: string | null } {
    const m = e.colors!;
    const row = choices(e, 'en')[m.cursor];
    if (e.packageLocked || e.saveState !== 'idle' || m.generation !== e.mutationGeneration)
        return { apply: false, enter: null };
    if (m.input) return { apply: false, enter: 'accept' };
    const apply = true;
    const count = Array.isArray(m.candidate) ? m.candidate.length : 0;
    if (!row || row.id === 'reverse' && !count || row.id === 'remove' && count <= 2 || row.id === 'add' && count >= 5)
        return { apply, enter: null };
    if (row.id === 'apply') return { apply, enter: 'accept_draft' };
    if (row.id === 'cancel') return { apply, enter: 'back' };
    if (Object.hasOwn(row, 'value')) return { apply, enter: 'choose_candidate' };
    return { apply, enter: row.id === 'custom' || row.id.startsWith('stop:') ? 'edit' : 'adjust' };
}

export function colorsTitle(e: Editor, language: Language): string {
    const title = t('colors.title', language);
    return e.colors?.kind === 'theme' ? t('fields.global.theme.label', language) + ' · ' + title : title;
}

export function colorsKey(e: Editor, event: TextKey, language: Language, width = 80, height = 10): LocalizedText | null {
    const m = e.colors!, key = event.key;
    const commandKey = !event.text && !event.paste && !event.meta;
    const cancel = commandKey && (key === 'escape' || event.ctrl && key.toLowerCase() === 'g');
    const navigation = commandKey && !event.ctrl && ['up', 'down', 'home', 'end', 'pageup', 'pagedown'].includes(key);
    if ((e.packageLocked || e.saveState !== 'idle' || m.generation !== e.mutationGeneration) && !cancel && !navigation) {
        e.canMutateDraft(m.generation);
        return e.compositionError;
    }
    if (m.input) {
        if (cancel) {
            m.input = null;
            m.error = false;
            return null;
        }
        if (commandKey && !event.ctrl && key === 'return') {
            try {
                if (m.kind === 'gradient' && m.editing === null)
                    m.candidate = parseGradient(m.input.value);
                else if (m.kind === 'gradient') {
                    if (!/^#[0-9a-f]{6}$/iu.test(m.input.value))
                        throw new Error();
                    (m.candidate as string[])[m.editing!] = m.input.value.toLowerCase();
                }
                else {
                    const value = m.input.value === 'inherit' ? null : m.input.value;
                    if (!validColor(value))
                        throw new Error();
                    m.candidate = normalizeColor(value) as string | null;
                }
                m.input = null;
                m.error = false;
            }
            catch {
                m.error = true;
            }
        }
        else {
            const result = inputKey(m.input.value, m.input, event, 256);
            m.input = result.state;
            m.error = !!result.error;
        }
        return null;
    }
    if (event.text || event.paste || event.meta || event.overflow)
        return null;
    if (cancel) {
        e.colors = null;
        return null;
    }
    const rows = choices(e, language);
    if (e.shortcuts.action('colors', event) === 'apply-color' || !event.ctrl && key === 'return' && rows[m.cursor]?.id === 'apply') {
        if (!e.canMutateDraft(m.generation)) return e.compositionError;
        const changed = !sameColor(m.candidate, draftColor(e.draft, m.key, m.scope, m.id));
        if (!e.commitDraft(colorDraft(e))) return text('colors.invalid');
        e.colors = null;
        const context = e.detail ? 'detail' : e.page === 'layout' ? 'layout' : e.advanced ? 'host-settings' : 'settings';
        return changed ? text('colors.staged', { save: e.shortcuts.hint(context, 'save') }) : text('colors.no_changes');
    }
    if (event.ctrl) return null;
    if (['up', 'down', 'pageup', 'pagedown', 'tab'].includes(key)) {
        const page = colorPage(e, language, width, height).capacity;
        const delta = key === 'up' ? -1 : key === 'pageup' ? -page : key === 'pagedown' ? page : 1;
        m.cursor = Math.max(0, Math.min(rows.length - 1, m.cursor + delta));
    }
    if (key === 'home') m.cursor = 0;
    if (key === 'end') m.cursor = rows.length - 1;
    if (key === 'return' || key === 'left' || key === 'right') {
        const selected = rows[m.cursor]!;
        if (selected.id === 'cancel') {
            e.colors = null;
            return null;
        }
        if (Object.hasOwn(selected, 'value'))
            m.candidate = Array.isArray(selected.value) ? [...selected.value] : selected.value!;
        else if (selected.id === 'custom' || selected.id.startsWith('stop:')) {
            m.editing = selected.id.startsWith('stop:') ? Number(selected.id.slice(5)) : null;
            m.input = textInput(m.editing === null ? (m.kind === 'gradient' ? gradientName(m.candidate) : m.candidate === null ? 'inherit' : String(m.candidate)) : (m.candidate as string[])[m.editing]!);
        }
        else if (selected.id === 'reverse' && Array.isArray(m.candidate))
            m.candidate.reverse();
        else if (selected.id === 'add') {
            if (!Array.isArray(m.candidate))
                m.candidate = [...GRADIENT_PRESETS.ocean];
            else if (m.candidate.length < 5)
                m.candidate.push(m.candidate.at(-1)!);
        }
        else if (selected.id === 'remove' && Array.isArray(m.candidate) && m.candidate.length > 2)
            m.candidate.pop();
        m.error = false;
    }
    return null;
}
const plain = (text: string): Span => ({ text, bold: false, foreground: null, background: null });

function colorPage(e: Editor, language: Language, width: number, height: number) {
    const m = e.colors!;
    const tr = (key: string, params?: Record<string, unknown>) => t('colors.' + key, language, params);
    const format = (value: ColorValue | undefined) => {
        if (value === undefined) return tr('unsaved');
        if (value === null) return m.kind === 'gradient' ? t('values.off', language) : tr('inherit');
        if (!Array.isArray(value)) return m.kind === 'theme' ? t('values.' + value, language) : value === 'default' ? tr('default') : value;
        const name = gradientName(value);
        return t('gradients.preset.' + name, language, {}, name);
    };
    const saved = draftColor(e.baseline.draft, m.key, m.scope, m.id);
    const draft = draftColor(e.draft, m.key, m.scope, m.id);
    const savedText = tr('saved', { value: format(saved) });
    const draftText = tr('draft', { value: format(draft) });
    const candidateText = tr('candidate', { value: format(m.candidate) });
    const together = [savedText, draftText, candidateText].join(' · ');
    const pair = savedText + ' · ' + draftText;
    const header = displayWidth(together) <= width ? [together]
        : displayWidth(pair) <= width ? [pair, candidateText]
            : [savedText, draftText, candidateText];
    // Keep the candidate and the focused choice visible even when the host reduces the pane.
    const fixed: EditorLine[] = header.slice(-Math.max(1, height - 1)).map(text => ({ text }));
    const back = e.shortcuts.surface === 'native' ? 'Ctrl+G' : 'Esc/Ctrl+G';
    const help = hintLine('shortcuts.color-help', language, { enter: 'Enter', apply: e.shortcuts.hint('colors', 'apply-color'), back });
    if (colorControls(e).apply && height > fixed.length + 1 && displayWidth(help.text) <= width) fixed.push(help);
    return { fixed, capacity: Math.max(1, height - fixed.length) };
}

export function colorsView(e: Editor, language: Language, width: number, height: number): ((EditorLine | { spans: Span[] }) & { selected: boolean })[] {
    const m = e.colors!, tr = (key: string) => t('colors.' + key, language);
    const back = e.shortcuts.surface === 'native' ? 'Ctrl+G' : 'Esc/Ctrl+G';
    if (m.input) {
        const help = m.error ? { text: tr('invalid') } : hintLine('shortcuts.color-input-help', language, { enter: 'Enter', back, clear: 'Ctrl+U' });
        return [
            { spans: [plain(tr('input'))], selected: false },
            { ...inputView(m.input, width), selected: true },
            { spans: editorLineSpans(help, width).map(span => ({ ...plain(span.text), ...span })), selected: false },
        ];
    }
    const rows = choices(e, language), { fixed, capacity } = colorPage(e, language, width, height);
    const start = Math.floor(m.cursor / capacity) * capacity;
    return [...fixed.map(row => ({ ...row, selected: false })), ...rows.slice(start, start + capacity).map((row, index) => {
        const selected = start + index === m.cursor;
        const chosen = Object.hasOwn(row, 'value') && sameColor(row.value, m.candidate);
        const spans = [plain(selected ? '› ' : '  '), { ...plain(row.label), bold: chosen }];
        if (chosen) spans.push(plain(' ✓'));
        if (row.colors?.length) {
            spans.push(plain(' '));
            for (const color of row.colors) spans.push({ ...plain('██'), foreground: color.startsWith('ansi:') ? { kind: 'ansi', value: Number(color.slice(5)) } : { kind: 'rgb', value: color } });
        }
        if (row.surface) spans.push(plain(' · ' + tr((m.kind === 'theme' ? 'theme_surface_' : 'surface_') + row.surface)));
        return { spans, selected };
    })];
}
