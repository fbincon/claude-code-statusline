import { EDITOR_SHORTCUTS_SCHEMA_VERSION, type EditorShortcutsResult } from '../contracts/ui.js';
import { isLocalizedText, renderMessage, t, text, type Language, type LocalizedText } from '../i18n/messages.js';
import { clip, displayWidth } from '../unicode/index.js';
import { BackendError } from './backend.js';
import {
  SHORTCUT_GROUPS, canAssignKey, isNativeReservedKey, keyToken, listedShortcut, reservedNativeKeys,
  resolveShortcut, shortcutAliases, shortcutConflict, shortcutHint, shortcutKeyLabel,
  type EditorSurface, type ShortcutAction, type ShortcutBindings, type ShortcutConflict, type ShortcutContext,
} from './shortcut-map.js';
import { matchText } from './search.js';
import { formSelection, formWindow } from './navigation.js';
import { inputKey, inputView, textInput, type TextInput, type TextKey } from './text-input.js';
import { wrapText } from './text.js';
import { hintLine, sectionDivider, wrapEditorHints, wrapEditorLine, type EditorLine } from './hints.js';

export type ShortcutEffect = 'read-shortcuts' | 'save-shortcuts';
export const SHORTCUT_PANEL_MIN_COLUMNS = 32;
export const SHORTCUT_PANEL_MIN_ROWS = 12;

export function shortcutPanelFits(columns: number, rows: number): boolean {
  return columns >= SHORTCUT_PANEL_MIN_COLUMNS && rows >= SHORTCUT_PANEL_MIN_ROWS;
}

type Request = (operation: 'read_editor_shortcuts' | 'set_editor_shortcuts', payload?: unknown) => Promise<EditorShortcutsResult>;
const firstActions: Partial<Record<string, readonly ShortcutAction[]>> = {
  editor: ['save', 'finish', 'close', 'undo', 'redo', 'history'],
  components: ['toggle-item', 'search', 'category', 'item-details'],
};
const actions = Object.entries(SHORTCUT_GROUPS).flatMap(([group, entries]) => {
  const first = firstActions[group] ?? [];
  return [...first, ...entries.filter(action => !first.includes(action))].map(key => ({
    group, key, presets: { terminal: listedShortcut('terminal', key, {}), native: listedShortcut('native', key, {}) },
  }));
});
const commands = ['save', 'restore-all', 'reload'] as const;
const surfaces = ['terminal', 'native'] as const;
const widestPreset = Math.max(...actions.flatMap(({ presets }) => surfaces.map(surface => displayWidth(presets[surface]))));
const customKeyWidth = displayWidth('Ctrl+A');

export function defaultShortcuts(warning: LocalizedText | null = null): EditorShortcutsResult {
  return { schema_version: EDITOR_SHORTCUTS_SCHEMA_VERSION, bindings: {}, revision: null, warning };
}

function sameBindings(a: ShortcutBindings, b: ShortcutBindings): boolean {
  return Object.keys(a).length === Object.keys(b).length && (Object.keys(a) as ShortcutAction[]).every(action => a[action] === b[action]);
}

interface ShortcutPanel {
  draft: ShortcutBindings;
  selected: ShortcutAction | null;
  query: string;
  filter: { input: TextInput; selected: ShortcutAction | null } | null;
  command: number | null;
  capture: boolean;
  confirm: { kind: 'close' | 'reload'; discard: boolean } | null;
  message: LocalizedText | null;
  busy: boolean;
  needsReload: boolean;
  restore: boolean;
}

const actionMessage = (action: ShortcutAction) => text('shortcuts.action.' + action);

function matchingActions(panel: ShortcutPanel, language: Language): typeof actions {
  const query = panel.filter?.input.value ?? panel.query;
  return query.trim() ? actions.filter(({ key }) => matchText(key, query) ||
    matchText(renderMessage(actionMessage(key), language), query)) : actions;
}

function conflictMessage(conflict: ShortcutConflict): LocalizedText {
  return text('shortcuts.conflict', { key: shortcutKeyLabel(conflict.key), first: actionMessage(conflict.first), second: actionMessage(conflict.second), editor: text('shortcuts.' + conflict.surface) });
}

export class EditorShortcuts {
  snapshot: EditorShortcutsResult = defaultShortcuts();
  panel: ShortcutPanel | null = null;
  private reloadReason: LocalizedText | null = null;

  constructor(readonly surface: EditorSurface) {}

  action(context: ShortcutContext, event: TextKey): ShortcutAction | null {
    return resolveShortcut(this.surface, context, event, this.snapshot.bindings);
  }

  hint(context: ShortcutContext, ...actions: ShortcutAction[]): string {
    return shortcutHint(this.surface, context, this.snapshot.bindings, ...actions);
  }

  aliases(context: ShortcutContext, action: ShortcutAction): string {
    return shortcutAliases(this.surface, context, this.snapshot.bindings, action);
  }

  open(): void {
    const warning = this.reloadReason ?? (this.snapshot.warning?.key === 'shortcuts.read-failed' ? this.snapshot.warning : null);
    this.panel = { draft: { ...this.snapshot.bindings }, selected: actions[0]!.key, query: '', filter: null, command: null,
      capture: false, confirm: null, message: warning, busy: false, restore: false, needsReload: warning !== null };
  }

  private dirty(panel: ShortcutPanel): boolean {
    return panel.restore || !sameBindings(panel.draft, this.snapshot.bindings);
  }

  key(event: TextKey, language: Language, width: number, height: number, shift = false): ShortcutEffect | null {
    const panel = this.panel;
    if (!panel || panel.busy || event.meta || event.overflow) return null;
    const key = event.key === 'enter' ? 'return' : event.key;
    const commandKey = !event.text && !event.paste;
    const cancel = commandKey && (event.ctrl && key.toLowerCase() === 'g' || !event.ctrl && (key === 'escape' || key === 'esc'));
    if (panel.filter) {
      const filter = panel.filter;
      if (cancel) {
        panel.selected = filter.selected;
        panel.filter = null;
        panel.message = null;
      } else if (commandKey && !event.ctrl && key === 'return') {
        panel.query = filter.input.value;
        panel.filter = null;
        panel.message = null;
      } else {
        const before = filter.input.value;
        const result = inputKey(before, filter.input, commandKey && key === 'space' ? { ...event, key: ' ' } : event, 256);
        filter.input = result.state;
        panel.message = result.error ? text('input.' + result.error, { limit: 256 }) : null;
        if (before !== result.state.value) {
          const matches = matchingActions(panel, language);
          if (!matches.some(({ key }) => key === panel.selected)) panel.selected = matches[0]?.key ?? null;
        }
      }
      return null;
    }
    if (!commandKey) return null;
    if (cancel) {
      if (panel.capture) { panel.capture = false; panel.message = null; }
      else if (panel.confirm) panel.confirm = null;
      else if (this.dirty(panel)) panel.confirm = { kind: 'close', discard: false };
      else this.panel = null;
      return null;
    }
    if (panel.confirm) {
      if (event.ctrl) return null;
      if (key === 'down' || key === 'up') panel.confirm.discard = key === 'down';
      else if (key === 'return') {
        const { discard, kind } = panel.confirm;
        panel.confirm = null;
        if (discard && kind === 'reload') return 'read-shortcuts';
        if (discard) this.panel = null;
      }
      return null;
    }
    if (panel.capture) {
      const token = keyToken(event), action = panel.selected!;
      if (token === 'Ctrl+C' && this.surface === 'terminal') panel.message = text('shortcuts.interrupt-key');
      else if (token !== null && isNativeReservedKey(action, token)) panel.message = text('shortcuts.host-key', { key: token });
      else if (token === null || !canAssignKey(action, token)) panel.message = text(action === 'save-source' ? 'shortcuts.source-key' : 'shortcuts.unavailable-key');
      else {
        panel.draft[action] = token;
        panel.capture = false;
        panel.message = null;
      }
      return null;
    }
    if (event.ctrl) return null;
    if (key === 'tab') panel.command = panel.command === null ? (shift ? commands.length - 1 : 0) : null;
    else if (panel.command !== null) {
      if (['up', 'down', 'left', 'right'].includes(key)) {
        const delta = key === 'up' || key === 'left' ? -1 : 1;
        panel.command = Math.max(0, Math.min(commands.length - 1, panel.command + delta));
      } else if (key === 'return') {
        if (commands[panel.command] === 'save') {
          if (panel.needsReload) panel.message = text('shortcuts.reload-first');
          else if (shortcutConflict(panel.draft)) panel.message = null;
          else if (this.dirty(panel) || this.snapshot.warning?.key === 'shortcuts.ignored-bindings') return 'save-shortcuts';
        } else if (commands[panel.command] === 'restore-all') {
          panel.draft = {};
          panel.restore = this.snapshot.warning?.key === 'shortcuts.invalid';
          panel.message = text('shortcuts.restored');
        } else if (!this.dirty(panel)) return 'read-shortcuts';
        else panel.confirm = { kind: 'reload', discard: false };
      }
    } else if (key === '/') {
      panel.filter = { input: textInput(panel.query), selected: panel.selected };
      panel.message = null;
    } else if (!panel.selected) return null;
    else if (key === 'return') {
      panel.capture = true;
      panel.message = null;
    } else if (key === 'delete') {
      delete panel.draft[panel.selected];
      panel.message = null;
    } else if (key === 'pageup' || key === 'pagedown') {
      const matches = matchingActions(panel, language);
      const { listRows } = shortcutPanelLayout(this, language, width, height, matches);
      panel.selected = formSelection(matches, panel.selected, listRows, key === 'pageup' ? -1 : 1) || null;
    } else if (['up', 'down', 'home', 'end'].includes(key)) {
      const matches = matchingActions(panel, language);
      const index = matches.findIndex(row => row.key === panel.selected);
      const next = key === 'home' ? 0 : key === 'end' ? matches.length - 1
        : Math.max(0, Math.min(matches.length - 1, index + (key === 'up' ? -1 : 1)));
      panel.selected = matches[next]?.key ?? null;
    }
    return null;
  }

  async perform(effect: ShortcutEffect, request: Request, isCurrent: () => boolean = () => true): Promise<void> {
    const panel = this.panel;
    if (!panel || panel.busy) return;
    const live = () => isCurrent() && this.panel === panel;
    const requireRead = (notice: LocalizedText) => {
      this.reloadReason = notice;
      panel.message = notice;
      panel.needsReload = true;
    };
    const loaded = (result: EditorShortcutsResult, message: LocalizedText | null) => {
      this.snapshot = result;
      this.reloadReason = null;
      panel.draft = { ...result.bindings };
      panel.message = message;
      panel.needsReload = false;
      panel.restore = false;
    };
    panel.busy = true;
    try {
      if (effect === 'read-shortcuts') {
        const result = await request('read_editor_shortcuts');
        if (!live()) return;
        if (result.warning?.key === 'shortcuts.read-failed') requireRead(result.warning);
        else loaded(result, result.warning ?? text('shortcuts.reloaded'));
        return;
      }
      if (panel.needsReload) return;
      const bindings = { ...panel.draft }, expected_revision = this.snapshot.revision;
      try {
        const result = await request('set_editor_shortcuts', { bindings, expected_revision });
        if (!live()) return;
        if (result.warning || !sameBindings(bindings, result.bindings)) throw new Error('Unexpected shortcut save result');
        loaded(result, text('shortcuts.saved'));
      } catch (error) {
        if (!live()) return;
        const failure = error instanceof BackendError ? error.localization : null;
        if (failure?.key === 'shortcuts.changed') { requireRead(failure); return; }
        const recoveryRequired = failure?.key === 'recovery.required';
        if (!recoveryRequired && error instanceof BackendError && ['invalid_request', 'invalid_configuration', 'configuration_conflict', 'unsupported_protocol', 'unsupported_operation'].includes(error.code)) throw error;
        const result = await request('read_editor_shortcuts').catch(() => null);
        if (!live()) return;
        if (result && !result.warning && sameBindings(bindings, result.bindings)) loaded(result, text('shortcuts.saved'));
        else if (!result || result.warning?.key === 'shortcuts.read-failed') requireRead(result?.warning ?? text('shortcuts.unknown'));
        else if (recoveryRequired) requireRead(text('shortcuts.read-recovery'));
        else if (result.revision !== expected_revision) requireRead(text('shortcuts.changed'));
        else throw error;
      }
    } catch (error) {
      if (live()) {
        const message = error instanceof BackendError && error.localization ? error.localization : text('shortcuts.failed', { detail: error instanceof Error ? error.message : String(error) });
        if (effect === 'read-shortcuts') requireRead(message);
        else panel.message = message;
      }
    } finally {
      panel.busy = false;
    }
  }
}

type PanelAction = (typeof actions)[number];
interface PanelRow extends EditorLine { kind?: 'columns' | 'group' | 'detail'; selected?: boolean }
interface MenuSpan { text: string; selected: boolean }

function currentKeys(action: PanelAction, surface: EditorSurface, bindings: ShortcutBindings): string {
  return bindings[action.key] ? listedShortcut(surface, action.key, bindings) : action.presets[surface];
}

function actionDetails(action: PanelAction, language: Language, bindings: ShortcutBindings, width: number): PanelRow[] {
  const compact = width < 48;
  const keyText = (key: string) => compact ? key.replaceAll(' / ', '/') : key;
  const sides = surfaces.flatMap(surface => action.presets[surface] ? [{
    label: t('shortcuts.' + surface + '-short', language),
    keys: keyText(currentKeys(action, surface, bindings)) + ' [' + keyText(action.presets[surface]) + ']',
  }] : []);
  const details = compact && sides.length === 2 && sides[0]!.keys === sides[1]!.keys
    ? [sides.map(side => side.label).join('/') + ' ' + sides[0]!.keys]
    : sides.map(side => side.label + ' ' + side.keys);
  const combined = details.join(' · ');
  const lines = displayWidth(combined) <= width ? [combined] : wrapText(details, width);
  return lines.map(text => ({ text, kind: 'detail' }));
}

function shortcutMenu(command: number | null, language: Language, width: number): MenuSpan[] {
  const items = commands.map((key, index) => {
    const selected = command === index;
    return { text: (selected ? '› ' : '  ') + t('shortcuts.' + key, language), selected };
  });
  const divider = { text: ' · ', selected: false };
  if (displayWidth(items.map(item => item.text).join(divider.text)) > width) return [items[command ?? 0]!];
  return items.flatMap((item, index) => index ? [divider, item] : [item]);
}

function shortcutTable(editor: EditorShortcuts, language: Language, width: number, showDefaults: boolean) {
  const option = t('ui.drawing.option', language).trim();
  const current = t(showDefaults ? 'shortcuts.current-key' : 'ui.drawing.value', language).trim();
  const preset = t('shortcuts.default-key', language);
  const alternate = editor.surface === 'native' ? 'terminal' : 'native';
  const otherLabel = t('shortcuts.' + alternate + '-short', language);
  const otherKeyWidth = Math.max(customKeyWidth, ...actions.filter(row => !row.presets[editor.surface])
    .map(row => displayWidth(row.presets[alternate])));
  const keyWidth = Math.max(displayWidth(current), widestPreset, displayWidth(otherLabel) + 1 + otherKeyWidth);
  const presetWidth = Math.max(displayWidth(preset), widestPreset);
  const optionWidth = Math.max(1, Math.min(44, width - 4 - keyWidth - (showDefaults ? 2 + presetWidth : 0)));
  const pad = (value: string, cells: number) => {
    const visible = clip(value, cells);
    return visible + ' '.repeat(cells - displayWidth(visible));
  };
  const line = (marker: string, label: string, binding: string, defaultBinding: string) => {
    const prefix = marker + pad(label, optionWidth) + '  ';
    return showDefaults ? prefix + pad(binding, keyWidth) + '  ' + defaultBinding : prefix + binding;
  };
  return {
    heading: line('  ', option, current, preset),
    row(action: PanelAction, selected: boolean): PanelRow {
      const surface = action.presets[editor.surface] ? editor.surface : alternate;
      const value = currentKeys(action, surface, editor.panel!.draft) + (surface === alternate ? ' ' + otherLabel : '');
      return { selected, text: line(selected ? '› ' : '  ', renderMessage(actionMessage(action.key), language), value, action.presets[surface]) };
    },
  };
}

function shortcutPanelLayout(editor: EditorShortcuts, language: Language, columns: number, rows: number, matches: PanelAction[]) {
  const panel = editor.panel!;
  const framed = columns >= 64 && rows >= 20;
  const headerRows = columns >= 64 && rows >= 18 ? 2 : 1;
  const width = columns - (framed ? 2 : 0) - (editor.surface === 'terminal' ? 2 : 0);
  const height = rows - headerRows - (framed ? 2 : 1);
  const geometry = { framed, headerRows, innerWidth: width, height };
  const tr = (key: string, params?: Record<string, unknown>) => t('shortcuts.' + key, language, params);
  const hint = (key: string, keys: Record<string, string>) => wrapEditorHints(hintLine('shortcuts.' + key, language, keys), columns);
  const paragraphs = (value: string): PanelRow[] => wrapText([value], width).map(text => ({ text }));

  if (panel.confirm) {
    const { kind, discard } = panel.confirm;
    const footer = hint('confirm-help', { arrows: '↑↓', enter: 'Enter', back: 'Ctrl+G' });
    const before = paragraphs(tr(kind === 'close' ? 'confirm-close' : 'confirm-reload'))
      .slice(0, Math.max(0, height - footer.length - 2));
    before.push(
      { text: clip((discard ? '  ' : '› ') + tr('keep'), width), selected: !discard },
      { text: clip((discard ? '› ' : '  ') + tr('discard'), width), selected: discard },
    );
    return { ...geometry, before, after: [], listRows: 0, tableHeading: false, menu: [], footer };
  }

  const selected = matches.find(row => row.key === panel.selected);
  const filtering = panel.filter !== null;
  const conflict = !filtering && !panel.capture && !panel.busy && !panel.message ? shortcutConflict(panel.draft) : null;
  const notice = panel.busy ? text('shortcuts.working') : panel.message ??
    (panel.capture || filtering ? null : conflict ? conflictMessage(conflict) : editor.snapshot.warning);
  const detail = notice?.key === 'shortcuts.read-failed' ? notice.params.detail : notice;
  const instruction = isLocalizedText(detail) && ['shortcuts.read-busy', 'shortcuts.read-recovery'].includes(detail.key);
  const messages = notice ? paragraphs(renderMessage(instruction ? detail : notice, language)) : [];
  const details = selected && !filtering ? actionDetails(selected, language, panel.draft, width) : [];
  if (panel.capture && selected) {
    const reserved = reservedNativeKeys(selected.key);
    const captureHelp = reserved.length ? tr('capture-host-help', { keys: reserved.join(', ') }) : tr('capture');
    const footer = [...wrapEditorLine({ text: captureHelp }, columns), ...hint('cancel-help', { back: 'Ctrl+G' })];
    const before = [...paragraphs(tr('capture-action', { action: actionMessage(selected.key) })), ...messages, ...details]
      .slice(0, height - footer.length);
    return { ...geometry, before, after: [], listRows: 0, tableHeading: false, menu: [], footer };
  }

  const before: PanelRow[] = [];
  const query = panel.filter?.input.value ?? panel.query;
  if (filtering || query.trim()) {
    const prefix = tr('filter') + ' ';
    const value = panel.filter ? inputView({ ...panel.filter.input }, width - displayWidth(prefix)) : query;
    before.push({ text: clip(prefix + value, width) });
  }
  if (!matches.length) before.push(...paragraphs(tr('no-matches')));
  const menu = filtering || panel.busy ? [] : shortcutMenu(panel.command, language, width);
  const fixedHelp = panel.busy ? [] : filtering
    ? hint('filter-help', { enter: 'Enter', back: 'Ctrl+G', clear: 'Ctrl+U' })
    : hint('back-help', { tab: 'Tab', back: 'Ctrl+G' });
  const contextHelp = panel.busy || filtering || instruction ? [] : panel.command !== null
    ? hint('command-help', { arrows: '←→', enter: 'Enter' })
    : matches.length ? hint('list-help', { filter: '/', enter: 'Enter', restore: 'Delete' })
      : hint('filter-only', { filter: '/' });
  const minimumList = matches.length ? 2 : 0; // One action and its group.
  const requiredRows = before.length + Number(menu.length > 0) + minimumList;
  const instructionRows = instruction ? messages.length : 0;
  const footer = [...contextHelp, ...fixedHelp];
  const navigation = '↑↓ PgUp/PgDn Home/End';
  const detailHeight = width >= 90 ? 1 : 2;
  if (!panel.busy && !filtering && panel.command === null && matches.length && !instruction && columns >= 64 &&
      height - requiredRows - footer.length > detailHeight + 1) {
    footer.unshift({ text: navigation + ' ' + t('ui.hints.select', language), keys: [{ start: 0, end: navigation.length }] });
  }
  let remaining = height - footer.length - requiredRows;
  const tableHeading = matches.length > 0 && remaining > instructionRows;
  remaining -= Number(tableHeading);
  const shownMessages = messages.slice(0, Math.max(0, instruction ? remaining : Math.min(4, remaining)));
  // Reserve a fixed detail area so paging does not change when bindings wrap on a new selection.
  const detailRows = selected && !filtering ? Math.max(0, Math.min(detailHeight, remaining - shownMessages.length)) : 0;
  const listRows = minimumList + Math.max(0, remaining - shownMessages.length - detailRows);
  const after = [...details.slice(0, detailRows), ...shownMessages];
  return { ...geometry, before, after, listRows, tableHeading, menu, footer };
}

export function shortcutPanelView(editor: EditorShortcuts, language: Language, columns: number, rows: number) {
  const panel = editor.panel!;
  const matches = matchingActions(panel, language);
  const { height, before, after, listRows, tableHeading, ...geometry } = shortcutPanelLayout(editor, language, columns, rows, matches);
  const width = geometry.innerWidth;
  const body = [...before];
  if (listRows > 0 && matches.length) {
    const table = shortcutTable(editor, language, width, columns >= 80);
    if (tableHeading) body.push({ text: table.heading, kind: 'columns' });
    const window = formWindow(matches, panel.selected ?? '', listRows);
    for (const line of window.lines) {
      if (line.index === null) {
        body.push({ text: sectionDivider(t('shortcuts.group.' + line.group, language), width), kind: 'group' });
      } else {
        const action = matches[line.index]!;
        body.push(table.row(action, panel.command === null && action.key === panel.selected));
      }
    }
  }
  body.push(...after);
  return { ...geometry, body, bodyHeight: height - geometry.footer.length };
}
