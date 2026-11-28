import { expect, test } from 'claude-code/testing';
import { START, RUN, PANE, setup, keys, reply, sample, selectedSetting, selectSetting, visibleText } from '../fixtures.ts';
import { copyDraft } from '../../lib/editor/draft.ts';
import { t } from '../../lib/i18n/index.ts';
import { PRESETS } from '../../lib/generated-contracts.ts';

test('native editor adds and saves the optional cache cause component and retains it on reopening', {timeoutMs:20000}, async ($,on) => {
  const f=setup(on);
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,{key:'a',ctrl:true},'/', 'cache-miss-reason','return','return','s');
  expect(f.store.draft.display.instances.some(i=>i.type_id==='cache-miss-reason'&&i.enabled)).toBe(true);
  expect(f.calls.some(c=>c.operation==='apply')).toBe(true);
  await ui.unmount();await $.command.run(RUN);const reopened=await $.ui.mount(PANE);
  expect(f.calls.filter(c=>c.operation==='preview').at(-1)!.payload.draft.display.instances.some((i:any)=>i.type_id==='cache-miss-reason'&&i.enabled)).toBe(true);
  await reopened.unmount();
});

test('quick setup preserves a dirty draft on cancel, previews its candidate and saves with the opening revision', {timeoutMs:20000}, async ($,on) => {
  const f=setup(on);
  f.behavior.process=(request,next)=>request.operation==='preset'
    ? {value:reply({draft:{...copyDraft(request.payload.draft), display:{...copyDraft(request.payload.draft).display,theme:'dark'}}})} : next();
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,'4',' ',{key:'p',ctrl:true},'return');
  expect(await visibleText(ui)).toContain(t('quick.preset-ready', 'en'));
  await keys(ui,'s', 'right');
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
  const draft = f.store.draft;
  const original = draft.display.instances[0]!;
  const selected = { ...original, id: 'copied-model', options: { ...original.options, label: 'Review model' } };
  original.enabled = false;
  draft.display.instances.push(selected);
  const before = JSON.stringify(draft);
  f.behavior.process=(request,next)=>request.operation==='explain' ? {value:reply({
    sample:true,scope:request.payload.scope,width:request.payload.width,actual_availability:'not_observed',
    preview:sample('Explained sample'),instances:request.payload.draft.display.instances.map((node:any)=>({
      id:node.id,type_id:node.type_id,enabled:node.enabled,
      reasons:[{code:node.enabled?'configured_on':'configured_off',origin:'configuration'},{code:'actual_not_observed',origin:'unknown'}],
      samples:node.enabled?[{row_id:'main',outcome:'sample_visible',truncated:false}]:[],
    })),
  })} : next();
  await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
  await keys(ui,'down',{key:'e',ctrl:true});await selectSetting(ui,'item-explain');await keys(ui,'return');
  const explanation = await visibleText(ui);
  for (const label of ['Review model', t('explain.examples','en'), t('explain.reason.configured_on','en'), 'Explained sample']) {
    expect(explanation).toContain(label);
  }
  expect(explanation.includes(t('explain.reason.configured_off','en'))).toBe(false);
  await keys(ui,'end');
  const lastPage = await visibleText(ui);
  expect(lastPage).toContain(t('explain.panel_note','en'));
  expect(lastPage).toContain('main:' + selected.id);
  await keys(ui,{key:'g',ctrl:true});
  expect(await selectedSetting(ui,'item-explain')).toBe(true);
  expect(await visibleText(ui)).toContain('Review model');
  expect(f.calls.filter(c=>c.operation==='explain')).toHaveLength(1);
  expect(JSON.stringify(f.store.draft)).toBe(before);
  expect(f.calls.some(c=>c.operation==='apply')).toBe(false);await ui.unmount();
});

test('native Powerline controls save and reopen through the editor protocol', {timeoutMs:20000}, async ($,on) => {
  const f = setup(on);
  await $.session.start(START); await $.command.run(RUN); const ui = await $.ui.mount(PANE);
  await keys(ui, '4');
  for (const key of ['padding','separator','start_cap','end_cap','color_mode']) {
    await selectSetting(ui, 'field:powerline.' + key); await keys(ui, 'right');
  }
  await keys(ui, 's');
  expect(f.store.draft.display.powerline).toEqual({padding:'none',separator:'slash',start_cap:true,end_cap:false,color_mode:'continuous'});
  await ui.unmount(); await $.command.run(RUN); const reopened = await $.ui.mount(PANE);
  expect(f.calls.filter(c=>c.operation==='preview').at(-1)!.payload.draft.display.powerline).toEqual(f.store.draft.display.powerline);
  await reopened.unmount();
});

test('all complete scheme choices can save a copy without publishing the dirty native draft', {timeoutMs:20000}, async ($,on) => {
  const f = setup(on), original = JSON.stringify(f.store.draft);
  f.behavior.process = (request,next) => {
    if (request.operation === 'preset') {
      const candidate = copyDraft(request.payload.draft); candidate.display.theme = 'terminal';
      return {value:reply({draft:candidate})};
    }
    if (request.operation === 'profiles_read' || request.operation === 'profiles_apply')
      return {value:reply({version:1,revision:'1'.repeat(64),profiles:[],bindings:[],
        ...(request.operation === 'profiles_apply' ? {changed:true,backup_dir:'/backup'} : {})})};
    return next();
  };
  await $.session.start(START); await $.command.run(RUN); const ui = await $.ui.mount(PANE);
  await keys(ui, '4', ' ');
  for (const id of ['daily-development','agent-focus','quota-watch']) {
    await keys(ui, {key:'p',ctrl:true}, 'home');
    for (let i=0; i<PRESETS.findIndex(p=>p.id===id); i++) await keys(ui, 'down');
    await keys(ui, 'return', 'end', 'return', 'down', 'down', 'return', 'Copy ' + id, 'return', 'return');
    expect(f.calls.filter(c=>c.operation==='preset').at(-1)!.payload.preset).toBe(id);
    expect(f.calls.filter(c=>c.operation==='profiles_apply').at(-1)!.payload.display.theme).toBe('terminal');
    expect(f.calls.filter(c=>c.operation==='profiles_apply').at(-1)!.payload.display.use_colors).toBe(false);
    await keys(ui, {key:'g',ctrl:true});
  }
  expect(f.calls.some(c=>c.operation==='apply')).toBe(false);
  expect(JSON.stringify(f.store.draft)).toBe(original);
  await ui.unmount();
});
