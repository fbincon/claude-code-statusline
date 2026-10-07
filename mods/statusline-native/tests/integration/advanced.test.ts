import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, reply } from '../fixtures.ts';
import { copyDraft } from '../../lib/editor/draft.ts';
import type { ClientProps } from '../../lib/session.ts';

async function selectSetting(ui: any, key: string) {
  await keys(ui, 'home');
  for (let i = 0; i < 100; i++) {
    const props = (await ui.find({ key: 'statusline-client' }))!.props.props as ClientProps;
    if (props.view.editor?.setting === key) return;
    await keys(ui, 'down');
  }
  throw new Error('Setting could not be selected: ' + key);
}

test('item format and explicit layout save a complete draft while text reserves shortcuts', async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, {key:'e',ctrl:true}, 'return', {key:'u',ctrl:true}, 's', 'f', 'q', '中', '文', 'return');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await selectSetting(ui, 'item:priority');
  await keys(ui, 'return', {key:'u',ctrl:true}, '1', '0', '0', 'return');
  await selectSetting(ui, 'item:max_width');
  await keys(ui, 'return', {key:'u',ctrl:true}, '5', 'return', {key:'g',ctrl:true}, '4', 'home', 'return', 's');
  const d = fixture.store.draft.display;
  expect(d.item_options['model-with-effort']?.label).toBe('sfq中文');
  expect(d.item_options['model-with-effort']?.priority).toBe(100);
  expect(d.item_options['model-with-effort']?.max_width).toBe(5);
  expect(d.layout).toEqual({mode:'explicit',rows:[['model-with-effort']]});
  expect(fixture.calls.filter((c) => c.operation === 'apply').length).toBe(1);
  expect(fixture.calls.find((c) => c.operation === 'apply')!.payload.expected_revision).toBe('0'.repeat(64));
  await ui.unmount();
});

test('preset/import only replace drafts; export includes unsaved draft and cancel avoids saves', async ($, on) => {
  const fixture = setup(on);
  const imported = copyDraft(fixture.store.draft);
  imported.display.formatting.number_format = 'grouped';
  imported.host.padding = 7;
  fixture.behavior.process = (request, next) => {
    if (request.operation === 'import' || request.operation === 'preset') return {value:reply({draft:imported})};
    if (request.operation === 'export') return {value:reply({path:request.payload.path})};
    return next();
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3');
  await selectSetting(ui, 'preset-apply');
  await keys(ui, 'return');
  expect(fixture.calls.some((c) => c.operation === 'preset')).toBe(true);
  expect(fixture.store.draft.host.padding).toBe(0);
  await selectSetting(ui, 'import-file');
  await keys(ui, 'return', {key:'u',ctrl:true}, '/', '中', 'space', '文', '.', 'j', 's', 'o', 'n', 'return');
  expect(fixture.calls.find((c) => c.operation === 'import')!.payload.path).toBe('/中 文.json');
  await selectSetting(ui, 'export-file');
  await keys(ui, 'return', 'return');
  const exported = fixture.calls.find((c) => c.operation === 'export')!;
  expect(exported.payload.draft.host.padding).toBe(7);
  expect(exported.payload.overwrite).toBe(false);
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await keys(ui, 'q');
  expect(fixture.store.draft.host.padding).toBe(0);
  await ui.unmount();
});

test('actual host row aliases apply separately and unavailable behavior rows remain guidance', async ($, on) => {
  const fixture = setup(on);
  fixture.store.rows.push({key:'turnDuration',label:'Show turn duration',kind:'boolean',value:true,provider:{plugin:'engine',tier:'core'},isLocked:false});
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', 'h');
  await selectSetting(ui, 'host-turnDuration');
  await keys(ui, ' ', 'a');
  expect(fixture.configCalls).toEqual([{key:'turnDuration',value:false}]);
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await selectSetting(ui, 'host-effort');
  expect(await ui.find({in:'statusline-client',type:'Text',text:/unavailable.*\/effort/})).toBeDefined();
  await keys(ui, ' ', 'a');
  expect(fixture.configCalls.length).toBe(1);
  await ui.unmount();
});

test('changed host kinds and choices are refused per row while independent rows apply', async ($, on) => {
  const fixture = setup(on);
  fixture.store.rows.push({key:'turnDuration',label:'Show turn duration',kind:'boolean',value:true,provider:{plugin:'engine',tier:'core'},isLocked:false});
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '3', 'h');
  await selectSetting(ui, 'host-theme');
  await keys(ui, 'right');
  await selectSetting(ui, 'host-verbose');
  await keys(ui, ' ');
  await selectSetting(ui, 'host-turnDuration');
  await keys(ui, ' ');
  fixture.store.rows = fixture.store.rows.map((row) => row.key === 'theme' ? {...row,kind:'text'} : row.key === 'turnDuration' ? {...row,isLocked:true} : row);
  await keys(ui, 'a');
  expect(fixture.configCalls).toEqual([{key:'verbose',value:true}]);
  await selectSetting(ui, 'host-theme');
  expect(await ui.find({in:'statusline-client',type:'Text',text:/Changed elsewhere/})).toBeDefined();
  await keys(ui, 'r', '3', 'h');
  fixture.store.rows = fixture.store.rows.map((row) => row.key === 'theme' ? {...row,kind:'choice',options:['dark','light']} : row);
  await keys(ui, 'r', '3', 'h');
  await selectSetting(ui, 'host-theme');
  await keys(ui, 'right');
  fixture.store.rows = fixture.store.rows.map((row) => row.key === 'theme' ? {...row,options:['dark']} : row);
  await keys(ui, 'a');
  expect(fixture.configCalls.length).toBe(1);
  expect(await ui.find({in:'statusline-client',type:'Text',text:/Value no longer fits/})).toBeDefined();
  await ui.unmount();
});
