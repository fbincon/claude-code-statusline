import type { View } from '../session.ts';
import { canEdit } from '../preferences.ts';

export interface SettingRow {
  key: string;
  label: string;
  group: string;
  value: string;
  editable: boolean;
}

export function settingRows(view: View): SettingRow[] {
  const e = view.editor!;
  const d = e.draft.display;
  const h = e.draft.host;
  const rows: SettingRow[] = [
    {
      key: 'colors',
      label: 'Colors',
      group: 'Appearance',
      value: d.use_colors ? 'on' : 'off',
      editable: true,
    },
    {
      key: 'palette',
      label: 'Palette',
      group: 'Appearance',
      value: d.palette,
      editable: true,
    },
    {
      key: 'directory-style',
      label: 'Directory',
      group: 'Appearance',
      value: d.directory_style,
      editable: true,
    },
    {
      key: 'separator-style',
      label: 'Separator',
      group: 'Appearance',
      value: d.separator_style,
      editable: true,
    },
    {
      key: 'scope-labels',
      label: 'Scope labels',
      group: 'Appearance',
      value: d.scope_labels,
      editable: true,
    },
    {
      key: 'padding',
      label: 'Padding',
      group: 'Refresh / behavior',
      value: e.buffers.padding,
      editable: true,
    },
    {
      key: 'refresh_interval',
      label: 'Refresh',
      group: 'Refresh / behavior',
      value: e.buffers.refresh_interval,
      editable: true,
    },
    {
      key: 'vim-indicator',
      label: 'Vim indicator',
      group: 'Refresh / behavior',
      value: h.hide_vim_mode_indicator ? 'hidden' : 'shown',
      editable: true,
    },
    {
      key: 'settings-subagent-statusline',
      label: 'Custom subagent rows',
      group: 'Refresh / behavior',
      value: d.subagents.enabled ? 'on' : 'off',
      editable: true,
    },
  ];
  if (e.advanced) {
    for (const key of ['theme', 'verbose']) {
      const p = view.preferences.find((row) => row.row.key === key);
      rows.push({
        key: 'host-' + key,
        label: p?.row.label || key,
        group: 'Claude preferences (apply separately)',
        value: p
          ? String(p.value) +
            (p.row.isLocked
              ? ' [locked by host policy]'
              : !canEdit(p)
                ? ' [unsupported control]'
                : '')
          : '(unavailable)',
        editable: !!p && canEdit(p),
      });
    }
  }
  return rows;
}

export function adjustSetting(view: View, delta: -1 | 1): void {
  const e = view.editor!;
  const d = e.draft.display;
  const choice = (
    key: keyof typeof e.description.options,
    current: string,
  ): string => {
    const values = (
      e.description.options[key] as { choices: (string | boolean)[] }
    ).choices as string[];
    return values[
      (values.indexOf(current) + delta + values.length) % values.length
    ]!;
  };
  switch (e.setting) {
    case 'colors':
      d.use_colors = !d.use_colors;
      break;
    case 'palette':
      d.palette = choice('palette', d.palette) as typeof d.palette;
      break;
    case 'directory-style':
      d.directory_style = choice(
        'directory-style',
        d.directory_style,
      ) as typeof d.directory_style;
      break;
    case 'separator-style':
      d.separator_style = choice(
        'separator-style',
        d.separator_style,
      ) as typeof d.separator_style;
      break;
    case 'scope-labels':
      d.scope_labels = choice(
        'scope-labels',
        d.scope_labels,
      ) as typeof d.scope_labels;
      break;
    case 'vim-indicator':
      e.draft.host.hide_vim_mode_indicator =
        !e.draft.host.hide_vim_mode_indicator;
      break;
    case 'settings-subagent-statusline':
      d.subagents.enabled = !d.subagents.enabled;
      break;
    case 'padding':
    case 'refresh_interval': {
      const field = e.setting;
      const range =
        field === 'padding'
          ? e.description.options.padding
          : e.description.options['refresh-interval'];
      const current = e.draft.host[field];
      e.setBuffer(
        field,
        String(
          Math.max(
            range.minimum,
            Math.min(
              range.maximum,
              (typeof current === 'number' ? current : range.minimum) + delta,
            ),
          ),
        ),
      );
      e.acceptNumeric(field);
      break;
    }
    default: {
      const p = view.preferences.find((p) => 'host-' + p.row.key === e.setting);
      if (!p || !canEdit(p)) {
        view.message =
          'This Claude preference is unavailable, locked or unsupported.';
        break;
      }
      if (p.row.kind === 'boolean') p.value = !p.value;
      else {
        const choices = p.row.options!;
        p.value =
          choices[
            (choices.indexOf(String(p.value)) + delta + choices.length) %
              choices.length
          ]!;
      }
      p.result = '';
    }
  }
}
