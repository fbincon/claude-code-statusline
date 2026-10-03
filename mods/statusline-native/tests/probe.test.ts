import { expect, test } from 'claude-code/testing';
import type { ProcessRunResult } from 'claude-code';
import {
  BASE,
  START,
  RUN,
  PANE,
  description,
  readResult,
  output,
  reply,
  sample,
  setup,
} from './fixtures.ts';

test('three pages edit a full draft, save the opening revision and stay open', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  expect(fixture.opens[0]).toEqual({
    id: 'statusline-native',
    title: 'Statusline configuration',
    focus: true,
    closeOnEscape: true,
    rows: 24,
  });
  expect(fixture.calls[0]!.argv).toEqual([
    '/tmp/bin with spaces/claude-statusline',
    'ui',
    '--config-dir',
    '/tmp/config 中文 $`',
  ]);
  const count = fixture.calls.length;
  await ui.redraw(PANE.props);
  expect(fixture.calls.length).toBe(count);
  await ui.select({ key: 'item-main', value: 'git' });
  await ui.press({ key: 'toggle-item' });
  await ui.press({ key: 'move-up' });
  await ui.press({ key: 'page-subagents' });
  await ui.select({ key: 'item-subagent', value: 'status' });
  await ui.press({ key: 'toggle-item' });
  await ui.press({ key: 'page-settings' });
  await ui.press({ key: 'colors' });
  await ui.select({ key: 'palette', value: 'ansi' });
  await ui.select({ key: 'directory-style', value: 'home' });
  await ui.select({ key: 'separator-style', value: 'compact' });
  await ui.select({ key: 'scope-labels', value: 'always' });
  await ui.input({ key: 'padding', text: '2' });
  await ui.input({ key: 'refresh_interval', text: 'event' });
  await ui.press({ key: 'vim-indicator' });
  await ui.press({ key: 'save' });
  const applied = fixture.calls.find((call) => call.operation === 'apply')!;
  expect(applied.payload.expected_revision).toBe('0'.repeat(64));
  expect(applied.payload.draft.display.items).toEqual([
    'git',
    'model-with-effort',
  ]);
  expect(applied.payload.draft.display.subagents.items).toEqual([
    'name',
    'status',
  ]);
  expect(applied.payload.draft.display).toMatchObject({
    use_colors: false,
    palette: 'ansi',
    directory_style: 'home',
    separator_style: 'compact',
    scope_labels: 'always',
  });
  expect(applied.payload.draft.host).toEqual({
    padding: 2,
    refresh_interval: 'event',
    hide_vim_mode_indicator: true,
  });
  expect(
    await ui.find({ type: 'Text', text: 'Tool configuration saved.' }),
  ).toBeDefined();
  expect(await ui.find({ key: 'save' })).toBeDefined();
  await ui.press({ key: 'colors' });
  await ui.press({ key: 'save' });
  expect(
    fixture.calls.filter((call) => call.operation === 'apply')[1]!.payload
      .expected_revision,
  ).toBe('1'.repeat(64));
  expect(fixture.configCalls).toEqual([]);
  await ui.unmount();
});

test('closing discards pending tool and host changes without applying', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'page-settings' });
  await ui.press({ key: 'colors' });
  await ui.press({ key: 'host-verbose' });
  await ui.press({ key: 'close' });
  await ui.unmount();
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  expect(fixture.configCalls).toEqual([]);
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  await reopened.press({ key: 'page-settings' });
  expect((await reopened.find({ key: 'colors' }))?.props.label).toBe(
    'Colors: on',
  );
  expect((await reopened.find({ key: 'host-verbose' }))?.props.label).toBe(
    'Verbose: off',
  );
  await reopened.unmount();
});

test('numeric validation blocks saving and a narrow pane preserves its draft', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'page-settings' });
  await ui.input({ key: 'padding', text: '33', kind: 'change' });
  await ui.press({ key: 'save' });
  expect(await ui.find({ type: 'Text', text: 'Enter 0-32' })).toBeDefined();
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await ui.input({ key: 'padding', text: '4' });
  await ui.press({ key: 'colors' });
  await ui.redraw({ ...PANE.props, bodyColumns: 20 });
  expect(await ui.find({ key: 'save' })).toBeUndefined();
  expect(await ui.find({ type: 'Text', text: 'Draft kept' })).toBeDefined();
  await ui.redraw(PANE.props);
  expect((await ui.find({ key: 'padding' }))?.props.value).toBe('4');
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: off');
  await ui.unmount();
});

test('host preferences apply separately and report partial refusals', async ($, on) => {
  const fixture = setup(on);
  fixture.behavior.configSet = (key, value) =>
    key === 'verbose' ? { deny: 'Policy refuses verbose' } : { value };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'page-settings' });
  await ui.select({ key: 'host-theme', value: 'light' });
  await ui.press({ key: 'host-verbose' });
  await ui.press({ key: 'apply-host' });
  expect(
    await ui.find({ type: 'Text', text: 'Theme: Applied.' }),
  ).toBeDefined();
  expect(
    await ui.find({ type: 'Text', text: 'Policy refuses verbose' }),
  ).toBeDefined();
  expect((await ui.find({ key: 'host-theme' }))?.props.value).toBe('light');
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('locked, missing and concurrently changed host rows are not overwritten', async ($, on) => {
  const fixture = setup(on);
  fixture.store.rows[0]!.isLocked = true;
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'page-settings' });
  expect(await ui.find({ key: 'host-theme' })).toBeUndefined();
  expect(
    await ui.find({ type: 'Text', text: 'locked by host policy' }),
  ).toBeDefined();
  await ui.press({ key: 'host-verbose' });
  fixture.store.rows[1]!.value = true;
  await ui.press({ key: 'apply-host' });
  expect(
    await ui.find({ type: 'Text', text: 'Changed elsewhere' }),
  ).toBeDefined();
  expect(fixture.configCalls).toEqual([]);
  fixture.store.rows = [];
  await ui.press({ key: 'reload' });
  await ui.press({ key: 'page-settings' });
  expect(
    await ui.find({ type: 'Text', text: 'theme: unavailable' }),
  ).toBeDefined();
  await ui.unmount();
});

test('a rejected save retains the draft and explicit reload reads the changed state', async ($, on) => {
  const fixture = setup(on);
  fixture.behavior.process = (request, next) => {
    return request.operation === 'apply'
      ? {
          value: output(
            JSON.stringify({
              protocol_version: 1,
              error: {
                code: 'configuration_conflict',
                message: 'Changed elsewhere',
              },
            }),
            2,
          ),
        }
      : next();
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'page-settings' });
  await ui.press({ key: 'colors' });
  await ui.press({ key: 'save' });
  expect(
    await ui.find({ type: 'Text', text: 'configuration_conflict' }),
  ).toBeDefined();
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: off');
  await ui.press({ key: 'reload' });
  await ui.press({ key: 'page-settings' });
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  expect(fixture.store.draft).toEqual(BASE);
  await ui.unmount();
});

test('uncertain save results must be reconciled before retry or close', async ($, on) => {
  const fixture = setup(on);
  let applies = 0;
  fixture.behavior.process = (request, next) => {
    if (request.operation !== 'apply') return next();
    applies += 1;
    fixture.store.draft = request.payload.draft;
    fixture.store.revision = '2'.repeat(64);
    return { value: output('{') };
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'page-settings' });
  await ui.press({ key: 'colors' });
  await ui.press({ key: 'save' });
  expect(await ui.find({ key: 'save' })).toBeUndefined();
  await ui.press({ key: 'close' });
  expect(await ui.find({ key: 'reconcile' })).toBeDefined();
  await ui.press({ key: 'reconcile' });
  expect(
    await ui.find({
      type: 'Text',
      text: 'submitted tool configuration is saved',
    }),
  ).toBeDefined();
  expect(await ui.find({ key: 'save' })).toBeDefined();
  expect(applies).toBe(1);
  await ui.unmount();
});

test('applying locks controls and closing until the write completes', async ($, on) => {
  const fixture = setup(on);
  let finish!: (value: ProcessRunResult) => void;
  let started!: () => void;
  const pending = new Promise<ProcessRunResult>((resolve) => {
    finish = resolve;
  });
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  fixture.behavior.process = async (request, next) => {
    if (request.operation !== 'apply') return next();
    started();
    return { value: await pending };
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const saving = ui.press({ key: 'save' });
  await begun;
  await ui.redraw(PANE.props);
  expect(await ui.find({ key: 'save' })).toBeUndefined();
  await ui.press({ key: 'close' });
  finish(
    reply({
      ...readResult(BASE, '1'.repeat(64)),
      changed: false,
      backup_dir: null,
    }),
  );
  await saving;
  expect(await ui.find({ key: 'save' })).toBeDefined();
  await ui.unmount();
});

test('backend opening failures and preview retry recover without losing drafts', async ($, on) => {
  const fixture = setup(on);
  let failure: Error | ProcessRunResult | null = output('{');
  fixture.behavior.process = (request, next) =>
    failure instanceof Error
      ? { deny: failure.message }
      : failure
        ? { value: failure }
        : next();
  await $.session.start(START);
  for (const error of [
    output('{'),
    output('usage: unsupported ui', 2),
    new Error('Process timed out'),
  ]) {
    failure = error;
    await $.command.run(RUN);
    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ key: 'save' })).toBeUndefined();
    expect(
      await ui.find({ type: 'Text', text: 'Could not open' }),
    ).toBeDefined();
    await ui.press({ key: 'close' });
    await ui.unmount();
  }
  failure = null;
  await $.command.run(RUN);
  let previews = 0;
  fixture.behavior.process = (request, next) => {
    if (request.operation === 'preview' && ++previews === 1)
      return { deny: 'Preview timed out' };
    return next();
  };
  const ui = await $.ui.mount(PANE);
  expect(
    await ui.find({ type: 'Text', text: 'Preview timed out' }),
  ).toBeDefined();
  await ui.press({ key: 'retry' });
  expect(await ui.find({ key: 'save' })).toBeDefined();
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('stale preview and opening responses cannot replace a resized or closed editor', async ($, on) => {
  const fixture = setup(on);
  let resolveOld!: (value: ProcessRunResult) => void;
  let started!: () => void;
  const oldStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const old = new Promise<ProcessRunResult>((resolve) => {
    resolveOld = resolve;
  });
  fixture.behavior.process = async (request, next) => {
    if (request.operation === 'preview' && request.payload.width === 40) {
      started();
      return { value: await old };
    }
    return next();
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const older = ui.redraw({ ...PANE.props, bodyColumns: 40 });
  await oldStarted;
  await ui.redraw({ ...PANE.props, bodyColumns: 30 });
  resolveOld(reply(sample('stale width 40')));
  await older;
  expect(await ui.find({ type: 'Text', text: 'width=30' })).toBeDefined();
  expect(
    await ui.find({ type: 'Text', text: 'stale width 40' }),
  ).toBeUndefined();
  await ui.press({ key: 'close' });
  await ui.unmount();
  let finish!: (value: ProcessRunResult) => void;
  let began!: () => void;
  const pending = new Promise<ProcessRunResult>((resolve) => {
    finish = resolve;
  });
  const begun = new Promise<void>((resolve) => {
    began = resolve;
  });
  fixture.behavior.process = async (request, next) => {
    if (request.operation !== 'read') return next();
    began();
    return { value: await pending };
  };
  const opening = $.command.run(RUN);
  await begun;
  const loading = await $.ui.mount(PANE);
  await loading.press({ key: 'close' });
  finish(reply(readResult()));
  await opening;
  await loading.redraw();
  expect(await loading.find({ key: 'save' })).toBeUndefined();
  await loading.unmount();
});

test('command collisions and foreign panes pass through', async ($, on) => {
  const fixture = setup(on);
  fixture.commands = [
    {
      name: RUN.command,
      description: 'Foreign',
      source: 'plugin',
      plugin: 'other',
    },
  ];
  await $.session.start(START);
  expect((await $.command.run(RUN)).text).toBe('foreign command');
  expect(fixture.registered).toBe(false);
  const ui = await $.ui.mount({ ...PANE, requestId: 'foreign' });
  expect(await ui.find({ type: 'Text', text: 'foreign pane' })).toBeDefined();
  await ui.unmount();
});

test(
  'the installed primary command opens the editor and refuses foreign commands independently',
  { options: { primaryCommand: true } },
  async ($, on) => {
    const fixture = setup(on);
    await $.session.start(START);
    await $.command.run({ ...RUN, command: 'statusline-configure' });
    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ key: 'save' })).toBeDefined();
    await ui.press({ key: 'close' });
    await ui.unmount();
    fixture.commands = [
      {
        name: 'statusline-configure',
        description: 'Foreign',
        source: 'plugin',
        plugin: 'other',
      },
    ];
    await $.session.start(START);
    expect(
      (await $.command.run({ ...RUN, command: 'statusline-configure' })).text,
    ).toBe('foreign command');
    await $.command.run(RUN);
    const alias = await $.ui.mount(PANE);
    expect(await alias.find({ key: 'save' })).toBeDefined();
    await alias.unmount();
  },
);

test('session reload discards pending drafts and numeric focus exit cancels unaccepted values', async ($, on) => {
  setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'page-settings' });
  await ui.input({ key: 'padding', text: '9', kind: 'change' });
  await $.ui.focus({
    component: 'Pane',
    requestId: 'statusline-native',
    origin: { kind: 'person' },
  });
  await ui.redraw();
  expect((await ui.find({ key: 'padding' }))?.props.value).toBe('0');
  await ui.press({ key: 'colors' });
  await $.session.start(START);
  await $.command.run(RUN);
  await ui.redraw();
  await ui.press({ key: 'page-settings' });
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  await ui.unmount();
});
