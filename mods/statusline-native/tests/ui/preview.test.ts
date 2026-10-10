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
      { text: '中文 e\u0301', bold: true, background: null, foreground: { kind: 'rgb', value: '#8ed3d3' } },
      { text: ' tail', bold: false, background: null, foreground: null },
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
    const row = previewLine(elements, [{ text: 'slot', bold: true, background: null, foreground: { kind: 'ansi', value } }], 10, 'light') as unknown as Node;
    const span = nodes(row).find((node) => node.props.color)!;
    expect(span.props.color).toBe(`ansi256(${value})`);
    expect(span.props.bold).toBe(true);
    expect(row.props.backgroundColor).toBe('#ffffff');
  }
});

test('foreground and background reset independently without painting padding', () => {
  const row = previewLine(elements, [
    {text:'A',bold:true,foreground:{kind:'ansi',value:200},background:{kind:'rgb',value:'#123456'}},
    {text:'B',bold:false,foreground:null,background:null},
  ], 5, 'light') as unknown as Node;
  const colored = nodes(row).find(n => n.props.color === 'ansi256(200)')!;
  expect(colored.props.backgroundColor).toBe('#123456');
  expect(row.props.backgroundColor).toBe('#ffffff');
  expect(nodes(row).filter(n => n !== row && n !== colored).every(n => n.props.backgroundColor === undefined)).toBe(true);
});

test('a cluster crossing spans is clipped and styled as one unit', () => {
  const spans = [
    {text:'👩',bold:false,foreground:{kind:'ansi' as const,value:1},background:null},
    {text:'🏽‍💻X',bold:true,foreground:{kind:'ansi' as const,value:2},background:null},
  ];
  const full = previewLine(elements, spans, 3) as unknown as Node;
  expect(text(full)).toBe('👩🏽‍💻X');
  const emoji = nodes(full).find(n => n.children.includes('👩🏽‍💻'))!;
  expect(emoji.props.bold).toBe(false);
  expect(emoji.props.color).toBe('ansi256(1)');
  expect(text(previewLine(elements, spans, 2) as unknown as Node)).toBe('… ');
});

test('plain styled text neutralizes controls before measuring the row', () => {
  const row = previewLine(elements, [{text:'A\x1b[2J\x9bZ',bold:false,foreground:null,background:null}], 10) as unknown as Node;
  expect(text(row)).toBe('A [2J Z   ');
});
