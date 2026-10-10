import { expect, test } from 'claude-code/testing';
import type { ClientElements } from 'claude-code';
import { Editor } from '../../lib/editor/draft.ts';
import { formWindow } from '../../lib/editor/navigation.ts';
import { formRows } from '../../lib/client/forms.ts';
import { settingRows } from '../../lib/client/settings.ts';
import { handleKey } from '../../lib/client/keys.ts';
import type { View } from '../../lib/session.ts';
import { draw } from '../../ui/client/draw.ts';
import { clip, displayWidth } from '../../ui/layout.ts';
import { editorLayout, editorShortcuts } from '../../ui/client/help.ts';
import { shortcutRows, shortcutSpans } from '../../ui/components/shortcuts.ts';
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
      const geometry = editorLayout(state, columns!, rows!);
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

test('category picker fits both languages and accepts or cancels without changing the draft', () => {
  for (const language of ['en', 'zh-CN'] as const) for (const [columns, rows] of [[32, 12], [64, 18], [120, 30]]) {
    const state = view(), e = state.editor!;
    state.language = language;
    const before = JSON.stringify(e.draft);
    handleKey(state, {key:'f', ctrl:true}, columns!, rows!);
    expect(state.input?.kind).toBe('category');
    handleKey(state, {key:'end'}, columns!, rows!);
    render(draw(elements, state, columns!, rows!) as unknown as Node);
    handleKey(state, {key:'g', ctrl:true}, columns!, rows!);
    expect(e.category.main).toBe('all');
    handleKey(state, {key:'f', ctrl:true}, columns!, rows!);
    handleKey(state, {key:'end'}, columns!, rows!);
    handleKey(state, {key:'return'}, columns!, rows!);
    expect(e.category.main).toBe('test');
    expect(e.modified).toBe(false);
    expect(JSON.stringify(e.draft)).toBe(before);
    expect(e.move('main', 1)).toBe(false);
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
    expect(formWindow(settingRows(state), e.setting, editorLayout(state, columns!, rows!).formHeight).lines.some((line) => line.index !== null && settingRows(state)[line.index]!.key === key)).toBe(true);
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

test('the theme accent heading and footer keep page controls ordered and out of content titles', () => {
  for (const page of ['main', 'subagents', 'settings', 'layout', 'detail']) {
    const state = view(), e = state.editor!;
    if (page === 'detail') e.detail = { scope: 'main', id: 'model-with-effort' };
    else e.page = page as typeof e.page;
    const groups = editorShortcuts(state);
    const expected = page === 'main' || page === 'subagents'
      ? ['Tab', 'Space', '↑↓', '←→', 'Ctrl+E', '/']
      : page === 'settings' ? ['Tab', '↑↓', '←→', 'Enter', 'H', 'R']
      : page === 'detail' ? ['Tab', '↑↓', '←→', 'Enter', 'Ctrl+G'] : ['Tab', '↑↓', '←→', 'Enter'];
    expect(groups[1]!.map((hint) => hint.key)).toEqual(expected);
    expect(groups.flat().every((hint) => hint.label === hint.label.toLowerCase())).toBe(true);
    const tree = draw(elements, state, 120, 30) as unknown as Node;
    const heading = (tree.children[0] as Node).children[0] as Node;
    expect(text(heading)).toBe('Configure Status Line');
    expect(heading.props.color).toBe('suggestion');
    expect(heading.props.bold).toBe(true);
    expect(text(tree.children[1]!).replace(/[\[\]]/g, '')).toContain('2 Subagents');
    expect(text(tree.children[2]!)).toBe('Click region for keys.');
    expect(text(tree.children[3]!)).not.toContain('H show');
    expect(text(tree.children[3]!)).not.toContain('Ctrl+G');
    const footer = tree.children[5] as Node;
    expect(footer.props.key).toBe('shortcut-region');
    expect(text(footer)).toContain('S save');
    expect(text(footer)).toContain('Esc focus');
  }
});

test('preferences, search, input, busy and uncertain states advertise their available controls', () => {
  const state = view(), e = state.editor!;
  e.page = 'settings';
  expect(editorShortcuts(state).flat().find((hint) => hint.key === 'H')!.label).toBe('show preferences');
  expect(editorShortcuts(state).flat().some((hint) => hint.key === 'A')).toBe(false);
  e.advanced = true;
  expect(editorShortcuts(state)[1]!.map((hint) => hint.key)).toEqual(['Tab', '↑↓', '←→', 'Enter', 'H', 'A', 'R']);
  expect(editorShortcuts(state).flat().find((hint) => hint.key === 'H')!.label).toBe('hide preferences');
  for (const page of ['main', 'subagents', 'layout']) {
    e.page = page as typeof e.page;
    const hints = editorShortcuts(state).flat();
    expect(hints.some((hint) => hint.key === 'H' || hint.key === 'A')).toBe(false);
    expect(hints.some((hint) => hint.key === '/')).toBe(page !== 'layout');
  }
  e.page = 'main';
  state.input = { kind: 'search', scope: 'main', original: '', selected: e.selected.main };
  expect(editorShortcuts(state).flat().map((hint) => hint.key)).toEqual(['Enter', 'Ctrl+G', 'Ctrl+U', 'Backspace', 'Esc']);
  const tree = draw(elements, state, 120, 30) as unknown as Node;
  expect(text(tree.children[3]!)).toContain('/ search');
  expect(text(tree.children[5]!)).not.toContain('/ search');
  state.input = null;
  state.uncertain = true;
  expect(editorShortcuts(state).flat().map((hint) => hint.key)).toEqual(['K', 'Q', 'Esc']);
  state.busy = 'Saving…';
  expect(editorShortcuts(state).flat().map((hint) => hint.key)).toEqual(['Esc']);
  expect(text(draw(elements, state, 120, 30) as unknown as Node)).toContain('Saving…');
});

test('complete shortcut groups wrap without losing order, styles or Unicode', () => {
  const groups = [
    [{ key: 'S', label: 'save' }, { key: 'Q', label: 'close' }],
    [{ key: 'Tab', label: 'page' }, { key: 'Ctrl+E', label: 'format' }, { key: '/', label: '搜索 é中文' }],
  ];
  for (const width of [16, 25, 32, 64, 120]) {
    const rows = shortcutRows(groups, width);
    expect(rows.flat().map((hint) => hint.key)).toEqual(['S', 'Q', 'Tab', 'Ctrl+E', '/']);
    for (const row of rows) {
      const spans = shortcutSpans(row, width);
      expect(displayWidth(spans.map((span) => span.text).join('')) <= width).toBe(true);
      expect(spans.filter((span) => span.style?.bold).map((span) => span.text)).toEqual(row.map((hint) => hint.key));
    }
    expect(rows[0]!.some((hint) => hint.key === 'Tab')).toBe(false);
  }
  expect(shortcutRows([[{ key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' }]], 13)[0]![0]!.label).toBe('cancel');
  expect(shortcutRows(groups, 1)).toEqual([]);
});

test('footer wrapping retains selection, input and a real sample row at the minimum size', () => {
  for (const [columns, rows] of [[32, 12], [32, 13], [48, 12], [64, 18], [64, 20], [80, 24], [120, 30], [80, 48]]) {
    for (const mode of ['main', 'subagents', 'settings', 'layout', 'detail', 'search', 'field', 'path', 'numeric', 'busy', 'uncertain']) {
      const state = view(), e = state.editor!;
      state.preview = { main: [[{ text: 'sample one' }], [{ text: 'sample two' }]], subagents: [[{ text: 'sample agent' }]] } as View['preview'];
      if (mode === 'detail' || mode === 'field') { e.detail = { scope: 'main', id: 'model-with-effort' }; e.setting = 'item:label'; }
      else if (['settings', 'path', 'numeric'].includes(mode)) { e.page = 'settings'; e.advanced = true; e.setting = mode === 'path' ? 'export-file' : mode === 'numeric' ? 'padding' : 'host-theme'; }
      else if (mode === 'layout') { e.page = 'layout'; e.setting = 'layout.mode'; }
      else if (mode === 'subagents') e.page = 'subagents';
      if (mode === 'search') state.input = { kind: 'search', scope: 'main', original: '', selected: e.selected.main };
      if (mode === 'field') state.input = { kind: 'field', key: 'item:label', buffer: 'SfQ 中文 é' };
      if (mode === 'path') state.input = { kind: 'path', action: 'export', buffer: '/SfQ 中文.json' };
      if (mode === 'numeric') state.input = { kind: 'numeric', field: 'padding' };
      if (mode === 'busy') state.busy = 'Saving…';
      if (mode === 'uncertain') state.uncertain = true;
      const input = state.input;
      const geometry = editorLayout(state, columns!, rows!);
      const tree = draw(elements, state, columns!, rows!) as unknown as Node;
      const lines = render(tree);
      expect(lines).toHaveLength(rows!);
      expect(3 + geometry.bodyHeight + geometry.previewHeight + geometry.footerRows).toBe(rows);
      expect(geometry.bodyRows >= 2).toBe(true);
      expect(state.input).toBe(input);
      const content = text(tree.children[3]!);
      expect(content).toContain('›');
      if (!e.detail && (e.page === 'main' || e.page === 'subagents')) expect(content).toContain('Filter:');
      expect(text(tree.children[4]!)).toContain(e.page === 'subagents' ? 'sample agent' : 'sample one');
      const hints = geometry.footer.flat();
      if (state.input) expect(hints.some((hint) => hint.key === 'Ctrl+G')).toBe(true);
      else if (!state.busy && !state.uncertain) {
        expect(hints.filter((hint) => ['S', 'F', 'Q'].includes(hint.key)).map((hint) => hint.key)).toEqual(['S', 'F', 'Q']);
        expect(hints.some((hint) => hint.key === 'Tab')).toBe(true);
      }
    }
  }
});

test('keys follow theme text and stay bold while action labels stay regular, including narrow groups', () => {
  const hints = [{ key: 'Ctrl+G', label: 'cancel editing', short: 'cancel' }, { key: 'Esc', label: 'focus' }];
  const spans = shortcutSpans(hints, 25);
  expect(spans.map((s) => s.text).join('')).toBe('Ctrl+G cancel · Esc focus');
  expect(spans.filter((s) => s.style?.bold).map((s) => s.text)).toEqual(['Ctrl+G', 'Esc']);
  expect(spans.filter((s) => s.style?.bold).every((s) => s.style?.color === 'text' && s.style?.dimColor === false)).toBe(true);
  expect(spans.filter((s) => s.style?.bold === false).every((s) => s.style?.color === 'inactive' && s.style?.dimColor === false)).toBe(true);
  expect(shortcutSpans(hints, 8)).toEqual([]);
  for (const width of [1, 12, 32, 64]) {
    const parts = shortcutSpans([{ key: 'Enter', label: '保存中文 é', short: '保存' }], width);
    expect(displayWidth(parts.map((s) => s.text).join('')) <= width).toBe(true);
    expect(displayWidth(clip('é中文', width)) <= width).toBe(true);
  }
});

test('both languages keep every page, form, numeric error and footer inside the cell viewport', () => {
  for (const language of ['en','zh-CN'] as const) {
    for (const [columns, rows] of [[32,12],[64,18],[64,20],[80,24],[120,30],[80,48]]) {
      for (const page of ['main','subagents','settings','layout','detail']) {
        const state=view(),e=state.editor!;
        state.language=language;
        if(page==='detail') {e.detail={scope:'main',id:'model-with-effort'};e.setting='item:label';}
        else e.page=page as typeof e.page;
        const output=render(draw(elements,state,columns!,rows!) as unknown as Node).join('\n');
        expect(output).toContain(language==='zh-CN'?'配置状态栏':'Configure Status Line');
        expect(output.includes('native.')).toBe(false);
        expect(output.includes('fields.')).toBe(false);
      }
    }
  }
});
