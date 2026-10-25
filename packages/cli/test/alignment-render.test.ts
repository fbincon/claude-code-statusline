import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, defaultItem } from '@fbincon/statusline-core/config/display';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { displayWidth, strip, styledUnits } from '@fbincon/statusline-core/rendering/layout';
import { RenderTrace } from '@fbincon/statusline-core/rendering/trace';
import { editAlignment } from '@fbincon/statusline-core/editor/alignments';
import type { AlignmentRef } from '@fbincon/statusline-core/contracts/ui';
import { env } from './render-support.js';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { presentation } from '../src/rendering/environment.js';
import { previewRows, samplePreviewData } from '@fbincon/statusline-core/rendering/preview';
const ref=(id:string):AlignmentRef=>({kind:'instance',id});
function fixture(right=false){
  const d=defaultDisplay();d.scope_labels='off';
  const row=(names:string[],texts:string[])=>names.map((id,i)=>({id,type_id:'text',enabled:true,text:texts[i]!,options:defaultItem()}));
  const a=row(['a','b'],['A','BBB']),b=row(['c','d'],['CCCC','D']);
  const spacer=(id:string)=>({id,type_id:'spacer',enabled:true,text:null,options:defaultItem()});
  d.instances=right?[spacer('s1'),...a,spacer('s2'),...b]:[...a,...b];
  d.layout={mode:'explicit',rows:right?[['s1','a','b'],['s2','c','d']]:[['a','b'],['c','d']]};
  return editAlignment(d,'table',[[ref('a'),ref('c')],[ref('b'),ref('d')]]);
}
const offset=(text:string,token:string)=>displayWidth(text.slice(0,text.indexOf(token)));
test('explicit rows align visible starts and preserve column positions through hiding and resizing',()=>{
  for(const right of [false,true])for(const separator of ['classic','powerline'] as const){
    const d=fixture(right);d.separator_style=separator;
    for(const width of [40,80,120]){
      let rows=configuredRows({},d,width,env).map(strip);
      assert.equal(rows.length,2);assert(rows.every(row=>displayWidth(row)<=width));
      assert.equal(offset(rows[0]!,'A'),offset(rows[1]!,'CCCC'));
      assert.equal(offset(rows[0]!,'BBB'),offset(rows[1]!,'D'));
      const position=offset(rows[1]!,'D');d.instances.find(n=>n.id==='b')!.enabled=false;
      rows=configuredRows({},d,width,env).map(strip);assert(!rows[0]!.includes('BBB'));if(!right)assert.equal(offset(rows[1]!,'D'),position);
      assert.equal(offset(rows[0]!,'A'),offset(rows[1]!,'CCCC'));
      d.instances.find(n=>n.id==='d')!.enabled=false;
      const hidden=configuredRows({},d,width,env).map(strip);assert.equal(hidden.length,2);assert(!hidden.some(row=>row.includes('BBB')||row.includes('D')));
      d.instances.find(n=>n.id==='b')!.enabled=true;d.instances.find(n=>n.id==='d')!.enabled=true;
    }
  }
});
test('narrow widths collapse whole relationships and preserve the original fitting result and reasons',()=>{
  const d=fixture();d.instances.find(n=>n.id==='c')!.text='C'.repeat(70);
  const trace=new RenderTrace(d);trace.begin('main','main');
  for(const width of [2,8,40]){
    const output=configuredRows({},d,width,{...env,trace});
    const baseline=configuredRows({},{...d,layout:{...d.layout,alignments:[]}},width,env);
    assert.deepEqual(output,baseline);assert(output.every(row=>displayWidth(row)<=width));
    assert.equal(trace.alignmentCollapsed('a'),true);assert.equal(trace.alignmentCollapsed('d'),true);
  }
  const wide=configuredRows({},d,120,{...env,trace}).map(strip);
  assert.equal(trace.alignmentCollapsed('a'),false);assert.equal(offset(wide[0]!,'BBB'),offset(wide[1]!,'D'));
});
test('whole hidden rows disappear, independent rows keep their fitting and disabled spacers explain fallback',()=>{
  const d=fixture(true);d.instances.filter(n=>['a','b'].includes(n.id)).forEach(n=>n.enabled=false);
  assert.equal(configuredRows({},d,80,env).length,1);
  d.instances.filter(n=>['a','b'].includes(n.id)).forEach(n=>n.enabled=true);d.instances.find(n=>n.id==='s1')!.enabled=false;
  const trace=new RenderTrace(d);trace.begin('main','main');const output=configuredRows({},d,80,{...env,trace});
  assert.deepEqual(output,configuredRows({},{...d,layout:{...d.layout,alignments:[]}},80,env));
  assert.equal(trace.alignmentCollapsed('a'),true);
});
test('alignment retains complete group gradients, Unicode and collection reuse',()=>{
  const d=fixture();d.separator_style='powerline';d.instances[0]!.text='中文👩🏽‍💻é';
  d.instances[1]!.type_id='model';d.instances[1]!.text=null;
  d.instances[3]!.type_id='model';d.instances[3]!.text=null;
  for(const node of d.instances){node.options.foreground_gradient=['#112233','#ddeeff'];node.options.background_gradient=['#010203','#040506'];}
  d.groups=[{id:'g1',member_ids:['a','b'],primary_id:'b',link_visibility:true,shared_powerline:true},{id:'g2',member_ids:['c','d'],primary_id:'d',link_visibility:true,shared_powerline:true}];
  d.layout.alignments=[{id:'groups',columns:[[{kind:'group',id:'g1'},{kind:'group',id:'g2'}]]}];
  const rows=configuredRows({model:{id:'Claude'}},d,80,env);
  assert.equal(rows.length,2);assert(rows.every(row=>displayWidth(row)<=80));
  assert(strip(rows[0]!).includes('中文👩🏽‍💻é'));assert(styledUnits(rows[0]!).some(u=>u.text==='👩🏽‍💻'));
  assert.equal(displayWidth(rows[0]!),displayWidth(rows[1]!));
});
test('aligned duplicate observations are collected once and OSC 8 links keep whole graphemes',()=>{
  const d=fixture(); d.instances[0]!.type_id='git'; d.instances[0]!.text=null;
  d.instances[2]!.type_id='git'; d.instances[2]!.text=null;
  let calls=0;
  const sources={...env,git:()=>{calls++;return {kind:'ok',branch:'main'};}};
  for(const width of [8,80]){
    calls=0;configuredRows({cwd:'/project'},d,width,sources);assert.equal(calls,1);
  }
  d.instances[0]!.type_id='current-dir';d.instances[2]!.type_id='current-dir';
  d.instances[0]!.options.link='on';d.instances[2]!.options.link='on';
  d.instances[0]!.options.foreground_gradient=['#112233','#ddeeff'];
  const output=configuredRows({cwd:'/中文/👩🏽‍💻/é'},d,120,env);
  assert(output.some(row=>row.includes('\x1b]8;')));
  assert(styledUnits(output[0]!).some(unit=>unit.text==='👩🏽‍💻'));
});
test('six-language joint previews match rendering at 40/80/120 cells with Unicode, links and color fallback',async()=>{
  for(const language of LANGUAGES) {
    const sources={...env,language:await presentation(language)},d=fixture();
    d.statusline_language=language;d.separator_style='powerline';
    d.instances[0]!.text='中文 日本語 한글 é 👩🏽‍💻';
    d.instances[2]!.type_id='current-dir';d.instances[2]!.text=null;d.instances[2]!.options.link='on';
    d.directory_style='basename';
    for(const id of ['b','d']) {const node=d.instances.find(n=>n.id===id)!;node.type_id='context-used';node.text=null;}
    for(const node of d.instances){node.options.foreground_gradient=['#22d3ee','#3b82f6'];node.options.background_gradient=['#112233','#445566'];}
    const payload=samplePreviewData('/test/home');
    for(const width of [40,80,120]) {
      const output=configuredRows(payload,d,width,sources);
      assert.deepEqual(previewRows(d,width,sources,'/test/home'),output);
      assert(output.length>0);assert(output.every(row=>displayWidth(row)<=width));
      assert(output.every(row=>!strip(row).includes('statusline.')));
    }
    d.palette='ansi';assert(configuredRows(payload,d,120,sources).every(row=>!row.includes(';2;')));
    d.use_colors=false;assert(configuredRows(payload,d,120,sources).every(row=>!row.match(/\x1b\[[0-9;]*m/u)));
  }
});
