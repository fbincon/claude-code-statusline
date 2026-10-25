import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, defaultItem } from '@fbincon/statusline-core/config/display';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { renderTask } from '@fbincon/statusline-core/rendering/subagents';
import { styledUnits, strip, displayWidth } from '@fbincon/statusline-core/rendering/layout';
import { parse } from '@fbincon/statusline-core/rendering/styles';
import { riskColor } from '@fbincon/statusline-core/rendering/appearance';
import { edit } from '@fbincon/statusline-core/config/instances';
import { env } from './render-support.js';

const colors=['#123456','#abcdef'];
test('final main clipping repaints foreground endpoints in auto and explicit rows', () => {
  for (const mode of ['auto','explicit'] as const) for (const separator of ['classic','powerline'] as const) {
    const d=defaultDisplay();d.scope_labels='off';d.separator_style=separator;
    d.instances=[{id:'text',type_id:'text',enabled:true,text:'中文👩🏽‍💻é'.repeat(25),options:{...defaultItem(),foreground_gradient:colors}}];
    d.layout={mode,rows:mode==='explicit'?[['text']]:[]};
    for (const width of [4,40,80,120]) {
      const rows=configuredRows({},d,width,env);
      assert(rows.every(row=>displayWidth(row)<=width));
      const body=styledUnits(rows[0]!).filter(unit=>unit.text.trim() && !['>','<'].includes(unit.text));
      assert.deepEqual(parse(body[0]!.style).foreground,['rgb',colors[0]]);
      assert.deepEqual(parse(body.at(-1)!.style).foreground,['rgb',colors[body.length > 1 ? 1 : 0]]);
    }
  }
});
test('spacer gaps stay unpainted and foreground gradients survive independent and shared groups', () => {
  for (const separator of ['classic','powerline'] as const) for (const grouped of [false,true]) {
    const d=defaultDisplay();d.scope_labels='off';d.separator_style=separator;
    d.instances=[
      {id:'label',type_id:'text',enabled:true,text:'ABC',options:{...defaultItem(),foreground_gradient:colors}},
      {id:'model',type_id:'model',enabled:true,text:null,options:{...defaultItem(),foreground_gradient:colors}},
      {id:'gap',type_id:'spacer',enabled:true,text:null,options:defaultItem()},
      {id:'tail',type_id:'text',enabled:true,text:'XYZ',options:{...defaultItem(),foreground_gradient:colors}},
    ];
    d.layout={mode:'explicit',rows:[d.instances.map(n=>n.id)]};
    if(grouped)d.groups=[{id:'group',member_ids:['label','model'],primary_id:'model',link_visibility:true,shared_powerline:true}];
    const row=configuredRows({model:{id:'Claude'}},d,80,env)[0]!, units=styledUnits(row);
    assert.equal(displayWidth(row),80);
    for(const letter of ['A','X'])assert.deepEqual(parse(units.find(u=>u.text===letter)!.style).foreground,['rgb',colors[0]]);
    for(const letter of ['C','Z'])assert.deepEqual(parse(units.find(u=>u.text===letter)!.style).foreground,['rgb',colors[1]]);
    assert(units.filter(u=>u.text===' ' && parse(u.style).background===null).length>30);
  }
});
test('warnings override foreground gradients while shared backgrounds belong to the primary', () => {
  const d=defaultDisplay();d.scope_labels='off';d.separator_style='powerline';d.formatting.thresholds.enabled=true;
  d.instances=[{id:'label',type_id:'text',enabled:true,text:'LABEL',options:{...defaultItem(),foreground_gradient:colors,background_gradient:['#ffffff','#000000']}},
    {id:'risk',type_id:'context-used',enabled:true,text:null,options:{...defaultItem(),foreground_gradient:colors,background_gradient:['#010203','#040506']}}];
  d.groups=[{id:'g',member_ids:['label','risk'],primary_id:'risk',link_visibility:true,shared_powerline:true}];
  d.layout={mode:'explicit',rows:[['label','risk']]};
  const row=configuredRows({context_window:{used_percentage:95}},d,80,env)[0]!, units=styledUnits(row);
  assert.deepEqual(parse(units[0]!.style).background,['rgb','#010203']);
  const metric=units.find(unit=>unit.text==='9')!;
  assert.deepEqual(parse(metric.style).foreground,riskColor(95,d));
  assert.deepEqual(d.instances[0]!.options.background_gradient,['#ffffff','#000000']);
  assert.equal(configuredRows({},d,80,env).length,0);
});
test('agent gradients and CLI setters share options, warning precedence and plain-output fallback', () => {
  let d=defaultDisplay();d.scope_labels='off';d.use_colors=true;
  d.subagents.instances=[{id:'task',type_id:'task',enabled:true,text:null,options:{...defaultItem(),foreground_gradient:colors}}];
  d=edit(d,'subagent',{action:'set',id:'task',option:'foreground-gradient',value:'ocean'},()=> 'unused').config;
  const task={id:'a',status:'running',description:'中文 test long task'};
  const colored=renderTask(task,d,env,40), plain=renderTask(task,{...d,use_colors:false},env,40);
  assert.equal(strip(colored),plain);assert(!plain.includes('\x1b'));
  const units=styledUnits(colored);assert(units.some(u=>parse(u.style).foreground?.[0]==='rgb'));
});
