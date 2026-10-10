import { expect, test } from 'claude-code/testing';
import type { ClientElements } from 'claude-code';
import { Editor } from '../../lib/editor/draft.ts';
import type { View } from '../../lib/session.ts';
import { draw } from '../../ui/client/draw.ts';
import { settingRows } from '../../lib/client/settings.ts';
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
    const rows = preview.children.slice(1, framed ? -1 : undefined) as Node[];
    for (const row of rows) {
      expect(row.props.backgroundColor).toBe(framed ? undefined : background === 'light' ? '#ffffff' : '#17191e');
      if (framed) expect((row.children[1] as Node).props.backgroundColor).toBe(undefined);
    }
    const bodies = rows.map((row) => framed ? (row.children[1] as Node).children[0] as Node : row);
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
