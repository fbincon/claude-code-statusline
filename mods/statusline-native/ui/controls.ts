import type { Elements } from 'claude-code';
import type { Editor, Page } from '../lib/draft.ts';

export type Controls = Pick<
  Elements['terminal'],
  'Box' | 'Text' | 'Button' | 'Input' | 'Select'
>;

export interface Actions {
  edit: (change: (editor: Editor) => void) => void;
  page: (page: Page) => void;
  save: () => void;
  close: () => void;
  reload: () => void;
  retry: () => void;
  reconcile: () => void;
  preference: (key: string, value: string | boolean) => void;
  applyPreferences: () => void;
}
