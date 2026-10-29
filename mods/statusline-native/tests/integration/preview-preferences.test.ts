import { expect, mock, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, visibleText } from '../fixtures.ts';
import { previewBackground } from '../../lib/preview-preferences.ts';

test('preview background remembers immediately across cancel/reopen without changing configuration', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  mock.store(on, { 'preview-background': 'light' });
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const before = JSON.stringify(fixture.store.draft);
  await keys(ui, '3');
  await selectSetting(ui, 'preview-background');
  expect(await visibleText(ui)).toContain('light');
  await keys(ui, 'right');
  expect(await visibleText(ui)).toContain('dark');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await keys(ui, 'q');
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect(await visibleText(reopened)).toContain('dark');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  await reopened.unmount();
});

test('failed background writes restore the remembered choice and keep the draft', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  on('store.set', () => ({ deny: 'Preference storage refused' }));
  on('store.get', () => ({ value: 'dark' }));
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const before = JSON.stringify(fixture.store.draft);
  await keys(ui, '3');
  await selectSetting(ui, 'preview-background');
  await keys(ui, 'return');
  expect(await visibleText(ui)).toContain('dark');
  expect(await visibleText(ui)).toContain('Could not remember the preview background');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('missing or invalid preview preferences retain the previous dark default', () => {
  for (const value of [null, undefined, 'auto', 'LIGHT', {}, 1]) expect(previewBackground(value)).toBe('dark');
  expect(previewBackground('light')).toBe('light');
});
