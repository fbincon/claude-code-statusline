import { expect, test } from 'claude-code/testing';
import { START, RUN, PANE, setup, keys, reply, sample, selectSetting } from '../fixtures.ts';
import { copyDraft } from '../../lib/editor/draft.ts';

test('quick setup preserves a dirty draft on cancel, previews its candidate and saves with the opening revision', {timeoutMs:20000}, async ($,on) => {
  const f=setup(on);
  f.behavior.process=(request,next)=>request.operation==='preset'
    ? {value:reply({draft:{...copyDraft(request.payload.draft), display:{...copyDraft(request.payload.draft).display,theme:'dark'}}})} : next();
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,'3',' ',{key:'p',ctrl:true},'return','right');
  expect(f.calls.some(c=>c.operation==='apply')).toBe(false);
  expect(f.calls.filter(c=>c.operation==='preview').at(-1)!.payload.draft.display.theme).toBe('light');
  await keys(ui,{key:'g',ctrl:true},'s');
  expect(f.store.draft.display.theme).toBe('classic');
  expect(f.store.draft.display.use_colors).toBe(false);
  await keys(ui,{key:'p',ctrl:true},'return','end','return','down','return');
  expect(f.store.draft.display.theme).toBe('dark');
  expect(f.calls.filter(c=>c.operation==='apply').at(-1)!.payload.expected_revision).toBe('1'.repeat(64));
  expect(f.configCalls).toEqual([]);await ui.unmount();
});

test('native text editing preserves graphemes and suffixes and bulk text cannot execute commands', {timeoutMs:20000}, async ($,on)=>{
  const f=setup(on);await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,'S1Q');expect(f.calls.some(c=>c.operation==='apply')).toBe(false);
  await keys(ui,{key:'e',ctrl:true},'return',{key:'u',ctrl:true},'中文👩🏽‍💻后缀','home','right','delete','标签','return',{key:'g',ctrl:true},'s');
  expect(f.store.draft.display.instances[0]!.options.label).toBe('中标签👩🏽‍💻后缀');
  await ui.unmount();
});

test('native explanation is instance-bound, scrollable and never applies the draft', {timeoutMs:20000}, async ($,on)=>{
  const f=setup(on);
  f.behavior.process=(request,next)=>request.operation==='explain' ? {value:reply({
    sample:true,scope:request.payload.scope,width:request.payload.width,actual_availability:'not_observed',
    preview:sample('Explained sample'),instances:request.payload.draft.display.instances.map((node:any)=>({
      id:node.id,type_id:node.type_id,enabled:node.enabled,
      reasons:[{code:'configured_on',origin:'configuration'},{code:'actual_not_observed',origin:'unknown'}],
      samples:[{row_id:'main',outcome:'sample_visible',truncated:false}],
    })),
  })} : next();
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,{key:'e',ctrl:true});await selectSetting(ui,'item-explain');await keys(ui,'return');
  expect(await ui.find({in:'statusline-client',type:'Text',text:/Actual session fields/})).toBeDefined();
  await keys(ui,'end');expect(await ui.find({in:'statusline-client',type:'Text',text:/Wrapping preserves content/})).toBeDefined();
  await keys(ui,{key:'g',ctrl:true});
  expect(f.calls.filter(c=>c.operation==='explain')).toHaveLength(1);
  expect(f.calls.some(c=>c.operation==='apply')).toBe(false);await ui.unmount();
});
