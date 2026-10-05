import { MAIN_ITEM_IDS } from '../../lib/generated-contracts.ts';
import { expect, test } from 'claude-code/testing';
import type { ProcessRunResult } from 'claude-code';
import {
  BASE,
  START,
  RUN,
  PANE,
  readResult,
  output,
  reply,
  sample,
  setup,
  keys,
} from '../fixtures.ts';

const REGION = 'statusline-client';
const error = (code: string) =>
  output(
    JSON.stringify({
      protocol_version: 3,
      error: { code, message: 'Test save refused.' },
    }),
    2,
  );

test('Client owns only native command, edits three pages and saves a full revision-bound draft', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  expect(fixture.registrations).toEqual(['statusline-configure-native']);
  expect(
    (await $.command.run({ ...RUN, command: 'statusline-configure' })).text,
  ).toBe('foreign command');
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  expect(await ui.find({ type: 'Client', key: REGION })).toBeDefined();
  expect(fixture.calls[0]!.argv).toEqual([
    '/tmp/bin with spaces/claude-statusline',
    'ui',
    '--config-dir',
    '/tmp/config 中文 $`',
  ]);
  const count = fixture.calls.length;
  await ui.redraw(PANE.props);
  expect(fixture.calls.length).toBe(count);
  await keys(ui, '/', 'g', 'i', 't', 'return', ' ', 'left');
  await keys(ui, '2', '/', 's', 't', 'a', 't', 'u', 's', 'return', 'down', ' ');
  await keys(
    ui,
    '3',
    ' ',
    'down',
    'right',
    'down',
    'right',
    'down',
    'right',
    'down',
    'right',
  );
  await keys(ui, 'down', 'return', { key: 'u', ctrl: true }, '2', 'return');
  await keys(
    ui,
    'down',
    'return',
    { key: 'u', ctrl: true },
    'e',
    'v',
    'e',
    'n',
    't',
    'return',
  );
  await keys(ui, 'down', ' ', 's');
  const applied = fixture.calls.find((call) => call.operation === 'apply')!;
  expect(applied.payload.expected_revision).toBe('0'.repeat(64));
  expect(applied.payload.draft.display.items).toContain('git');
  expect(applied.payload.draft.display.subagents.items).not.toContain(
    'status-elapsed',
  );
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
    await ui.find({
      in: REGION,
      type: 'Text',
      text: 'Tool configuration saved.',
    }),
  ).toBeDefined();
  expect(fixture.closes).toHaveLength(0);
  await keys(ui, 's');
  expect(
    fixture.calls.filter((call) => call.operation === 'apply')[1]!.payload
      .expected_revision,
  ).toBe('1'.repeat(64));
  expect(fixture.configCalls).toEqual([]);
  await ui.unmount();
});

test('reopening focuses the same draft; q discards and the next opening reads persisted state', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', ' ');
  const reads = fixture.calls.filter((c) => c.operation === 'read').length;
  await $.command.run(RUN);
  await ui.redraw();
  expect(fixture.calls.filter((c) => c.operation === 'read')).toHaveLength(
    reads,
  );
  expect(
    await ui.find({ in: REGION, type: 'Text', text: /Colors\s+off/ }),
  ).toBeDefined();
  await keys(ui, 'q');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  await keys(reopened, '3');
  expect(
    await reopened.find({ in: REGION, type: 'Text', text: /Colors\s+on/ }),
  ).toBeDefined();
  await reopened.unmount();
});

test('search reserves ordinary shortcuts; Ctrl+G restores filter and numeric editing', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '/', 's', 'f', 'q');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  expect(fixture.closes).toHaveLength(0);
  await keys(
    ui,
    { key: 'g', ctrl: true },
    '3',
    'down',
    'down',
    'down',
    'down',
    'down',
    'return',
    { key: 'u', ctrl: true },
    '9',
  );
  // Focus exit (Esc) is host-owned and does not cancel Client editing.
  await $.ui.focus({
    component: 'Pane',
    requestId: 'statusline-native',
    origin: { kind: 'person' },
  });
  await ui.redraw();
  expect(
    await ui.find({ in: REGION, type: 'Text', text: '9 _' }),
  ).toBeDefined();
  await keys(ui, { key: 'g', ctrl: true }, 's');
  expect(fixture.store.draft.host.padding).toBe(0);
  await ui.unmount();
});

test('invalid numeric input stays visible and cannot save; correcting it accepts only that field', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(
    ui,
    '3',
    'down',
    'down',
    'down',
    'down',
    'down',
    'return',
    { key: 'u', ctrl: true },
    '9',
    '9',
    'return',
  );
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'Enter 0-32' }),
  ).toBeDefined();
  await keys(ui, 's');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await keys(ui, { key: 'u', ctrl: true }, '3', '2', 'return', 's');
  expect(fixture.store.draft.host.padding).toBe(32);
  await ui.unmount();
});

test('foreign native command and foreign panes pass through without changing the external entry', async ($, on) => {
  const fixture = setup(on);
  fixture.commands.push({
    name: RUN.command,
    description: 'foreign',
    plugin: 'foreign',
  } as any);
  await $.session.start(START);
  expect((await $.command.run(RUN)).text).toBe('foreign command');
  expect(
    (await $.command.run({ ...RUN, command: 'statusline-configure' })).text,
  ).toBe('foreign command');
  const ui = await $.ui.mount({ ...PANE, requestId: 'foreign' });
  expect(await ui.find({ type: 'Text', text: 'foreign pane' })).toBeDefined();
  expect(fixture.calls).toHaveLength(0);
  await ui.unmount();
});

test('unknown saves require read reconciliation before retry or close', async ($, on) => {
  const fixture = setup(on);
  let applies = 0;
  fixture.behavior.process = (request, next) => {
    if (request.operation !== 'apply') return next();
    applies++;
    fixture.store.draft = request.payload.draft;
    fixture.store.revision = '2'.repeat(64);
    return { value: output('{') };
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', ' ', 'f', 's', 'q');
  expect(applies).toBe(1);
  expect(fixture.closes).toHaveLength(0);
  await keys(ui, 'k');
  expect(
    await ui.find({
      in: REGION,
      type: 'Text',
      text: 'submitted tool configuration is saved',
    }),
  ).toBeDefined();
  expect(applies).toBe(1);
  expect(fixture.closes).toHaveLength(0);
  await ui.unmount();
});

test('conflicting save retains the draft; explicit reload reads external changes', async ($, on) => {
  const fixture = setup(on);
  let reject = true;
  fixture.behavior.process = (request, next) =>
    request.operation === 'apply' && reject
      ? { value: error('configuration_conflict') }
      : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', ' ', 'f');
  expect(fixture.closes).toHaveLength(0);
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'configuration_conflict' }),
  ).toBeDefined();
  expect(
    await ui.find({ in: REGION, type: 'Text', text: /Colors\s+off/ }),
  ).toBeDefined();
  fixture.store.draft.display.palette = 'ansi';
  await keys(ui, 'r', '3');
  expect(
    await ui.find({ in: REGION, type: 'Text', text: /Colors\s+on/ }),
  ).toBeDefined();
  reject = false;
  await keys(ui, 'f');
  expect(fixture.closes).toHaveLength(1);
  await ui.unmount();
});

test('Claude preferences are separate, checked per row and retain partial application', async ($, on) => {
  const fixture = setup(on);
  fixture.behavior.configSet = (key, value) =>
    key === 'verbose' ? { deny: 'policy' } : { value };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', 'h', 'right', 'down', ' ', 'f');
  expect(fixture.closes).toHaveLength(0);
  expect(fixture.configCalls).toHaveLength(0);
  await keys(ui, 'a');
  expect(fixture.configCalls).toEqual([
    { key: 'theme', value: 'light' },
    { key: 'verbose', value: true },
  ]);
  expect(fixture.store.rows[0]!.value).toBe('light');
  expect(fixture.store.rows[1]!.value).toBe(false);
  await keys(ui, 'q');
  expect(fixture.closes).toHaveLength(1);
  await ui.unmount();
});

test('missing, locked and concurrently changed Claude rows cannot be overwritten', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', 'h', 'right', 'down', ' ');
  fixture.store.rows[0]!.value = 'light';
  fixture.store.rows[1]!.isLocked = true;
  await keys(ui, 'a');
  expect(fixture.configCalls).toHaveLength(0);
  await ui.unmount();
});

test('full and compact layouts keep selection through paging, filtering and resize', async ($, on) => {
  setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, bodyColumns: 72 },
  });
  expect(
    (await ui.find({ in: REGION, key: 'content-region' }))?.props.borderStyle,
  ).toBe('round');
  await keys(ui, 'end');
  await ui.redraw({
    ...PANE.props,
    bodyColumns: 32,
    scroll: { offset: 0, bodyRows: 12 },
  });
  await ui.resize({ columns: 32, rows: 12 });
  expect(
    (await ui.find({ in: REGION, key: 'content-region' }))?.props.borderStyle,
  ).toBeUndefined();
  expect(
    await ui.find({ in: REGION, key: 'item-main:' + MAIN_ITEM_IDS[MAIN_ITEM_IDS.length - 1] }),
  ).toBeDefined();
  await keys(ui, 'pageup', 'pagedown', 'home', 'down');
  await ui.redraw({
    ...PANE.props,
    bodyColumns: 31,
    scroll: { offset: 0, bodyRows: 12 },
  });
  expect(
    await ui.find({ type: 'Text', text: 'Resize pane to 32x12' }),
  ).toBeDefined();
  await ui.redraw({ ...PANE.props, bodyColumns: 72 });
  await ui.resize({ columns: 72, rows: 24 });
  expect(
    await ui.find({ in: REGION, key: 'item-main:fast-mode' }),
  ).toBeDefined();
  await ui.unmount();
});

test('Client fault and retry preserve received edits; old epoch and malformed posts are ignored safely', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', ' ');
  const before = (await ui.find({ key: REGION }))!.props.props as any;
  await ui.post({ epoch: before.epoch, fault: 'injected Client failure' });
  expect(
    await ui.find({ type: 'Text', text: 'Received draft kept' }),
  ).toBeDefined();
  await ui.press({ key: 'retry-client' });
  expect(
    await ui.find({ in: REGION, type: 'Text', text: /Colors\s+off/ }),
  ).toBeDefined();
  await ui.post({
    epoch: before.epoch,
    columns: 60,
    rows: 24,
    events: [{ seq: 1, event: { key: 's' } }],
  });
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await ui.post({ epoch: 'bad' });
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'Invalid Client input' }),
  ).toBeDefined();
  await ui.unmount();
});

test('ordered cumulative batches preserve fast edits, deduplicate writes and reject sequence gaps', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const props = (await ui.find({ key: REGION }))!.props.props as any;
  const batch = {
    epoch: props.epoch,
    columns: 60,
    rows: 24,
    events: [
      { seq: 1, event: { key: '3' } },
      { seq: 2, event: { key: ' ' } },
      { seq: 3, event: { key: 's' } },
    ],
  };
  await ui.post(batch);
  await ui.post(batch);
  expect(fixture.calls.filter((c) => c.operation === 'apply')).toHaveLength(1);
  expect(fixture.store.draft.display.use_colors).toBe(false);
  await ui.post({ ...batch, events: [{ seq: 5, event: { key: 'f' } }] });
  expect(fixture.closes).toHaveLength(0);
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'sequence is incomplete' }),
  ).toBeDefined();
  await ui.unmount();
});

test('opening errors can retry and preview failures do not mutate drafts', async ($, on) => {
  const fixture = setup(on);
  let fail = true;
  fixture.behavior.process = (request, next) =>
    fail && request.operation === 'describe'
      ? { deny: 'process refused' }
      : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  expect(await ui.find({ key: 'retry-client' })).toBeDefined();
  fail = false;
  await ui.press({ key: 'retry-client' });
  expect(await ui.find({ type: 'Client', key: REGION })).toBeDefined();
  await keys(ui, 'f');
  expect(fixture.closes).toHaveLength(1);
  await ui.unmount();
});

test('pending apply blocks input, close and reopening until the result arrives', async ($, on) => {
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
  const saving = keys(ui, 's');
  await begun;
  await ui.redraw();
  await ui.press({ key: 'close' });
  expect(fixture.closes).toHaveLength(0);
  expect((await $.command.run(RUN)).text).toContain('pending save');
  await keys(ui, ' ', 's');
  finish(
    reply({
      ...readResult(BASE, '1'.repeat(64)),
      changed: false,
      backup_dir: null,
    }),
  );
  await saving;
  expect(fixture.calls.filter((c) => c.operation === 'apply')).toHaveLength(1);
  await ui.unmount();
});

test('preview errors can retry; height-only redraws reuse the cached sample', async ($, on) => {
  const fixture = setup(on);
  let previews = 0;
  fixture.behavior.process = (request, next) =>
    request.operation === 'preview'
      ? ++previews === 1
        ? { deny: 'Preview timed out' }
        : { value: reply(sample('recovered sample')) }
      : next();
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'Preview timed out' }),
  ).toBeDefined();
  await keys(ui, 'v');
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'recovered sample' }),
  ).toBeDefined();
  const count = previews;
  await ui.redraw({ ...PANE.props, scroll: { offset: 0, bodyRows: 30 } });
  expect(previews).toBe(count);
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('late sample responses cannot replace a newer resized preview', async ($, on) => {
  const fixture = setup(on);
  let resolveOld!: (value: ProcessRunResult) => void;
  let started!: () => void;
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<ProcessRunResult>((resolve) => {
    resolveOld = resolve;
  });
  fixture.behavior.process = async (request, next) => {
    if (request.operation !== 'preview') return next();
    if (request.payload.width === 60) {
      started();
      return { value: await pending };
    }
    return { value: reply(sample('new width sample')) };
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await begun;
  await ui.redraw({ ...PANE.props, bodyColumns: 72 });
  resolveOld(reply(sample('stale sample')));
  await ui.redraw();
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'new width sample' }),
  ).toBeDefined();
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'stale sample' }),
  ).toBeUndefined();
  await ui.unmount();
});

test('a fast printable terminal chunk enters search and retains all characters', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '/git');
  expect(
    await ui.find({ in: REGION, type: 'Text', text: 'Filter: git' }),
  ).toBeDefined();
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await keys(ui, { key: 'g', ctrl: true });
  expect(
    await ui.find({ in: REGION, key: 'item-main:model-with-effort' }),
  ).toBeDefined();
  await ui.unmount();
});
