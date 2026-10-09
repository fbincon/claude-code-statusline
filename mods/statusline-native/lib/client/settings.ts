import { setMessage, failureMessage } from '../i18n/messages.ts';
import { text as localizedText } from '../i18n/index.ts';
import type { View } from '../session.ts';
import { formRows, adjustForm } from './forms.ts';
import { PREFERENCE_SPECS, specFor, canEdit } from '../preferences.ts';
import { LANGUAGE_NAMES } from '../i18n/index.ts';

export interface SettingRow {
  key: string;
  label: string;
  group: string;
  value: string;
  editable: boolean;
}

export function settingRows(view: View): SettingRow[] {
  const e = view.editor!;
  if (e.detail || e.page === 'layout') return formRows(view);
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
      key: 'preview-background',
      label: 'Preview background (UI only)',
      group: 'Appearance',
      value: view.previewBackground ?? 'dark',
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
  const fields = formRows(view);
  const appearanceEnd = rows.findIndex(row => row.group !== 'Appearance');
  rows.splice(appearanceEnd, 0, ...fields.filter(row => row.group === 'Appearance'));
  rows.push(...fields.filter(row => row.group !== 'Appearance'));
  rows.push(
    { key: 'ui-language', label: 'Interface language (saved immediately)', group: 'Interface', value: LANGUAGE_NAMES[view.language ?? 'en'], editable: true },
    { key: 'preset-select', label: 'Preset', group: 'Presets / portable files', value: e.preset, editable: true },
    { key: 'preset-apply', label: 'Expand selected preset', group: 'Presets / portable files', value: 'replace draft; save later', editable: true },
    { key: 'import-file', label: 'Import file', group: 'Presets / portable files', value: 'file path; save later', editable: true },
    { key: 'export-file', label: 'Export current draft', group: 'Presets / portable files', value: 'new file path (may be unsaved)', editable: true },
  );
  if (e.advanced) {
    for (const spec of PREFERENCE_SPECS) {
      const p = view.preferences.find((p) => specFor(p)?.id === spec.id);
      rows.push({ key: 'host-' + (p?.row.key ?? spec.id), label: p?.row.label || spec.label,
        group: spec.group + ' (apply separately)',
        value: p ? String(p.value) + (p.row.isLocked ? ' [locked; ' + spec.entry + ']' : !canEdit(p) ? ' [unsupported; ' + spec.entry + ']' : '') + (p.result ? ' · ' + p.result : '') : '(unavailable; ' + spec.entry + ')',
        editable: !!p && canEdit(p) });
    }
  }
  return rows;
}

export function adjustSetting(view: View, delta: -1 | 1): void {
  const e = view.editor!;
  const d = e.draft.display;
  const form = formRows(view).find((row) => row.key === e.setting);
  if (form) { adjustForm(view, form, delta); return; }
  if (e.setting === 'preset-select') {
    const choices = e.description.presets.map((p) => p.id);
    e.preset = choices[(choices.indexOf(e.preset) + delta + choices.length) % choices.length]!;
    return;
  }
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
    case 'ui-language':
      view.language = view.language === 'zh-CN' ? 'en' : 'zh-CN';
      break;
    case 'preview-background':
      view.previewBackground = view.previewBackground === 'light' ? 'dark' : 'light';
      break;
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
        setMessage(view, "message", localizedText("native.lib.client.settings.this_claude_preference_is_unavailable_locked_or_unsupported"));
        break;
      }
      if (p.row.kind === 'boolean') p.value = !p.value;
      else if (p.row.kind === 'choice') {
        const choices = p.row.options!;
        p.value =
          choices[
            (choices.indexOf(String(p.value)) + delta + choices.length) %
              choices.length
          ]!;
      }
      else if (p.row.kind === 'number') p.value = Number(p.value) + delta;
      p.result = '';
    }
  }
}
