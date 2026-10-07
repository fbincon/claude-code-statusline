import { expect, test } from 'claude-code/testing';
import { dimensions, clip, cellWidth } from '../../ui/layout.ts';
import { formPages, formSelection, formWindow, pageSelection, pageWindow } from '../../lib/editor/navigation.ts';

test('smallest usable pane budgets all sections and resizing keeps selection visible', () => {
  expect(dimensions(31, 12).available).toBe(false);
  expect(dimensions(32, 11).available).toBe(false);
  expect(dimensions(32, 12).available).toBe(true);
  for (const rows of [12, 18, 24, 40]) {
    const layout = dimensions(32, rows);
    expect(5 + layout.previewHeight + layout.bodyHeight).toBe(rows);
    expect(layout.previewRows <= 3).toBe(true);
    expect(layout.itemCapacity >= 1).toBe(true);
    expect(layout.formHeight >= 1).toBe(true);
  }
  const keys = Array.from({ length: 24 }, (_, i) => String(i));
  expect(pageSelection(keys, '0', 5, -1)).toBe('0');
  expect(pageSelection(keys, '0', 5, 1)).toBe('5');
  expect(pageSelection(keys, '20', 5, 1)).toBe('20');
  const window = pageWindow(keys, '23', 2);
  expect(keys.slice(window.start, window.end)).toContain('23');
  expect(pageSelection([], '', 1, 1)).toBe('');
});

test('grouped pages fill actual rows, repeat context and never orphan headings', () => {
  const rows = ['A', 'A', 'A', 'A', 'A', 'B', 'C', 'C', 'C'].map((group, i) => ({ key: String(i), group }));
  expect(formPages(rows, 8)[0]!.end).toBe(6);
  for (let height = 1; height < 16; height++) {
    const pages = formPages(rows, height);
    expect(pages.flatMap((p) => p.lines.filter((line) => line.index !== null).map((line) => line.index))).toEqual(rows.map((_, i) => i));
    for (const page of pages) {
      expect(page.lines.length <= height).toBe(true);
      if (height > 1) expect(page.lines[0]!.index).toBeNull();
      page.lines.forEach((line, i) => {
        if (line.index === null) {
          expect(page.lines[i + 1]?.index !== null).toBe(true);
          expect(page.lines[i + 1]?.group).toBe(line.group);
        }
      });
    }
    for (const row of rows) expect(formWindow(rows, row.key, height).lines.some((line) => line.index === Number(row.key))).toBe(true);
  }
  expect(formPages([], 0)).toHaveLength(1);
  expect(formSelection([], '', 1, 1)).toBe('');
});

test('page keys retain field offsets and clamp on the final page and boundaries', () => {
  const rows = ['A', 'A', 'A', 'B', 'B', 'C', 'C'].map((group, i) => ({ key: String(i), group }));
  expect(formSelection(rows, '1', 4, 1)).toBe('4');
  expect(formSelection(rows, '4', 4, -1)).toBe('1');
  expect(formSelection(rows, '4', 4, 1)).toBe('6');
  expect(formSelection(rows, '6', 4, 1)).toBe('6');
  expect(formSelection(rows, '1', 4, -1)).toBe('1');
  expect(pageSelection(['0', '1', '2', '3', '4', '5'], '2', 3, 1)).toBe('5');
  expect(pageSelection(['0', '1', '2', '3'], '2', 3, 1)).toBe('3');
});

test('long CJK and combining labels fit without breaking Unicode pairs', () => {
  expect(clip('中文路径测试', 7)).toBe('中文路…');
  expect(clip('e\u0301abcd', 3)).toBe('e\u0301a…');
  expect(clip('😀abc', 3)).toBe('😀…');
  expect(clip('a\nb', 10)).toBe('a b');
  expect(clip('text', 0)).toBe('');
  for (const label of ['中文路径测试', '😀 abcdef', 'e\u0301abcdef']) {
    expect(
      [...clip(label, 5)].reduce((width, char) => width + cellWidth(char), 0) <=
        5,
    ).toBe(true);
  }
});
