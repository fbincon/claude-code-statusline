/** One official-host child per interface language, retaining every output pair. */
import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, previewDraft, presentation } from '../fixtures.ts';
import { LANGUAGES, type Language } from '../../lib/i18n/index.ts';

export function registerLanguagePairs(language: Language): void {
  for (const target of LANGUAGES) {
    test(`save, cancel and reopen preserve independent output languages in ${language}/${target}`, {timeoutMs: 30000}, async ($, on) => {
      const fixture = setup(on);
      fixture.store.uiLanguage = language;
      await $.session.start(START);
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
    });
  }
}
