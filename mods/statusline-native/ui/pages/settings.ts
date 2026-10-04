import type { RenderElement } from 'claude-code';
import type { Editor, NumericField } from '../../lib/editor/draft.ts';
import type { Preference } from '../../lib/preferences.ts';
import { canEdit } from '../../lib/preferences.ts';
import { settingsKeys, pageWindow } from '../../lib/editor/navigation.ts';
import type { Actions, Controls } from '../controls.ts';
import { clip } from '../layout.ts';
import { pagination } from '../components/pagination.ts';

export function settingsPage(
  ui: Controls,
  editor: Editor,
  preferences: Preference[],
  width: number,
  capacity: number,
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
      autoFocus: editor.setting === key ? true : undefined,
      options: values.map((choice) => ({
        label: String(choice),
        value: String(choice),
      })),
      onSelect: (selected) => actions.edit((state) => update(state, selected)),
    });
  const numeric = (field: NumericField, label: string) =>
    Input({
      key: field,
      label,
      value: editor.buffers[field],
      submitLabel: 'Accept',
      autoFocus: editor.setting === field ? true : undefined,
      onInput: (value) =>
        actions.edit((state) => state.setBuffer(field, value)),
      onSubmit: (value) =>
        actions.edit((state) => {
          state.setBuffer(field, value);
          state.acceptNumeric(field);
        }),
    });
  const toggle = (
    key: string,
    label: string,
    update: (editor: Editor) => void,
    hotkey?: string,
  ) =>
    Button({
      key,
      label: clip(label, width),
      plain: true,
      hotkey,
      autoFocus: editor.setting === key ? true : undefined,
      onPress: () => actions.edit(update),
    });
  const rows: RenderElement[] = [
    toggle(
      'colors',
      `Colors: ${display.use_colors ? 'on' : 'off'}`,
      (state) => {
        state.draft.display.use_colors = !state.draft.display.use_colors;
      },
      'c',
    ),
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
      'Directory',
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
    numeric('padding', 'Padding'),
    numeric('refresh_interval', 'Refresh'),
    toggle(
      'vim-indicator',
      `Vim indicator: ${editor.draft.host.hide_vim_mode_indicator ? 'hidden' : 'shown'}`,
      (state) => {
        state.draft.host.hide_vim_mode_indicator =
          !state.draft.host.hide_vim_mode_indicator;
      },
    ),
    choices(
      'scope-labels',
      'Scope labels',
      display.scope_labels,
      editor.description.options['scope-labels'].choices,
      (state, value) => {
        state.draft.display.scope_labels = value as typeof display.scope_labels;
      },
    ),
    toggle(
      'settings-subagent-statusline',
      `Custom subagent rows: ${display.subagents.enabled ? 'on' : 'off'}`,
      (state) => {
        state.draft.display.subagents.enabled =
          !state.draft.display.subagents.enabled;
      },
    ),
  ];
  if (editor.advanced) {
    for (const key of ['theme', 'verbose'] as const) {
      const preference = preferences.find((value) => value.row.key === key);
      if (!preference) {
        rows.push(
          Text({
            wrap: 'truncate',
            children: [key + ': unavailable in this host'],
          }),
        );
        continue;
      }
      const row = preference.row;
      if (!canEdit(preference)) {
        rows.push(
          Text({
            wrap: 'truncate',
            children: [
              `${row.label}: ${String(row.value)} (${row.isLocked ? 'locked by host policy' : 'unsupported control'})`,
            ],
          }),
        );
      } else if (row.kind === 'choice') {
        rows.push(
          Select({
            key: 'host-' + key,
            label: row.label,
            value: String(preference.value),
            autoFocus: editor.setting === 'host-' + key ? true : undefined,
            options: (row.options || []).map((value) => ({
              label: value,
              value,
            })),
            onSelect: (value) => actions.preference(key, value),
          }),
        );
      } else {
        rows.push(
          Button({
            key: 'host-' + key,
            plain: true,
            label: clip(
              row.label + ': ' + (preference.value ? 'on' : 'off'),
              width,
            ),
            autoFocus: editor.setting === 'host-' + key ? true : undefined,
            onPress: () => actions.preference(key, !preference.value),
          }),
        );
      }
    }
  }
  const keys = settingsKeys(editor.advanced);
  const window = pageWindow(keys, editor.setting, capacity);
  return [
    Text({
      bold: true,
      wrap: 'truncate',
      children: [
        editor.advanced ? 'Tool settings + host (apply: a)' : 'Tool settings',
      ],
    }),
    ...rows.slice(window.start, window.end),
    pagination(ui, keys, editor.setting, capacity, actions),
  ];
}
