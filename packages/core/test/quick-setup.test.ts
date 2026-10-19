import test from 'node:test';
import assert from 'node:assert/strict';
import { openQuick, quickKey, receivePreset, quickView } from '../src/editor/quick-setup.js';
import { defaultDisplay } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import { applyPreset } from '../src/config/presets.js';
import { LANGUAGES } from '../src/i18n/registry.js';

test('quick setup isolates candidates, retains opt-outs and returns through each step', () => {
  const draft={display:defaultDisplay(),host:{...DEFAULT_HOST}};
  draft.display.subagents.enabled=false; draft.display.statusline_language='ja';
  const original=JSON.stringify(draft), quick=openQuick(draft);
  quickKey(quick,'down'); quickKey(quick,'down'); quickKey(quick,'down');
  assert.equal(quickKey(quick,'return'),'preset'); assert.equal(quick.preset,'multi-agent');
  receivePreset(quick,{display:applyPreset(quick.base.display,quick.preset,()=> 'copy'),host:quick.base.host});
  quickKey(quick,'right');
  assert.notEqual(quick.candidate.display.theme,draft.display.theme);
  assert.equal(quick.candidate.display.subagents.enabled,false);
  assert.equal(quick.candidate.display.statusline_language,'ja');
  quickKey(quick,'end'); quickKey(quick,'return');
  assert.equal(quick.step,'review'); assert.equal(quickKey(quick,'return'),'accept');
  quickKey(quick,'backspace'); assert.equal(quick.step,'appearance');
  quickKey(quick,'backspace'); assert.equal(quick.step,'scenario');
  assert.equal(quickKey(quick,'cancel'),'cancel'); assert.equal(JSON.stringify(draft),original);
});
test('all scenarios have localized scrollable requirements at narrow sizes', () => {
  for(const language of LANGUAGES) for(let selected=0; selected<6; selected++) {
    const q=openQuick({display:defaultDisplay(),host:{...DEFAULT_HOST}});q.selected=selected;
    const lines=quickView(q,language,30,3);
    assert.equal(lines.length,3); assert.equal(lines.filter(line=>line.selected).length,1);
    assert.ok(!lines.some(line=>line.text.includes('quick.')));
    quickKey(q,'pagedown'); assert.equal(q.detailScroll,1);
  }
});
