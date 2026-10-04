import { Editor } from './editor/draft.ts';
import type { Scope, PreviewResult } from './generated-contracts.ts';
import type { Preference } from './preferences.ts';

export type InputMode =
  | { kind: 'search'; scope: Scope; original: string; selected: string }
  | { kind: 'numeric'; field: 'padding' | 'refresh_interval' }
  | null;

export interface View {
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

type EditorData = Pick<
  Editor,
  | 'description'
  | 'baseline'
  | 'draft'
  | 'page'
  | 'advanced'
  | 'setting'
  | 'activeNumeric'
  | 'selected'
  | 'order'
  | 'search'
  | 'buffers'
  | 'fieldErrors'
>;
export interface ClientProps {
  epoch: number;
  ack: number;
  generation: number;
  columns: number;
  rows: number;
  view: Omit<View, 'editor'> & { editor: EditorData | null };
}

export function clientProps(
  view: View,
  epoch: number,
  ack: number,
  generation: number,
  columns: number,
  rows: number,
): ClientProps {
  const e = view.editor;
  // The host freezes port data recursively. Never expose live editor arrays or
  // preference rows: subsequent keys must still mutate our own draft.
  return JSON.parse(
    JSON.stringify({
      epoch,
      ack,
      generation,
      columns,
      rows,
      view: {
        ...view,
        editor: e
          ? {
              description: e.description,
              baseline: e.baseline,
              draft: e.draft,
              page: e.page,
              advanced: e.advanced,
              setting: e.setting,
              activeNumeric: e.activeNumeric,
              selected: e.selected,
              order: e.order,
              search: e.search,
              buffers: e.buffers,
              fieldErrors: e.fieldErrors,
            }
          : null,
      },
    }),
  ) as ClientProps;
}

/** Rendering uses the same editor model, with only plain data crossing ports. */
export function clientView(props: ClientProps): View {
  const data = props.view.editor;
  return {
    ...props.view,
    editor: data
      ? Object.assign(new Editor(data.description, data.baseline), data)
      : null,
  };
}
