import type { Elements } from 'claude-code';
import type { Editor, Page } from '../lib/editor/draft.ts';
import type { Scope } from '../lib/generated-contracts.ts';

export type Controls = Pick<
  Elements['terminal'],
  'Box' | 'Text' | 'Button' | 'Input' | 'Select'
>;

export interface Actions {
  edit: (change: (editor: Editor) => void) => void;
  filter: (scope: Scope, value: string) => void;
  page: (page: Page) => void;
  paginate: (delta: -1 | 1) => void;
  move: (delta: -1 | 1) => void;
  advanced: () => void;
  save: () => void;
  finish: () => void;
  close: () => void;
  reload: () => void;
  retry: () => void;
  reconcile: () => void;
  preference: (key: string, value: string | boolean) => void;
  applyPreferences: () => void;
}
