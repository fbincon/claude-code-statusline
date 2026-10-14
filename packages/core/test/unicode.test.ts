import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { graphemes, displayWidth, clip } from '../src/unicode/index.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
test('tests.rendering.test_graphemes.GraphemeTests.test_every_official_unicode_18_boundary', () => {
  const lines = readFileSync(join(root, 'tools/unicode/GraphemeBreakTest.txt'), 'utf8').split('\n');
  for (const line of lines) {
    const raw = line.split('#')[0]!.trim(); if (!raw) continue;
    const expected = raw.split('÷').map(group => group.trim().split(/\s+/u).filter(token => token && token !== '×').map(token => String.fromCodePoint(parseInt(token, 16))).join('')).filter(Boolean);
    assert.deepEqual(graphemes(expected.join('')), expected, line);
  }
});
test('tests.rendering.test_graphemes.GraphemeTests.test_shared_widths_and_clipping_budgets', () => {
  const cases = JSON.parse(readFileSync(join(root, 'tests/fixtures/graphemes.json'), 'utf8')).cases;
  for (const fixture of cases) {
    assert.deepEqual(graphemes(fixture.text), fixture.clusters); assert.equal(displayWidth(fixture.text), fixture.width);
    for (let width = 0; width < fixture.width + 2; width++) {
      const output = clip(fixture.text, width, '…'); assert.ok(displayWidth(output) <= width);
      const content = output.endsWith('…') && output !== fixture.text ? output.slice(0, -1) : output;
      assert.equal(fixture.clusters.slice(0, graphemes(content).length).join(''), content);
    }
  }
});
test('tests.rendering.test_graphemes.GraphemeTests.test_long_combining_cluster_is_never_sliced', () => {
  const cluster = 'e' + '\u0301'.repeat(4096);
  assert.equal(clip(cluster + 'X', 1, ''), cluster); assert.equal(displayWidth(cluster), 1);
});
