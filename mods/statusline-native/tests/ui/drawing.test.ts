import { expect, test } from 'claude-code/testing';
import type { ClientElements } from 'claude-code';
import { Editor } from '../../lib/editor/draft.ts';
import { formWindow } from '../../lib/editor/navigation.ts';
import { formRows } from '../../lib/client/forms.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { handleKey } from '../../lib/client/keys.ts';
import type { View } from '../../lib/session.ts';
import { draw } from '../../ui/client/draw.ts';
import { clip, dimensions, displayWidth } from '../../ui/layout.ts';
import { shortcutSpans } from '../../ui/components/shortcuts.ts';
import { description, readResult } from '../fixtures.ts';

interface Node { type: string; props: any; children: (Node | string)[] }
const elements = Object.fromEntries(['Box', 'Text'].map((type) => [type, (props: any) => ({ type, props, children: props.children ?? [] })])) as unknown as ClientElements;
function view(): View {
  return { editor: new Editor(description(), readResult()), input: null, preview: null,
    preferences: [], preferencesError: '', error: '', previewError: '', previewBusy: false,
    message: '', busy: '', uncertain: false };
}
function text(node: Node | string): string { return typeof node === 'string' ? node : node.children.map(text).join(''); }
function render(node: Node): string[] {
  let lines: string[];
  if (node.type === 'Text') lines = [text(node)];
  else if (node.props.flexDirection === 'row' || !node.props.flexDirection) {
    const children = node.children.map((child) => typeof child === 'string' ? [child] : render(child));
    lines = Array.from({ length: Math.max(1, ...children.map((c) => c.length)) }, (_, i) => children.map((c) => c[i] ?? '').join(''));
  } else lines = node.children.flatMap((child) => typeof child === 'string' ? [child] : render(child));
  if (typeof node.props.width === 'number') {
    for (const line of lines) expect(displayWidth(line) <= node.props.width).toBe(true);
    lines = lines.map((line) => line + ' '.repeat(node.props.width - displayWidth(line)));
  }
  if (typeof node.props.height === 'number') {
    expect(lines.length <= node.props.height).toBe(true);
    while (lines.length < node.props.height) lines.push(' '.repeat(node.props.width ?? 0));
  }
  return lines;
}

test('all editor pages fit the viewport and frame titles stay on its top edge', () => {
  for (const [columns, rows] of [[32, 12], [64, 18], [64, 20], [80, 24], [120, 30], [80, 48]]) {
    for (const page of ['main', 'subagents', 'settings', 'layout', 'detail']) {
      const state = view(), e = state.editor!;
      if (page === 'detail') { e.detail = { scope: 'main', id: 'model-with-effort' }; e.setting = 'item:label'; }
      else e.page = page as typeof e.page;
      if (e.page === 'settings' || e.page === 'layout' || e.detail) e.setting = settingRows(state)[0]!.key;
      const tree = draw(elements, state, columns!, rows!) as unknown as Node;
      const lines = render(tree);
      expect(lines).toHaveLength(rows!);
      const geometry = dimensions(columns!, rows!);
      expect(lines[3]!.includes(geometry.framed ? '╭─' : '─')).toBe(true);
      expect(lines[3 + geometry.bodyHeight]!.includes('Preview')).toBe(true);
      if (geometry.framed) expect(lines[4]!.includes(page === 'main' || page === 'subagents' ? 'Filter:' : 'OPTION')).toBe(true);
    }
  }
});

test('layout and item forms have contiguous groups and stable field identities', () => {
  const state = view(), e = state.editor!;
  e.draft.display.items = ['model-with-effort', 'git', 'context-used'];
  e.page = 'layout';
  const rows = formRows(state);
  expect(rows.slice(0, 3).map((r) => r.key)).toEqual(['layout.mode', 'break:git', 'break:context-used']);
  expect(rows.slice(3).map((r) => r.key)).toEqual(e.draft.display.items.flatMap((id) => ['fit:' + id + ':priority', 'fit:' + id + ':max_width']));
  e.detail = { scope: 'main', id: 'git' };
  expect(formRows(state).slice(-2).map((r) => r.key)).toEqual(['item:priority', 'item:max_width']);
  for (const group of new Set(formRows(state).map((r) => r.group))) {
    const indices = formRows(state).flatMap((r, i) => r.group === group ? [i] : []);
    expect(indices[indices.length - 1]! - indices[0]! + 1).toBe(indices.length);
  }
});

test('resizing keeps field and input state; h exposes separate host application', () => {
  const state = view(), e = state.editor!;
  handleKey(state, { key: '3' }, 80, 24);
  handleKey(state, { key: 'end' }, 80, 24);
  const key = e.setting;
  state.input = { kind: 'path', action: 'export', buffer: '/中文 é.json' };
  const input = state.input;
  for (const [columns, rows] of [[32, 12], [80, 48], [64, 20]]) {
    render(draw(elements, state, columns!, rows!) as unknown as Node);
    expect(e.setting).toBe(key);
    expect(state.input).toBe(input);
    expect(formWindow(settingRows(state), e.setting, dimensions(columns!, rows!).formHeight).lines.some((line) => line.index !== null && settingRows(state)[line.index]!.key === key)).toBe(true);
  }
  handleKey(state, { key: 'g', ctrl: true }, 32, 12);
  handleKey(state, { key: 'h' }, 80, 24);
  expect(e.advanced).toBe(true);
  expect(e.setting).toBe('host-theme');
  expect(text(draw(elements, state, 80, 24) as unknown as Node)).toContain('Claude preferences');
  expect(handleKey(state, { key: 'a' }, 80, 24)).toBe('applyPreferences');
  handleKey(state, { key: 'h' }, 80, 24);
  expect(e.setting).toBe('colors');
  expect(settingRows(state).some((r) => r.key.startsWith('host-'))).toBe(false);
});

test('keys are white and bold while action labels stay regular, including narrow groups', () => {
  const hints = [{ key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' }, { key: 'Esc', label: 'focus' }];
  const spans = shortcutSpans(hints, 25);
  expect(spans.map((s) => s.text).join('')).toBe('Ctrl+G cancel · Esc focus');
  expect(spans.filter((s) => s.style?.bold).map((s) => s.text)).toEqual(['Ctrl+G', 'Esc']);
  expect(spans.filter((s) => s.style?.bold).every((s) => s.style?.color === 'white' && s.style?.dimColor === false)).toBe(true);
  expect(shortcutSpans(hints, 8)).toEqual([]);
  for (const width of [1, 12, 32, 64]) {
    const parts = shortcutSpans([{ key: 'Enter', label: '保存中文 é', short: '保存' }], width);
    expect(displayWidth(parts.map((s) => s.text).join('')) <= width).toBe(true);
    expect(displayWidth(clip('é中文', width)) <= width).toBe(true);
  }
});
