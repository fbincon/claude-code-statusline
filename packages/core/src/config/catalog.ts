import type { CatalogItem, Scope } from '../contracts/ui.js';
import { catalogData } from './catalog-data.js';

export const ITEMS: readonly CatalogItem[] = catalogData as CatalogItem[];
export const BY_SCOPE = {
  main: new Map(ITEMS.filter(item => item.scope === 'main').map(item => [item.id, item])),
  subagent: new Map(ITEMS.filter(item => item.scope === 'subagent').map(item => [item.id, item])),
};
export const NODE_TYPES = ['text', 'spacer'] as const;
export function canonicalItem(id: string): string { return id === 'prompt-timer' ? 'task-timer' : id; }
export function defaultItems(scope: Scope): string[] {
  return [...BY_SCOPE[scope].values()].filter(item => item.default_position !== null)
    .sort((a, b) => a.default_position! - b.default_position!).map(item => item.id);
}
export function conflicts(scope: Scope, types: readonly string[]): boolean {
  const selected = new Set(types);
  return types.some(id => BY_SCOPE[scope].get(id)?.excludes.some(other => selected.has(other)));
}
