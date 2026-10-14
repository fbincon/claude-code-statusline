import type { DisplayDraft, EditorField, Scope } from '../contracts/ui.js';
import { EDITOR_FIELDS } from '../contracts/ui.js';
import { BY_SCOPE, canonicalItem } from './catalog.js';
import { defaultItem, validateDisplay } from './display.js';
import { find, scoped, updateDisplay, updateSubagents, editedOptions, edit } from './instances.js';
import { FORMAT_CHOICES, VISIBILITY_ITEMS, layout } from './formatting.js';
import { clone, fail, integer } from './validation.js';

export function itemFields(scope: Scope, typeId: string): EditorField[] {
  if (typeId === 'spacer') return [];
  const fields = EDITOR_FIELDS.item as unknown as readonly EditorField[];
  if (typeId === 'text') return [{ key: 'text', label: 'Literal text', group: 'Item format', kind: 'text', choices: [], minimum: 0, maximum: 10000, nullable: false },
    ...fields.filter(field => ['label', 'icon', 'foreground', 'background', 'priority', 'max_width'].includes(field.key)).map(clone)];
  const rule = Object.hasOwn(VISIBILITY_ITEMS[scope], typeId) ? VISIBILITY_ITEMS[scope][typeId] : undefined;
  return fields.filter(field => (field.key !== 'visibility' || rule !== undefined) && (field.key !== 'visibility_threshold' || rule === 'used-at-least'))
    .map(field => field.key === 'visibility' ? { ...field, choices: ['always', rule!] } : clone(field));
}
export function editItem(config: DisplayDraft, scope: Scope, identifier: string, option: string, value: unknown): DisplayDraft {
  let node = find(config, scope, identifier);
  if (!node && scope === 'main') { identifier = canonicalItem(identifier); node = find(config, scope, identifier); }
  if (!node && !BY_SCOPE[scope].has(identifier)) fail('errors.advanced.unknown_scoped_item');
  const nodes = scoped(config, scope).instances;
  const values = Object.fromEntries(nodes.map(item => [item.id, clone(item.options)]));
  values[identifier] = editedOptions(node?.options ?? defaultItem(), option, value);
  return scope === 'main' ? updateDisplay(config, { item_options: values }) : updateDisplay(config, { subagents: updateSubagents(config.subagents, { item_options: values }) });
}
export function editLayout(config: DisplayDraft, mode: string, rows?: string[][]): DisplayDraft {
  const known = new Set(config.instances.map(node => node.id));
  const mapped = rows?.length ? rows.map(row => row.map(id => known.has(id) ? id : canonicalItem(id))) :
    mode === 'explicit' && config.instances.some(node => node.enabled) ? [config.instances.map(node => node.id)] : [];
  return updateDisplay(config, { layout: layout({ mode, rows: mapped }, mode === 'explicit' ? mapped.flat() : []) });
}
export function parseField(spec: EditorField, raw: unknown): unknown {
  if (spec.kind === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw !== 'on' && raw !== 'off') fail('errors.editor_fields.expected_on_off');
    return raw === 'on';
  }
  if (spec.kind === 'integer') {
    if (spec.nullable && [null, 'none', 'inherit'].includes(raw as null | string)) return null;
    if (typeof raw === 'string' && /^[0-9]+$/u.test(raw)) raw = Number(raw);
    else if (typeof raw !== 'number' || !Number.isInteger(raw)) fail('errors.editor_fields.expected_an_integer');
    return integer(raw, spec.minimum, spec.maximum, spec.key);
  }
  if (spec.kind === 'choice' && !spec.choices.includes(raw as string)) fail('errors.editor_fields.expected_one_of', { value0: spec.choices.join(', ') });
  return spec.nullable && raw === 'inherit' ? null : raw;
}
export function fieldValue(config: DisplayDraft, key: string, scope?: Scope, identifier?: string): unknown {
  if (scope !== undefined) {
    const node = find(config, scope, identifier!);
    if (key === 'text') return node?.text;
    const options = node?.options ?? defaultItem();
    return Object.hasOwn(FORMAT_CHOICES, key) ? options.formatting[key] ?? 'inherit' : options[key as keyof typeof options];
  }
  let value: unknown = config;
  for (const part of key.split('.')) value = (value as Record<string, unknown>)[part];
  return value;
}
export function setField(config: DisplayDraft, key: string, raw: unknown, scope?: Scope, identifier?: string): DisplayDraft {
  const node = scope === undefined ? undefined : find(config, scope, identifier!);
  const fields = scope === undefined ? EDITOR_FIELDS.global as unknown as readonly EditorField[] : itemFields(scope, node?.type_id ?? identifier!);
  const spec = fields.find(field => field.key === key);
  if (!spec) fail('errors.editor_fields.unknown_editor_field');
  const parsed = parseField(spec, raw);
  if (scope !== undefined) {
    if (key === 'text') return edit(config, scope, { action: 'set', id: identifier!, option: 'text', value: parsed }, () => { throw new Error('Unexpected ID allocation'); }).config;
    return editItem(config, scope, identifier!, key, parsed === null && spec.kind === 'text' ? 'inherit' : parsed);
  }
  const data = clone(config), parts = key.split('.');
  let target = data as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
  target[parts.at(-1)!] = parsed;
  return validateDisplay(data);
}
export function breakBefore(config: DisplayDraft, identifier: string, enabled: boolean): DisplayDraft {
  const breaks = new Set(config.layout.rows.slice(1).map(row => row[0]!));
  if (enabled) breaks.add(identifier); else breaks.delete(identifier);
  const rows: string[][] = [];
  for (const node of config.instances) { if (!rows.length || breaks.has(node.id)) rows.push([]); rows.at(-1)!.push(node.id); }
  return editLayout(config, 'explicit', rows);
}
