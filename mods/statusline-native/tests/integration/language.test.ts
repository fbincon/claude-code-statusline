import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, output } from '../fixtures.ts';
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
    ? {value:output(JSON.stringify({protocol_version:5,error:{code:'io_error',message:'Storage refused.',localization:null}}),2)} : next();
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
