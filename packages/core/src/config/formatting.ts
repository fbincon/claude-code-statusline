import { POWERLINE_FIELDS, type PowerlineDraft } from '../contracts/ui.js';
import type { FormattingDraft, ItemOptionsDraft, LayoutDraft, Scope, VisibilityRule } from '../contracts/ui.js';
import { DEFAULT_ITEM } from './defaults.js';
import { exact, integer, nullableInteger, safeText, object, fail, clone } from './validation.js';

import { FORMAT_CHOICES, VISIBILITY_ITEMS } from './generated-constants.js';
export { FORMAT_CHOICES, VISIBILITY_ITEMS };
export function color(value: unknown): string | null {
  if (value === null || value === 'default') return value;
  if (typeof value === 'string') {
    if (/^#[0-9a-fA-F]{6}$/u.test(value)) return value.toLowerCase();
    if (/^ansi:[0-9]{1,3}$/u.test(value) && Number(value.slice(5)) <= 255) return 'ansi:' + Number(value.slice(5));
  }
  return fail('errors.appearance.color');
}
export function visibility(scope: Scope, id: string, rule: unknown): VisibilityRule {
  if (rule !== 'always' && (!Object.hasOwn(VISIBILITY_ITEMS[scope], id) || VISIBILITY_ITEMS[scope][id] !== rule)) {
    fail('errors.appearance.visibility', { scope, item: id });
  }
  return rule as VisibilityRule;
}
export function overrides(value: unknown): Record<string, string> {
  if (!object(value) || Object.keys(value).some(key => !Object.hasOwn(FORMAT_CHOICES, key))) fail('errors.formatting.format_overrides_contain_unknown_fields');
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const choices: readonly string[] = FORMAT_CHOICES[key as keyof typeof FORMAT_CHOICES];
    if (typeof item !== 'string' || !choices.includes(item)) fail('errors.formatting.must_be_one_of', { field: key, value1: choices.join(', ') });
    output[key] = item;
  }
  return output;
}
export function formatting(value: unknown): FormattingDraft {
  exact(value, [...Object.keys(FORMAT_CHOICES), 'thresholds'], 'formatting');
  const { thresholds, ...rest } = value;
  const choices = overrides(rest);
  exact(thresholds, ['enabled', 'warning', 'critical'], 'thresholds');
  if (typeof thresholds.enabled !== 'boolean') fail('errors.formatting.thresholds_enabled_must_be_a_boolean');
  const warning = integer(thresholds.warning, 0, 100, 'thresholds.warning');
  const critical = integer(thresholds.critical, 0, 100, 'thresholds.critical');
  if (warning >= critical) fail('errors.formatting.thresholds_warning_must_be_below_critical');
  return { ...Object.fromEntries(Object.keys(FORMAT_CHOICES).map(key => [key, choices[key]])), thresholds: { enabled: thresholds.enabled, warning, critical } } as unknown as FormattingDraft;
}
export function itemOptions(value: unknown): ItemOptionsDraft {
  exact(value, Object.keys(DEFAULT_ITEM), 'item options');
  return {
    label: safeText(value.label, 'label'), icon: safeText(value.icon, 'icon'),
    priority: integer(value.priority, 0, 100, 'priority'), max_width: nullableInteger(value.max_width, 2, 10000, 'max_width'),
    formatting: overrides(value.formatting), foreground: color(value.foreground), background: color(value.background),
    visibility: value.visibility as VisibilityRule, visibility_threshold: integer(value.visibility_threshold, 0, 100, 'visibility_threshold'),
  };
}
export function legacyOptions(value: unknown, ids: readonly string[], scope: Scope, legacy: boolean): Record<string, ItemOptionsDraft> {
  if (!object(value) || Object.keys(value).some(id => !ids.includes(id))) fail('errors.formatting.item_options_must_map_known_scoped_item');
  return Object.fromEntries(Object.entries(value).map(([id, raw]) => {
    if (legacy) { exact(raw, ['label', 'icon', 'priority', 'max_width', 'formatting'], 'item options'); raw = { ...clone(DEFAULT_ITEM), ...raw }; }
    const option = itemOptions(raw); option.visibility = visibility(scope, id, option.visibility);
    return [id, option];
  }));
}
export function layout(value: unknown, ids: readonly string[]): LayoutDraft {
  exact(value, ['mode', 'rows'], 'layout');
  if (!['auto', 'explicit'].includes(value.mode as string) || !Array.isArray(value.rows)) fail('errors.formatting.layout_requires_auto_explicit_mode_and_an');
  const rows = value.rows;
  if (rows.some(row => !Array.isArray(row) || !row.length || row.some(id => typeof id !== 'string'))) fail('errors.formatting.layout_rows_must_be_nonempty_arrays_of');
  if (value.mode === 'auto' && rows.length) fail('errors.formatting.auto_layout_requires_empty_rows');
  if (value.mode === 'explicit' && JSON.stringify(rows.flat()) !== JSON.stringify(ids)) fail('errors.formatting.explicit_rows_must_flatten_to_items_in');
  return { mode: value.mode as LayoutDraft['mode'], rows: rows.map(row => [...row]) };
}
export function reorderedLayout(value: LayoutDraft, ids: readonly string[]): LayoutDraft {
  if (value.mode === 'auto') return clone(value);
  const remaining = [...ids], rows: string[][] = [];
  for (const row of value.rows) {
    const size = row.filter(id => ids.includes(id)).length;
    if (size) rows.push(remaining.splice(0, size));
  }
  if (remaining.length) { if (rows.length) rows.at(-1)!.push(...remaining); else rows.push(remaining); }
  return { mode: 'explicit', rows };
}

/** Closed, shared appearance controls; no arbitrary glyph templates. */
export function powerline(value: unknown): PowerlineDraft {
  exact(value, POWERLINE_FIELDS.map(field => field.key.slice(10)), 'powerline');
  for (const field of POWERLINE_FIELDS) {
    const key = field.key.slice(10), raw = value[key];
    if (field.kind === 'boolean' ? typeof raw !== 'boolean' : !(field.choices as readonly unknown[]).includes(raw))
      fail('errors.powerline.value', { field: key });
  }
  return clone(value) as unknown as PowerlineDraft;
}
