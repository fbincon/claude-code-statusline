import { expect, test } from 'claude-code/testing';
import type { CatalogItem } from '../../lib/generated-contracts.ts';
import { guidanceRows } from '../../lib/editor/guidance.ts';
import { displayWidth } from '../../ui/layout.ts';
import { parseResponse } from '../../lib/backend.ts';
import { SEARCH_CATALOG } from '../generated-search-fixtures.ts';
import { description, reply } from '../fixtures.ts';

test('all canonical item guidance is translated and fits terminal cells', () => {
  for (const item of SEARCH_CATALOG as CatalogItem[]) for (const language of ['en', 'zh-CN'] as const) for (const width of [30, 60, 118]) {
    const rows = guidanceRows(item, language, width);
    expect(rows[0]!.kind).toBe('heading');
    expect(rows.every(row => displayWidth(row.text) <= width && !row.text.includes('guidance.'))).toBe(true);
    if (item.guidance.setup.includes('claude-statusline doctor')) {
      expect(rows.some(row => row.text.includes('claude-statusline doctor'))).toBe(true);
    }
  }
});

test('catalog guidance rejects missing and unknown source/scope/condition metadata', () => {
  const valid = {...description(), catalog: SEARCH_CATALOG as CatalogItem[]};
  expect(parseResponse('describe', reply(valid)).catalog.length).toBe(84);
  for (const guide of [null, {}, {source_kinds:['future'],measurement_scope:'main',requirements:[],setup:[]},
    {source_kinds:['official_input'],measurement_scope:'future',requirements:[],setup:[]},
    {source_kinds:['official_input'],measurement_scope:'main',requirements:['future'],setup:[]}]) {
    const data = JSON.parse(JSON.stringify(valid)); data.catalog[0].guidance = guide;
    expect(() => parseResponse('describe', reply(data))).toThrow();
  }
});
