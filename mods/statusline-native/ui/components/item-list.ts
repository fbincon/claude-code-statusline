import type { Editor } from '../../lib/editor/draft.ts';
import type { Scope } from '../../lib/generated-contracts.ts';
import { itemKey, pageWindow } from '../../lib/editor/navigation.ts';
import type { Actions, Controls } from '../controls.ts';
import { clip } from '../layout.ts';

export function itemList(
  ui: Controls,
  editor: Editor,
  scope: Scope,
  capacity: number,
  width: number,
  actions: Actions,
) {
  const visible = editor.visible(scope);
  const window = pageWindow(
    visible.map((item) => item.id),
    editor.selected[scope],
    capacity,
  );
  const enabled = new Set(editor.items(scope));
  return visible.slice(window.start, window.end).map((item) =>
    ui.Button({
      key: itemKey(scope, item.id),
      label: clip(`[${enabled.has(item.id) ? 'x' : ' '}] ${item.label}`, width),
      plain: true,
      autoFocus: editor.selected[scope] === item.id ? true : undefined,
      onPress: () =>
        actions.edit((state) => {
          state.selected[scope] = item.id;
          state.toggle(scope, item.id);
        }),
    }),
  );
}
