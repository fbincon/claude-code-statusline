import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, t } from '@fbincon/statusline-core/i18n/messages';
import { openReuse, reuseKey } from '@fbincon/statusline-core/editor/reuse-manager';
import { openChanges } from '@fbincon/statusline-core/editor/change-review';
import { copyDraft } from '@fbincon/statusline-core/editor/draft';
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { fixture, plain } from './fixtures.js';
import { frame } from '../src/drawing.js';

test('both history shortcuts and bounded review/reuse pages work in all six languages',()=>{
  for(const language of LANGUAGES){
    const state=fixture(language),e=state.editor,base=copyDraft(e.draft);state.key({key:'d',ctrl:true});assert.equal(e.history.undo.length,1);const copy=e.selected.main;
    state.key({key:'z',ctrl:true});assert.deepEqual(e.draft,base);state.key({key:'r',ctrl:true});assert(e.instance('main',copy));
    const unchanged=copyDraft(e.draft);for(const key of ['z','r','t'])state.key({key,ctrl:true,paste:true,text:true});assert.deepEqual(e.draft,unchanged);assert.equal(e.changeReview,null);
    state.key({key:'t',ctrl:true});assert(e.changeReview);assert(plain(state,80,24).join('\n').includes(t('history.title',language)));
    for(const [width,height]of [[32,12],[64,18],[80,24],[196,200]])assert(frame(state,width!,height!).rows.every(row=>displayWidth(row.map(s=>s.text).join(''))===width));
    state.key({key:'q'});e.detail={scope:'main',id:copy};openReuse(e,'style');
    for(const key of ['return','down','return','end','return'])reuseKey(e,{key},language,70,16);
    assert.equal(e.reuse!.page,'review');const beforeCancel=copyDraft(e.draft);reuseKey(e,{key:'q'},language,70,16);assert.deepEqual(e.draft,beforeCancel);
    openChanges(e);e.setSaveState('unknown');const steps=e.history.undo.length;assert(!e.undo());assert.equal(e.history.undo.length,steps);assert(e.changeReview);
  }
});
