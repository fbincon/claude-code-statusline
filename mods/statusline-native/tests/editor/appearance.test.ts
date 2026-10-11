import { component } from '../fixtures.ts';
import { expect, test } from 'claude-code/testing';
import { BASE } from '../fixtures.ts';
import { copyDraft } from '../../lib/editor/draft.ts';
import { isDraft } from '../../lib/backend.ts';
import { EDITOR_FIELDS } from '../../lib/generated-contracts.ts';
import { itemFields, normalizeColor } from '../../lib/editor/appearance.ts';
import { APPEARANCE_CASES } from '../generated-search-fixtures.ts';

test('shared scoped appearance cases have the same acceptance as Python', () => {
  for (const c of APPEARANCE_CASES) {
    const draft = copyDraft(BASE);
    const target = c.scope === 'main' ? draft.display : draft.display.subagents;
    const node = component(c.item,false);
    Object.assign(node.options,c.patch);
    target.instances = [...target.instances.filter(i=>i.id!==c.item),node];
    expect(isDraft(draft)).toBe(c.valid);
  }
});

test('scoped forms expose only meaningful conditions and canonicalize colors', () => {
  const fields = JSON.parse(JSON.stringify(EDITOR_FIELDS.item));
  expect(itemFields(fields, 'main', 'model').some(f => f.key === 'visibility')).toBe(false);
  expect(itemFields(fields, 'subagent', 'task').some(f => f.key === 'visibility')).toBe(false);
  expect(itemFields(fields, 'main', 'active-agents').find(f => f.key === 'visibility')?.choices).toEqual(['always', 'nonzero']);
  expect(itemFields(fields, 'main', 'context-used').some(f => f.key === 'visibility_threshold')).toBe(true);
  expect(normalizeColor('#Ab01EF')).toBe('#ab01ef');
  expect(normalizeColor('ansi:001')).toBe('ansi:1');
});

test('future, partial, invalid global appearances are rejected', () => {
  for (const patch of [{schema_version: 9}, {theme: 'auto'}, {powerline_glyph: 'custom'}, {separator_style: 'shell'}]) {
    const draft = copyDraft(BASE);
    Object.assign(draft.display, patch);
    expect(isDraft(draft)).toBe(false);
  }
  const draft = copyDraft(BASE);
  delete (draft.display as unknown as Record<string, unknown>).theme;
  expect(isDraft(draft)).toBe(false);
});
