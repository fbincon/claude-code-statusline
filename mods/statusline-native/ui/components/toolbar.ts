import type { Editor } from '../../lib/editor/draft.ts';
import type { Actions, Controls } from '../controls.ts';

export function toolbar(
  ui: Controls,
  editor: Editor,
  uncertain: boolean,
  pending: boolean,
  actions: Actions,
) {
  const button = (
    key: string,
    label: string,
    hotkey: string,
    onPress: () => void,
  ) => ui.Button({ key, label, hotkey, plain: true, onPress });
  return [
    ui.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        ...(uncertain
          ? [button('reconcile', 'Check saved state', 'k', actions.reconcile)]
          : [
              button('save', 'Save', 's', actions.save),
              button('finish', 'Finish', 'f', actions.finish),
            ]),
        button('close', pending ? 'Discard' : 'Close', 'q', actions.close),
      ],
    }),
    ui.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        ...(editor.page === 'settings'
          ? [
              button(
                'advanced',
                editor.advanced ? 'Basic' : 'Advanced',
                'h',
                actions.advanced,
              ),
              ...(editor.advanced
                ? [button('apply-host', 'Apply', 'a', actions.applyPreferences)]
                : []),
            ]
          : [
              button('toggle-item', 'Toggle', 't', () =>
                actions.edit((state) => {
                  const scope = state.page === 'main' ? 'main' : 'subagent';
                  state.toggle(scope, state.selected[scope]);
                }),
              ),
              button('move-up', 'Up', 'u', () => actions.move(-1)),
          button('move-down', 'Dn', 'd', () => actions.move(1)),
            ]),
      button('reload', 'Reload', 'r', actions.reload),
      ],
    }),
  ];
}
