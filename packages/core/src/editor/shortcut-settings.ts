import { EDITOR_SHORTCUTS_SCHEMA_VERSION, type EditorShortcutsResult } from '../contracts/ui.js';
import { renderMessage, t, text, type Language, type LocalizedText } from '../i18n/messages.js';
import { displayWidth } from '../unicode/index.js';
import { BackendError } from './backend.js';
import {
  SHORTCUT_GROUPS, canAssignKey, isNativeReservedKey, keyToken, listedShortcut, reservedNativeKeys,
  resolveShortcut, shortcutAliases, shortcutConflict, shortcutHint, shortcutKeyLabel,
  type EditorSurface, type ShortcutAction, type ShortcutBindings, type ShortcutConflict, type ShortcutContext,
} from './shortcut-map.js';
import { matchText } from './search.js';
import { inputKey, inputView, textInput, type TextInput, type TextKey } from './text-input.js';
import { wrapText } from './text.js';

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
  return [...first, ...entries.filter(action => !first.includes(action))].map(action => ({ group, action }));
});
const commands = ['save', 'restore-all', 'reload'] as const;
const originalSettingsContexts = ['legacy-settings', 'numeric-settings', 'refresh-settings'] as const;

export function defaultShortcuts(warning: LocalizedText | null = null): EditorShortcutsResult {
  return { schema_version: EDITOR_SHORTCUTS_SCHEMA_VERSION, bindings: {}, revision: null, warning };
}

function sameBindings(a: ShortcutBindings, b: ShortcutBindings): boolean {
  return Object.keys(a).length === Object.keys(b).length && (Object.keys(a) as ShortcutAction[]).every(action => a[action] === b[action]);
}

interface ShortcutPanel {
  draft: ShortcutBindings;
  selected: ShortcutAction | null;
  scroll: number;
  query: string;
  filter: { input: TextInput; selected: ShortcutAction | null; scroll: number } | null;
  command: number | null;
  capture: boolean;
  confirm: { kind: 'close' | 'reload'; discard: boolean } | null;
  message: LocalizedText | null;
  busy: boolean;
  needsReload: boolean;
  restore: boolean;
}

const actionMessage = (action: ShortcutAction) => text('shortcuts.action.' + action);

function panelShortcut(surface: EditorSurface, action: ShortcutAction, bindings: ShortcutBindings): string {
  return listedShortcut(surface, action, bindings, action === 'save' ? ['list'] : undefined);
}

function matchingActions(panel: ShortcutPanel, language: Language): typeof actions {
  const query = panel.filter?.input.value ?? panel.query;
  return query.trim() ? actions.filter(({ action }) => matchText(action, query) ||
    matchText(renderMessage(actionMessage(action), language), query)) : actions;
}

function conflictMessage(conflict: ShortcutConflict): LocalizedText {
  return text('shortcuts.conflict', { key: shortcutKeyLabel(conflict.key), first: actionMessage(conflict.first), second: actionMessage(conflict.second), editor: text('shortcuts.' + conflict.surface) });
}

export class EditorShortcuts {
  snapshot: EditorShortcutsResult = defaultShortcuts();
  panel: ShortcutPanel | null = null;

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
    this.panel = { draft: { ...this.snapshot.bindings }, selected: actions[0]!.action, scroll: 0, query: '', filter: null, command: null,
      capture: false, confirm: null, message: null, busy: false, restore: false, needsReload: false };
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
        panel.scroll = filter.scroll;
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
          if (!matches.some(({ action }) => action === panel.selected)) panel.selected = matches[0]?.action ?? null;
          panel.scroll = 0;
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
      if (token !== null && isNativeReservedKey(action, token)) panel.message = text('shortcuts.host-key', { key: token });
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
      panel.filter = { input: textInput(panel.query), selected: panel.selected, scroll: panel.scroll };
      panel.message = null;
    } else if (!panel.selected) return null;
    else if (key === 'return') {
      panel.capture = true;
      panel.message = null;
    } else if (key === 'delete') {
      delete panel.draft[panel.selected];
      panel.message = null;
    } else if (['up', 'down', 'pageup', 'pagedown', 'home', 'end'].includes(key)) {
      const matches = matchingActions(panel, language);
      const index = matches.findIndex(({ action }) => action === panel.selected);
      const capacity = key === 'pageup' || key === 'pagedown' ? shortcutPanelLayout(this, language, width, height).capacity : 1;
      const delta = key === 'up' || key === 'pageup' ? -capacity : capacity;
      const next = key === 'home' ? 0 : key === 'end' ? matches.length - 1 : Math.max(0, Math.min(matches.length - 1, index + delta));
      panel.selected = matches[next]?.action ?? null;
    }
    return null;
  }

  async perform(effect: ShortcutEffect, request: Request, isCurrent: () => boolean = () => true): Promise<void> {
    const panel = this.panel;
    if (!panel || panel.busy) return;
    const live = () => isCurrent() && this.panel === panel;
    const loaded = (result: EditorShortcutsResult, message: LocalizedText | null) => {
      this.snapshot = result;
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
        if (result.warning?.key === 'shortcuts.read-failed') panel.message = result.warning;
        else loaded(result, result.warning ?? text('shortcuts.reloaded'));
        return;
      }
      const bindings = { ...panel.draft }, expected_revision = this.snapshot.revision;
      try {
        const result = await request('set_editor_shortcuts', { bindings, expected_revision });
        if (!live()) return;
        if (result.warning || !sameBindings(bindings, result.bindings)) throw new Error('Unexpected shortcut save result');
        loaded(result, text('shortcuts.saved'));
      } catch (error) {
        if (!live()) return;
        const failure = error instanceof BackendError ? error.localization : null;
        if (failure?.key === 'shortcuts.changed') { panel.needsReload = true; throw error; }
        if (error instanceof BackendError && ['invalid_request', 'invalid_configuration', 'configuration_conflict', 'unsupported_protocol', 'unsupported_operation'].includes(error.code)) throw error;
        const result = await request('read_editor_shortcuts').catch(() => null);
        if (!live()) return;
        if (result && !result.warning && sameBindings(bindings, result.bindings)) loaded(result, text('shortcuts.saved'));
        else if (!result || result.warning?.key === 'shortcuts.read-failed') {
          panel.needsReload = true;
          panel.message = text('shortcuts.unknown');
        } else if (result.revision !== expected_revision) {
          panel.needsReload = true;
          panel.message = text('shortcuts.changed');
        } else throw error;
      }
    } catch (error) {
      if (live()) panel.message = error instanceof BackendError && error.localization ? error.localization : text('shortcuts.failed', { detail: error instanceof Error ? error.message : String(error) });
    } finally {
      panel.busy = false;
    }
  }
}

interface PanelRow { text: string; selected?: boolean }

function shortcutPanelLayout(editor: EditorShortcuts, language: Language, width: number, height: number) {
  const panel = editor.panel!;
  const tr = (key: string, params?: Record<string, unknown>) => t('shortcuts.' + key, language, params);
  const selected = actions.find(({ action }) => action === panel.selected);
  const filtering = panel.filter !== null;
  const query = panel.filter?.input.value ?? panel.query;
  const before: PanelRow[] = [];
  if (filtering || query.trim()) {
    const prefix = tr('filter') + ' ';
    const value = panel.filter ? inputView({ ...panel.filter.input }, width - displayWidth(prefix)) : query;
    before.push({ text: prefix + value });
  }
  const details: PanelRow[] = [];
  if (selected && !filtering) {
    const { group, action } = selected;
    before.push({ text: panel.capture ? tr('capture-action', { action: actionMessage(action) }) : tr('group.' + group) });
    const keys = (surface: EditorSurface) => {
      const preset = panelShortcut(surface, action, {});
      return preset ? `${tr(surface + '-short')} ${panelShortcut(surface, action, panel.draft)} [${preset}]` : '';
    };
    const keyRow = [keys('terminal'), keys('native')].filter(Boolean);
    if (action === 'save') {
      const preset = listedShortcut('terminal', action, {}, originalSettingsContexts);
      if (preset && preset !== panelShortcut('terminal', action, {})) {
        const effective = listedShortcut('terminal', action, panel.draft, originalSettingsContexts);
        keyRow.push(`${tr('legacy-settings-short')} ${effective} [${preset}]`);
      }
    }
    const combined = keyRow.join(' · ');
    details.push(...(displayWidth(combined) <= width ? [combined] : wrapText(keyRow, width)).map(text => ({ text })));
  } else if (!selected) before.push({ text: tr('no-matches') });
  const conflict = shortcutConflict(panel.draft);
  const notice = panel.busy ? text('shortcuts.working') : panel.message ??
    (panel.capture || filtering ? null : conflict ? conflictMessage(conflict) : editor.snapshot.warning);
  let help = panel.command === null ? tr('list-help') : tr('command-help');
  if (panel.capture && selected) {
    const keys = reservedNativeKeys(selected.action);
    help = keys.length ? tr('capture-host-help', { keys: keys.join(', ') }) : tr('capture');
  }
  const fixedHelp = filtering ? wrapText([tr('filter-help')], width) : [tr('back-help')];
  const commandRows = commands.map((command, index) => ({ text: (panel.command === index ? '› ' : '  ') + tr(command), selected: panel.command === index }));
  const controls = commandRows.map(row => row.text.trim()).join(' · ');
  let options: PanelRow[] = [];
  if (!filtering) {
    if (displayWidth(controls) <= width) options = [{ text: controls }];
    else options = panel.command === null ? [{ text: tr('options') }] : [commandRows[panel.command]!];
  }
  const messageRows = notice || !filtering ? wrapText([notice ? renderMessage(notice, language) : help], width) : [];
  // Leave space for the selected action and preserve controls even when a warning wraps.
  const available = Math.max(0, height - before.length - options.length - fixedHelp.length - 1);
  const messages = messageRows.slice(0, Math.min(4, available, Math.max(1, available - details.length)));
  const after = [...details.slice(0, Math.max(0, available - messages.length)), ...messages.map(text => ({ text })),
    ...options, ...fixedHelp.map(text => ({ text }))];
  return { before, after, capacity: Math.max(1, height - before.length - after.length) };
}

export function shortcutPanelRows(editor: EditorShortcuts, language: Language, width: number, height: number): PanelRow[] {
  const panel = editor.panel!;
  const tr = (key: string) => t('shortcuts.' + key, language);
  if (panel.confirm) return [
    ...wrapText([tr(panel.confirm.kind === 'close' ? 'confirm-close' : 'confirm-reload')], width).map(text => ({ text })),
    { text: (panel.confirm.discard ? '  ' : '› ') + tr('keep'), selected: !panel.confirm.discard },
    { text: (panel.confirm.discard ? '› ' : '  ') + tr('discard'), selected: panel.confirm.discard },
    { text: tr('confirm-help') },
  ];
  const matches = matchingActions(panel, language);
  const { before, after, capacity } = shortcutPanelLayout(editor, language, width, height);
  const index = matches.findIndex(({ action }) => action === panel.selected);
  const start = Math.max(0, Math.min(panel.scroll, index, matches.length - capacity));
  panel.scroll = Math.max(start, index - capacity + 1);
  const alternate = editor.surface === 'native' ? 'terminal' : 'native';
  const visible = matches.slice(panel.scroll, panel.scroll + capacity).map(({ action }) => {
    const selected = panel.command === null && action === panel.selected;
    const key = panelShortcut(editor.surface, action, panel.draft) || panelShortcut(alternate, action, panel.draft);
    const label = renderMessage(actionMessage(action), language);
    return { selected, text: `${selected ? '›' : ' '} ${key}  ${label}` };
  });
  return [...before, ...visible, ...after].slice(0, height);
}
