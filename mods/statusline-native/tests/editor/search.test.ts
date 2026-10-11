import { expect, test } from 'claude-code/testing';
import { matchText, bestMatch } from '../../lib/editor/search.ts';
import { Editor } from '../../lib/editor/draft.ts';
import type { CatalogItem } from '../../lib/generated-contracts.ts';
import { SEARCH_CASES, SEARCH_CATALOG } from '../generated-search-fixtures.ts';
import { description, readResult } from '../fixtures.ts';
import { itemSpans } from '../../ui/components/catalog.ts';

test('shared Unicode codepoint matches and stable search tiers', () => {
  for (const value of SEARCH_CASES.text_matches) {
    const match = matchText(value.text, value.query);
    expect(match?.rank ?? null).toBe(value.rank);
    expect(match?.positions ?? []).toEqual(value.positions);
  }
  const value = SEARCH_CASES.ranking;
  const ranked = [...value.items].sort((a, b) => bestMatch([['name', a[1]!]], value.query)!.rank - bestMatch([['name', b[1]!]], value.query)!.rank);
  expect(ranked.map(item => item[0])).toEqual(value.expected);
});

test('add discovery searches all languages without changing configured instances', () => {
  const editor=new Editor({...description(),catalog:SEARCH_CATALOG as CatalogItem[]},readResult());
  const order=[...editor.order.main];
  expect(editor.categories('main').length).toBe(12);
  expect(editor.categories('subagent')).toEqual(['all','task','model','context','location','layout']);
  editor.openPicker('main');
  for(const query of ['mwe','推理','仓库','Repository']){
    editor.filter('main',query);expect(editor.visible('main').length>0).toBe(true);
  }
  expect(editor.modified).toBe(false);expect(editor.move('main',1)).toBe(false);
  editor.closePicker('main');expect(editor.order.main).toEqual(order);
  editor.instanceAction('main','add','model');const id=editor.selected.main;
  editor.instance('main',id)!.options.label='私有🦊引擎';
  editor.filter('main','私有🦊');expect(editor.visible('main').map(i=>i.id)).toEqual([id]);
  expect(editor.matches('main')[0]!.match.positions).toEqual([0,1,2]);
});

test('alternate-language highlight shows source evidence and never unrelated Chinese text', () => {
  const item = SEARCH_CATALOG.find(item => item.scope === 'main' && item.id === 'model-with-effort') as CatalogItem;
  const match = matchText(item.id, 'mwe', 'id')!;
  const spans = itemSpans(item, match, 'mwe', 'zh-CN', 120, true, true);
  expect(spans.filter(span => span.style?.bold).map(span => span.text).join('')).toBe('mwe');
  expect(spans.map(span => span.text).join('')).toContain('model-with-effort');
});
