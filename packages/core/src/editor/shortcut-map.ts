import type { TextKey } from './text-input.js';

export type EditorSurface = 'terminal' | 'native';

export const SHORTCUT_GROUPS = {
  editor: ['save', 'finish', 'close', 'reload', 'retry-preview', 'history', 'undo', 'redo'],
  components: ['add-item', 'copy-item', 'remove-item', 'toggle-item', 'move-left', 'move-right', 'item-details', 'search', 'category', 'close-picker'],
  tools: ['quick-setup', 'profiles', 'groups', 'sources', 'diagnose', 'preview-scenario', 'preview-width', 'preview-row', 'show-host-preferences', 'apply-host-preferences', 'event-refresh'],
  review: ['close-history', 'compare-saved', 'export-draft', 'discard-to-saved', 'accept-repair', 'accept-import', 'cancel-import', 'select-import', 'full-import'],
  managers: ['apply-color', 'reload-profiles', 'reload-sources', 'save-source', 'close-reuse', 'accept-reuse', 'reuse-references', 'reuse-layout', 'reuse-sources', 'close-packages', 'refresh-package', 'reload-packages', 'cancel-package-review'],
  tasks: ['close-tasks', 'reload-tasks', 'task-identity', 'task-search', 'task-evidence', 'task-filter'],
} as const;

export type ShortcutAction = typeof SHORTCUT_GROUPS[keyof typeof SHORTCUT_GROUPS][number];
export type ShortcutBindings = Partial<Record<ShortcutAction, string>>;
type Defaults = Partial<Record<ShortcutAction, readonly string[]>>;

interface Scenario {
  defaults: Defaults;
  fixed: readonly string[];
}

function scenario(defaults: Defaults, fixed: readonly string[] = []): Scenario {
  return { defaults, fixed };
}

function editorScenarios(surface: EditorSurface) {
  const native = surface === 'native';
  const preview: Defaults = { 'preview-scenario': ['Ctrl+V'], 'preview-width': ['Ctrl+W'], 'preview-row': ['Ctrl+N'] };
  const draft: Defaults = {
    history: ['Ctrl+T'], undo: native ? ['Ctrl+/', 'Ctrl+Z'] : ['Ctrl+Z'], redo: ['Ctrl+R'],
    diagnose: ['Ctrl+L'], groups: ['Ctrl+B'], sources: ['Ctrl+Y'], ...preview,
  };
  const pageTools: Defaults = { profiles: ['Ctrl+O'], 'quick-setup': ['Ctrl+P'] };
  const chrome: Defaults = native
    ? { save: ['S'], finish: ['F'], reload: ['R'], 'retry-preview': ['V'] }
    : { save: ['Ctrl+S'] };
  const close: Defaults = { close: [native ? 'Q' : 'Esc'] };
  const root = { ...draft, ...chrome, ...close };
  const listSelection: Defaults = { search: ['/'], category: ['Ctrl+F'], 'item-details': ['Ctrl+E'] };
  const pageKeys = native ? ['1', '2', '3', '4', 'K'] : [];
  const formKeys = [...pageKeys, 'Enter', 'Space', 'Left', 'Right'];
  const importActions = { ...preview, 'cancel-import': ['Q'] };
  const reuse = { 'close-reuse': ['Q'] };
  return {
    list: scenario({ ...root, ...pageTools, ...listSelection,
      save: native ? ['S'] : ['Enter', 'Ctrl+S'],
      'add-item': native ? ['A', 'Ctrl+A'] : ['Ctrl+A'],
      'copy-item': native ? ['D', 'Ctrl+D'] : ['Ctrl+D'],
      'remove-item': native ? ['X', 'Ctrl+X'] : ['Ctrl+X'],
      'toggle-item': native ? ['Enter', 'Space'] : ['Space'],
      'move-left': ['Left'], 'move-right': ['Right'],
    }, pageKeys),
    picker: scenario({ ...chrome, ...listSelection, ...(native ? { 'close-picker': ['Q'] } : {}) }, ['Enter', 'Space', 'Left', 'Right', ...pageKeys]),
    detail: scenario({ ...root, ...(native ? { 'item-details': ['Ctrl+E'] } : {}) }, formKeys),
    layout: scenario({ ...root, ...pageTools }, formKeys),
    settings: scenario({ ...root, ...pageTools, ...(native ? { 'show-host-preferences': ['H'] } : {}) }, formKeys),
    'host-settings': scenario(native ? { ...root, ...pageTools, 'show-host-preferences': ['H'], 'apply-host-preferences': ['A'] } : {}, formKeys),
    'legacy-settings': scenario(native ? {} : { ...root, ...pageTools, save: ['Ctrl+S', 'Enter'] }, ['Space', 'Left', 'Right']),
    'numeric-settings': scenario(native ? {} : { ...root, ...pageTools, save: ['Ctrl+S', 'Enter'] }, ['Space', 'Left', 'Right', ...'0123456789']),
    'refresh-settings': scenario(native ? {} : { ...root, ...pageTools, save: ['Ctrl+S', 'Enter'], 'event-refresh': ['E'] }, ['Space', 'Left', 'Right', ...'0123456789']),
    quick: scenario(preview, ['Enter', 'Left', 'Right']),
    'import-review': scenario({ ...importActions, 'accept-import': ['A'], 'select-import': ['S'], 'full-import': ['F'] }, ['Enter']),
    'import-selection': scenario({ ...importActions, 'select-import': ['S'], 'full-import': ['F'] }, ['Enter', 'Space']),
    history: scenario({ 'close-history': ['Q'], undo: ['U'], redo: ['R'], 'compare-saved': ['C'], 'export-draft': ['E'], 'discard-to-saved': ['L'] }, ['Enter', 'K']),
    repair: scenario({ 'close-history': ['Q'], 'accept-repair': ['A'] }, ['Enter']),
    colors: scenario({ 'apply-color': ['Ctrl+S'] }, ['Enter', 'Left', 'Right']),
    profiles: scenario({ 'reload-profiles': ['R'] }, ['Enter']),
    sources: scenario({ 'reload-sources': ['R'] }, ['Enter']),
    'source-form': scenario({ 'save-source': ['Ctrl+S'] }, ['Enter', 'Left', 'Right', 'Space']),
    reuse: scenario(reuse, ['Enter', 'Space', 'Left', 'Right']),
    'reuse-review': scenario({ ...reuse, 'accept-reuse': ['A'] }, ['Enter']),
    'reuse-groups': scenario({ ...reuse, 'accept-reuse': ['A'], 'reuse-references': ['X'], 'reuse-layout': ['L'] }, ['Enter']),
    'reuse-complete': scenario({ ...reuse, 'reuse-sources': ['B'] }),
    packages: scenario({ 'close-packages': ['Q'], 'refresh-package': ['R'], 'reload-packages': ['L'], 'cancel-package-review': ['C'] }, ['Enter']),
    tasks: scenario(native ? {} : { 'close-tasks': ['Q'], 'reload-tasks': ['R'], 'task-identity': ['S'], 'task-search': ['/'], 'task-evidence': ['E'], 'task-filter': ['F'] }, ['Enter', 'Left', 'Right', 'J', 'K']),
  };
}

const scenarios = { terminal: editorScenarios('terminal'), native: editorScenarios('native') };
export type ShortcutContext = keyof ReturnType<typeof editorScenarios>;
const surfaces: readonly EditorSurface[] = ['terminal', 'native'];
const actions = Object.values(SHORTCUT_GROUPS).flat();
const reservedControl = new Set(['Ctrl+C', 'Ctrl+G', 'Ctrl+H', 'Ctrl+I', 'Ctrl+J', 'Ctrl+K', 'Ctrl+M', 'Ctrl+U']);

export function keyToken(event: TextKey): string | null {
  if (event.text || event.paste || event.meta || event.overflow) return null;
  if (event.ctrl) {
    if (event.key === '/' || event.key === '_') return 'Ctrl+/';
    return event.key.length === 1 && /^[a-z]$/i.test(event.key) ? 'Ctrl+' + event.key.toUpperCase() : null;
  }
  switch (event.key) {
    case ' ': case 'space': return 'Space';
    case 'return': case 'enter': return 'Enter';
    case 'left': return 'Left';
    case 'right': return 'Right';
    case 'escape': case 'esc': return 'Esc';
    default: return event.key.length === 1 && /^[!-~]$/.test(event.key) ? event.key.toUpperCase() : null;
  }
}

export function assignableKey(key: string): boolean {
  if (key.length === 1) return /^[!-`{-~]$/.test(key);
  return ['Space', 'Enter', 'Left', 'Right'].includes(key) ||
    key.length === 6 && /^Ctrl\+[A-Z]$/.test(key) && !reservedControl.has(key);
}

export function canAssignKey(action: ShortcutAction, key: string): boolean {
  return assignableKey(key) && (action !== 'save-source' || key.startsWith('Ctrl+')) &&
    surfaces.every(surface => Object.values(scenarios[surface]).every(({ defaults, fixed }) => !defaults[action] || !fixed.includes(key)));
}

export function isBindingMap(value: unknown): value is ShortcutBindings {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([action, key]) =>
    actions.includes(action as ShortcutAction) && typeof key === 'string' && canAssignKey(action as ShortcutAction, key));
}

function effectiveKeys(defaults: Defaults, bindings: ShortcutBindings, action: ShortcutAction): readonly string[] {
  const keys = defaults[action], custom = bindings[action];
  return !keys ? [] : custom === undefined ? keys : [custom];
}

export interface ShortcutConflict {
  surface: EditorSurface;
  context: ShortcutContext;
  key: string;
  first: ShortcutAction;
  second: ShortcutAction;
}

export function shortcutConflict(bindings: ShortcutBindings): ShortcutConflict | null {
  for (const surface of surfaces) {
    for (const context of Object.keys(scenarios[surface]) as ShortcutContext[]) {
      const { defaults } = scenarios[surface][context], used = new Map<string, ShortcutAction>();
      for (const action of Object.keys(defaults) as ShortcutAction[]) {
        for (const key of effectiveKeys(defaults, bindings, action)) {
          const first = used.get(key);
          if (first) return { surface, context, key, first, second: action };
          used.set(key, action);
        }
      }
    }
  }
  return null;
}

export function resolveShortcut(surface: EditorSurface, context: ShortcutContext, event: TextKey, bindings: ShortcutBindings): ShortcutAction | null {
  const key = keyToken(event);
  if (key === null) return null;
  const { defaults } = scenarios[surface][context];
  return (Object.keys(defaults) as ShortcutAction[]).find(action => effectiveKeys(defaults, bindings, action).includes(key)) ?? null;
}

export function shortcutKeyLabel(key: string): string {
  return key === 'Left' ? '←' : key === 'Right' ? '→' : key;
}

export function shortcutHint(surface: EditorSurface, context: ShortcutContext, bindings: ShortcutBindings, ...commands: ShortcutAction[]): string {
  const { defaults } = scenarios[surface][context];
  const keys = commands.map(action => effectiveKeys(defaults, bindings, action)[0]).filter((key): key is string => key !== undefined);
  if (keys.length > 1 && keys.every(key => key.startsWith('Ctrl+') && key.length === 6))
    return 'Ctrl+' + keys.map(key => key.slice(5)).join('/');
  return keys[0] === 'Left' && keys[1] === 'Right' && keys.length === 2 ? '←→' : keys.map(shortcutKeyLabel).join('/');
}

export function shortcutAliases(surface: EditorSurface, context: ShortcutContext, bindings: ShortcutBindings, action: ShortcutAction): string {
  return effectiveKeys(scenarios[surface][context].defaults, bindings, action).map(shortcutKeyLabel).join('/');
}

export function listedShortcut(surface: EditorSurface, action: ShortcutAction, bindings: ShortcutBindings): string {
  const keys = Object.values(scenarios[surface]).flatMap(({ defaults }) => effectiveKeys(defaults, bindings, action));
  return [...new Set(keys)].map(shortcutKeyLabel).join(' / ');
}
