import type { Draft, ImportChange, Scope } from '../contracts/ui.js';
import { canonical, scalarCompare } from '../json.js';
import { text, t } from '../i18n/messages.js';
import { clone, object } from './validation.js';

export const SECTIONS = ['main', 'subagent', 'formatting', 'layout', 'language', 'host'] as const;
export const KINDS = ['add', 'remove', 'enable', 'disable', 'reorder', 'change'] as const;

function fieldMessage(path: string[]) {
  let key: string;
  if (path.includes('options')) {
    const tail = path.slice(path.indexOf('options') + 1), name = tail.at(-1) ?? 'overrides';
    key = name === 'overrides' ? 'review.overrides' : 'fields.item.' + name + '.label';
  } else if (path[0] === 'host') key = 'review.fields.' + path.at(-1);
  else if (path.length === 2 && ['use_colors', 'palette', 'directory_style', 'separator_style', 'scope_labels', 'layout'].includes(path[1]!)) key = 'review.fields.' + path[1];
  else if (path.join('.') === 'display.subagents.enabled') key = 'review.fields.subagents_enabled';
  else key = 'fields.global.' + path.slice(1).join('.') + '.label';
  return t(key) === key ? text('review.field', { path: path.join('.') }) : text(key);
}

export function differences(before: Draft, after: Draft): ImportChange[] {
  const changes: ImportChange[] = [];
  function add(section: ImportChange['section'], kind: ImportChange['kind'], scope: Scope | null, identifier: string | null,
    path: string[], old: unknown, next: unknown, typeId?: string) {
    let label = text('review.component', { item: identifier || path.join('.') });
    if (identifier && typeId) {
      const item = text(`items.${scope}.${typeId}.label`);
      label = ['enable', 'disable', 'add', 'remove'].includes(kind) ? text('review.' + kind, { item }) : text('review.item_field', { item, field: fieldMessage(path) });
    } else if (kind === 'reorder') label = text('review.reorder');
    else if (kind === 'change') label = fieldMessage(path);
    changes.push({ section, kind, scope, item_id: identifier, path, before: clone(old), after: clone(next), label });
  }
  function walk(old: unknown, next: unknown, path: string[], section: ImportChange['section'], scope: Scope | null = null, identifier: string | null = null, typeId?: string) {
    if (canonical(old) === canonical(next)) return;
    if (object(old) && object(next)) {
      for (const key of [...new Set([...Object.keys(old), ...Object.keys(next)])].sort(scalarCompare)) {
        walk(old[key] ?? null, next[key] ?? null, [...path, key], section, scope, identifier, typeId);
      }
    } else add(section, 'change', scope, identifier, path, old, next, typeId);
  }
  const old = before.display, next = after.display;
  for (const scope of ['main', 'subagent'] as const) {
    const left = scope === 'main' ? old : old.subagents, right = scope === 'main' ? next : next.subagents;
    const root = scope === 'main' ? ['display'] : ['display', 'subagents'];
    const a = new Map(left.instances.map(node => [node.id, node])), b = new Map(right.instances.map(node => [node.id, node]));
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const previous = a.get(id), following = b.get(id), node = following ?? previous!;
      const path = [...root, 'instances', id];
      if (!previous || !following) { add(scope, following ? 'add' : 'remove', scope, id, path, previous ?? null, following ?? null, node.type_id); continue; }
      if (previous.enabled !== following.enabled) add(scope, following.enabled ? 'enable' : 'disable', scope, id, [...path, 'enabled'], previous.enabled, following.enabled, node.type_id);
      for (const key of ['type_id', 'options', 'text'] as const) walk(previous[key], following[key], [...path, key], key === 'options' ? 'formatting' : scope, scope, id, node.type_id);
    }
    const leftOrder = [...a.keys()].filter(id => b.has(id)), rightOrder = [...b.keys()].filter(id => a.has(id));
    if (canonical(leftOrder) !== canonical(rightOrder)) add(scope, 'reorder', scope, null, [...root, 'instances'], leftOrder, rightOrder);
  }
  for (const key of Object.keys(old).filter(key => !['schema_version', 'instances', 'subagents', 'layout', 'statusline_language', 'metrics'].includes(key)).sort(scalarCompare)) {
    walk(old[key as keyof typeof old], next[key as keyof typeof next], ['display', key], 'formatting');
  }
  for (const key of Object.keys(old.subagents).filter(key => key !== 'instances').sort(scalarCompare)) {
    walk(old.subagents[key as keyof typeof old.subagents], next.subagents[key as keyof typeof next.subagents], ['display', 'subagents', key], 'subagent');
  }
  walk(old.metrics, next.metrics, ['display', 'metrics'], 'main');
  walk(old.layout, next.layout, ['display', 'layout'], 'layout');
  walk(old.statusline_language, next.statusline_language, ['display', 'statusline_language'], 'language');
  walk(before.host, after.host, ['host'], 'host');
  return changes.sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section));
}
