import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, output, reply, sample } from '../fixtures.ts';
import type { ClientProps } from '../../lib/session.ts';

test('language persists immediately across cancel and reopening while display draft stays independent', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const props = async () => (await ui.find({key: 'statusline-client'}))!.props.props as ClientProps;
  const before = JSON.stringify(fixture.store.draft);
  await keys(ui,'3',' ');
  const draft = JSON.stringify((await props()).view.editor!.draft);
  await selectSetting(ui,'ui-language');
  await keys(ui,'right');
  expect((await props()).view.language).toBe('zh-CN');
  expect((await props()).view.editor!.setting).toBe('ui-language');
  expect(JSON.stringify((await props()).view.editor!.draft)).toBe(draft);
  expect(fixture.store.uiLanguage).toBe('zh-CN');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  expect(fixture.calls.some(c=>c.operation==='apply')).toBe(false);
  expect(await ui.find({in:'statusline-client',type:'Text',text:'配置状态栏'})).toBeDefined();
  await keys(ui,'q');
  await ui.unmount();
  await $.command.run(RUN);
  const reopened=await $.ui.mount(PANE);
  expect(((await reopened.find({key:'statusline-client'}))!.props.props as ClientProps).view.language).toBe('zh-CN');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  await keys(reopened,'3');
  await selectSetting(reopened,'ui-language');
  await keys(reopened,'left');
  expect(fixture.store.uiLanguage).toBe('en');
  await reopened.unmount();
});

test('rejected language write restores the last display language without replacing the draft', {timeoutMs: 20000}, async ($, on) => {
  const fixture=setup(on);
  fixture.behavior.process=(request,next)=>request.operation==='set_ui_language'
    ? {value:output(JSON.stringify({protocol_version:7,error:{code:'io_error',message:'Storage refused.',localization:null}}),2)} : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui=await $.ui.mount(PANE);
  await keys(ui,'3');
  await selectSetting(ui,'ui-language');
  const before=((await ui.find({key:'statusline-client'}))!.props.props as ClientProps).view.editor!.draft;
  await keys(ui,'right');
  const after=((await ui.find({key:'statusline-client'}))!.props.props as ClientProps).view;
  expect(after.language).toBe('en');
  expect(after.error).toContain('Storage refused');
  expect(after.editor!.draft).toEqual(before);
  expect(fixture.store.uiLanguage).toBe('en');
  await ui.unmount();
});

test('initial shared language and bilingual search keep user text and command shortcuts intact', {timeoutMs: 20000}, async ($, on) => {
  const fixture=setup(on);
  fixture.store.uiLanguage='zh-CN';
  await $.session.start(START);
  await $.command.run(RUN);
  const ui=await $.ui.mount(PANE);
  expect(await ui.find({in:'statusline-client',type:'Text',text:'配置状态栏'})).toBeDefined();
  await keys(ui,'/','剩','余','上','下','文','return');
  const data=((await ui.find({key:'statusline-client'}))!.props.props as ClientProps).view.editor!;
  expect(data.search.main).toBe('剩余上下文');
  expect(data.selected.main).toBe('context-remaining');
  expect(data.draft).toEqual(fixture.store.draft);
  await ui.unmount();
});


test('statusline language previews a display draft and cancel discards it in either interface language', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.uiLanguage = 'zh-CN';
  fixture.behavior.process = (request, next) => request.operation === 'preview'
    ? {value: reply(sample(request.payload.draft.display.statusline_language === 'zh-CN' ? '上下文 剩余 73%' : 'Context 73% left'))} : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const view = async () => ((await ui.find({key: 'statusline-client'}))!.props.props as ClientProps).view;
  await keys(ui, '3');
  await selectSetting(ui, 'field:statusline_language');
  await keys(ui, 'right');
  const current = await view();
  expect(current.language).toBe('zh-CN');
  expect(current.editor!.draft.display.statusline_language).toBe('zh-CN');
  expect(current.editor!.setting).toBe('field:statusline_language');
  expect(fixture.store.draft.display.statusline_language).toBe('en');
  expect(fixture.calls.some(c => c.operation === 'apply' || c.operation === 'set_ui_language')).toBe(false);
  expect(await ui.find({in:'statusline-client', type:'Text', text:'上下文 剩余 73%'})).toBeDefined();
  await selectSetting(ui, 'ui-language');
  await keys(ui, 'left');
  expect((await view()).language).toBe('en');
  expect((await view()).editor!.draft.display.statusline_language).toBe('zh-CN');
  await keys(ui, 'q');
  await ui.unmount();
  expect(fixture.store.draft.display.statusline_language).toBe('en');
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect(((await reopened.find({key:'statusline-client'}))!.props.props as ClientProps).view.editor!.draft.display.statusline_language).toBe('en');
  await reopened.unmount();
});

test('saving statusline language persists the complete draft while a refusal retains edits', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  let refused = true;
  fixture.behavior.process = (request, next) => request.operation === 'apply' && refused
    ? {value: output(JSON.stringify({protocol_version:7,error:{code:'io_error',message:'Write refused.',localization:null}}),2)} : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const view = async () => ((await ui.find({key:'statusline-client'}))!.props.props as ClientProps).view;
  await keys(ui, '3', 'right');
  await selectSetting(ui, 'field:statusline_language');
  await keys(ui, 'right');
  expect((await view()).editor!.draft.display.statusline_language).toBe('zh-CN');
  await keys(ui, 'S');
  expect(fixture.store.draft.display.statusline_language).toBe('en');
  expect((await view()).editor!.draft.display.statusline_language).toBe('zh-CN');
  expect((await view()).editor!.draft.display.use_colors).toBe(false);
  expect((await view()).error).toContain('Write refused');
  expect((await view()).uncertain).toBe(true);
  await keys(ui, 'k');
  expect((await view()).uncertain).toBe(false);
  expect((await view()).editor!.draft.display.statusline_language).toBe('zh-CN');
  refused = false;
  await keys(ui, 'S');
  expect(fixture.store.draft.display.statusline_language).toBe('zh-CN');
  expect(fixture.store.draft.display.use_colors).toBe(false);
  expect(fixture.store.uiLanguage).toBe('en');
  expect(fixture.calls.filter(c => c.operation === 'apply')).toHaveLength(2);
  await keys(ui, 'q');
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect(((await reopened.find({key:'statusline-client'}))!.props.props as ClientProps).view.editor!.draft.display.statusline_language).toBe('zh-CN');
  await reopened.unmount();
});
