import test from 'node:test';
import assert from 'node:assert/strict';
import { textInput, editText, inputView } from '../src/editor/text-input.js';
import { displayWidth } from '../src/unicode/index.js';

test('cursor insertion and both deletion directions preserve Chinese and complete graphemes', () => {
  let state = textInput('中文é👩🏽‍💻尾');
  const act = (kind: 'left' | 'right' | 'home' | 'end' | 'backspace' | 'delete') => state = editText(state, {kind}, 256).state;
  act('left'); act('left'); act('delete');
  assert.equal(state.value, '中文é尾');
  act('backspace'); assert.equal(state.value, '中文尾');
  state = editText(state, {kind:'insert',value:'标签'},256).state;
  assert.equal(state.value, '中文标签尾');
  act('home'); act('backspace'); assert.equal(state.cursor, 0);
  act('end'); act('delete'); assert.equal(state.value, '中文标签尾');
});
test('incremental combining and ZWJ input recomputes cursor boundaries', () => {
  let state = textInput('');
  for (const value of 'é👩🏽‍💻') state = editText(state,{kind:'insert',value},256).state;
  state = editText(state,{kind:'backspace'},256).state;
  assert.equal(state.value,'é');
  assert.equal(editText(state,{kind:'backspace'},256).state.value,'');
});
test('invalid and oversized paste is atomic, without normalization or truncation', () => {
  const state = textInput('原文');
  for(const value of ['A\nB','\x1b[3~','\ud800']) {
    const result=editText(state,{kind:'insert',value},256);
    assert.equal(result.error,'invalid'); assert.equal(result.state,state);
  }
  const result=editText(state,{kind:'insert',value:'界'.repeat(255)},256);
  assert.equal(result.error,'limit'); assert.equal(result.state,state);
});
test('horizontal viewport follows the caret through resize without splitting clusters', () => {
  const state=textInput('/中文/é/👩🏽‍💻/long/path');
  for(const width of [20,6,2,1,40]) {
    const value=inputView(state,width);
    assert.ok(value.includes('▏')); assert.ok(displayWidth(value)<=width);
    assert.equal(state.value,'/中文/é/👩🏽‍💻/long/path');
  }
  const start=editText(state,{kind:'home'},4096).state;
  assert.ok(inputView(start,8).startsWith('▏/中文'));
});
