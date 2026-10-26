import type { DescribeResult, PreviewResult, ReadResult } from '../lib/generated-contracts.ts';
import { Editor } from '../lib/editor/draft.ts';
import type { View } from '../lib/session.ts';
import { preferences } from '../lib/preferences.ts';
import { CAPACITY_DESCRIPTION, CAPACITY_VALUES, CAPACITY_CASES } from './generated-capacity-fixtures.ts';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function capacityView(value: typeof CAPACITY_CASES[number]): View {
  const data = Object.fromEntries(Object.entries(value.editor).map(([key, index]) => [key, clone(CAPACITY_VALUES[index])]));
  const editor = Object.assign(new Editor(clone(CAPACITY_DESCRIPTION) as DescribeResult, data.baseline as ReadResult), data);
  return { editor, language: 'zh-CN', input: value.search ? { kind: 'search', scope: 'main', original: '', selected: editor.selected.main } : null,
    preview: clone(CAPACITY_VALUES[value.preview]) as PreviewResult, previewBackground: 'dark',
    preferences: preferences([
      { key: 'theme', label: 'Theme', kind: 'choice', value: 'dark', options: ['dark','light','dark-daltonized','light-daltonized','dark-ansi','light-ansi'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
      ...['verbose','showTurnDuration','showTerminalTitle','showSpinner','thinkingEnabled','fastMode','vimMode'].map(key => ({ key, label: key, kind: 'boolean' as const, value: true, provider: { plugin: 'engine', tier: 'core' as const }, isLocked: false })),
      { key: 'model', label: 'Model', kind: 'choice', value: 'default', options: ['default','sonnet','opus','haiku'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
      { key: 'effort', label: 'Effort', kind: 'choice', value: 'high', options: ['low','medium','high','max'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
    ]),
    preferencesError: '', error: 'x'.repeat(value.padding), previewError: '', previewBusy: false, message: '', busy: '', uncertain: false };
}

