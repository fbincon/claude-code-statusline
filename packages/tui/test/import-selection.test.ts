import test from 'node:test';
import assert from 'node:assert/strict';
import { createReview } from '@fbincon/statusline-core/editor/import-review';
import { differences } from '@fbincon/statusline-core/editor/import-differences';
import { IMPORT_FIELDS } from '@fbincon/statusline-core/editor/import-selection';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { frame } from '../src/drawing.js';
import { fixture } from './fixtures.js';

test('external review selects, previews, cancels and accepts without invoking Save', () => {
  for (const language of LANGUAGES) {
    const state = fixture(language), base = structuredClone(state.editor.draft), incoming = structuredClone(base);
    incoming.display.theme = 'light'; incoming.host.padding = 7;
    const open = () => { state.editor.review = createReview({ draft: incoming, changes: differences(base, incoming) }, base); };
    open(); state.key({ key: 's' }, 80, 24);
    assert.deepEqual(state.editor.review!.result.draft, base);
    for (let i=0; i<IMPORT_FIELDS.indexOf('theme'); i++) state.key({ key: 'down' }, 80, 24);
    state.key({ key: 'space' }, 80, 24);
    assert.equal(state.editor.review!.result.draft.display.theme, 'light');
    assert.equal(state.key({ key: 'a' }), null); assert(state.editor.review);
    for (const [width,height] of [[32,12],[40,16],[80,24],[120,30]])
      assert(frame(state,width!,height!).rows.every(row=>displayWidth(row.map(span=>span.text).join(''))===width));
    state.key({ key: 'g', ctrl: true }); assert.deepEqual(state.editor.draft, base);
    open(); state.key({ key: 's' });
    for (let i=0; i<IMPORT_FIELDS.indexOf('theme'); i++) state.key({ key: 'down' });
    state.key({ key: 'space' }); state.key({ key: 'return' });
    assert.equal(state.key({ key: 'a' }), null);
    assert.equal(state.editor.review, null); assert.equal(state.editor.draft.display.theme, 'light');
    assert.equal(state.editor.draft.host.padding, base.host.padding);
    assert.deepEqual(state.editor.baseline.draft, base);
  }
});
