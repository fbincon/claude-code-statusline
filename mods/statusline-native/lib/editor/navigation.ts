export const SETTING_KEYS = [
  'colors',
  'palette',
  'directory-style',
  'separator-style',
  'padding',
  'refresh_interval',
  'vim-indicator',
  'scope-labels',
  'settings-subagent-statusline',
] as const;

export function settingsKeys(advanced: boolean): string[] {
  return [...SETTING_KEYS, ...(advanced ? ['host-theme', 'host-verbose'] : [])];
}

export function itemKey(scope: string, id: string): string {
  return `item-${scope}:${id}`;
}

export function pageWindow(
  keys: readonly string[],
  selected: string,
  capacity: number,
) {
  const size = Math.max(1, capacity);
  const index = Math.max(0, keys.indexOf(selected));
  const start = Math.floor(index / size) * size;
  return {
    start,
    end: Math.min(keys.length, start + size),
    size,
    page: Math.floor(start / size) + 1,
    pages: Math.max(1, Math.ceil(keys.length / size)),
  };
}

export function pageSelection(
  keys: readonly string[],
  selected: string,
  capacity: number,
  delta: -1 | 1,
): string {
  const window = pageWindow(keys, selected, capacity);
  const page = Math.max(0, Math.min(window.pages - 1, window.page - 1 + delta));
  return keys[page * window.size] || '';
}
