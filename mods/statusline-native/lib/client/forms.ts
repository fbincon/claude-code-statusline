import { setMessage, failureMessage } from '../i18n/messages.ts';
import { text as localizedText } from '../i18n/index.ts';
/** Canonical Python descriptors drive advanced tool forms in the Client. */
import { ITEM_DEFAULTS } from '../generated-contracts.ts';
import { itemFields, normalizeColor } from '../editor/appearance.ts';
import { isDraft } from '../backend.ts';
import { copyDraft } from '../editor/draft.ts';
import type { Draft, EditorField } from '../generated-contracts.ts';
import type { View } from '../session.ts';
import type { SettingRow } from './settings.ts';
import { fieldMessage } from '../i18n/presentation.ts';

export interface FormRow extends SettingRow {
  spec: EditorField;
  valueRaw: unknown;
}

function read(data: unknown, path: string): unknown {
  return path.split('.').reduce((v, key) => (v as Record<string, unknown>)[key], data);
}

function write(data: unknown, path: string, value: unknown): void {
  const parts = path.split('.');
  const key = parts.pop()!;
  const target = parts.reduce((v, part) => (v as Record<string, unknown>)[part], data);
  (target as Record<string, unknown>)[key] = value;
}

function format(raw: unknown): string {
  return raw === null ? 'inherit' : typeof raw === 'boolean' ? raw ? 'on' : 'off' : String(raw);
}

function row(spec: EditorField, key: string, valueRaw: unknown): FormRow {
  return { ...spec, spec, key, valueRaw, value: format(valueRaw), editable: true };
}

export function formRows(view: View): FormRow[] {
  const e = view.editor!;
  const d = e.draft.display;
  if (e.detail) {
    const map = e.detail.scope === 'main' ? d.item_options : d.subagents.item_options;
    const options = (map as Record<string, NonNullable<Draft['display']['item_options'][keyof Draft['display']['item_options']]>>)[e.detail.id];
    return itemFields(e.description.editor_fields.item!, e.detail.scope, e.detail.id).map((spec) => row(spec, 'item:' + spec.key,
      spec.key in e.description.formatting_options ? options?.formatting[spec.key] ?? 'inherit' :
      options?.[spec.key as keyof typeof options] ?? ITEM_DEFAULTS[spec.key as keyof typeof ITEM_DEFAULTS]))
      .sort((a, b) => ['Item format', 'Conditional visibility', 'Item colors', 'Item fitting'].indexOf(a.group) - ['Item format', 'Conditional visibility', 'Item colors', 'Item fitting'].indexOf(b.group));
  }
  if (e.page === 'layout') {
    const result = [row({ key: 'layout.mode', label: 'Layout mode', group: 'Layout', kind: 'choice', choices: ['auto', 'explicit'], minimum: 0, maximum: 0, nullable: false }, 'layout.mode', d.layout.mode)];
    const starts = new Set(d.layout.rows.slice(1).map((r) => r[0]));
    for (const id of d.items) {
      const label = e.catalog('main').find((i) => i.id === id)!.label;
      if (id !== d.items[0]) result.push(row({ key: 'break:' + id, label: 'New row before ' + label, group: 'Row boundaries', kind: 'boolean', choices: [], minimum: 0, maximum: 0, nullable: false }, 'break:' + id, starts.has(id)));
    }
    for (const id of d.items) {
      const label = e.catalog('main').find((i) => i.id === id)!.label;
      for (const name of ['priority', 'max_width']) {
        const spec = e.description.editor_fields.item!.find((s) => s.key === name)!;
        result.push(row({ ...spec, label: label + ' ' + spec.label, group: 'Item fitting' }, 'fit:' + id + ':' + name,
          d.item_options[id]?.[name as 'priority' | 'max_width'] ?? (name === 'priority' ? 50 : null)));
      }
    }
    return result;
  }
  return e.description.editor_fields.global!.map((spec) => row(spec, 'field:' + spec.key, read(d, spec.key)));
}

function options(draft: Draft, scope: 'main' | 'subagent', id: string) {
  const map = scope === 'main' ? draft.display.item_options : draft.display.subagents.item_options;
  const target = map as Record<string, NonNullable<Draft['display']['item_options'][keyof Draft['display']['item_options']]>>;
  return target[id] ??= { ...ITEM_DEFAULTS, visibility: 'always', formatting: {} };
}

export function setFormValue(view: View, current: FormRow, raw: string | boolean): boolean {
  const e = view.editor!;
  const spec = current.spec;
  let value: unknown = raw;
  if (spec.kind === 'integer') {
    value = spec.nullable && (raw === 'inherit' || raw === 'none') ? null :
      typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (value !== null && (!Number.isInteger(value) || Number(value) < spec.minimum || Number(value) > spec.maximum)) {
      setMessage(view, "message", localizedText("native.lib.client.forms.enter", {label: fieldMessage(current, view), minimum: spec.minimum, maximum: spec.maximum, value3: (spec.nullable ? localizedText("native.lib.client.forms.or_none") : localizedText("native.lib.client.forms.detail"))}));
      return false;
    }
  } else if (spec.kind === 'text') value = spec.nullable && raw === 'inherit' ? null : raw;
  else if (spec.kind === 'choice' && !spec.choices.includes(String(raw))) return false;
  if (spec.key === "foreground" || spec.key === "background") value = normalizeColor(value);
  const draft = copyDraft(e.draft);
  if (current.key === 'layout.mode') {
    draft.display.layout = { mode: value as 'auto' | 'explicit', rows: value === 'explicit' && draft.display.items.length ? [[...draft.display.items]] : [] };
  } else if (current.key.startsWith('break:')) {
    const starts = new Set(draft.display.layout.rows.slice(1).map((r) => r[0]));
    const id = current.key.slice(6) as Draft['display']['items'][number];
    if (value) starts.add(id); else starts.delete(id);
    const rows: typeof draft.display.layout.rows = [];
    for (const item of draft.display.items) {
      if (!rows.length || starts.has(item)) rows.push([]);
      rows[rows.length - 1]!.push(item);
    }
    draft.display.layout = { mode: 'explicit', rows };
  } else if (current.key.startsWith('fit:')) {
    const [, id, key] = current.key.split(':');
    (options(draft, 'main', id!) as unknown as Record<string, unknown>)[key!] = value;
  } else if (e.detail) {
    const option = options(draft, e.detail.scope, e.detail.id);
    if (spec.key in e.description.formatting_options) {
      if (value === 'inherit') delete option.formatting[spec.key];
      else option.formatting[spec.key] = String(value);
    } else (option as unknown as Record<string, unknown>)[spec.key] = value;
  } else write(draft.display, spec.key, value);
  if (!isDraft(draft)) {
    setMessage(view, "message", localizedText("native.lib.client.forms.invalid_value_check_thresholds_text_and_width_constraints"));
    return false;
  }
  e.draft = draft;
  return true;
}

export function adjustForm(view: View, current: FormRow, delta: -1 | 1): void {
  const spec = current.spec;
  if (spec.kind === 'boolean') setFormValue(view, current, !current.valueRaw);
  else if (spec.kind === 'choice') {
    const index = spec.choices.indexOf(String(current.valueRaw));
    setFormValue(view, current, spec.choices[(index + delta + spec.choices.length) % spec.choices.length]!);
  } else if (spec.kind === 'integer') {
    setFormValue(view, current, String(Math.max(spec.minimum, Math.min(spec.maximum, Number(current.valueRaw ?? spec.minimum) + delta))));
  }
}
