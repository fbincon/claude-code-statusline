import { expect, test } from 'claude-code/testing';
import type { ClientElements } from 'claude-code';
import { Editor } from '../../lib/editor/draft.ts';
import type { View } from '../../lib/session.ts';
import { draw } from '../../ui/client/draw.ts';
import { handleKey } from '../../lib/client/keys.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { t } from '../../lib/i18n/index.ts';
import { description, readResult } from '../fixtures.ts';

interface Node { type: string; props: any; children: (Node | string)[] }
const elements = Object.fromEntries(['Box', 'Text'].map((type) => [type, (props: any) => ({ type, props, children: props.children ?? [] })])) as unknown as ClientElements;
function view(): View {
  return { editor: new Editor(description(), readResult()), input: null, preview: null,
    preferences: [], preferencesError: '', error: '', previewError: '', previewBusy: false,
    message: '', busy: '', uncertain: false };
}
function nodes(node: Node): Node[] {
  return [node, ...node.children.flatMap((child) => typeof child === 'string' ? [] : nodes(child))];
}
function text(node: Node): string {
  return node.children.map((child) => typeof child === 'string' ? child : text(child)).join('');
}

test('all pages explicitly pair selected colors and keep chrome on host tokens', () => {
  for (const [columns, rows] of [[32, 12], [80, 24], [120, 30]]) {
    for (const page of ['main', 'subagents', 'settings', 'layout', 'detail']) {
      const state = view(), e = state.editor!;
      if (page === 'detail') e.detail = { scope: 'main', id: 'model-with-effort' };
      else e.page = page as typeof e.page;
      if (e.page === 'settings' || e.page === 'layout' || e.detail) e.setting = settingRows(state)[0]!.key;
      const tree = draw(elements, state, columns!, rows!) as unknown as Node;
      const content = tree.children[3] as Node;
      const selected = nodes(content).find((n) => n.type === 'Text' && text(n).startsWith('›'))!;
      expect(selected.props.color).toBe('inverseText');
      expect(selected.props.backgroundColor).toBe('text');
      expect(selected.props.dimColor).toBe(false);
      const chrome = [tree.children[0], tree.children[1], tree.children[2], content, tree.children[5]] as Node[];
      const colors = chrome.flatMap(nodes).flatMap((n) => [n.props.color, n.props.backgroundColor].filter(Boolean));
      expect(colors.every((c) => ['text', 'inverseText', 'inactive', 'suggestion', 'error'].includes(c))).toBe(true);
      expect(chrome.flatMap(nodes).some((n) => n.props.dimColor === true)).toBe(false);
    }
  }
});

test('editing highlights complete original graphemes and keeps the selected field label', () => {
  const state = view(), e = state.editor!;
  const before = JSON.stringify(e.draft);
  e.detail = { scope: 'main', id: 'model-with-effort' };
  e.setting = 'item:label';
  const key = (event: Parameters<typeof handleKey>[1]) => handleKey(state, event, 80, 24);
  const expectCaret = (value: string, caret: string) => {
    for (const [columns, rows] of [[80, 24], [32, 12]]) {
      const tree = draw(elements, state, columns!, rows!) as unknown as Node;
      const field = nodes(tree.children[3] as Node).find(node => node.props.key === 'setting-item:label')!;
      const row = field.children[0] as Node;
      const [label, ...runs] = row.children as Node[];
      expect(text(label!).startsWith('› ')).toBe(true);
      expect(row.props.backgroundColor).toBe('text');
      expect(runs.map(text).join('')).toBe(' ' + value);
      expect(text(runs[0]!).startsWith(' ')).toBe(true);
      expect(runs[0]!.props.backgroundColor).toBe('inverseText');
      const highlighted = runs.filter(run => run.props.backgroundColor === 'text');
      expect(highlighted.map(text)).toEqual([caret]);
      expect(highlighted[0]!.props.color).toBe('inverseText');
      expect(runs.filter(run => run !== highlighted[0]).every(run =>
        run.props.color === 'text' && run.props.backgroundColor === 'inverseText')).toBe(true);
    }
  };
  key({ key: 'return' });
  key({ key: 'u', ctrl: true });
  expectCaret(' ', ' ');
  const value = 'A中é👩🏽‍💻B';
  key({ key: value, text: true });
  expectCaret(value + ' ', ' ');
  for (const cluster of ['B', '👩🏽‍💻', 'é', '中']) {
    key({ key: 'left' });
    expectCaret(value, cluster);
  }
  key({ key: 'x' });
  expectCaret('Ax中é👩🏽‍💻B', '中');
  key({ key: 'g', ctrl: true });
  expect(state.input).toBe(null);
  expect(JSON.stringify(e.draft)).toBe(before);
});

test('catalog search fits its translated label and shortcuts around the styled input', () => {
  const state = view(), language = 'zh-CN';
  state.language = language;
  handleKey(state, { key: '/' }, 80, 24);
  handleKey(state, { key: '中文', text: true }, 80, 24);
  handleKey(state, { key: 'left' }, 80, 24);
  const label = t('native.ui.client.draw.filter', language);
  for (const [columns, rows] of [[80, 24], [32, 12]]) {
    const tree = draw(elements, state, columns!, rows!) as unknown as Node;
    const filter = nodes(tree.children[3] as Node).find(node => node.type === 'Text' && text(node).startsWith(label))!;
    expect(text(filter).startsWith(label + '中文')).toBe(true);
    expect(filter.children.some(child => typeof child !== 'string' && text(child) === '文' &&
      child.props.color === 'inverseText' && child.props.backgroundColor === 'text')).toBe(true);
    expect(text(filter)).toContain('/ ' + t('native.ui.client.draw.search', language));
  }
});

test('sample rows use the chosen preview background independently of themed ancestors', () => {
  const state = view();
  const spans = [
    { text: 'rgb 中文', bold: true, background: null, foreground: { kind: 'rgb', value: '#8ed3d3' } },
    { text: ' ansi', bold: false, background: null, foreground: { kind: 'ansi', value: 3 } },
    { text: ' plain', bold: false, background: null, foreground: null },
  ];
  state.preview = { sample: true, main: [spans, spans, spans, spans], subagents: [] } as View['preview'];
  const before = JSON.stringify(state.preview);
  for (const background of ['dark', 'light'] as const) for (const width of [32, 64, 80, 120]) {
    state.previewBackground = background;
    const tree = draw(elements, state, width, 30) as unknown as Node;
    const preview = tree.children[4] as Node;
    expect(tree.props.backgroundColor).toBe(undefined);
    expect(preview.props.backgroundColor).toBe(undefined);
    const framed = width >= 64;
    const sectionBody = preview.children[1] as Node;
    expect(sectionBody.props.backgroundColor).toBe(undefined);
    const center = sectionBody.children[framed ? 1 : 0] as Node;
    expect(center.props.backgroundColor).toBe(undefined);
    const bodies = center.children as Node[];
    expect(bodies.every((n) => n.props.width === width - (framed ? 2 : 0) && n.props.height === 1 && n.props.backgroundColor === (background === 'light' ? '#ffffff' : '#17191e'))).toBe(true);
    const texts = bodies.flatMap(nodes).filter((n) => n.type === 'Text');
    expect(texts.every((n) => n.props.backgroundColor === undefined)).toBe(true);
    expect(texts.some((n) => n.props.color === '#8ed3d3' && text(n) === 'rgb 中文')).toBe(true);
    expect(texts.some((n) => n.props.color === 'ansi256(3)' && text(n) === ' ansi')).toBe(true);
    expect(texts.some((n) => n.props.color === undefined && text(n) === ' plain')).toBe(true);
    expect(texts.every((n) => !['text', 'inverseText', '#dedee7'].includes(n.props.color))).toBe(true);
  }
  expect(JSON.stringify(state.preview)).toBe(before);
  state.preview = { sample: true, main: [], subagents: [] };
  const empty = draw(elements, state, 80, 24) as unknown as Node;
  const placeholder = nodes(empty.children[4] as Node).find((n) => n.type === 'Text' && text(n) === '(empty preview)')!;
  expect(placeholder.props.color).toBe(undefined);
  expect(placeholder.props.backgroundColor).toBe(undefined);
});

test('error, search and loading styles preserve the draft and never require terminal white', () => {
  const state = view(), e = state.editor!;
  state.error = 'Save refused';
  state.input = { kind: 'search', scope: 'main', original: '', selected: e.selected.main };
  const input = state.input, before = JSON.stringify(e.draft);
  const tree = draw(elements, state, 80, 24) as unknown as Node;
  expect(((tree.children[2] as Node).children[0] as Node).props.color).toBe('error');
  expect(state.input).toBe(input);
  expect(JSON.stringify(e.draft)).toBe(before);
  for (const size of [[20, 8], [80, 24]]) {
    state.editor = null;
    const loading = draw(elements, state, size[0]!, size[1]!) as unknown as Node;
    const label = nodes(loading).find((n) => n.type === 'Text' && /Loading|Resize/.test(text(n)))!;
    expect(label.props.color).toBe('text');
    expect(label.props.backgroundColor).toBe('inverseText');
  }
});
