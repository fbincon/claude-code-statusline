import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS } from '../src/config/catalog.js';
import { defaultDisplay, defaultItem } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import type { DescribeResult, Draft, GroupDraft, InstanceDraft, ReadResult, Scope } from '../src/contracts/ui.js';
import { isDraft } from '../src/editor/backend.js';
import { changesKey } from '../src/editor/change-review.js';
import { copyDraft, Editor } from '../src/editor/draft.js';
import { groupScope } from '../src/editor/groups.js';

const members = ['context-tokens', 'dot', 'context-used'];
const mainOrder = ['session-cost', 'worktree', ...members, 'tokens', 'model'];
const agentMembers = ['name', 'dot', 'status-elapsed'];
const agentOrder = ['effort', ...agentMembers, 'tokens'];

function instance(id: string): InstanceDraft {
  return { id, type_id: id === 'dot' ? 'text' : id.startsWith('gap-') ? 'spacer' : id,
    enabled: id !== 'context-used', text: id === 'dot' ? '·' : null, options: defaultItem() };
}

function group(id: string, memberIds: string[]): GroupDraft {
  return { id, member_ids: [...memberIds], primary_id: memberIds[0]!, link_visibility: true, shared_powerline: true };
}

function editor(draft: Draft): Editor {
  assert(isDraft(draft), 'Opening configuration must be valid');
  const current: ReadResult = { draft, revision: '0'.repeat(64), installed: true, installation: {}, backend_version: 'test',
    capabilities: { host_version: null, subagent_rows: 'unknown', native_mod: 'unknown', native_mod_loaded: null, data_observation: 'not_observed' } };
  return new Editor({ catalog: [...ITEMS] } as DescribeResult, current);
}

function fixture(rows: string[][] = [mainOrder]): Draft {
  const display = defaultDisplay();
  display.instances = rows.flat().map(instance);
  display.groups = [group('context-block', members)];
  display.layout = { mode: 'explicit', rows: rows.map(row => [...row]) };
  display.subagents.instances = agentOrder.map(instance);
  display.subagents.groups = [group('agent-block', agentMembers)];
  return { display, host: { ...DEFAULT_HOST } };
}

function assertOrder(e: Editor, scope: Scope, ids: string[]): void {
  assert.deepEqual(e.order[scope], ids);
  assert.deepEqual(groupScope(e.draft.display, scope).instances.map(node => node.id), ids);
  assert.deepEqual(groupScope(e.draft.display, scope).groups, groupScope(e.baseline.draft.display, scope).groups);
  assert(isDraft(e.draft));
}

test('single components cross a complete group in either direction in both scopes', () => {
  const auto = fixture();
  auto.display.layout = { mode: 'auto', rows: [] };
  for (const opening of [fixture(), auto]) {
    for (const [id, delta, expected] of [
      ['worktree', 1, ['session-cost', ...members, 'worktree', 'tokens', 'model']],
      ['tokens', -1, ['session-cost', 'worktree', 'tokens', ...members, 'model']],
    ] as const) {
      const e = editor(opening);
      e.selectItem('main', id);
      assert(e.move('main', delta));
      assertOrder(e, 'main', [...expected]);
      assert.deepEqual(e.draft.display.layout.rows, opening.display.layout.mode === 'explicit' ? [expected] : []);
      assert.equal(e.selected.main, id);
      assert.deepEqual(e.draft.display.subagents, opening.display.subagents);
      assert.equal(e.history.undo.length, 1);
    }
  }
  for (const [id, delta, expected] of [
    ['effort', 1, [...agentMembers, 'effort', 'tokens']],
    ['tokens', -1, ['effort', 'tokens', ...agentMembers]],
  ] as const) {
    const e = editor(fixture());
    e.selectItem('subagent', id);
    assert(e.move('subagent', delta));
    assertOrder(e, 'subagent', [...expected]);
    assert.equal(e.selected.subagent, id);
    assert.deepEqual(e.draft.display.layout, e.baseline.draft.display.layout);
  }
});

test('selecting any group member moves the whole group and retains the selected member', () => {
  for (const id of members) {
    const e = editor(fixture());
    e.selectItem('main', id);
    assert(e.move('main', -1));
    assertOrder(e, 'main', ['session-cost', ...members, 'worktree', 'tokens', 'model']);
    assert(e.move('main', 1));
    assertOrder(e, 'main', mainOrder);
    assert.equal(e.selected.main, id);
  }
  const e = editor(fixture());
  e.selectItem('subagent', 'dot');
  assert(e.move('subagent', 1));
  assertOrder(e, 'subagent', ['effort', 'tokens', ...agentMembers]);
  assert.equal(e.selected.subagent, 'dot');
});

test('adjacent groups of different sizes swap without losing their members or settings', () => {
  const first = ['session-cost', 'worktree'];
  for (const rows of [[mainOrder], [first, [...members, 'tokens', 'model']]]) {
    const opening = fixture(rows);
    opening.display.groups.push({ ...group('other', first), link_visibility: false });
    const e = editor(opening);
    e.selectItem('main', 'worktree');
    assert(e.move('main', 1));
    assertOrder(e, 'main', [...members, ...first, 'tokens', 'model']);
    assert.deepEqual(e.draft.display.layout.rows, rows.length === 1 ? [[...members, ...first, 'tokens', 'model']] : [members, [...first, 'tokens', 'model']]);
    assert.equal(e.selected.main, 'worktree');
    assert(e.move('main', -1));
    assert.deepEqual(e.draft, opening);
  }
});

test('crossing an explicit row boundary swaps units between rows as one undoable step', () => {
  const opening = fixture([['session-cost', 'worktree'], [...members, 'tokens'], ['model']]);
  const e = editor(opening);
  e.selectItem('main', 'worktree');
  assert(e.move('main', 1));
  assertOrder(e, 'main', ['session-cost', ...members, 'worktree', 'tokens', 'model']);
  assert.deepEqual(e.draft.display.layout.rows, [['session-cost', ...members], ['worktree', 'tokens'], ['model']]);
  const moved = copyDraft(e.draft);
  assert.equal(e.history.undo.length, 1);
  assert(e.undo());
  assert.deepEqual(e.draft, opening);
  assert(e.undo(true));
  assert.deepEqual(e.draft, moved);
  assert.equal(e.selected.main, 'worktree');
  assert(e.move('main', -1));
  assert.deepEqual(e.draft, opening);
});

test('a group at the list edge is a silent no-op and filters still block reordering', () => {
  const opening = fixture([members]);
  const e = editor(opening);
  e.selectItem('main', 'dot');
  assert(e.move('main', -1));
  assert(e.move('main', 1));
  e.filter('main', 'context');
  assert.equal(e.move('main', 1), false);
  assert.deepEqual(e.draft, opening);
  assert.equal(e.history.undo.length, 0);
});

test('spacer collisions and row breaks that split a group give different refusals', () => {
  const opening = fixture([['session-cost', 'gap-left'], [...members, 'gap-right']]);
  const e = editor(opening);
  e.selectItem('main', 'dot');
  assert.equal(e.move('main', -1), false);
  assert.equal(e.compositionError.key, 'composition.invalid');

  const split = copyDraft(opening);
  split.display.layout.rows = [['session-cost', 'gap-left'], ['context-tokens'], ['dot', 'context-used', 'gap-right']];
  assert.equal(e.applyStructure(split), false);
  assert.equal(e.compositionError.key, 'composition.groups.invalid');
  assert.deepEqual(e.draft, opening);
  assert.equal(e.changeReview, null);
  assert.equal(e.history.undo.length, 0);
});

test('moving a group reviews affected alignment before recording an edit', () => {
  const opening = fixture([['session-cost', 'worktree'], [...members, 'tokens', 'model']]);
  opening.display.layout.alignments = [{ id: 'metrics', columns: [[
    { kind: 'instance', id: 'session-cost' }, { kind: 'group', id: 'context-block' },
  ]] }];
  const e = editor(opening);
  e.selectItem('main', 'worktree');
  assert(e.move('main', 1));
  assert.equal(e.changeReview?.kind, 'structure');
  assert.deepEqual(e.structureProposal?.repairs.map(repair => repair.id), ['metrics']);
  assert.deepEqual(e.draft, opening);
  assert.equal(e.history.undo.length, 0);
  changesKey(e, { key: 'g', ctrl: true }, 'en', 80, 18);
  assert.equal(e.structureProposal, null);
  assert.deepEqual(e.draft, opening);
  assert.equal(e.history.undo.length, 0);

  assert(e.move('main', 1));
  assert(e.acceptProposal());
  assertOrder(e, 'main', ['session-cost', ...members, 'worktree', 'tokens', 'model']);
  assert.deepEqual(e.draft.display.layout.alignments, []);
  assert.equal(e.history.undo.length, 1);
  assert(e.undo());
  assert.deepEqual(e.draft, opening);
});
