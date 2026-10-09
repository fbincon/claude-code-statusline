/** Presentation of canonical descriptors and actual host rows, without editing values. */
import type { View } from '../session.ts';
import type { SettingRow } from '../client/settings.ts';
import { PREFERENCE_SPECS, specFor, canEdit } from '../preferences.ts';
import { preferenceResult } from './messages.ts';
import { t, text } from './index.ts';
import type { Language } from './index.ts';
import type { Shortcut } from '../../ui/components/shortcuts.ts';

export function translatedShortcuts(groups: Shortcut[][], language: Language = 'en'): Shortcut[][] {
  const label = (value: string) => t('ui.hints.' + value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), language, {}, value);
  return groups.map(group => group.map(h => ({...h, label: label(h.label), ...(h.short ? {short: label(h.short)} : {})})));
}

export function preferenceLabel(preference: View['preferences'][number], language: Language = 'en'): string {
  const spec = specFor(preference);
  return spec ? t('preferences.' + spec.id + '.label', language, {}, preference.row.label) : preference.row.label;
}

function groupKey(group: string): string {
  return 'groups.' + group.toLowerCase().replaceAll(' / ', '.').replaceAll(' ', '-');
}

export function fieldMessage(row: SettingRow, view: View) {
  const key = row.key;
  if (key.startsWith('field:')) return text('fields.global.' + key.slice(6) + '.label');
  if (key.startsWith('item:')) return text('fields.item.' + key.slice(5) + '.label');
  if (key.startsWith('fit:')) {
    const [, id, field] = key.split(':');
    return text('native.fitting_label', {item: text('items.main.' + id + '.label'), field: text('fields.item.' + field + '.label')});
  }
  if (key.startsWith('break:')) return text('layout.break_before', {item: text('items.main.' + key.slice(6) + '.label')});
  return text('native.settings.' + key);
}

const VALUE_KEYS = new Set(['on','off','inherit','default','ansi','full','home','project-relative','basename','classic','compact',
  'when-subagents','always','event','hide','show','auto','explicit','original','short','legacy','grouped','unicode','ascii',
  'remaining','used','countdown','time','datetime','local','UTC','all','running','light','dark','hidden','shown']);

function valueLabel(value: string, language: Language) {
  return VALUE_KEYS.has(value) ? t('values.' + value, language, {}, value) : value;
}

export function settingPresentation(view: View, rows: SettingRow[]): SettingRow[] {
  const language = view.language ?? 'en';
  return rows.map(row => {
    let label = fieldMessage(row, view);
    let group = t(groupKey(row.group), language, {}, row.group);
    let value = row.value;
    if (row.key.startsWith('host-')) {
      const p = view.preferences.find(p => 'host-' + p.row.key === row.key);
      const spec = p ? specFor(p) : PREFERENCE_SPECS.find(s => 'host-' + s.id === row.key);
      if (spec) {
        label = text('preferences.' + spec.id + '.label');
        group = t('native.host_group', language, {group: text(groupKey(spec.group))});
        const entry = text('preferences.' + spec.id + '.entry');
        value = p ? (p.row.kind === 'boolean' ? t('values.' + (p.value ? 'on' : 'off'), language)
                   : p.row.kind === 'choice' && spec.id !== 'model' ? valueLabel(String(p.value), language) : String(p.value)) +
          (p.row.isLocked ? t('native.host_locked', language, {entry}) : !canEdit(p) ? t('native.host_unsupported', language, {entry}) : '') +
          (p.result ? ' · ' + preferenceResult(p, language) : '') : t('native.host_unavailable', language, {entry});
      }
    } else if (row.key === 'ui-language') {
      // Both autonyms remain recognizable in either interface language.
    } else if (row.key === 'preset-select') value = t('presets.' + value, language);
    else if (['preset-apply','import-file','export-file'].includes(row.key)) value = t('native.actions.' + row.key, language);
    else if (!row.key.endsWith(':label') && !row.key.endsWith(':icon') && !row.key.endsWith('base_ref')) value = valueLabel(value, language);
    return {...row, label: t(label.key, language, label.params, row.label), group, value};
  });
}
