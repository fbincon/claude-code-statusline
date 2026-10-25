import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { formRows, setFormValue } from '@fbincon/statusline-core/editor/forms';
import { GRADIENT_PRESETS } from '@fbincon/statusline-core/editor/gradients';
import { isDraft } from '@fbincon/statusline-core/editor/backend';
import { fixture } from './fixtures.js';
import { fieldValue } from '../src/drawing/presentation.js';
import { t } from '@fbincon/statusline-core/i18n/messages';

test('six-language gradient controls cycle presets, validate custom colors and retain unsaved draft boundaries', () => {
  for (const language of LANGUAGES) {
    const state=fixture(language), before=structuredClone(state.editor.baseline.draft);
    state.key({key:'e',ctrl:true}); state.editor.setting='item:foreground_gradient';
    const row=()=>state.rows().find(row=>row.key==='item:foreground_gradient')!;
    assert.equal(fieldValue(row(),state),t('values.off',language));
    state.key({key:'right'});
    assert.equal(fieldValue(row(),state),t('gradients.preset.ocean',language));
    assert.equal(row().value,'ocean');
    const node=()=>state.editor.instance('main',state.editor.detail!.id)!;
    assert.deepEqual(node().options.foreground_gradient,GRADIENT_PRESETS.ocean);
    assert.deepEqual(state.editor.baseline.draft,before);
    let field=formRows(state).find(row=>row.spec.key==='foreground_gradient')!;
    assert.equal(setFormValue(state,field,'#AABBCC,#DDEEFF,#010203'),true);
    assert.deepEqual(node().options.foreground_gradient,['#aabbcc','#ddeeff','#010203']);
    field=formRows(state).find(row=>row.spec.key==='foreground_gradient')!;
    assert.equal(setFormValue(state,field,'#000000'),false);
    assert.deepEqual(node().options.foreground_gradient,['#aabbcc','#ddeeff','#010203']);
    assert(isDraft(state.editor.draft));
    state.key({key:'return'}); state.key({key:'g',ctrl:true});
    assert.equal(state.input,null);
    assert.deepEqual(node().options.foreground_gradient,['#aabbcc','#ddeeff','#010203']);
  }
});
