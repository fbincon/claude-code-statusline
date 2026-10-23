import { reconcileGroups, insertionAfter } from '../editor/groups.js';
import type { DisplayDraft, InstanceDraft, Scope, LayoutDraft, ItemOptionsDraft, SubagentDraft } from '../contracts/ui.js';
import { BY_SCOPE, canonicalItem } from './catalog.js';
import { defaultItem, validateDisplay, validateSubagents } from './display.js';
import { fail, clone } from './validation.js';
import { itemOptions, FORMAT_CHOICES, reorderedLayout } from './formatting.js';

export function scoped(config: DisplayDraft, scope: Scope): DisplayDraft | SubagentDraft {
  if (scope !== 'main' && scope !== 'subagent') fail('composition.errors.scope');
  return scope === 'main' ? config : config.subagents;
}
export function find(config: DisplayDraft, scope: Scope, id: string): InstanceDraft | undefined {
  return scoped(config, scope).instances.find(node => node.id === id);
}
export function legacyId(config: DisplayDraft, scope: Scope, typeId: string, allowAbsent = false): string {
  const type = scope === 'main' ? canonicalItem(typeId) : typeId;
  const matches = scoped(config, scope).instances.filter(node => node.type_id === type);
  if (matches.length > 1) fail('composition.errors.ambiguous', { type_id: type, scope });
  if (matches.length) return matches[0]!.id;
  if (allowAbsent && BY_SCOPE[scope].has(type)) {
    if (find(config, scope, type)) fail('composition.errors.legacy', { scope });
    return type;
  }
  return fail('composition.errors.absent', { type_id: type, scope });
}
export function reconcileRows(layout: LayoutDraft, nodes: readonly InstanceDraft[]): LayoutDraft {
  if (layout.mode !== 'explicit') return clone(layout);
  const ids = nodes.map(node => node.id);
  if (!layout.rows.length) return { mode: 'explicit', rows: ids.length ? [ids] : [] };
  const membership = new Map(layout.rows.flatMap((row, index) => row.map(id => [id, index] as const)));
  const sizes = layout.rows.map(() => 0);
  let current = ids.map(id => membership.get(id)).find(value => value !== undefined) ?? 0;
  for (const id of ids) { current = membership.get(id) ?? current; sizes[current] = sizes[current]! + 1; }
  let offset = 0;
  const rows = sizes.filter(size => size > 0).map(size => { const row = ids.slice(offset, offset + size); offset += size; return row; });
  return { mode: 'explicit', rows };
}
export function updateProjection(nodes: readonly InstanceDraft[], scope: Scope, items?: readonly string[], options?: Record<string, ItemOptionsDraft>): InstanceDraft[] {
  let result = clone([...nodes]);
  const byId = new Map(result.map(node => [node.id, node]));
  if (items !== undefined) {
    const selected = items.map(id => scope === 'main' && !byId.has(id) ? canonicalItem(id) : id);
    for (const id of selected) {
      if (!byId.has(id)) {
        if (!BY_SCOPE[scope].has(id)) fail('composition.errors.unknown_id');
        const node = { id, type_id: id, enabled: true, options: defaultItem(), text: null };
        result.push(node); byId.set(id, node);
      }
    }
    result = [...selected.map(id => ({ ...byId.get(id)!, enabled: true })), ...result.filter(node => !selected.includes(node.id)).map(node => ({ ...node, enabled: false }))];
  }
  if (options !== undefined) {
    for (const [id, option] of Object.entries(options)) {
      if (!result.some(node => node.id === id)) {
        if (!BY_SCOPE[scope].has(id)) fail('composition.errors.options_id');
        result.push({ id, type_id: id, enabled: false, options: clone(option), text: null });
      }
    }
    result = result.map(node => ({ ...node, options: clone(Object.hasOwn(options, node.id) ? options[node.id]! : defaultItem()) }));
  }
  return result;
}
export function updateDisplay(config: DisplayDraft, updates: Partial<DisplayDraft> & { items?: readonly string[]; item_options?: Record<string, ItemOptionsDraft> }): DisplayDraft {
  const { items, item_options, ...rest } = updates;
  const nodes = updateProjection(rest.instances ?? config.instances, 'main', items, item_options);
  let layout = rest.layout ?? reconcileRows(config.layout, nodes);
  if (rest.layout && layout.mode === 'explicit' && JSON.stringify(layout.rows.flat()) === JSON.stringify(nodes.filter(node => node.enabled).map(node => node.id))) {
    layout = reorderedLayout(layout, nodes.map(node => node.id));
  }
  return validateDisplay({ ...config, ...rest, instances: nodes, layout, groups: reconcileGroups(rest.groups ?? config.groups, nodes) });
}
export function updateSubagents(config: SubagentDraft, updates: Partial<SubagentDraft> & { items?: readonly string[]; item_options?: Record<string, ItemOptionsDraft> }): SubagentDraft {
  const { items, item_options, ...rest } = updates;
  const nodes = updateProjection(rest.instances ?? config.instances, 'subagent', items, item_options);
  return validateSubagents({ ...config, ...rest, instances: nodes, groups: reconcileGroups(rest.groups ?? config.groups, nodes) });
}
export function editedOptions(current: ItemOptionsDraft, option: string, value: unknown): ItemOptionsDraft {
  const data = clone(current), key = option.replaceAll('-', '_');
  if (Object.hasOwn(FORMAT_CHOICES, key)) {
    if (value === 'inherit') delete data.formatting[key];
    else data.formatting[key] = value as string;
  } else if (['label', 'icon', 'priority', 'max_width', 'foreground', 'background', 'visibility', 'visibility_threshold', 'link', 'presentation', 'bar_width', 'bar_style', 'cost_rate_basis'].includes(key)) {
    if (['priority', 'max_width', 'visibility_threshold', 'bar_width'].includes(key)) {
      if (value === null || value === 'none') value = null;
      else if (typeof value === 'string' && /^[+-]?\d+$/u.test(value.trim())) value = Number(value);
      else if (typeof value !== 'number' || !Number.isFinite(value)) fail('errors.advanced.width_priority_must_be_an_integer_or');
    } else if (value === 'inherit') value = null;
    (data as unknown as Record<string, unknown>)[key] = value;
  } else fail('errors.advanced.unknown_item_option');
  return itemOptions(data);
}
export interface Edit { action: string; id?: string; type_id?: string; after?: string; before?: string; option?: string; value?: unknown; text?: string }
export function edit(config: DisplayDraft, scope: Scope, request: Edit, nextId: () => string): { config: DisplayDraft; selected: string | null } {
  const { action, id, type_id, after, before, option, value, text } = request;
  if (action === 'add' && text !== undefined && type_id !== 'text') fail('composition.errors.only_text');
  const nodes = clone(scoped(config, scope).instances);
  const node = nodes.find(item => item.id === id);
  if (!['add', 'copy'].includes(action) && !node) fail('composition.errors.unknown_id');
  let selected = id ?? null;
  if (action === 'add' || action === 'copy') {
    if (action === 'copy' && !node) fail('composition.errors.unknown_id');
    selected = nextId();
    const added: InstanceDraft = action === 'copy' ? { ...clone(node!), id: selected } : { id: selected, type_id: type_id!, enabled: true, options: defaultItem(), text: type_id === 'text' ? text ?? '' : null };
    const anchor = after ?? (action === 'copy' ? id : undefined);
    if (anchor !== undefined && !nodes.some(node => node.id === anchor)) fail('composition.errors.anchor');
    const index = insertionAfter(nodes, scoped(config, scope).groups, anchor);
    nodes.splice(index, 0, added);
  } else if (action === 'remove') {
    const index = nodes.indexOf(node!); nodes.splice(index, 1);
    selected = nodes[Math.min(index, nodes.length - 1)]?.id ?? null;
  } else if (action === 'move') {
    if ((after === undefined) === (before === undefined)) fail('composition.errors.move');
    const anchor = after ?? before;
    if (anchor === id) return { config, selected };
    nodes.splice(nodes.indexOf(node!), 1);
    const index = nodes.findIndex(item => item.id === anchor);
    if (index < 0) fail('composition.errors.anchor');
    nodes.splice(index + (after === undefined ? 0 : 1), 0, node!);
  } else if (action === 'enable' || action === 'disable') node!.enabled = action === 'enable';
  else if (action === 'set') {
    if (option === 'text') node!.text = value as string;
    else {
      const capability = BY_SCOPE[scope].get(node!.type_id)?.capabilities, key = option!.replaceAll('-','_');
      if (Object.hasOwn(FORMAT_CHOICES,key) && !supportedFormats(scope,node!.type_id,capability).includes(key) || key === 'link' && !capability?.link) fail('errors.advanced.unknown_item_option');
      node!.options = editedOptions(node!.options, option!, value);
    }
  } else fail('composition.errors.action');
  return { config: scope === 'main' ? updateDisplay(config, { instances: nodes }) : updateDisplay(config, { subagents: updateSubagents(config.subagents, { instances: nodes }) }), selected };
}
import { supportedFormats } from '../editor/appearance.js';
