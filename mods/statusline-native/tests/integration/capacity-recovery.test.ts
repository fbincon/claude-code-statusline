import { expect, test } from 'claude-code/testing';
import type { Elements } from 'claude-code';
import type { ClientProps } from '../../lib/session.ts';
import { withinBudget } from '../../ui/frame.ts';
import { CAPACITY_DESCRIPTION, CAPACITY_VALUES, CAPACITY_CASES } from '../generated-capacity-fixtures.ts';
import type { Draft } from '../../lib/generated-contracts.ts';
import { setup, START, RUN, PANE, keys, reply, output, presentation } from '../fixtures.ts';
import { HOST_VERSION } from '../../.claude-plugin/types/host-version.ts';

for (const failure of ['preflight', 'host'] as const) test(`capacity ${failure} recovery preserves a successful 24-instance save`, {timeoutMs: 30000}, async ($, on) => {
  const fixture = setup(on);
  const baseline = CAPACITY_CASES.find(value => value.name === 'plain-main-w72')!;
  fixture.store.draft = JSON.parse(JSON.stringify(CAPACITY_VALUES[baseline.editor.draft])) as Draft;
  let inject = false, injectedBudget: boolean | null = null;
  on('ui.resolve', { surface: 'terminal', component: 'Pane' }, async ($, e, next) => {
    const table = await next(e) as Elements['terminal'];
    return { ...table, Client: props => {
      if (!inject) return table.Client(props);
      inject = false;
      const before = props.props as ClientProps;
      const broken: ClientProps = { ...before, frame: [['Text', failure === 'host' ? { wrap: 'invalid-wrap' } : {}, [failure === 'preflight' ? 'x'.repeat(60000) : 'Injected host rejection']]] };
      injectedBudget = withinBudget(broken);
      return table.Client({ ...props, props: broken });
    } };
  });
  fixture.behavior.process = (request, next) => {
    if (request.operation === 'describe') return { value: reply({ ...CAPACITY_DESCRIPTION, backend_version: 'test' }) };
    const result = next();
    if (request.operation === 'apply') inject = true;
    return result;
  };
  await $.session.start(START); await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  for (let i = 0; i < 14; i++) await keys(ui, 'd');
  await keys(ui, 's');
  expect(fixture.store.draft.display.instances.length).toBe(24);
  expect(fixture.calls.filter(call => call.operation === 'apply').length).toBe(1);
  const supportsFault = Number(HOST_VERSION.split('.')[2]) >= 289;
  if (failure === 'preflight' || supportsFault) {
    expect(await ui.find({type: 'Text', text: /last save succeeded/})).toBeDefined();
    expect(await ui.find({ type: 'Client', })).toBeUndefined();
  }
  expect(injectedBudget).toBe(failure === 'host');
  // ui.fault is private to its owning plugin: the test's own observer cannot
  // count it. The small malformed drawing reaches host validation; the owned
  // recovery tree above must replace the Client on hosts supporting that event.
  await ui.press({ key: 'retry-client' });
  expect(await ui.find({ type: 'Client',  })).toBeDefined();
  expect((await presentation(ui)).ack).toBe(0);
  expect(fixture.calls.filter(call => call.operation === 'apply').length).toBe(1);
  expect(fixture.store.draft.display.instances.length).toBe(24);
  await keys(ui, 'q'); expect(fixture.closes.length).toBe(1);
  await ui.unmount();
});

test('presentation recovery checks an unknown save by reading without resubmitting', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  let inject = false;
  on('ui.resolve', { surface: 'terminal', component: 'Pane' }, async ($, e, next) => {
    const table = await next(e) as Elements['terminal'];
    return { ...table, Client: props => {
      if (!inject) return table.Client(props);
      inject = false;
      return table.Client({ ...props, props: { ...(props.props as ClientProps), frame: [['Text', {}, ['x'.repeat(60000)]]] } });
    } };
  });
  fixture.behavior.process = (request, next) => {
    const result = next();
    if (request.operation === 'apply') {
      inject = true;
      return { value: output(JSON.stringify({ protocol_version: 28, error: { code: 'io_error', message: 'Reply lost after commit', localization: null } }), 2) };
    }
    return result;
  };
  await $.session.start(START); await $.command.run(RUN); const ui = await $.ui.mount(PANE);
  await keys(ui, '3', ' ', 's');
  expect(await ui.find({type: 'Text', text: /Save outcome unknown/})).toBeDefined();
  expect(await ui.find({key: 'retry-client'})).toBeUndefined();
  await ui.press({key: 'close'}); expect(fixture.closes.length).toBe(0);
  await ui.press({key: 'reconcile'});
  expect(await ui.find({type: 'Text', text: /last save succeeded/})).toBeDefined();
  expect(fixture.calls.filter(call => call.operation === 'apply').length).toBe(1);
  await ui.press({key: 'retry-client'});
  expect(fixture.store.draft.display.use_colors).toBe(false);
  expect(await ui.find({ type: 'Client', })).toBeDefined();
  await ui.unmount();
});

test('bounded colored presentation uses the same page capacity for keys and survives resize', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.draft.display.instances = Array.from({length: 40}, (_, i) => ({
    ...JSON.parse(JSON.stringify(fixture.store.draft.display.instances[0]!)), id: 'row-' + i,
  }));
  fixture.behavior.process = (request, next) => request.operation === 'preview' ? {value: reply({sample: true,
    main: Array.from({length: 3}, () => Array.from({length: request.payload.width}, (_, i) => ({text: 'x', bold: false, background: null, foreground: {kind: 'rgb', value: '#' + i.toString(16).padStart(6, '0')}}))), subagents: []})} : next();
  await $.session.start(START); await $.command.run(RUN);
  const ui = await $.ui.mount({...PANE, viewport: {columns: 528, rows: 206}, props: {...PANE.props, bodyColumns: 500, scroll: {offset: 0, bodyRows: 200}}});
  const first = await presentation(ui);
  expect(first.displayColumns < 500 || first.displayRows < 200).toBe(true);
  expect(first.frame.filter(node => typeof node[1].color === 'string' && node[1].color.startsWith('#')).length > 1).toBe(true);
  await keys(ui, 'pagedown');
  const page = await presentation(ui);
  expect(page.frame.some(node => String(node[1].key).startsWith('item-main:row-'))).toBe(true);
  expect(page.frame.some(node => node[2].some(child => typeof child === 'string' && child.startsWith('›')))).toBe(true);
  expect(withinBudget(page)).toBe(true);
  await ui.redraw({...PANE.props, bodyColumns: 60}); await ui.resize({columns: 60, rows: 24});
  expect(withinBudget(await presentation(ui))).toBe(true);
  await keys(ui, 's');
  expect(fixture.store.draft.display.instances.length).toBe(40);
  expect(fixture.calls.filter(call => call.operation === 'apply').length).toBe(1);
  await ui.unmount();
});
