import type { Draft, PreviewResult, Span } from '../contracts/ui.js';
import { t, type Language } from '../i18n/messages.js';
import { changePreview } from './change-review.js';
import { colorDraft } from './color-manager.js';
import type { Editor } from './draft.js';
import { previewRows, previewScope } from './preview-settings.js';

export function editorPreviewDraft(editor: Editor): Draft {
    if (editor.changeReview) return changePreview(editor);
    if (editor.reuse?.result && !editor.reuse.result.blocked.length) return editor.reuse.result.draft;
    if (editor.colors) return colorDraft(editor);
    if (editor.profiles?.candidate) return { ...editor.draft, display: editor.profiles.candidate };
    return editor.quick?.candidate ?? editor.review?.result.draft ?? editor.draft;
}

export function samplePreview(editor: Editor, display: Draft['display'], preview: PreviewResult | null, language: Language,
    status: { busy?: boolean; error?: string } = {}): { rows: Span[][]; empty: string } {
    const tr = (key: string) => t(key, language);
    if (status.busy) return { rows: [], empty: tr('native.ui.client.draw.loading_sample_preview') };
    if (status.error) return { rows: [], empty: status.error };
    if (!preview || preview.scenario && preview.scenario !== editor.previewScenario)
        return { rows: [], empty: tr('native.ui.client.draw.loading_sample_preview') };
    const rows = previewRows(editor, preview);
    if (rows.length) return { rows, empty: '' };
    const subagents = previewScope(editor) === 'subagent';
    if (subagents && !display.subagents.enabled) return { rows, empty: tr('preview.empty_subagents_off') };
    const instances = subagents ? display.subagents.instances : display.instances;
    if (!instances.some(item => item.enabled)) return { rows, empty: tr('ui.drawing.no_enabled_items') };
    const noAgents = subagents && ['no-agents', 'missing'].includes(editor.previewScenario);
    return { rows, empty: tr(noAgents ? 'preview.empty_no_agents' : 'preview.empty_no_values') };
}
