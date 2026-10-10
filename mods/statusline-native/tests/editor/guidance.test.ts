import { expect, test } from 'claude-code/testing';
import type { CatalogItem } from '../../lib/generated-contracts.ts';
import { guidanceLines } from '../../lib/editor/guidance.ts';
import { displayWidth } from '../../ui/layout.ts';
import { parseResponse } from '../../lib/backend.ts';
import { SEARCH_CATALOG } from '../generated-search-fixtures.ts';
import { description, reply } from '../fixtures.ts';

test('all canonical item explanations are translated and fit terminal cells', () => {
  for (const item of SEARCH_CATALOG as CatalogItem[]) for (const language of ['en', 'zh-CN'] as const) for (const width of [30, 60, 118]) {
    const lines = guidanceLines(item, language, width);
    expect(lines.every(line => displayWidth(line) <= width)).toBe(true);
    expect(lines.join('\n').includes('guidance.')).toBe(false);
    expect(lines.some(line => line.includes('claude-statusline doctor'))).toBe(true);
  }
});

test('catalog guidance rejects missing and unknown source/scope/condition metadata', () => {
  const valid = {...description(), catalog: SEARCH_CATALOG as CatalogItem[]};
  expect(parseResponse('describe', reply(valid)).catalog.length).toBe(74);
  for (const guide of [null, {}, {source_kinds:['future'],measurement_scope:'main',requirements:[],setup:[]},
    {source_kinds:['official_input'],measurement_scope:'future',requirements:[],setup:[]},
    {source_kinds:['official_input'],measurement_scope:'main',requirements:['future'],setup:[]}]) {
    const data = JSON.parse(JSON.stringify(valid)); data.catalog[0].guidance = guide;
    expect(() => parseResponse('describe', reply(data))).toThrow();
  }
});
