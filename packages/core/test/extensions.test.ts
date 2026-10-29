import test from 'node:test';
import assert from 'node:assert/strict';
import { definition, parseObservation, selectPointer, sourceView, emptyObservation } from '../src/extensions/model.js';
import { unboundDisplay } from '../src/extensions/portable.js';
import { defaultDisplay } from '../src/config/display.js';
import { newInstance } from '../src/editor/instances.js';
import { withLink, truncateStyled, splitAnsiText, displayWidth, strip, styledUnits } from '../src/rendering/layout.js';
import { safeLink, fileLink, CLOSE_LINK } from '../src/terminal/links.js';
import { rowSpans } from '../src/rendering/spans.js';
import { itemFields } from '../src/config/editor-fields.js';
import type { SourceContext } from '../src/contracts/ui.js';
const context: SourceContext={project:'/project',session:'session',agent:null,branch:'main',head:'a'.repeat(40)};
const source=definition({id:'test',name:'Test',kind:'json',scope:{project:'/project',session:null,agent:null},ttl_seconds:300,settings:{path:'/value.json'},enabled:true,revision:'r1'});
test('historical source views filter current and fallback before choosing values or auxiliary fields', () => {
    const at = Date.parse('2026-10-28T11:00:00Z');
    const entry = (observed_at: string | null, value = 0) => ({...parseObservation({value,observed_at},source,context), fields:{pr:42,ci:'success',url:'https://github.com/example/repo/pull/42'}});
    for (const observed_at of ['2026-10-28T10:55:00Z','2026-10-28T11:00:00Z']) {
        const view=sourceView(source,context,entry(observed_at),null,at+3600000,at);
        assert.equal(view.value,0);assert.equal(view.freshness,'current');assert.equal(view.fields?.pr,42);
    }
    assert.equal(sourceView(source,context,entry('2026-10-28T10:54:59Z'),null,at,at).freshness,'stale');
    const future=entry('2026-10-28T12:00:00Z',99),unknown=entry(null,77);
    for(const current of [future,unknown]) {
        const rejected=sourceView(source,context,current,current,at+3600000,at);
        assert.equal(rejected.value,null);assert.equal(rejected.fields,undefined);assert.equal(rejected.freshness,'unknown');
        assert.equal(rejected.reason,current===future?'newer_than_input':'association_unavailable');
        const earlier=sourceView(source,context,current,entry('2026-10-28T10:59:00Z'),at+3600000,at);
        assert.equal(earlier.value,0);assert.equal(earlier.freshness,'current');assert.equal(earlier.observed_at,'2026-10-28T10:59:00.000Z');
    }
    assert.equal(sourceView(source,context,unknown,null,at).value,77,'ordinary live rendering retains unknown-time values');
    const partial={...entry('2026-10-28T11:00:00Z'),state:'partial' as const};
    assert.equal(sourceView(source,context,partial,null,at,at).state,'partial');
});
test('source values preserve zero/false and cannot execute JSON Pointer expressions',()=>{
    for(const value of [0,false,''])assert.equal(parseObservation({value},source,context).value,value);
    assert.equal(selectPointer({'a/b':{'~':42}},'/a~1b/~0'),42);
    assert.equal(selectPointer({},'/not-present'),undefined);
    assert.throws(()=>selectPointer({},'/__proto__/x'));
    assert.throws(()=>selectPointer({},'$.eval()'));
    assert.throws(()=>parseObservation({version:2,value:1},source,context));
    assert.throws(()=>parseObservation({value:{}},source,context));
    assert.throws(()=>parseObservation({value:1,observed_at:'2026-02-30T00:00:00Z'},source,context));
});
test('freshness, errors and identities cannot turn old observations into live success',()=>{
    const good=parseObservation({value:0,observed_at:'2026-10-23T00:00:00Z'},source,context);
    const now=Date.parse('2026-10-23T00:06:00Z');
    assert.equal(sourceView(source,context,good,good,now).freshness,'stale');
    const failed=sourceView(source,context,emptyObservation(source,context,'read_error'),good,now);
    assert.equal(failed.value,0);assert.equal(failed.state,'error');
    const rejected = parseObservation({value:999,state:'error'},source,context);
    assert.equal(sourceView(source,context,rejected,good,now).value,0);
    assert.equal(sourceView(source,context,rejected,null,now).value,null);
    const mismatch=sourceView(source,{...context,head:'b'.repeat(40)},good,good,now);
    assert.equal(mismatch.value,null);assert.equal(mismatch.state,'mismatch');
    assert.equal(sourceView({...source,enabled:false},context,good,good,now).value,null);
    assert.equal(sourceView(source,context,parseObservation({value:1},source,context),null,now).freshness,'unknown');
});
test('portable display strips binding authority while keeping component intent and identity',()=>{
    const display=defaultDisplay(), node=newInstance('external-value',display.instances);node.source={binding:'local-id',hint:'Queue'};display.instances.push(node);
    const portable=unboundDisplay(display);
    assert.deepEqual(portable.instances.at(-1)?.source,{binding:null,hint:'Queue'});
    assert.equal(display.instances.at(-1)?.source?.binding,'local-id');assert.equal(portable.instances.at(-1)?.id,node.id);
});
test('OSC8 survives grapheme clipping, wrapping and span conversion without leaking to the next item',()=>{
    const target=fileLink('/tmp/中文 path/#name')!;
    assert.equal(target,'file:///tmp/%E4%B8%AD%E6%96%87%20path/%23name');
    const linked=withLink('\x1b[31m中👨‍👩‍👧‍👦文 ab\x1b[0m',target,'on');
    assert.equal(displayWidth(linked),9);
    for(const part of splitAnsiText(linked,4)){
        assert(displayWidth(part)<=4);assert(part.includes(CLOSE_LINK));
        assert(rowSpans(part).every(span=>span.link===target));
    }
    const clipped=truncateStyled(linked,4);assert.equal(strip(clipped),'中…');
    assert.equal(styledUnits(clipped+' plain').at(-1)?.link,undefined);
    assert.equal(withLink('text',target,'auto',false),'text');
    for(const bad of ['javascript:alert(1)','file://remote/share','https://a/\x1b]0;title','https://a/%1b','https://u:p@host/'])assert.equal(safeLink(bad),null);
});
test('component capabilities supply supported form options consistently',()=>{
    const external=itemFields('main','external-value').map(field=>field.key);
    assert(external.includes('number_format'));assert(!external.includes('model_name'));assert(!external.includes('link'));
    assert(itemFields('main','pr').some(field=>field.key==='link'));
    assert(!itemFields('main','current-dir').some(field=>field.key==='allowance'));
    assert(!itemFields('main','model').some(field=>field.key==='number_format'));
    assert(itemFields('main','model').some(field=>field.key==='model_name'));
    assert(!itemFields('main','git').some(field=>field.key==='reset_timezone'));
    assert(itemFields('main','weekly-reset').some(field=>field.key==='reset_timezone'));
});

test('producer scope, state and cache identity follow only declared scope and inputs', async()=>{
    const {observationContext}=await import('../src/extensions/model.js');
    assert.deepEqual(observationContext(source,context),{...context,session:null,agent:null,branch:null,head:null});
    assert.equal(parseObservation({value:0,state:'partial'},source,context).state,'partial');
    const wrongScope={project:null,session:null,agent:null};
    assert.throws(()=>parseObservation({scope:wrongScope,value:8},source,context));
    assert.throws(()=>parseObservation({version:1,source_id:source.id,scope:wrongScope,observed_at:null,state:'valid',value:8,unit:null},source,context,true));
    const good=parseObservation({value:8},source,context);
    assert.equal(sourceView(source,context,emptyObservation(source,context,'scope'),good,Date.now()).value,null);
    const scoped={...source,kind:'command' as const,settings:{...source.settings,input:{s:'session',a:'agent',h:'head'}}};
    assert.deepEqual(observationContext(scoped,{...context,agent:'child'}),{...context,agent:'child',branch:null});
});
