import { expect, test } from 'claude-code/testing';
import { dimensions, clip, cellWidth } from '../../ui/layout.ts';
import { pageSelection, pageWindow } from '../../lib/editor/navigation.ts';

test('smallest usable pane budgets all sections and resizing keeps selection visible', () => {
  expect(dimensions(31, 12).available).toBe(false);
  expect(dimensions(32, 11).available).toBe(false);
  expect(dimensions(32, 12).available).toBe(true);
  for (const rows of [12, 18, 24, 40]) {
    const layout = dimensions(32, rows);
    expect(5 + layout.previewHeight + layout.bodyHeight).toBe(rows);
    expect(layout.previewRows <= 3).toBe(true);
    expect(layout.itemCapacity >= 1).toBe(true);
    expect(layout.settingCapacity >= 1).toBe(true);
  }
  const keys = Array.from({ length: 24 }, (_, i) => String(i));
  expect(pageSelection(keys, '0', 5, -1)).toBe('0');
  expect(pageSelection(keys, '0', 5, 1)).toBe('5');
  expect(pageSelection(keys, '20', 5, 1)).toBe('20');
  const window = pageWindow(keys, '23', 2);
  expect(keys.slice(window.start, window.end)).toContain('23');
  expect(pageSelection([], '', 1, 1)).toBe('');
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
