import { clientKey } from '../fixtures.ts';
import { MAIN_ITEM_IDS } from '../../lib/generated-contracts.ts';
import { expect, test } from 'claude-code/testing';
import type { ProcessRunResult } from 'claude-code';
import type { ClientProps } from '../../lib/session.ts';
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
  selectSetting,
  component,
  previewDraft,
} from '../fixtures.ts';

const REGION = 'statusline-client';
test('native Layout alignment form renders through the Client and persists only after Save', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.draft.display.instances = ['a','b'].map(id => ({ ...component('text'), id, text: id }));
  fixture.store.draft.display.layout = { mode: 'explicit', rows: [['a'],['b']] };
  await $.session.start(START); await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '4'); await selectSetting(ui, 'row-alignment');
  await keys(ui, 'return', 'return', 'down', 'right', 'down', 'right', 'end', 'return');
  const alignment = previewDraft(fixture).display.layout.alignments![0]!;
  expect(alignment.columns).toEqual([[{kind:'instance',id:'a'},{kind:'instance',id:'b'}]]);
  expect(fixture.calls.some(call => call.operation === 'apply')).toBe(false);
  expect(await ui.find({ in: await clientKey(ui), type: 'Text', text: new RegExp(alignment.id) })).toBeDefined();
  await keys(ui, {key:'g',ctrl:true}, 's');
  expect(fixture.store.draft.display.layout.alignments!.length).toBe(1);
  await ui.unmount();
});
const error = (code: string) =>
  output(
    JSON.stringify({
      protocol_version: 25,
      error: { code, message: 'Test save refused.' },
    }),
    2,
  );

test('search and categories use local state without preview processes or writes', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const count = fixture.calls.length;
  await keys(ui, '/', 'git', 'return', {key:'f', ctrl:true}, 'end', 'return', 'left');
  expect(fixture.calls.length).toBe(count);
  expect(fixture.configCalls).toEqual([]);
  await keys(ui, 'q');
  expect(fixture.calls.some(call => call.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('Client owns only native command, edits three pages and saves a full revision-bound draft', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  expect(fixture.registrations.toSorted()).toEqual(['statusline-configure-native', 'statusline-task']);
  expect(
    (await $.command.run({ ...RUN, command: 'statusline-configure' })).text,
  ).toBe('foreign command');
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  expect(await ui.find({ type: 'Client', })).toBeDefined();
  expect(fixture.calls[0]!.argv).toEqual([
    '/tmp/bin with spaces/claude-statusline',
    'ui',
    '--config-dir',
    '/tmp/config 中文 $`',
  ]);
  const count = fixture.calls.length;
  await ui.redraw(PANE.props);
  expect(fixture.calls.length).toBe(count);
  await keys(ui, {key:'a',ctrl:true}, '/', 'g', 'i', 't', 'return', 'return', 'left');
  await keys(ui, '2', '/', 's', 't', 'a', 't', 'u', 's', 'return', 'down', ' ');
  await keys(ui, '3', ' ');
  for (const field of ['palette', 'directory-style', 'separator-style', 'scope-labels']) {
    await selectSetting(ui, field);
    await keys(ui, 'right');
  }
  await selectSetting(ui, 'padding');
  await keys(ui, 'return', { key: 'u', ctrl: true }, '2', 'return');
  await selectSetting(ui, 'refresh_interval');
  await keys(ui, 'return', { key: 'u', ctrl: true }, 'e', 'v', 'e', 'n', 't', 'return');
  await selectSetting(ui, 'vim-indicator');
  await keys(ui, ' ', 's');
  const applied = fixture.calls.find((call) => call.operation === 'apply')!;
  expect(applied.payload.expected_revision).toBe('0'.repeat(64));
  expect(applied.payload.draft.display.instances.filter((i: {enabled:boolean})=>i.enabled).map((i: {type_id:string})=>i.type_id)).toContain('git');
  expect(applied.payload.draft.display.subagents.instances.filter((i: {enabled:boolean})=>i.enabled).map((i: {id:string})=>i.id)).not.toContain(
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
      in: await clientKey(ui),
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

test('reopening focuses the same draft; q discards and the next opening reads persisted state', {timeoutMs: 20000}, async ($, on) => {
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
    await ui.find({ in: await clientKey(ui), type: 'Text', text: /Colors:\s+off/ }),
  ).toBeDefined();
  await keys(ui, 'q');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  await keys(reopened, '3');
  expect(
    await reopened.find({ in: await clientKey(reopened), type: 'Text', text: /Colors:\s+on/ }),
  ).toBeDefined();
  await reopened.unmount();
});

test('search reserves ordinary shortcuts; Ctrl+G restores filter and numeric editing', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '/', 's', 'f', 'q');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  expect(fixture.closes).toHaveLength(0);
  await keys(ui, {key: 'g', ctrl: true}, '3');
  await selectSetting(ui, 'padding');
  await keys(ui, 'return', {key: 'u', ctrl: true}, '9');
  // Focus exit (Esc) is host-owned and does not cancel Client editing.
  await $.ui.focus({
    component: 'Pane',
    requestId: 'statusline-native',
    origin: { kind: 'person' },
  });
  await ui.redraw();
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: '9▏' }),
  ).toBeDefined();
  await keys(ui, { key: 'g', ctrl: true }, 's');
  expect(fixture.store.draft.host.padding).toBe(0);
  await ui.unmount();
});

test('invalid numeric input stays visible and cannot save; correcting it accepts only that field', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3');
  await selectSetting(ui, 'padding');
  await keys(ui, 'return', {key: 'u', ctrl: true}, '9', '9', 'return');
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'Enter 0-32' }),
  ).toBeDefined();
  await keys(ui, 's');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await keys(ui, { key: 'u', ctrl: true }, '3', '2', 'return', 's');
  expect(fixture.store.draft.host.padding).toBe(32);
  await ui.unmount();
});

test('foreign native command and foreign panes pass through without changing the external entry', {timeoutMs: 20000}, async ($, on) => {
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
  expect(fixture.calls.every(call=>call.operation==='read_ui_preferences')).toBe(true);
  await ui.unmount();
});

test('unknown saves require read reconciliation before retry or close', {timeoutMs: 20000}, async ($, on) => {
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
      in: await clientKey(ui),
      type: 'Text',
      text: 'submitted tool configuration is saved',
    }),
  ).toBeDefined();
  expect(applies).toBe(1);
  expect(fixture.closes).toHaveLength(0);
  await ui.unmount();
});

test('conflicting save retains the draft; explicit reload reads external changes', {timeoutMs: 20000}, async ($, on) => {
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
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'configuration_conflict' }),
  ).toBeDefined();
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: /Colors:\s+off/ }),
  ).toBeDefined();
  fixture.store.draft.display.palette = 'ansi';
  await keys(ui, 'r', '3');
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: /Colors:\s+on/ }),
  ).toBeDefined();
  reject = false;
  await keys(ui, 'f');
  expect(fixture.closes).toHaveLength(1);
  await ui.unmount();
});

test('Claude preferences are separate, checked per row and retain partial application', {timeoutMs: 20000}, async ($, on) => {
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

test('missing, locked and concurrently changed Claude rows cannot be overwritten', {timeoutMs: 20000}, async ($, on) => {
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

test('full and compact layouts keep selection through paging, filtering and resize', {timeoutMs: 20000}, async ($, on) => {
  setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, bodyColumns: 72 },
  });
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: /╭─ Main items/ }),
  ).toBeDefined();
  await keys(ui, {key:'a',ctrl:true}, 'end');
  await ui.redraw({
    ...PANE.props,
    bodyColumns: 32,
    scroll: { offset: 0, bodyRows: 12 },
  });
  await ui.resize({ columns: 32, rows: 12 });
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: /╭─ Main items/ }),
  ).toBeUndefined();
  expect(
    {step:'picker-end',found:!!await ui.find({ in: await clientKey(ui), key: 'item-main:' + MAIN_ITEM_IDS[MAIN_ITEM_IDS.length - 1] })},
  ).toEqual({step:'picker-end',found:true});
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
    {step:'picker-return',found:!!await ui.find({ in: await clientKey(ui), key: 'item-main:model' })},
  ).toEqual({step:'picker-return',found:true});
  await ui.unmount();
});

test('Client fault and retry preserve received edits; old epoch and malformed posts are ignored safely', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', ' ');
  const before = (await ui.find({ type: 'Client',  }))!.props.props as any;
  await ui.post({ epoch: before.epoch, fault: 'injected Client failure' });
  expect(
    await ui.find({ type: 'Text', text: 'Received draft kept' }),
  ).toBeDefined();
  await ui.press({ key: 'retry-client' });
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: /Colors:\s+off/ }),
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
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'Invalid Client input' }),
  ).toBeDefined();
  await ui.unmount();
});

test('ordered cumulative batches preserve fast edits, deduplicate writes and reject sequence gaps', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const props = (await ui.find({ type: 'Client',  }))!.props.props as any;
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
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'sequence is incomplete' }),
  ).toBeDefined();
  await ui.unmount();
});

test('opening errors can retry and preview failures do not mutate drafts', {timeoutMs: 20000}, async ($, on) => {
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
  expect(await ui.find({ type: 'Client', })).toBeDefined();
  await keys(ui, 'f');
  expect(fixture.closes).toHaveLength(1);
  await ui.unmount();
});

test('pending apply blocks input, close and reopening until the result arrives', {timeoutMs: 20000}, async ($, on) => {
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

test('preview errors can retry; height-only redraws reuse the cached sample', {timeoutMs: 20000}, async ($, on) => {
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
  const ui = await $.ui.mount({...PANE, props: {...PANE.props, bodyColumns: 120}});
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'Preview timed out' }),
  ).toBeDefined();
  await keys(ui, 'v');
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'recovered sample' }),
  ).toBeDefined();
  const count = previews;
  await ui.redraw({ ...PANE.props, bodyColumns: 120, scroll: { offset: 0, bodyRows: 30 } });
  expect(previews).toBe(count);
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('late sample responses cannot replace a newer resized preview', {timeoutMs: 20000}, async ($, on) => {
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
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'new width sample' }),
  ).toBeDefined();
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'stale sample' }),
  ).toBeUndefined();
  await ui.unmount();
});

test('a fast printable terminal chunk enters search and retains all characters', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '/', 'git');
  expect(
    await ui.find({ in: await clientKey(ui), type: 'Text', text: 'Filter: git' }),
  ).toBeDefined();
  expect(fixture.calls.some((call) => call.operation === 'apply')).toBe(false);
  await keys(ui, { key: 'g', ctrl: true });
  expect(
    await ui.find({ in: await clientKey(ui), key: 'item-main:model-with-effort' }),
  ).toBeDefined();
  await ui.unmount();
});


test('preview fitting reserves the visible frame and refreshes when height changes its width', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.behavior.process = async (request, next) => request.operation === 'preview'
    ? {value: reply(sample(`${request.payload.width} cells`))} : next();
  await $.session.start(START); await $.command.run(RUN);
  const props = {...PANE.props, bodyColumns:72, scroll:{offset:0,bodyRows:24}};
  const ui = await $.ui.mount({...PANE,props});
  expect(await ui.find({in: await clientKey(ui),type:'Text',text:'70 cells'})).toBeDefined();
  await ui.redraw({...props,scroll:{offset:0,bodyRows:16}});
  expect(await ui.find({in: await clientKey(ui),type:'Text',text:'72 cells'})).toBeDefined();
  const count = fixture.calls.filter(call => call.operation === 'preview').length;
  await ui.redraw({...props,scroll:{offset:0,bodyRows:15}});
  expect(fixture.calls.filter(call => call.operation === 'preview').length).toBe(count);
  await ui.unmount();
});
