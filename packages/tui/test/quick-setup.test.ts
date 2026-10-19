import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, plain } from './fixtures.js';
import { receivePreset, type QuickSetup } from '@fbincon/statusline-core/editor/quick-setup';
import { applyPreset } from '@fbincon/statusline-core/config/presets';

test('quick setup cancels without changing dirty drafts and only accepts at the final step', () => {
  const state=fixture(), e=state.editor; const quick = () => e.quick as QuickSetup; e.draft.display.use_colors=false;
  const original=JSON.stringify(e.draft);
  state.key({key:'p',ctrl:true}); assert.ok(e.quick);
  assert.equal(state.key({key:'return'}),'transfer');
  receivePreset(quick(),{display:applyPreset(quick().base.display,e.preset,()=> 'new'),host:quick().base.host});
  state.key({key:'right'});state.key({key:'escape'});
  assert.equal(e.quick,null);assert.equal(JSON.stringify(e.draft),original);
  state.key({key:'p',ctrl:true});state.key({key:'return'});
  receivePreset(quick(),{display:applyPreset(quick().base.display,e.preset,()=> 'new'),host:quick().base.host});
  state.key({key:'end'});state.key({key:'return'});
  assert.ok(plain(state).join('\n').includes('Continue editing'));
  assert.equal(state.key({key:'return'}),null);assert.equal(e.quick,null);
  assert.equal(e.draft.display.layout.mode,'explicit');assert.equal(e.baseline.draft.display.layout.mode,'auto');
});
