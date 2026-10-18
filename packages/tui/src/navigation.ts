import { formWindow } from './layout.js';

/** Page by visible fields; group headings consume terminal rows, not selection steps. */
export function formPageIndex(rows: readonly { group: string }[], selected: number, scroll: number, height: number, direction: -1 | 1): number {
    const window = direction < 0
        ? formWindow(rows.slice(0, selected).reverse(), 0, 0, height)
        : formWindow(rows, selected, scroll, height);
    const step = Math.max(1, window.end - window.start);
    return Math.max(0, Math.min(rows.length - 1, selected + direction * step));
}
