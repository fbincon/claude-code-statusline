import type { RenderElement } from 'claude-code';
import type { Editor } from '../lib/draft.ts';
import type { Scope } from '../lib/generated-contracts.ts';
import type { Actions, Controls } from './controls.ts';

export function itemPage(
  ui: Controls,
  editor: Editor,
  scope: Scope,
  actions: Actions,
): RenderElement[] {
  const { Text, Input, Select, Button } = ui;
  const visible = editor.visible(scope);
  const selected = visible.find((item) => item.id === editor.selected[scope]);
  const enabled = editor.items(scope);
  const labels = new Map(
    editor.catalog(scope).map((item) => [item.id as string, item.label]),
  );
  return [
    ...(scope === 'subagent'
      ? [
          Button({
            key: 'subagent-statusline',
            label: `Custom subagent rows: ${editor.draft.display.subagents.enabled ? 'on' : 'off'}`,
            onPress: () =>
              actions.edit((state) => {
                state.draft.display.subagents.enabled =
                  !state.draft.display.subagents.enabled;
              }),
          }),
          Text({
            children: [
              'Subagent row integration: ' +
                editor.baseline.capabilities.subagent_rows,
            ],
          }),
        ]
      : []),
    Text({
      children: [
        'Enabled order: ' +
          (enabled.map((id) => labels.get(id)).join(' → ') || '(empty)'),
      ],
    }),
    Input({
      key: 'filter-' + scope,
      label: 'Filter',
      value: editor.search[scope],
      onInput: (value) => actions.edit((state) => state.filter(scope, value)),
      onSubmit: (value) => actions.edit((state) => state.filter(scope, value)),
    }),
    ...(visible.length
      ? [
          Select({
            key: 'item-' + scope,
            label: 'Item',
            value: selected?.id,
            options: visible.map((item) => ({
              value: item.id,
              label: `${enabled.includes(item.id) ? '[x]' : '[ ]'} ${item.label}`,
            })),
            onSelect: (value) =>
              actions.edit((state) => {
                state.selected[scope] = value;
              }),
          }),
          Text({ children: [selected?.description || ''] }),
          Text({
            dimColor: true,
            children: ['Example: ' + (selected?.examples.join(' · ') || '')],
          }),
          Button({
            key: 'toggle-item',
            label:
              selected && enabled.includes(selected.id)
                ? 'Disable item'
                : 'Enable item',
            hotkey: 't',
            onPress: () =>
              actions.edit((state) => {
                state.toggle(scope, state.selected[scope]);
              }),
          }),
          Button({
            key: 'move-up',
            label: 'Move up',
            hotkey: 'u',
            onPress: () =>
              actions.edit((state) => {
                state.move(scope, -1);
              }),
          }),
          Button({
            key: 'move-down',
            label: 'Move down',
            hotkey: 'd',
            onPress: () =>
              actions.edit((state) => {
                state.move(scope, 1);
              }),
          }),
        ]
      : [
          Text({
            children: [
              'No matching items. Clear the filter to see the catalog.',
            ],
          }),
        ]),
  ];
}
