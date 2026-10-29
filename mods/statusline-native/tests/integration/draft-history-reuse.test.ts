import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, visibleText, previewDraft, component } from '../fixtures.ts';

test('actual native Client routes history, comparison and whole-group review without saving', {timeoutMs:20000},async($,on)=>{
  const f=setup(on);f.store.draft.display.instances=[component('model-with-effort'),{...component('text'),id:'caption',text:'中文 👩‍💻'}];
  f.store.draft.display.groups=[{id:'group',primary_id:'model-with-effort',member_ids:['model-with-effort','caption'],link_visibility:true,shared_powerline:true}];
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,'d');expect(previewDraft(f).display.instances.length).toBe(3);
  await keys(ui,{key:'z',ctrl:true});expect(previewDraft(f).display.instances.length).toBe(2);
  await keys(ui,{key:'r',ctrl:true});expect(previewDraft(f).display.instances.length).toBe(3);
  await keys(ui,{key:'t',ctrl:true},'c');expect(await visibleText(ui)).toContain('Changes and history');expect(f.calls.filter(c=>c.operation==='read').length>1).toBe(true);
  await keys(ui,'q','3');await selectSetting(ui,'reuse-groups');await keys(ui,'return','return','down',' ','end','return');
  expect(await visibleText(ui)).toContain('Reuse complete groups');expect(previewDraft(f).display.instances.length).toBe(5);
  await keys(ui,'a');expect(await visibleText(ui)).toContain('Save separately');expect(f.calls.some(c=>c.operation==='apply')).toBe(false);
  await keys(ui,'q',{key:'z',ctrl:true});expect(previewDraft(f).display.instances.length).toBe(3);
  await ui.unmount();
});
