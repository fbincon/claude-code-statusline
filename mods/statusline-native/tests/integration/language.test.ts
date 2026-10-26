import { clientKey } from '../fixtures.ts';
import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, output, reply, sample, previewDraft, presentation, selectedSetting, visibleText } from '../fixtures.ts';
import { LANGUAGES, t } from '../../lib/i18n/index.ts';
import type { Language } from '../../lib/i18n/index.ts';

for (const language of LANGUAGES) {
  test(`save, cancel and reopen preserve independent output languages in ${language}`, {timeoutMs: 30000}, async ($, on) => {
    const fixture = setup(on);
    fixture.store.uiLanguage = language;
    await $.session.start(START);
    for (const target of LANGUAGES) {
      fixture.store.draft.display.statusline_language = 'en';
      await $.command.run(RUN);
      let ui = await $.ui.mount(PANE);
      const choose = async () => {
        await keys(ui, '3');
        await selectSetting(ui, 'field:statusline_language');
        for (let n = 0; n < LANGUAGES.indexOf(target); n++) await keys(ui, 'right');
        const view = await presentation(ui);
        expect(view.language).toBe(language);
        expect(previewDraft(fixture).display.statusline_language).toBe(target);
        expect(fixture.store.draft.display.statusline_language).toBe('en');
      };
      await choose();
      await keys(ui, 'q');
      await ui.unmount();
      expect(fixture.store.draft.display.statusline_language).toBe('en');
      await $.command.run(RUN);
      ui = await $.ui.mount(PANE);
      await choose();
      await keys(ui, 'S');
      expect(fixture.store.draft.display.statusline_language).toBe(target);
      expect(fixture.store.uiLanguage).toBe(language);
      await keys(ui, 'q');
      await ui.unmount();
      await $.command.run(RUN);
      ui = await $.ui.mount(PANE);
      const reopened = await presentation(ui);
      expect(reopened.language).toBe(language);
      expect(previewDraft(fixture).display.statusline_language).toBe(target);
      await keys(ui, 'q');
      await ui.unmount();
    }
  });
}

test('registered languages cycle forwards and backwards without replacing the display draft', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const view = async () => await presentation(ui);
  const headings: Partial<Record<Language, string>> = {
    en: 'Configure Status Line', 'zh-CN': '配置状态栏', 'zh-TW': '設定狀態列',
    ja: 'ステータスライン設定', ko: '상태 표시줄 설정',
  };
  await keys(ui, '3');
  await selectSetting(ui, 'ui-language');
  const draft = JSON.stringify(previewDraft(fixture));
  for (const language of [...LANGUAGES.slice(1), 'en'] as typeof LANGUAGES[number][]) {
    await keys(ui, 'right');
    expect((await view()).language).toBe(language);
    expect(fixture.store.uiLanguage).toBe(language);
    expect(await ui.find({in: await clientKey(ui), type:'Text', text:headings[language] ?? t('native.ui.client.draw.configure_status_line', language)})).toBeDefined();
    expect(JSON.stringify(previewDraft(fixture))).toBe(draft);
  }
  await keys(ui, 'left');
  const lastLanguage = LANGUAGES[LANGUAGES.length - 1]!;
  expect(fixture.store.uiLanguage).toBe(lastLanguage);
  await selectSetting(ui, 'field:statusline_language');
  for (const language of [...LANGUAGES.slice(1), 'en'] as typeof LANGUAGES[number][]) {
    await keys(ui, 'right');
    expect(previewDraft(fixture).display.statusline_language).toBe(language);
    expect(fixture.store.draft.display.statusline_language).toBe('en');
    expect(fixture.store.uiLanguage).toBe(lastLanguage);
  }
  await keys(ui, 'q');
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect((await presentation(reopened)).language).toBe(lastLanguage);
  await reopened.unmount();
});

test('language persists immediately across cancel and reopening while display draft stays independent', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const props = async () => await presentation(ui);
  const before = JSON.stringify(fixture.store.draft);
  await keys(ui,'3',' ');
  const draft = JSON.stringify(previewDraft(fixture));
  await selectSetting(ui,'ui-language');
  await keys(ui,'right');
  expect((await props()).language).toBe('zh-CN');
  expect(await selectedSetting(ui, 'ui-language')).toBe(true);
  expect(JSON.stringify(previewDraft(fixture))).toBe(draft);
  expect(fixture.store.uiLanguage).toBe('zh-CN');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  expect(fixture.calls.some(c=>c.operation==='apply')).toBe(false);
  expect(await ui.find({in: await clientKey(ui),type:'Text',text:'配置状态栏'})).toBeDefined();
  await keys(ui,'q');
  await ui.unmount();
  await $.command.run(RUN);
  const reopened=await $.ui.mount(PANE);
  expect((await presentation(reopened)).language).toBe('zh-CN');
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
    ? {value:output(JSON.stringify({protocol_version:24,error:{code:'io_error',message:'Storage refused.',localization:null}}),2)} : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui=await $.ui.mount(PANE);
  await keys(ui,'3');
  await selectSetting(ui,'ui-language');
  const before=previewDraft(fixture);
  await keys(ui,'right');
  const after=await presentation(ui);
  expect(after.language).toBe('en');
  expect(await visibleText(ui)).toContain('Could not confirm the saved interface language');
  expect(previewDraft(fixture)).toEqual(before);
  expect(fixture.store.uiLanguage).toBe('en');
  await ui.unmount();
});

test('initial shared language and bilingual search keep user text and command shortcuts intact', {timeoutMs: 20000}, async ($, on) => {
  const fixture=setup(on);
  fixture.store.uiLanguage='zh-CN';
  await $.session.start(START);
  await $.command.run(RUN);
  const ui=await $.ui.mount(PANE);
  expect(await ui.find({in: await clientKey(ui),type:'Text',text:'配置状态栏'})).toBeDefined();
  await keys(ui,{key:'a',ctrl:true},'/','剩','余','上','下','文','return');
  expect(await visibleText(ui)).toContain('剩余上下文');
  expect(await ui.find({in: await clientKey(ui),key:'item-main:context-remaining'})).toBeDefined();
  expect(previewDraft(fixture)).toEqual(fixture.store.draft);
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
  const view = async () => await presentation(ui);
  await keys(ui, '3');
  await selectSetting(ui, 'field:statusline_language');
  await keys(ui, 'right');
  const current = await view();
  expect(current.language).toBe('zh-CN');
  expect(previewDraft(fixture).display.statusline_language).toBe('zh-CN');
  expect(await selectedSetting(ui, 'field:statusline_language')).toBe(true);
  expect(fixture.store.draft.display.statusline_language).toBe('en');
  expect(fixture.calls.some(c => c.operation === 'apply' || c.operation === 'set_ui_language')).toBe(false);
  expect(await ui.find({in: await clientKey(ui), type:'Text', text:'上下文 剩余 73%'})).toBeDefined();
  await selectSetting(ui, 'ui-language');
  await keys(ui, 'left');
  expect((await view()).language).toBe('en');
  expect(previewDraft(fixture).display.statusline_language).toBe('zh-CN');
  await keys(ui, 'q');
  await ui.unmount();
  expect(fixture.store.draft.display.statusline_language).toBe('en');
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect(previewDraft(fixture).display.statusline_language).toBe('en');
  await reopened.unmount();
});

test('saving statusline language persists the complete draft while a refusal retains edits', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  let refused = true;
  fixture.behavior.process = (request, next) => request.operation === 'apply' && refused
    ? {value: output(JSON.stringify({protocol_version:24,error:{code:'io_error',message:'Write refused.',localization:null}}),2)} : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const view = async () => await presentation(ui);
  await keys(ui, '3', 'right');
  await selectSetting(ui, 'field:statusline_language');
  await keys(ui, 'right');
  expect(previewDraft(fixture).display.statusline_language).toBe('zh-CN');
  await keys(ui, 'S');
  expect(fixture.store.draft.display.statusline_language).toBe('en');
  expect(previewDraft(fixture).display.statusline_language).toBe('zh-CN');
  expect(previewDraft(fixture).display.use_colors).toBe(false);
  expect(await visibleText(ui)).toContain('Write refused');
  expect(await visibleText(ui)).toContain('check');
  await keys(ui, 'k');
  expect(await visibleText(ui)).toContain('No tool changes');
  expect(previewDraft(fixture).display.statusline_language).toBe('zh-CN');
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
  expect(previewDraft(fixture).display.statusline_language).toBe('zh-CN');
  await reopened.unmount();
});
