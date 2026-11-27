import { EDITOR_SHORTCUTS_SCHEMA_VERSION, type EditorShortcutsResult } from '../contracts/ui.js';
import { renderMessage, t, text, type Language, type LocalizedText } from '../i18n/messages.js';
import { displayWidth } from '../unicode/index.js';
import { BackendError } from './backend.js';
import {
  SHORTCUT_GROUPS, canAssignKey, keyToken, listedShortcut, resolveShortcut, shortcutAliases, shortcutConflict, shortcutHint, shortcutKeyLabel,
  type EditorSurface, type ShortcutAction, type ShortcutBindings, type ShortcutConflict, type ShortcutContext,
} from './shortcut-map.js';
import type { TextKey } from './text-input.js';
import { wrapText } from './text.js';

export type ShortcutEffect = 'read-shortcuts' | 'save-shortcuts';
type Request = (operation: 'read_editor_shortcuts' | 'set_editor_shortcuts', payload?: unknown) => Promise<EditorShortcutsResult>;
const actions = Object.entries(SHORTCUT_GROUPS).flatMap(([group, entries]) => entries.map(action => ({ group, action })));
const commands = ['save', 'restore-all', 'reload'] as const;

export function defaultShortcuts(warning: LocalizedText | null = null): EditorShortcutsResult {
  return { schema_version: EDITOR_SHORTCUTS_SCHEMA_VERSION, bindings: {}, revision: null, warning };
}

function sameBindings(a: ShortcutBindings, b: ShortcutBindings): boolean {
  return Object.keys(a).length === Object.keys(b).length && (Object.keys(a) as ShortcutAction[]).every(action => a[action] === b[action]);
}

interface ShortcutPanel {
  draft: ShortcutBindings;
  selected: number;
  scroll: number;
  command: number | null;
  capture: boolean;
  confirm: { kind: 'close' | 'reload'; discard: boolean } | null;
  message: LocalizedText | null;
  busy: boolean;
  needsReload: boolean;
  restore: boolean;
}

const actionMessage = (action: ShortcutAction) => text('shortcuts.action.' + action);
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
    this.panel = { draft: { ...this.snapshot.bindings }, selected: 0, scroll: 0, command: null,
      capture: false, confirm: null, message: null, busy: false, restore: false, needsReload: false };
  }

  private dirty(panel: ShortcutPanel): boolean {
    return panel.restore || !sameBindings(panel.draft, this.snapshot.bindings);
  }

  key(event: TextKey, capacity: number, shift = false): ShortcutEffect | null {
    const panel = this.panel;
    if (!panel || panel.busy || event.text || event.paste || event.meta || event.overflow) return null;
    const key = event.key === 'enter' ? 'return' : event.key;
    const cancel = event.ctrl && key.toLowerCase() === 'g' || !event.ctrl && (key === 'escape' || key === 'esc');
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
      const token = keyToken(event), action = actions[panel.selected]!.action;
      if (token === null || !canAssignKey(action, token)) panel.message = text(action === 'save-source' ? 'shortcuts.source-key' : 'shortcuts.unavailable-key');
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
          else if (this.dirty(panel)) return 'save-shortcuts';
        } else if (commands[panel.command] === 'restore-all') {
          panel.draft = {};
          panel.restore = this.snapshot.warning?.key === 'shortcuts.invalid';
          panel.message = text('shortcuts.restored');
        } else if (!this.dirty(panel)) return 'read-shortcuts';
        else panel.confirm = { kind: 'reload', discard: false };
      }
    } else if (key === 'return') {
      panel.capture = true;
      panel.message = null;
    } else if (key === 'delete') {
      delete panel.draft[actions[panel.selected]!.action];
      panel.message = null;
    } else if (['up', 'down', 'pageup', 'pagedown', 'home', 'end'].includes(key)) {
      const delta = key === 'up' ? -1 : key === 'down' ? 1 : key === 'pageup' ? -capacity : capacity;
      panel.selected = key === 'home' ? 0 : key === 'end' ? actions.length - 1 : Math.max(0, Math.min(actions.length - 1, panel.selected + delta));
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
        else loaded(result, text('shortcuts.reloaded'));
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

export const shortcutPanelCapacity = (height: number, width: number): number => Math.max(1, height - (width < 64 ? 8 : 6));

export function shortcutPanelRows(editor: EditorShortcuts, language: Language, width: number, height: number): { text: string; selected?: boolean }[] {
  const panel = editor.panel!;
  const tr = (key: string, params?: Record<string, unknown>) => t('shortcuts.' + key, language, params);
  if (panel.confirm) return [
    ...wrapText([tr(panel.confirm.kind === 'close' ? 'confirm-close' : 'confirm-reload')], width).map(text => ({ text })),
    { text: (panel.confirm.discard ? '  ' : '› ') + tr('keep'), selected: !panel.confirm.discard },
    { text: (panel.confirm.discard ? '› ' : '  ') + tr('discard'), selected: panel.confirm.discard },
    { text: tr('confirm-help') },
  ];
  const { group, action } = actions[panel.selected]!;
  const conflict = shortcutConflict(panel.draft);
  const notice = panel.busy ? text('shortcuts.working') : panel.message ?? (conflict ? conflictMessage(conflict) : editor.snapshot.warning);
  const presets = (surface: EditorSurface) => listedShortcut(surface, action, {});
  const active = (surface: EditorSurface, command: ShortcutAction = action) => listedShortcut(surface, command, panel.draft);
  const abbreviations = { terminal: tr('terminal-short'), native: tr('native-short') };
  const details = (surface: EditorSurface) => presets(surface) ? `${abbreviations[surface]} ${active(surface)} [${presets(surface)}]` : '';
  const keyRow = [details('terminal'), details('native')].filter(Boolean);
  const help = panel.capture ? tr('capture') : panel.command === null ? tr('list-help') : tr('command-help');
  const commandRows = commands.map((command, index) => ({ text: (panel.command === index ? '› ' : '  ') + tr(command), selected: panel.command === index }));
  const controls = commandRows.map(row => row.text.trim()).join(' · ');
  const fitCommands = displayWidth(controls) <= width ? [{ text: controls }] : panel.command === null
    ? [{ text: tr('options') }] : [commandRows[panel.command]!];
  const groupTitle = panel.capture ? tr('capture-action', { action: actionMessage(action) }) : tr('group.' + group);
  const keyLines = displayWidth(keyRow.join(' · ')) <= width ? [keyRow.join(' · ')] : wrapText(keyRow, width);
  const detailRows = [{ text: groupTitle }, ...keyLines.map(text => ({ text }))];
  const slices = wrapText([notice ? renderMessage(notice, language) : help], width).slice(0, Math.max(1, Math.min(4, height - detailRows.length - fitCommands.length - 2)));
  const finalRows = [...detailRows, ...slices.map(text => ({ text })), ...fitCommands, { text: tr('back-help') }];
  const capacity = Math.max(1, height - finalRows.length);
  const start = Math.max(0, Math.min(panel.scroll, panel.selected, actions.length - capacity));
  panel.scroll = Math.max(start, panel.selected - capacity + 1);
  const visible = actions.slice(panel.scroll, panel.scroll + capacity).map(({ action: entry }, index) => {
    const selected = panel.command === null && panel.scroll + index === panel.selected;
    const key = active(editor.surface, entry) || active(editor.surface === 'native' ? 'terminal' : 'native', entry);
    const label = renderMessage(actionMessage(entry), language);
    return { selected, text: `${selected ? '›' : ' '} ${key}  ${label}` };
  });
  return [...finalRows.slice(0, 1), ...visible, ...finalRows.slice(1)].slice(0, height);
}
