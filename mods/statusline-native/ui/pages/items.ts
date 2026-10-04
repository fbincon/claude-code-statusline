import type { Editor } from '../../lib/editor/draft.ts';
import type { Scope } from '../../lib/generated-contracts.ts';
import type { Actions, Controls } from '../controls.ts';
import { itemList } from '../components/item-list.ts';
import { pagination } from '../components/pagination.ts';

export function itemPage(
  ui: Controls,
  editor: Editor,
  scope: Scope,
  capacity: number,
  width: number,
  actions: Actions,
) {
  const visible = editor.visible(scope);
  const selected = visible.find((item) => item.id === editor.selected[scope]);
  return [
    ...(scope === 'subagent'
      ? [
          ui.Button({
            key: 'subagent-statusline',
            plain: true,
            label: `Custom subagent rows: ${editor.draft.display.subagents.enabled ? 'on' : 'off'}`,
            onPress: () =>
              actions.edit((state) => {
                state.draft.display.subagents.enabled =
                  !state.draft.display.subagents.enabled;
              }),
          }),
        ]
      : []),
    ui.Input({
      key: 'filter-' + scope,
      label: 'Filter',
      value: editor.search[scope],
      submitLabel: 'Find',
      onInput: (value) => actions.edit((state) => state.filter(scope, value)),
      onSubmit: (value) => actions.filter(scope, value),
    }),
    ...(visible.length
      ? itemList(ui, editor, scope, capacity, width, actions)
      : [ui.Text({ children: ['No matching items. Clear filter.'] })]),
    ...Array.from(
      {
        length: Math.max(
          0,
          capacity - Math.max(1, Math.min(capacity, visible.length)),
        ),
      },
      () => ui.Text({ children: [' '] }),
    ),
    ui.Text({
      dimColor: true,
      wrap: 'truncate',
      children: [
        selected
          ? `${selected.description} · Example: ${selected.examples.join(' · ')}`
          : '(empty selection)',
      ],
    }),
    pagination(
      ui,
      visible.map((item) => item.id),
      editor.selected[scope],
      capacity,
      actions,
    ),
  ];
}
