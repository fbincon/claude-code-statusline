/** Session-only controls; never part of a display draft or portable file. */
import type { PreviewResult, Scope } from '../contracts/ui.js';
import type { Editor } from './draft.js';
import type { ShortcutAction } from './shortcut-map.js';

export const SCENARIO_IDS = ['normal', 'warning', 'critical', 'zero', 'missing', 'source-stale', 'source-failed', 'long-content', 'git-clean', 'git-modified', 'git-conflicted', 'no-agents', 'few-agents', 'many-agents'] as const;
export type PreviewScenario = typeof SCENARIO_IDS[number];
export const PREVIEW_WIDTHS = ['auto', '40', '80', '120'] as const;
export function isScenario(value: unknown): value is PreviewScenario { return typeof value === 'string' && (SCENARIO_IDS as readonly string[]).includes(value); }
export function previewWidth(available: number, requested: string): number { return Math.max(2, Math.min(available, requested === 'auto' ? available : Number(requested))); }
export function cyclePreview<T>(values: readonly T[], value: T, delta: number): T { return values[(values.indexOf(value) + delta + values.length) % values.length]!; }

type PreviewViewport = `${'editor' | 'quick' | 'import'}:${Scope}`;
export type PreviewOffsets = Partial<Record<PreviewViewport, number>>;

export function previewScope(editor: Editor): Scope {
    return editor.quick?.previewScope ?? editor.review?.previewScope ?? editor.detail?.scope ?? (editor.page === 'subagents' ? 'subagent' : 'main');
}

function previewViewport(editor: Editor): PreviewViewport {
    return `${editor.quick ? 'quick' : editor.review ? 'import' : 'editor'}:${previewScope(editor)}`;
}

export function setPreviewScenario(editor: Editor, scenario: PreviewScenario): void {
    editor.previewScenario = scenario;
    editor.previewOffsets = {};
}

export function previewRows(editor: Editor, result: PreviewResult) {
    const rows = previewScope(editor) === 'main' ? result.main : result.subagents;
    return rows.slice(Math.min(editor.previewOffsets[previewViewport(editor)] ?? 0, Math.max(0, rows.length - 1)));
}

export function applyPreviewShortcut(editor: Editor, action: ShortcutAction | null, preview: PreviewResult | null): boolean {
    if (action === 'preview-scenario') {
        setPreviewScenario(editor, cyclePreview(SCENARIO_IDS, editor.previewScenario, 1));
    } else if (action === 'preview-width') {
        editor.previewWidth = cyclePreview(PREVIEW_WIDTHS, editor.previewWidth as typeof PREVIEW_WIDTHS[number], 1);
    } else if (action === 'preview-row') {
        if (preview?.scenario && preview.scenario !== editor.previewScenario) return true;
        const count = preview?.[previewScope(editor) === 'main' ? 'main' : 'subagents'].length ?? 0;
        const viewport = previewViewport(editor);
        const start = Math.min(editor.previewOffsets[viewport] ?? 0, Math.max(0, count - 1));
        editor.previewOffsets[viewport] = (start + 1) % Math.max(1, count);
    } else return false;
    return true;
}
