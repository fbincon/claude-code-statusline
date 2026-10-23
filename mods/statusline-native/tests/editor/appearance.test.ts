import { component } from '../fixtures.ts';
import { expect, test } from 'claude-code/testing';
import { BASE } from '../fixtures.ts';
import { copyDraft } from '../../lib/editor/draft.ts';
import { isDraft } from '../../lib/backend.ts';
import { EDITOR_FIELDS } from '../../lib/generated-contracts.ts';
import { itemFields, normalizeColor } from '../../lib/editor/appearance.ts';
import { APPEARANCE_CASES } from '../generated-search-fixtures.ts';
import { Editor } from '../../lib/editor/draft.ts';
import { description, readResult } from '../fixtures.ts';
import { formRows, setFormValue } from '../../lib/editor/forms.ts';

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

test('indicator fields survive native form changes and draft validation', () => {
  const current = readResult();
  current.draft.display.instances = [component('context-used')];
  const editor = new Editor(description(), current);
  editor.detail = { scope: 'main', id: 'context-used' };
  const view = { editor, message: '' };
  for (const [key, value] of [['presentation', 'bar'], ['bar_width', '12'], ['bar_style', 'ascii']] as const) {
    const field = formRows(view).find(row => row.spec.key === key)!;
    expect(setFormValue(view, field, value)).toBe(true);
  }
  expect(isDraft(editor.draft)).toBe(true);
  expect(editor.draft.display.instances[0]!.options.bar_width).toBe(12);
  const width = formRows(view).find(row => row.spec.key === 'bar_width')!;
  expect(setFormValue(view, width, '21')).toBe(false);
  expect(editor.draft.display.instances[0]!.options.bar_width).toBe(12);
});

test('future, partial, invalid global appearances are rejected', () => {
  for (const patch of [{schema_version: BASE.display.schema_version + 1}, {theme: 'auto'}, {powerline_glyph: 'custom'}, {separator_style: 'shell'}]) {
    const draft = copyDraft(BASE);
    Object.assign(draft.display, patch);
    expect(isDraft(draft)).toBe(false);
  }
  const draft = copyDraft(BASE);
  delete (draft.display as unknown as Record<string, unknown>).theme;
  expect(isDraft(draft)).toBe(false);
});
test('new Powerline controls share native forms and strict validation', () => {
  const editor=new Editor(description(),readResult());editor.page='settings';
  const view={editor,message:''};
  for(const [key,value] of [['padding','left'],['separator','slash'],['start_cap',true],['end_cap',false],['color_mode','continuous']] as const) {
    const field=formRows(view).find(row=>row.spec.key==='powerline.'+key)!;
    expect(setFormValue(view,field,value)).toBe(true);
    expect(editor.draft.display.powerline[key]).toBe(value);
  }
  expect(isDraft(editor.draft)).toBe(true);
  expect(description().presets.filter(p=>['daily-development','agent-focus','quota-watch'].includes(p.id)).length).toBe(3);
  const field=formRows(view).find(row=>row.spec.key==='powerline.padding')!;
  expect(setFormValue(view,field,'unknown')).toBe(false);
});

test('native rate forms retain the selected denominator and reject unrelated options', () => {
  const current = readResult(); current.draft.display.instances = [component('session-cost-rate')];
  const editor = new Editor(description(), current); editor.detail = { scope: 'main', id: 'session-cost-rate' };
  const view = { editor, message: '' }, row = formRows(view).find(row => row.spec.key === 'cost_rate_basis')!;
  expect(row.valueRaw).toBe('session'); expect(setFormValue(view, row, 'api')).toBe(true);
  expect(isDraft(editor.draft)).toBe(true); expect(editor.draft.display.instances[0]!.options.cost_rate_basis).toBe('api');
  expect(setFormValue(view, row, 'active')).toBe(false);
  expect(current.draft.display.instances[0]!.options.cost_rate_basis).toBe(undefined);
});
