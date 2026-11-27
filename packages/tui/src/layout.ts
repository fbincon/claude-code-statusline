import type { Key } from '@fbincon/statusline-core/terminal/key';

export const MIN_COLUMNS = 64, MIN_ROWS = 18;
const reportRowKeys = new Set(['up', 'down', 'left', 'right', 'pageup', 'pagedown', 'home', 'end', 'j', 'k', 'return', 'enter']);
export const usesReportRows = (event: Key) => !event.text && !event.paste && !event.ctrl && !event.meta && reportRowKeys.has(event.key.toLowerCase());
export interface Panel {
    y: number;
    width: number;
    height: number;
    framed: boolean;
    innerY: number;
    innerX: number;
    innerWidth: number;
    innerHeight: number;
}
export function canvasSize(columns: number, rows: number) {
    return {
        columns: Math.max(1, Math.min(500, Math.trunc(columns))),
        rows: Math.max(1, Math.min(200, Math.trunc(rows))),
    };
}
export function dimensions(columns: number, rows: number) {
    const { columns: width, rows: height } = canvasSize(columns, rows);
    const framed = width >= 64 && height >= 20;
    const previewRows = Math.min(5, Math.max(2, Math.floor((height - 10) / 4)));
    const previewHeight = previewRows + (framed ? 2 : 1), contentHeight = Math.max(3, height - 6 - previewHeight);
    const panel = (y: number, h: number): Panel => ({ y, width, height: h, framed, innerY: y + 1, innerX: framed ? 2 : 1, innerWidth: Math.max(1, width - (framed ? 4 : 2)), innerHeight: Math.max(1, h - (framed ? 2 : 1)) });
    const content = panel(4, contentHeight), preview = panel(4 + contentHeight, previewHeight);
    const report = panel(4, Math.max(3, height - 6));
    return { content, preview, report, actionsY: height - 2, helpY: height - 1, listHeight: Math.max(1, content.innerHeight - 2), available: width >= MIN_COLUMNS && height >= MIN_ROWS };
}
export interface FormLine {
    group: string;
    index?: number;
}
export function formWindow(rows: readonly {
    group: string;
}[], selected: number, scroll: number, height: number) {
    if (!rows.length)
        return { start: 0, end: 0, lines: [] as FormLine[] };
    height = Math.max(1, height);
    selected = Math.max(0, Math.min(selected, rows.length - 1));
    let start = Math.min(Math.max(0, scroll), selected, Math.max(0, rows.length - (height - 1)));
    for (;;) {
        const lines: FormLine[] = [];
        let group: string | undefined, end = start;
        for (let i = start; i < rows.length; i++) {
            const row = rows[i]!, heading = height > 1 && row.group !== group;
            if (lines.length + 1 + Number(heading) > height)
                break;
            if (heading)
                lines.push({ group: row.group });
            lines.push({ group: row.group, index: i });
            group = row.group;
            end = i + 1;
        }
        if (end > selected)
            return { start, end, lines };
        start++;
    }
}
