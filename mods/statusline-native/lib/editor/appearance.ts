/** Pure controls/validation from Python's scoped visibility capabilities. */
import { VISIBILITY_ITEMS } from '../generated-contracts.ts';
import type { Scope, EditorField } from '../generated-contracts.ts';

export function visibilityChoices(scope: Scope, id: string): string[] {
  const rule = (VISIBILITY_ITEMS[scope] as Record<string, string>)[id];
  return rule ? ['always', rule] : ['always'];
}

export function itemFields(fields: EditorField[], scope: Scope, id: string): EditorField[] {
  const choices = visibilityChoices(scope, id);
  return fields.filter(spec => (spec.key !== 'visibility' || choices.length > 1) &&
    (spec.key !== 'visibility_threshold' || choices.includes('used-at-least')))
    .map(spec => spec.key === 'visibility' ? {...spec, choices} : spec);
}

export function validColor(value: unknown): boolean {
  return value === null || value === 'default' || typeof value === 'string' && !/\s/u.test(value) &&
    (/^#[0-9a-f]{6}$/i.test(value) || /^ansi:[0-9]{1,3}$/.test(value) && Number(value.slice(5)) <= 255);
}

export function normalizeColor(value: unknown): unknown {
  if (typeof value !== 'string' || !validColor(value)) return value;
  return value.startsWith('ansi:') ? 'ansi:' + Number(value.slice(5)) : value.toLowerCase();
}
