export const SETTING_KEYS = [
  'colors',
  'palette',
  'preview-background',
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
  const offset = Math.max(0, keys.indexOf(selected)) - window.start;
  return keys[Math.min(keys.length - 1, page * window.size + offset)] || '';
}

interface GroupedRow {
  key: string;
  group: string;
}

export interface FormPage {
  start: number;
  end: number;
  lines: { group: string; index: number | null }[];
}

/** Pack actual field/header rows; a heading always stays with its first field. */
export function formPages(rows: readonly GroupedRow[], height: number): FormPage[] {
  const limit = Math.max(1, height);
  const pages: FormPage[] = [];
  let index = 0;
  while (index < rows.length) {
    const page: FormPage = { start: index, end: index, lines: [] };
    let group: string | null = null;
    while (index < rows.length) {
      const row = rows[index]!;
      const heading = limit > 1 && row.group !== group;
      if (page.lines.length + 1 + Number(heading) > limit) break;
      if (heading) page.lines.push({ group: row.group, index: null });
      page.lines.push({ group: row.group, index });
      group = row.group;
      page.end = ++index;
    }
    pages.push(page);
  }
  return pages.length ? pages : [{ start: 0, end: 0, lines: [] }];
}

export function formWindow(rows: readonly GroupedRow[], selected: string, height: number) {
  const pages = formPages(rows, height);
  const index = Math.max(0, rows.findIndex((row) => row.key === selected));
  const page = Math.max(0, pages.findIndex((p) => index >= p.start && index < p.end));
  return { ...pages[page]!, page: page + 1, pages: pages.length };
}

export function formSelection(rows: readonly GroupedRow[], selected: string, height: number, delta: -1 | 1): string {
  const pages = formPages(rows, height);
  const window = formWindow(rows, selected, height);
  const target = pages[Math.max(0, Math.min(pages.length - 1, window.page - 1 + delta))]!;
  const offset = Math.max(0, rows.findIndex((row) => row.key === selected)) - window.start;
  return rows[Math.min(target.end - 1, target.start + offset)]?.key ?? '';
}
