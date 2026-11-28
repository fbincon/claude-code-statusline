import test from 'node:test';
import assert from 'node:assert/strict';
import { textInput, editText, inputView, prefixedInputView } from '../src/editor/text-input.js';
import { clipEditorLine, editorLineSpans, joinEditorLines, wrapEditorLine } from '../src/editor/hints.js';
import { clusterSpans } from '../src/terminal/spans.js';
import { displayWidth, graphemes } from '../src/unicode/index.js';

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
test('moving left decorates the next complete grapheme without moving the text', () => {
  const value = 'a甲é👩🏽‍💻 ▏尾';
  let state = textInput(value);
  for (const cluster of graphemes(value).reverse()) {
    state = editText(state, { kind: 'left' }, 256).state;
    const line = inputView(state, displayWidth(value));
    assert.equal(line.text, value);
    assert.deepEqual(line.caret, { start: state.cursor, end: state.cursor + cluster.length });
    assert.deepEqual(editorLineSpans(line, displayWidth(value)).filter(span => span.caret), [{ text: cluster, bold: false, caret: true }]);
  }
});

test('resize bounds the viewport and reserves a blank cell only when needed', () => {
  const path = '/中文/é/👩🏽‍💻/long/path', state = textInput(path);
  for (const width of [20, 6, 2, 1, 40]) {
    const line = inputView(state, width);
    assert.ok(line.caret && displayWidth(line.text) <= width);
    assert.equal(line.text.slice(line.caret.start, line.caret.end), ' ');
    assert.equal(state.value, path);
  }
  assert.equal(inputView(state, 40).text, path + ' ');
  const start = editText(state, { kind: 'home' }, 4096).state;
  assert.ok(inputView(start, 8).text.startsWith('/中文'));

  const blank = { text: ' ', caret: { start: 0, end: 1 } };
  const wide = editText(textInput('👩🏽‍💻尾'), { kind: 'home' }, 256).state;
  assert.deepEqual(inputView(textInput(''), 1), blank);
  assert.deepEqual(inputView(wide, 1), blank);
  assert.deepEqual(inputView(wide, 2), { text: '👩🏽‍💻', caret: { start: 0, end: '👩🏽‍💻'.length } });
  assert.deepEqual(inputView(wide, 0), { text: '' });
  assert.equal(wide.value, '👩🏽‍💻尾');
});

test('zero-width input and sanitized display preserve editable offsets', () => {
  let state = textInput('A\u200b界');
  state = editText(state, { kind: 'left' }, 256).state;
  const visible = inputView(state, 8);
  state = editText(state, { kind: 'left' }, 256).state;
  assert.equal(state.cursor, 1);
  assert.deepEqual(inputView(state, 8), visible);
  assert.deepEqual(visible.caret, { start: 2, end: 3 });

  state = editText(textInput('A\r\nB'), { kind: 'left' }, 256).state;
  assert.deepEqual(inputView(state, 2), { text: ' B', caret: { start: 1, end: 2 } });
  assert.deepEqual(state, { value: 'A\r\nB', cursor: 3, scroll: 1 });
  state = editText(state, { kind: 'backspace' }, 256).state;
  assert.deepEqual(inputView(state, 2), { text: 'AB', caret: { start: 1, end: 2 } });

  const prepend = inputView(textInput('aa\u0600'), 2);
  assert.equal(prepend.text, '\u0600 ');
  assert.deepEqual(clusterSpans(editorLineSpans(prepend, 2)), [{ text: '\u0600 ', bold: false, caret: true }]);
});

test('translated prefixes and line composition preserve an end-of-input caret', () => {
  const line = prefixedInputView('文件路径：', textInput(''), 8);
  assert.equal(displayWidth(line.text), 8);
  assert.deepEqual(wrapEditorLine(line, 8), [line]);
  assert.deepEqual(editorLineSpans(line, 8).at(-1), { text: ' ', bold: false, caret: true });
  assert.equal(clipEditorLine(line, 2).caret, undefined);

  const key = { text: 'Tab', keys: [{ start: 0, end: 3 }] };
  const joined = joinEditorLines(key, ' ', line);
  assert.deepEqual(editorLineSpans(joined, 12), [
    { text: 'Tab', bold: true },
    { text: ' ' + line.text.slice(0, -1), bold: false },
    { text: ' ', bold: false, caret: true },
  ]);
});
