import { SCENARIO_IDS, PREVIEW_WIDTHS, cyclePreview, type PreviewScenario } from './preview-settings.js';
import type { Draft } from '../contracts/ui.js';
import { LANGUAGES, type Language, type LocalizedText } from '../i18n/messages.js';
import { copyDraft } from './draft.js';
import { openQuick, quickKey, receivePreset, type QuickSetup, type QuickViewport } from './quick-setup.js';

export interface SetupFacts {
    checks: { level: 'OK' | 'WARN' | 'ERROR'; message: string | LocalizedText }[];
    resources: string[];
    notes: LocalizedText[];
    draft: Draft | null;
    hasDisplay: boolean;
    canSave: boolean;
    canIntegrate: boolean;
}
export type SetupEffect = 'cancel' | 'interrupt' | 'preset' | 'language' | 'save' | 'integrate' | null;
export type SetupChoice = 'continue' | 'keep' | 'choose' | 'integrate' | 'save' | 'cancel';
export interface SetupViewport extends QuickViewport {
    detailCount: number;
    detailCapacity: number;
}
/** The wizard holds only drafts; effects are executed by its CLI/TUI adapters. */
export class SetupState {
    phase: 'checks' | 'choice' | 'quick' | 'review' = 'checks';
    previewScenario:PreviewScenario='normal';
    previewWidth='auto';
    previewOffset=0;
    selected = 0;
    scroll = 0;
    quick: QuickSetup | null = null;
    candidate: Draft | null;
    message: LocalizedText | null = null;
    constructor(readonly facts: SetupFacts, public language: Language) { this.candidate = facts.draft ? copyDraft(facts.draft) : null; }
    receive(draft: Draft): void { receivePreset(this.quick!, draft); }
    get choices(): readonly SetupChoice[] {
        if (this.phase === 'checks') return [this.facts.canSave ? 'continue' : 'cancel'];
        if (this.phase === 'choice') return ['keep', 'choose'];
        if (this.phase === 'review') return [
            ...(this.facts.canIntegrate ? ['integrate' as const] : []),
            ...(this.facts.canSave ? ['save' as const] : []),
            'cancel',
        ];
        return [];
    }
    key(key: string, viewport?: SetupViewport): SetupEffect {
        if(key==='preview-scenario'){this.previewScenario=cyclePreview(SCENARIO_IDS,this.previewScenario,1);this.previewOffset=0;return null;}
        if(key==='preview-width'){this.previewWidth=cyclePreview(PREVIEW_WIDTHS,this.previewWidth as typeof PREVIEW_WIDTHS[number],1);return null;}
        if(key==='preview-next'){this.previewOffset++;return null;}
        if (key === 'interrupt') return 'interrupt';
        if (key === 'escape' || key === 'cancel') return 'cancel';
        if (key.toLowerCase() === 'l') { this.language = LANGUAGES[(LANGUAGES.indexOf(this.language) + 1) % LANGUAGES.length]!; return 'language'; }
        if (this.phase === 'quick') {
            if (key === 'backspace' && this.quick!.step === 'scenario') {
                this.phase = 'choice'; this.quick = null; this.selected = 1; this.scroll = 0;
                return null;
            }
            if (key === 'tab') this.previewOffset = 0;
            const result = quickKey(this.quick!, key, viewport);
            if (result === 'preset') return 'preset';
            if (this.quick!.step === 'review') { this.candidate = copyDraft(this.quick!.candidate); this.phase = 'review'; this.selected = 0; this.scroll = 0; }
            return null;
        }
        if (key === 'pageup' || key === 'pagedown') {
            if (viewport) {
                const { detailCapacity, detailCount } = viewport;
                const last = Math.max(0, detailCount - detailCapacity);
                const offset = Math.min(this.scroll, last);
                this.scroll = Math.max(0, Math.min(last, offset + (key === 'pageup' ? -detailCapacity : detailCapacity)));
            }
            return null;
        }
        if (key === 'backspace' && this.phase !== 'checks') {
            this.phase = this.phase === 'choice' ? 'checks' : this.quick ? 'quick' : 'choice';
            if (this.phase === 'quick') {
                quickKey(this.quick!, 'backspace');
                quickKey(this.quick!, 'end');
            }
            this.scroll = 0; this.selected = 0; return null;
        }
        const choices = this.choices;
        const count = choices.length;
        if (['up','down','home','end'].includes(key)) {
            const selected = key === 'home' ? 0 : key === 'end' ? count - 1 : Math.max(0, Math.min(count - 1, this.selected + (key === 'up' ? -1 : 1)));
            if (selected !== this.selected) this.scroll = 0;
            this.selected = selected;
            return null;
        }
        if (key !== 'return') return null;
        switch (choices[this.selected]) {
            case 'continue':
                this.phase = 'choice'; this.selected = this.facts.hasDisplay ? 0 : 1; this.scroll = 0; break;
            case 'keep':
                this.candidate = copyDraft(this.facts.draft!);
                this.quick = null; this.phase = 'review'; this.selected = 0; this.scroll = 0; break;
            case 'choose':
                this.quick = openQuick(this.facts.draft!, 'daily-development'); this.phase = 'quick'; this.scroll = 0; break;
            case 'cancel': return 'cancel';
            case 'save': return 'save';
            case 'integrate': return 'integrate';
        }
        return null;
    }
}
