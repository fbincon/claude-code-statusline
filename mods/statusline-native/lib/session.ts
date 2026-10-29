import type { TextInput } from './editor/text-input.ts';
import type { Editor } from './editor/draft.ts';
import type { Scope, PreviewResult } from './generated-contracts.ts';
import type { Preference } from './preferences.ts';
import type { PreviewBackground } from './preview-preferences.ts';
import type { Language, LocalizedText } from './i18n/index.ts';
import type { MessageSlot } from './i18n/messages.ts';
import { t } from './i18n/index.ts';
import { draw } from '../ui/client/draw.ts';
import { CapacityError, frameElements, frameTree, withinBudget } from '../ui/frame.ts';
import type { Frame } from '../ui/frame.ts';

export type InputMode = (
  | { kind: 'search'; scope: Scope; original: string; selected: string }
  | { kind: 'category'; scope: Scope; selected: string }
  | { kind: 'field'; key: string; buffer: string; original?: string }
  | { kind: 'path'; action: 'import' | 'export'; buffer: string }
  | { kind: 'numeric'; field: 'padding' | 'refresh_interval' }
) & { edit?: TextInput } | null;

export interface View {
  language?: Language;
  localized?: Partial<Record<MessageSlot, LocalizedText>>;
  previewBackground?: PreviewBackground;
  editor: Editor | null;
  input: InputMode;
  preview: PreviewResult | null;
  preferences: Preference[];
  preferencesError: string;
  error: string;
  previewError: string;
  previewBusy: boolean;
  message: string;
  busy: string;
  uncertain: boolean;
}

/** Private host-to-Client presentation contract; unrelated to the backend protocol. */
export interface ClientProps {
  epoch: number;
  ack: number;
  generation: number;
  columns: number;
  rows: number;
  displayColumns: number;
  displayRows: number;
  language: Language;
  busy: boolean;
  frame: Frame;
}

export function clientProps(view: View, epoch: number, ack: number, generation: number, columns: number, rows: number): ClientProps {
  let width = Math.max(2, Math.min(10000, columns));
  let height = Math.max(0, Math.min(10000, rows));
  for (;;) {
    try {
      const { elements, frame } = frameElements();
      const reduced = width !== columns || height !== rows;
      draw(elements, view, width, height, reduced ? t('native.capacity.reduced', view.language ?? 'en', {columns: width, rows: height}) : '');
      const result: ClientProps = { epoch, ack, generation, columns, rows, displayColumns: width, displayRows: height, language: view.language ?? 'en', busy: !!view.busy, frame };
      if (withinBudget(result) && withinBudget(frameTree(frame))) return result;
    } catch (error) {
      if (!(error instanceof CapacityError)) throw error;
    }
    if (height > 12) height = Math.max(12, Math.floor(height * 0.75));
    else if (width > 32) width = Math.max(32, Math.floor(width * 0.75));
    else throw new CapacityError();
  }
}
