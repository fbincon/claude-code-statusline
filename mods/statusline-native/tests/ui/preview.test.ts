import { expect, test } from 'claude-code/testing';
import type { ClientElements } from 'claude-code';
import { previewLine, previewText, previewTitle } from '../../ui/components/preview.ts';
import { displayWidth } from '../../ui/layout.ts';
import { Editor } from '../../lib/editor/draft.ts';
import { description, readResult } from '../fixtures.ts';

interface Node { type: string; props: any; children: (Node | string)[] }
const elements = Object.fromEntries(['Box', 'Text'].map((type) => [type, (props: any) => ({ type, props, children: props.children ?? [] })])) as unknown as ClientElements;
function nodes(node: Node): Node[] {
  return [node, ...node.children.flatMap((child) => typeof child === 'string' ? [] : nodes(child))];
}
function text(node: Node): string {
  return node.children.map((child) => typeof child === 'string' ? child : text(child)).join('');
}

test('preview padding, CJK clipping and combining characters never acquire chrome colors', () => {
  for (const background of ['dark', 'light'] as const) for (const width of [1, 2, 5, 32, 64, 80, 120]) {
    const row = previewLine(elements, [
      { text: '中文 e\u0301', bold: true, foreground: { kind: 'rgb', value: '#8ed3d3' } },
      { text: ' tail', bold: false, foreground: null },
    ], width, background) as unknown as Node;
    expect(displayWidth(text(row))).toBe(width);
    expect(row.props.backgroundColor).toBe(background === 'light' ? '#ffffff' : '#17191e');
    expect(nodes(row).slice(1).every((n) => n.props.backgroundColor === undefined)).toBe(true);
    expect(nodes(row).filter((n) => n.props.color).every((n) => n.props.color === '#8ed3d3' && n.props.bold === true)).toBe(true);
  }
  for (const label of ['', '(empty preview)', 'Loading sample preview…', 'backend_error: failed', '2 more preview rows']) {
    const row = previewText(elements, label, 32) as unknown as Node;
    expect(displayWidth(text(row))).toBe(32);
    expect(row.props.backgroundColor).toBe('#17191e');
    expect(nodes(row).slice(1).every((n) => n.props.color === undefined && n.props.backgroundColor === undefined)).toBe(true);
  }
});

test('preview captions follow the palette draft and colors off without changing it', () => {
  const display = new Editor(description(), readResult()).draft.display;
  for (const palette of ['default', 'ansi'] as const) {
    display.palette = palette;
    display.use_colors = true;
    const before = JSON.stringify(display);
    expect(previewTitle(display, 80, false)).toBe('Preview · sample data · Palette: ' + palette + ' · dark bg');
    expect(previewTitle(display, 32, true)).toBe('Preview · ' + palette + ' · dark …');
    expect(JSON.stringify(display)).toBe(before);
  }
  display.use_colors = false;
  expect(previewTitle(display, 80, true)).toBe('Preview · sample data · Colors: off · dark bg …');
  expect(previewTitle(display, 32, false)).toBe('Preview · off · dark');
});

test('all ANSI sample slots remain indexed terminal colors instead of named RGB mappings', () => {
  for (let value = 0; value < 16; value++) {
    const row = previewLine(elements, [{ text: 'slot', bold: true, foreground: { kind: 'ansi', value } }], 10, 'light') as unknown as Node;
    const span = nodes(row).find((node) => node.props.color)!;
    expect(span.props.color).toBe(`ansi256(${value})`);
    expect(span.props.bold).toBe(true);
    expect(row.props.backgroundColor).toBe('#ffffff');
  }
});
