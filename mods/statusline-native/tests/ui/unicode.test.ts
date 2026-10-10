import { expect, test } from 'claude-code/testing';
import { graphemes, displayWidth, clip } from '../../lib/unicode.ts';
import { BREAK_CASES, GRAPHEME_CASES } from '../generated-unicode-fixtures.ts';

test('fixed Unicode 18 extended graphemes pass every official conformance case', () => {
  for (const clusters of BREAK_CASES) expect(graphemes(clusters.join(''))).toEqual(clusters);
});
test('shared terminal cell and clipping examples preserve every grapheme', () => {
  for (const sample of GRAPHEME_CASES) {
    expect(graphemes(sample.text)).toEqual(sample.clusters);
    expect(displayWidth(sample.text)).toBe(sample.width);
    for (let width = 0; width <= sample.width + 1; width++) {
      const output = clip(sample.text, width);
      expect(displayWidth(output) <= width).toBe(true);
      const content = output.endsWith('…') && output !== sample.text ? output.slice(0, -1) : output;
      expect(sample.clusters.slice(0, graphemes(content).length).join('')).toBe(content);
    }
  }
});
