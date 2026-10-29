import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { defaultItem } from '@fbincon/statusline-core/config/display';
import { alignmentsView } from '@fbincon/statusline-core/editor/alignment-manager';
import { formRows, setFormValue } from '@fbincon/statusline-core/editor/forms';
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
