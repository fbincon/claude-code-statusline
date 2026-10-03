import { expect, test } from 'claude-code/testing';

const START = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const;
const RUN = { command: 'statusline-configure-native', args: '', origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 } } as const;
const PANE = { plugin: 'statusline-native', surface: 'terminal', component: 'Pane',
  requestId: 'statusline-native', viewport: { columns: 100, rows: 30 },
  props: { title: 'Probe', isFocused: true, bodyColumns: 60, placement: 'inline',
    scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const;

test('the command requests focus and Esc close; toggles are transient', async ($, on) => {
  const opens: unknown[] = [];
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [] }));
  on('command.register', () => ({ value: { command: 'statusline-configure-native' } }));
  on('ui.open', ($, e) => { opens.push(e); return { value: { isPlaced: true } }; });
  on('ui.close', () => ({ value: undefined }));
  await $.session.start(START);
  await $.command.run(RUN);
  expect(opens[0]).toEqual({ id: 'statusline-native', title: 'Statusline native probe', focus: true, closeOnEscape: true });
  const ui = await $.ui.mount(PANE);
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  await ui.press({ key: 'colors' });
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: off');
  await ui.press({ key: 'close' });
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect((await reopened.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  await reopened.unmount();
});

test('a command collision passes through without registering or opening', async ($, on) => {
  let registered = false;
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [{ name: 'statusline-configure-native', description: 'Foreign', source: 'plugin', plugin: 'other' }] }));
  on('command.register', () => { registered = true; return { value: { command: RUN.command } }; });
  on('ui.log', () => ({ value: undefined }));
  on('command.run', () => ({ text: 'foreign command' }));
  await $.session.start(START);
  expect((await $.command.run(RUN)).text).toBe('foreign command');
  expect(registered).toBe(false);
});

test('another pane is passed through', async ($, on) => {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['foreign pane'] }));
  const ui = await $.ui.mount({ ...PANE, requestId: 'foreign' });
  expect(await ui.find({ type: 'Text', text: 'foreign pane' })).toBeDefined();
  await ui.unmount();
});
