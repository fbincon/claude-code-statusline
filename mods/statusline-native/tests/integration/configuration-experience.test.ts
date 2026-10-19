import { expect, test } from 'claude-code/testing';
import { START, RUN, PANE, setup, keys, reply } from '../fixtures.ts';
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
