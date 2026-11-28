import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { defaultItem } from '@fbincon/statusline-core/config/display';
import { alignmentsView } from '@fbincon/statusline-core/editor/alignment-manager';
import { formRows, setFormValue } from '@fbincon/statusline-core/editor/forms';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { fixture, plain } from './fixtures.js';

test('Layout alignment controls select stable references in six languages and apply only to the draft', () => {
  for (const language of LANGUAGES) {
    const state = fixture(language), e = state.editor;
    e.draft.display.instances = ['a', 'b'].map(id => ({ id, type_id: 'text', enabled: true, text: id, options: defaultItem() }));
    e.draft.display.layout = { mode: 'explicit', rows: [['a'], ['b']] };
    const before = structuredClone(e.draft);
    e.page = 'layout'; e.setting = 'row-alignment';
    state.key({ key: 'return' }); assert(e.alignmentManager);
    for (const key of ['return', 'down', 'right', 'down', 'right', 'end', 'return']) state.key({ key });
    const alignment = e.draft.display.layout.alignments![0]!;
    assert.deepEqual(alignment.columns, [[{ kind: 'instance', id: 'a' }, { kind: 'instance', id: 'b' }]]);
    assert.equal(e.baseline.draft.display.layout.alignments, undefined);
    assert(plain(state, 80, 24).join('\n').includes(alignment.id));
    assert(alignmentsView(e, language, 20, 4).length <= 4);
    state.key({ key: 'escape' });
    const field = formRows(state).find(row => row.key === 'layout.mode')!;
    assert.equal(setFormValue(state, field, 'auto'), true);
    assert.deepEqual(e.structureProposal?.repairs.map(r=>r.id),[alignment.id]);
    assert.equal(e.draft.display.layout.mode,'explicit');state.key({key:'q'});assert.equal(e.changeReview,null);
    e.page = 'main'; e.selected.main = 'a';
    state.key({ key: 'x', ctrl: true });
    assert.deepEqual(e.structureProposal?.repairs.map(r=>r.id),[alignment.id]);
    assert.deepEqual(e.draft.display.instances, before.display.instances);state.key({key:'q'});
    e.page = 'layout'; e.setting = 'row-alignment'; state.key({ key: 'return' });
    for (const key of ['return', 'down', 'return', 'escape']) state.key({ key });
    assert.deepEqual(e.draft.display.layout.alignments, []);
    assert.equal(e.alignmentManager, null);
  }
});

test('a row boundary in automatic layout is reviewed and accepted as one draft edit', () => {
  for (const language of ['en', 'zh-CN'] as const) {
    const state = fixture(language), e = state.editor;
    e.page = 'layout';
    const ids = e.draft.display.instances.map(node => node.id);
    e.setting = 'break:' + ids[1]!;
    const key = (key: string) => state.key({ key }, 64, 18);
    const navigate = () => {
      key('return');
      assert.equal(e.structureProposal?.confirmation?.key, 'layout.confirm_auto_boundary');
      assert.equal(e.draft.display.layout.mode, 'auto');
      assert.equal(e.history.undo.length, 0);
      const screen = plain(state, 64, 18).join('\n');
      assert(screen.includes(t('layout.review_title', language)));
      assert(screen.includes(e.instanceLabel('main', ids[1]!, language)));
    };
    navigate(); key('escape');
    assert.equal(e.changeReview, null);
    assert.equal(e.baseline.draft.display.layout.mode, 'auto');
    navigate(); key('a');
    assert.equal(e.changeReview, null);
    assert.equal(e.draft.display.layout.mode, 'explicit');
    assert.deepEqual(e.draft.display.layout.rows, [[ids[0]], ids.slice(1)]);
    assert.equal(e.history.undo.length, 1);
    assert.equal(e.baseline.draft.display.layout.mode, 'auto');
    assert(e.undo());
    assert.equal(e.draft.display.layout.mode, 'auto');
  }
});
