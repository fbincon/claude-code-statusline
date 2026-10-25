import { validCostRateOptions } from '../editor/cost-rate.js';
import { validGroups } from '../editor/groups.js';
import { validIndicatorOptions } from '../editor/indicators.js';
import type { DisplayDraft, SubagentDraft, InstanceDraft, ItemOptionsDraft, Scope, MetricsDraft } from '../contracts/ui.js';
import { integer as jsonInteger, canonical, scalarCompare, isLosslessNumber, pythonFloat } from '../json.js';
import { LANGUAGES, resolveLanguage } from '../i18n/registry.js';
import { DEFAULT_DISPLAY, DEFAULT_SUBAGENTS, DEFAULT_ITEM, DEFAULT_FORMATTING, DEFAULT_POWERLINE } from './defaults.js';
import { BY_SCOPE, canonicalItem, conflicts } from './catalog.js';
import { object, exact, fail, clone, choice, nullableInteger, ConfigError, isSchema } from './validation.js';
export { isSchema } from './validation.js';
import * as options from './formatting.js';
import { reference, SOURCE_TYPES } from '../extensions/model.js';

export const SCHEMA_VERSION = 14;
export const CONFIG_FILENAME = 'claude-statusline.json';
const v1 = ['schema_version', 'items', 'use_colors', 'palette', 'directory_style', 'separator_style'];
const v2 = [...v1, 'scope_labels', 'subagents'];
const v3 = [...v2, 'formatting', 'item_options', 'layout'];
const v5 = [...v3, 'metrics'];
const v6 = [...v5, 'statusline_language'];
const v7 = [...v6, 'theme', 'powerline_glyph'];
const v8 = [...v7.filter(key => !['items', 'item_options'].includes(key)), 'instances'];
const current = [...v8, 'powerline'];
const subagentKeys = ['enabled', 'items', 'item_options', 'visibility', 'hide_completed', 'row_limit', 'task_max_width'];

export function defaultDisplay(): DisplayDraft { return clone(DEFAULT_DISPLAY); }
export function defaultSubagents(): SubagentDraft { return clone(DEFAULT_SUBAGENTS); }
export function defaultItem(): ItemOptionsDraft { return clone(DEFAULT_ITEM); }
function repr(value: unknown): string {
  if (value == null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'string') return "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
  if (isLosslessNumber(value) && !/^-?\d+$/u.test(value.value)) {
    const number = Number(value.value);
    return Number.isFinite(number) ? pythonFloat(number) : number < 0 ? '-inf' : 'inf';
  }
  return String(value);
}
export function baseRef(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !value || [...value].length > 256 || value.startsWith('-') || /[\p{White_Space}\p{Cc}\p{Cs}]/u.test(value)) {
    fail('errors.metrics.branch_diff_base_ref_must_be_null');
  }
  return value;
}
function metrics(value: unknown): MetricsDraft {
  if (!object(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, 'branch_diff_base_ref')) fail('errors.metrics.metrics_requires_exactly_branch_diff_base_ref');
  return { branch_diff_base_ref: baseRef(value.branch_diff_base_ref) };
}
export function validateItems(value: unknown, scope: Scope): string[] {
  const main = scope === 'main';
  if (!Array.isArray(value)) fail(main ? 'errors.display.items_must_be_an_array_of_item' : 'errors.display.subagents_items_must_be_an_array_of');
  const seen = new Set<string>();
  const result = value.map(raw => {
    if (typeof raw !== 'string') fail(main ? 'errors.display.every_items_entry_must_be_a_string' : 'errors.display.every_subagents_items_entry_must_be_a');
    const id = main ? canonicalItem(raw) : raw;
    if (!BY_SCOPE[scope].has(id) || ['text', 'spacer'].includes(id)) fail(main ? 'errors.display.unknown_status_line_item' : 'errors.display.unknown_subagent_status_line_item', { item: id });
    if (seen.has(id)) fail(main ? 'errors.display.duplicate_status_line_item' : 'errors.display.duplicate_subagent_status_line_item', { item: id });
    seen.add(id); return id;
  });
  if (!main && conflicts(scope, result)) fail('errors.display.subagents_items_cannot_combine_status_elapsed_with');
  return result;
}
export function legacyInstances(scope: Scope, items: readonly string[], values: Record<string, ItemOptionsDraft>): InstanceDraft[] {
  const order = [...items, ...BY_SCOPE[scope].keys()].filter((id, index, all) => all.indexOf(id) === index && (items.includes(id) || Object.hasOwn(values, id)));
  return order.map(id => ({ id, type_id: id, enabled: items.includes(id), options: clone(values[id] ?? DEFAULT_ITEM), text: null }));
}
export function validateInstances(value: unknown, scope: Scope): InstanceDraft[] {
  if (!Array.isArray(value)) fail('composition.errors.array');
  const nodes = value.map(raw => {
    exact(raw, ['id', 'type_id', 'enabled', 'options', 'text', ...(object(raw) && Object.hasOwn(raw, 'source') ? ['source'] : [])], 'instance');
    const source = Object.hasOwn(raw, 'source') ? reference(raw.source) : undefined;
    if (source && !SOURCE_TYPES.includes(raw.type_id as string)) fail('composition.errors.node_options');
    const { id, type_id, enabled, text } = raw;
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/u.test(id)) fail('composition.errors.id');
    if (typeof type_id !== 'string' || !BY_SCOPE[scope].has(type_id)) fail('composition.errors.unknown_type');
    if (typeof enabled !== 'boolean') fail('composition.errors.enabled');
    const parsed = options.itemOptions(raw.options);
    if (!validIndicatorOptions(parsed as unknown as Record<string, unknown>, scope, type_id) || !validCostRateOptions(parsed as unknown as Record<string, unknown>, scope, type_id)) fail('composition.errors.node_options');
    const capability = BY_SCOPE[scope].get(type_id)?.capabilities;
    if (parsed.link !== undefined && !capability?.link || SOURCE_TYPES.includes(type_id) && Object.keys(parsed.formatting).some(key=>!capability?.formats.includes(key))) fail('composition.errors.node_options');
    if (type_id === 'text' || type_id === 'spacer') {
      if (parsed.visibility !== 'always' || Object.keys(parsed.formatting).length) fail('composition.errors.node_options');
      if (type_id === 'spacer' && canonical(parsed) !== canonical(DEFAULT_ITEM)) fail('composition.errors.spacer_options');
    } else parsed.visibility = options.visibility(scope, type_id, parsed.visibility);
    if (type_id === 'text') {
      if (typeof text !== 'string') fail('composition.errors.literal');
      // Item text and labels share the Python codepoint/control constraints.
      if ([...text].length > 256 || /[\p{Cc}\p{Cs}]/u.test(text)) fail('errors.formatting.must_be_null_or_text_without_control', { name: 'text' });
    } else if (text !== null) fail('composition.errors.only_text');
    return { id, type_id, enabled, options: parsed, text: text as string | null, ...(source ? { source } : {}) };
  });
  if (new Set(nodes.map(node => node.id)).size !== nodes.length) fail('composition.errors.duplicate');
  if (conflicts(scope, nodes.filter(node => node.enabled && !['text', 'spacer'].includes(node.type_id)).map(node => node.type_id))) fail('composition.errors.conflict');
  if (scope === 'subagent' && nodes.filter(node => node.type_id === 'spacer').length > 1) fail('composition.errors.subagent_spacer');
  return nodes;
}
function subagentScalars(value: Record<string, unknown>): Omit<SubagentDraft, 'instances' | 'groups'> {
  if (typeof value.enabled !== 'boolean') fail('errors.display.subagents_enabled_must_be_true_or_false');
  if (!['all', 'running'].includes(value.visibility as string) || typeof value.hide_completed !== 'boolean') {
    throw new ConfigError('subagent visibility must be all/running and hide_completed a boolean');
  }
  return { enabled: value.enabled, visibility: value.visibility as SubagentDraft['visibility'], hide_completed: value.hide_completed,
    row_limit: nullableInteger(value.row_limit, 0, 10000, 'row_limit'), task_max_width: nullableInteger(value.task_max_width, 2, 10000, 'task_max_width') };
}
export function validateSubagents(value: unknown, grouped = true): SubagentDraft {
  exact(value, [...subagentKeys.filter(key => !['items', 'item_options'].includes(key)), 'instances', ...(grouped ? ['groups'] : [])], 'subagents');
  const instances = validateInstances(value.instances, 'subagent');
  const groups = grouped ? value.groups : [];
  if (!validGroups(groups, instances)) fail('composition.groups.invalid');
  return { ...subagentScalars(value), instances, groups };
}
function legacySubagents(value: unknown, legacy: boolean): SubagentDraft {
  if (!object(value)) fail('errors.display.subagents_must_contain_a_json_object');
  const unknown = Object.keys(value).filter(key => !subagentKeys.includes(key)).sort(scalarCompare);
  const missing = subagentKeys.filter(key => !Object.hasOwn(value, key)).sort(scalarCompare);
  if (unknown.length) fail('errors.display.unknown_subagents_field_s', { value0: unknown.join(', ') });
  if (missing.length) fail('errors.display.missing_subagents_field_s', { value0: missing.join(', ') });
  const scalars = subagentScalars(value);
  const items = validateItems(value.items, 'subagent');
  const fields = options.legacyOptions(value.item_options, [...BY_SCOPE.subagent.keys()].filter(id => !['text', 'spacer'].includes(id)), 'subagent', legacy);
  return { ...scalars, groups: [], instances: legacyInstances('subagent', items, fields) };
}
function scalars(data: Record<string, unknown>, version: number) {
  if (typeof data.use_colors !== 'boolean') fail('errors.display.use_colors_must_be_true_or_false');
  return {
    schema_version: 14 as const, groups: [], use_colors: data.use_colors,
    palette: choice(data.palette, ['default', 'ansi'] as const, 'palette'),
    directory_style: choice(data.directory_style, ['full', 'home', 'project-relative', 'basename'] as const, 'directory_style'),
    separator_style: choice(data.separator_style, ['classic', 'compact', 'powerline'] as const, 'separator_style'),
    scope_labels: version === 1 ? 'when-subagents' as const : choice(data.scope_labels, ['off', 'when-subagents', 'always'] as const, 'scope_labels'),
    statusline_language: version >= 6 ? choice(resolveLanguage(data.statusline_language) ?? data.statusline_language, LANGUAGES, 'statusline_language') : 'en' as const,
    theme: version >= 7 ? choice(data.theme, ['classic', 'dark', 'light', 'terminal'] as const, 'theme') : 'classic' as const,
    powerline_glyph: version >= 7 ? choice(data.powerline_glyph, ['ascii', 'powerline'] as const, 'powerline_glyph') : 'ascii' as const,
    powerline: version >= 9 ? options.powerline(data.powerline) : clone(DEFAULT_POWERLINE),
    formatting: version >= 3 ? options.formatting(data.formatting) : clone(DEFAULT_FORMATTING),
    metrics: version >= 4 ? metrics(data.metrics) : { branch_diff_base_ref: null },
  };
}
export function validateDisplay(value: unknown): DisplayDraft {
  if (!object(value)) fail('errors.display.display_configuration_must_contain_a_json_object');
  let version: bigint;
  try { version = jsonInteger(value.schema_version); }
  catch { return fail('errors.display.schema_version_must_be_1_2_3', { SCHEMA_VERSION, version: repr(value.schema_version) }); }
  if (version > 14n) fail('errors.display.schema_version_is_newer_than_supported_version', { version, SCHEMA_VERSION });
  if (version < 1n) fail('errors.display.schema_version_must_be_1_2_3', { SCHEMA_VERSION, version: repr(value.schema_version) });
  if (version < 14n && [value.instances, object(value.subagents) ? value.subagents.instances : null].some(nodes => Array.isArray(nodes) && nodes.some(node => object(node) && object(node.options) && ['foreground_gradient','background_gradient'].some(key => Object.hasOwn(node.options as object, key))))) fail('gradients.schema');
  if (version >= 8n) {
    exact(value, version === 8n ? v8 : [...current, ...(version >= 12n ? ['groups'] : [])], 'display');
    const nodes = validateInstances(value.instances, 'main');
    const layout = options.layout(value.layout, nodes.map(node => node.id));
    if (layout.mode === 'auto' && nodes.some(node => node.type_id === 'spacer')) fail('composition.errors.main_spacer');
    const byId = new Map(nodes.map(node => [node.id, node]));
    if (layout.rows.some(row => row.filter(id => byId.get(id)!.type_id === 'spacer').length > 1)) fail('composition.errors.row_spacer');
    const subagents = validateSubagents(value.subagents, version >= 12n), groups = version >= 12n ? value.groups : [];
    if (!validGroups(groups, nodes, layout)) fail('composition.groups.invalid');
    return orderedDisplay({ ...scalars(value, Number(version)), subagents, layout, instances: nodes, groups });
  }
  const n = Number(version), keys = n === 1 ? v1 : n === 2 ? v2 : n === 3 ? v3 : n <= 5 ? v5 : n === 6 ? v6 : v7;
  const unknown = Object.keys(value).filter(key => !keys.includes(key)).sort(scalarCompare);
  const missing = keys.filter(key => !Object.hasOwn(value, key)).sort(scalarCompare);
  if (unknown.length) fail('errors.display.unknown_display_configuration_field_s', { value0: unknown.join(', ') });
  if (missing.length) fail('errors.display.missing_display_configuration_field_s', { value0: missing.join(', ') });
  const data = { ...value };
  if (object(data.item_options)) {
    const mapped: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(data.item_options)) {
      const name = canonicalItem(key);
      if (Object.hasOwn(mapped, name)) fail('errors.display.conflicting_item_aliases_in_item_options');
      Object.defineProperty(mapped, name, { value: item, enumerable: true, configurable: true });
    }
    data.item_options = mapped;
  }
  if (object(data.layout) && Array.isArray(data.layout.rows)) data.layout = { ...data.layout,
    rows: data.layout.rows.map(row => Array.isArray(row) ? row.map(id => typeof id === 'string' ? canonicalItem(id) : id) : row) };
  const items = validateItems(data.items, 'main');
  const fields = n >= 3 ? options.legacyOptions(data.item_options, [...BY_SCOPE.main.keys()].filter(id => !['text', 'spacer'].includes(id)), 'main', n < 7) : {};
  const nodes = legacyInstances('main', items, fields);
  const requestedLayout = n >= 3 ? options.layout(data.layout, items) : { mode: 'auto' as const, rows: [] };
  if (n === 2) {
    if (!object(data.subagents) || Object.keys(data.subagents).length !== 2 || !Object.hasOwn(data.subagents, 'enabled') || !Object.hasOwn(data.subagents, 'items')) fail('errors.display.v2_subagents_requires_exactly_enabled_and_items');
    const { instances: _instances, groups: _groups, ...defaults } = defaultSubagents();
    data.subagents = { ...defaults, item_options: {}, ...data.subagents };
  }
  return orderedDisplay({ ...scalars(data, n), instances: nodes,
    subagents: n === 1 ? defaultSubagents() : legacySubagents(data.subagents, n < 7),
    layout: options.reorderedLayout(requestedLayout, nodes.map(node => node.id)) });
}

function orderedDisplay(value: DisplayDraft): DisplayDraft {
  return { schema_version: 14, groups: value.groups, use_colors: value.use_colors, palette: value.palette,
    directory_style: value.directory_style, separator_style: value.separator_style,
    scope_labels: value.scope_labels, statusline_language: value.statusline_language,
    theme: value.theme, powerline_glyph: value.powerline_glyph, powerline: value.powerline, subagents: value.subagents,
    formatting: value.formatting, layout: value.layout, metrics: value.metrics, instances: value.instances };
}
