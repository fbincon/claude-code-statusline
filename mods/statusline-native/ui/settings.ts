import type { RenderElement } from 'claude-code';
import type { Editor, NumericField } from '../lib/draft.ts';
import type { Preference } from '../lib/preferences.ts';
import { canEdit, preferenceChanged } from '../lib/preferences.ts';
import type { Actions, Controls } from './controls.ts';

export function settingsPage(
  ui: Controls,
  editor: Editor,
  actions: Actions,
): RenderElement[] {
  const { Text, Button, Input, Select } = ui;
  const display = editor.draft.display;
  const choices = (
    key: string,
    label: string,
    value: string,
    values: (string | boolean)[],
    update: (editor: Editor, value: string) => void,
  ) =>
    Select({
      key,
      label,
      value,
      options: values.map((choice) => ({
        label: String(choice),
        value: String(choice),
      })),
      onSelect: (selected) => actions.edit((state) => update(state, selected)),
    });
  const numeric = (field: NumericField, label: string) => [
    Input({
      key: field,
      label,
      value: editor.buffers[field],
      submitLabel: 'Accept',
      onInput: (value) =>
        actions.edit((state) => state.setBuffer(field, value)),
      onSubmit: (value) =>
        actions.edit((state) => {
          state.setBuffer(field, value);
          state.acceptNumeric();
        }),
    }),
    ...(editor.fieldErrors[field]
      ? [Text({ color: 'red', children: [editor.fieldErrors[field] || ''] })]
      : []),
  ];
  return [
    Text({ bold: true, children: ['Tool settings'] }),
    Button({
      key: 'colors',
      label: `Colors: ${display.use_colors ? 'on' : 'off'}`,
      hotkey: 'c',
      onPress: () =>
        actions.edit((state) => {
          state.draft.display.use_colors = !state.draft.display.use_colors;
        }),
    }),
    choices(
      'palette',
      'Palette',
      display.palette,
      editor.description.options.palette.choices,
      (state, value) => {
        state.draft.display.palette = value as typeof display.palette;
      },
    ),
    choices(
      'directory-style',
      'Directory style',
      display.directory_style,
      editor.description.options['directory-style'].choices,
      (state, value) => {
        state.draft.display.directory_style =
          value as typeof display.directory_style;
      },
    ),
    choices(
      'separator-style',
      'Separator',
      display.separator_style,
      editor.description.options['separator-style'].choices,
      (state, value) => {
        state.draft.display.separator_style =
          value as typeof display.separator_style;
      },
    ),
    ...numeric(
      'padding',
      `Padding (${editor.description.options.padding.minimum}-${editor.description.options.padding.maximum})`,
    ),
    ...numeric(
      'refresh_interval',
      `Refresh seconds (${editor.description.options['refresh-interval'].minimum}-${editor.description.options['refresh-interval'].maximum}/event)`,
    ),
    Button({
      key: 'vim-indicator',
      label: `Built-in Vim indicator: ${editor.draft.host.hide_vim_mode_indicator ? 'hidden' : 'shown'}`,
      onPress: () =>
        actions.edit((state) => {
          state.draft.host.hide_vim_mode_indicator =
            !state.draft.host.hide_vim_mode_indicator;
        }),
    }),
    choices(
      'scope-labels',
      'Scope labels',
      display.scope_labels,
      editor.description.options['scope-labels'].choices,
      (state, value) => {
        state.draft.display.scope_labels = value as typeof display.scope_labels;
      },
    ),
    Button({
      key: 'settings-subagent-statusline',
      label: `Custom subagent rows: ${display.subagents.enabled ? 'on' : 'off'}`,
      onPress: () =>
        actions.edit((state) => {
          state.draft.display.subagents.enabled =
            !state.draft.display.subagents.enabled;
        }),
    }),
  ];
}

export function preferencePage(
  ui: Controls,
  values: Preference[],
  error: string,
  actions: Actions,
): RenderElement[] {
  const { Text, Select, Button } = ui;
  return [
    Text({
      bold: true,
      children: ['Claude Code preferences (apply separately)'],
    }),
    Text({
      dimColor: true,
      children: [
        'Closing discards pending preferences; applied preferences stay applied.',
      ],
    }),
    ...(error ? [Text({ color: 'red', children: [error] })] : []),
    ...(['theme', 'verbose'] as const).flatMap((key) => {
      const preference = values.find((value) => value.row.key === key);
      if (!preference)
        return [Text({ children: [key + ': unavailable in this host'] })];
      const row = preference.row;
      const result: RenderElement[] = [];
      if (!canEdit(preference)) {
        result.push(
          Text({
            children: [
              `${row.label}: ${String(row.value)} (${row.isLocked ? 'locked by host policy' : 'unsupported control'})`,
            ],
          }),
        );
      } else if (row.kind === 'choice') {
        result.push(
          Select({
            key: 'host-' + key,
            label: row.label,
            value: String(preference.value),
            options: (row.options || []).map((value) => ({
              label: value,
              value,
            })),
            onSelect: (value) => actions.preference(key, value),
          }),
        );
      } else {
        result.push(
          Button({
            key: 'host-' + key,
            label: row.label + ': ' + (preference.value ? 'on' : 'off'),
            onPress: () => actions.preference(key, !preference.value),
          }),
        );
      }
      if (preference.result)
        result.push(Text({ children: [row.label + ': ' + preference.result] }));
      return result;
    }),
    ...(values.some(preferenceChanged)
      ? [
          Button({
            key: 'apply-host',
            label: 'Apply host preferences',
            hotkey: 'a',
            onPress: actions.applyPreferences,
          }),
        ]
      : [Text({ dimColor: true, children: ['No pending host preferences.'] })]),
  ];
}
