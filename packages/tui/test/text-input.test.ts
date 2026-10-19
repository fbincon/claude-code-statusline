import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, plain } from './fixtures.js';

test('external text inputs edit the middle, cancel and reopen without losing suffixes', () => {
  const state = fixture(), e = state.editor;
  state.key({key:'e',ctrl:true}); state.key({key:'return'}); state.key({key:'u',ctrl:true});
  state.key({key:'中文👩🏽‍💻后缀',paste:true});
  state.key({key:'home'}); state.key({key:'right'}); state.key({key:'delete'});
  state.key({key:'标记',paste:true});
  assert.ok(plain(state).join('\n').includes('中标记▏👩🏽‍💻后缀'));
  state.key({key:'return'});
  assert.equal(e.instance('main',e.selected.main)!.options.label,'中标记👩🏽‍💻后缀');
  state.key({key:'return'}); state.key({key:'home'}); state.key({key:'delete'});
  state.key({key:'escape'});
  assert.equal(e.instance('main',e.selected.main)!.options.label,'中标记👩🏽‍💻后缀');
});
test('paste cannot save, navigate, accept import or cancel; over-limit text is explained', () => {
  const state=fixture();
  for(const key of ['s','1','return','escape','a']) assert.equal(state.key({key,paste:true}),null);
  state.key({key:'/'}); state.key({key:'escape',paste:true});
  assert.equal(state.editor.search.main,'escape');
  state.key({key:'界'.repeat(256),paste:true});
  assert.equal(state.editor.search.main,'escape');
  assert.equal(state.localized.message?.key,'input.limit');
  state.key({key:'A\nS',paste:true});
  assert.equal(state.localized.message?.key,'input.invalid');
});
