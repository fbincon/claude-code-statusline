import { expect, mock, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting } from '../fixtures.ts';
import type { ClientProps } from '../../lib/session.ts';
import { previewBackground } from '../../lib/preview-preferences.ts';

test('preview background remembers immediately across cancel/reopen without changing configuration', async ($, on) => {
  const fixture = setup(on);
  mock.store(on, { 'preview-background': 'light' });
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const before = JSON.stringify(fixture.store.draft);
  await keys(ui, '3');
  await selectSetting(ui, 'preview-background');
  const props = async () => (await ui.find({ key: 'statusline-client' }))!.props.props as ClientProps;
  expect((await props()).view.previewBackground).toBe('light');
  await keys(ui, 'right');
  expect((await props()).view.previewBackground).toBe('dark');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await keys(ui, 'q');
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect(((await reopened.find({ key: 'statusline-client' }))!.props.props as ClientProps).view.previewBackground).toBe('dark');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  await reopened.unmount();
});

test('failed background writes restore the remembered choice and keep the draft', async ($, on) => {
  const fixture = setup(on);
  on('store.set', () => { throw new Error('Preference storage refused'); });
  on('store.get', () => ({ value: 'dark' }));
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const before = JSON.stringify(fixture.store.draft);
  await keys(ui, '3');
  await selectSetting(ui, 'preview-background');
  await keys(ui, 'return');
  const view = ((await ui.find({ key: 'statusline-client' }))!.props.props as ClientProps).view;
  expect(view.previewBackground).toBe('dark');
  expect(view.error).toContain('previous choice kept');
  expect(JSON.stringify(fixture.store.draft)).toBe(before);
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('missing or invalid preview preferences retain the previous dark default', () => {
  for (const value of [null, undefined, 'auto', 'LIGHT', {}, 1]) expect(previewBackground(value)).toBe('dark');
  expect(previewBackground('light')).toBe('light');
});
